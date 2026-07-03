"""
Self-hosted Swahili speech-to-text sidecar for PolePole.

A tiny FastAPI service wrapping faster-whisper. The .NET backend
(SpeechService) POSTs recorded learner audio here; we transcribe it (with
word-level timestamps + confidence) and return JSON. The backend does the
scoring against the target phrase.

No cloud key, no per-minute billing — the Whisper model runs locally on CPU.

Run:
    python -m venv .venv
    .venv\\Scripts\\activate        (Windows)   |   source .venv/bin/activate  (macOS/Linux)
    pip install -r requirements.txt
    uvicorn app:app --host 127.0.0.1 --port 8081

Config via env vars:
    WHISPER_MODEL    tiny | base | small | medium | large-v3   (default: small)
    WHISPER_DEVICE   cpu | cuda                                 (default: cpu)
    WHISPER_COMPUTE  int8 | int8_float16 | float16 | float32    (default: int8)
"""
import os
import tempfile

from fastapi import FastAPI, File, Query, UploadFile
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")

app = FastAPI(title="PolePole Whisper sidecar")

# Loaded once at startup; the first request after boot warms the model.
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE)


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_SIZE, "device": DEVICE, "compute": COMPUTE}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), lang: str = Query("sw")):
    """Transcribe an uploaded audio clip. Returns text + per-word timing/confidence."""
    data = await file.read()

    # faster-whisper decodes via PyAV (bundled ffmpeg), so browser webm/opus,
    # m4a, wav, etc. all work. Write to a temp file for robust seekable decoding.
    suffix = os.path.splitext(file.filename or "")[1] or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        path = tmp.name

    try:
        segments, info = model.transcribe(
            path,
            language=lang or None,
            word_timestamps=True,
            vad_filter=True,          # drop leading/trailing silence
            beam_size=5,
        )

        words = []
        texts = []
        for seg in segments:
            texts.append(seg.text)
            for w in (seg.words or []):
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 4),
                })

        return {
            "text": " ".join(t.strip() for t in texts).strip(),
            "language": info.language,
            "duration": round(info.duration, 3),
            "words": words,
        }
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
