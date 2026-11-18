"""
Self-hosted Kinyarwanda text-to-speech sidecar for PolePole.

No cloud provider offers a Kinyarwanda voice, so this small FastAPI service
wraps an open model (see voice.py). The .NET backend (TtsService, provider
"Sidecar") POSTs a word or phrase here and caches the WAV it gets back, so
each phrase is synthesized once.

Run locally (Python 3.11):
    python -m venv .venv
    .venv\\Scripts\\activate        (Windows)   |   source .venv/bin/activate  (macOS/Linux)
    pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
    pip install -r requirements.txt
    python download_voice.py ./voice
    set TTS_VOICE_DIR=./voice       (Windows)   |   export TTS_VOICE_DIR=./voice
    uvicorn app:app --host 127.0.0.1 --port 8082

Config via env vars:
    TTS_VOICE_DIR   folder holding the downloaded voice        (default: /opt/voice)
    TTS_API_KEY     shared secret; when set, /synthesize requires it in the
                    X-Api-Key header. Unset (local dev on 127.0.0.1) = open.
                    Always set it when the service is reachable over a network.
    TTS_MAX_CHARS   longest text accepted                       (default: 200)
"""
import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel

import voice

API_KEY = os.getenv("TTS_API_KEY", "").strip()
MAX_CHARS = int(os.getenv("TTS_MAX_CHARS", "200"))

app = FastAPI(title="PolePole Kinyarwanda TTS sidecar")

# Loaded once at startup, so /health only answers once the voice is usable.
voice.load()


def require_api_key(x_api_key: str | None = Header(default=None)):
    """Reject callers without the shared secret. A no-op when no key is set."""
    if not API_KEY:
        return
    # Compare as bytes: compare_digest raises on non-ASCII str input.
    if not hmac.compare_digest((x_api_key or "").encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Missing or invalid X-Api-Key.")


class SynthesisRequest(BaseModel):
    text: str
    rate: float = 1.0


# Deliberately unauthenticated: the container platform's probes call it.
@app.get("/health")
def health():
    return {"ok": True, "voice": voice.SPEAKER, "language": "rw", "auth": bool(API_KEY)}


# A plain `def`, so FastAPI runs it on a worker thread and /health keeps
# answering while a phrase is being synthesized.
@app.post("/synthesize", dependencies=[Depends(require_api_key)])
def synthesize(req: SynthesisRequest):
    """Speak `text` in Kinyarwanda. Returns audio/wav (16 kHz, 16-bit, mono)."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"text is longer than {MAX_CHARS} characters")
    return Response(content=voice.synthesize(text, req.rate), media_type="audio/wav")
