# PolePole Kinyarwanda TTS sidecar

Self-hosted **text-to-speech** for the Kinyarwanda course. Azure and Google
have no Kinyarwanda voice and neither do browsers or phones, so this service
runs an open model on CPU and the backend caches what it produces.

```
learner taps 🔊
      ▼
.NET  GET /api/tts?text=amazi&course=rw
      │  clip already cached?  ──► yes: served from disk
      ▼  no
this service  POST /synthesize {text, rate}  ──►  WAV (16 kHz mono)
      ▼
.NET caches the clip and returns it
```

## The voice

[DigitalUmuganda/KinyarwandaTTS_female_voice](https://huggingface.co/DigitalUmuganda/KinyarwandaTTS_female_voice)
— a YourTTS model trained with Coqui TTS, licensed **CC-BY-SA 4.0**. Credit
Digital Umuganda wherever the app credits its sources.

`download_voice.py` pins the model to one commit. The checkpoint is a PyTorch
pickle, which executes code when loaded, so do not unpin it or point it at
another repository without reviewing what you are loading.

## Setup (Python 3.11)

```bash
cd tts-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python download_voice.py ./voice        # about 1.1 GB, once
```

Then, with `TTS_VOICE_DIR` pointing at that folder
(`set TTS_VOICE_DIR=./voice` on Windows, `export TTS_VOICE_DIR=./voice` elsewhere):

```bash
uvicorn app:app --host 127.0.0.1 --port 8082
```

Loading the voice takes up to a minute; <http://127.0.0.1:8082/health> answers
once it is ready.

Stay on torch 2.8: from 2.9 on, Coqui TTS refuses to import without
`torchcodec` and system ffmpeg libraries.

## Enable it in the .NET backend

The Kinyarwanda course is silent until a provider is configured for it:

```bash
cd backend/SwahiliCourse.Api
dotnet user-secrets set "Tts:Providers:rw" "Sidecar"
dotnet user-secrets set "Tts:Sidecar:Url" "http://127.0.0.1:8082"
```

Restart the backend. `GET /api/tts/status?course=rw` reports `{"enabled":true}`,
the 🔊 buttons appear in the Kinyarwanda course, and the backend starts
pre-generating that course's clips in the background (`Tts:Sidecar:Warmup`).
`Tts:Provider` is untouched, so the other courses keep their own voice.

## API

| | |
|---|---|
| `GET /health` | `{"ok":true,...}` once the voice is loaded. Open, for platform probes. |
| `POST /synthesize` | JSON `{"text": "...", "rate": 0.85}` → `audio/wav`. `rate` below 1 slows speech. Needs `X-Api-Key` when `TTS_API_KEY` is set. |

The same text and rate always produce the same bytes (the model's randomness
is seeded), so clips do not change between replicas or rebuilds.

## Performance

Measured on an 8-core desktop CPU: about 50 s to load, 2–3 s per short phrase.
Expect both to be slower on a 2 vCPU container. Requests are handled one at a
time.

## Deploying

`bash deploy/azure-tts-deploy.sh` from the repo root — see `deploy/DEPLOY.md`,
"Kinyarwanda audio".
