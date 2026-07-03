# PolePole Whisper sidecar

Self-hosted Swahili **speech-to-text** for the pronunciation / speak-and-check
feature. Runs a local [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
model — no cloud key, no per-minute billing.

```
learner speaks (browser mic)
      │  webm/opus audio
      ▼
.NET  POST /api/speech/assess  ──►  this service  POST /transcribe
      │                                   │  faster-whisper (local)
      │   ◄── transcription + word timings ┘
      ▼
scores word-match / completeness / confidence / wpm  ──►  frontend
```

## Setup

```bash
cd whisper-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8081
```

First run downloads the model (~470 MB for `small`) to your Whisper cache.
`faster-whisper` bundles its own audio decoding (PyAV/ffmpeg), so **no separate
ffmpeg install is required**.

Check it's up: <http://127.0.0.1:8081/health>

## Enable it in the .NET backend

The backend defaults to **disabled** so nothing changes until this service is
running. Turn it on via user-secrets (preferred) or `appsettings.json`:

```bash
cd backend/SwahiliCourse.Api
dotnet user-secrets set "Speech:Enabled" "true"
dotnet user-secrets set "Speech:WhisperUrl" "http://127.0.0.1:8081"
```

Then restart the backend. `GET /api/speech/status` should report `{"enabled":true}`,
and the pronunciation drill's mic button appears in the app.

## Model size vs. quality

| `WHISPER_MODEL` | RAM  | Speed (CPU) | Swahili quality |
|-----------------|------|-------------|-----------------|
| `tiny`          | ~1GB | fastest     | rough           |
| `base`          | ~1GB | fast        | ok              |
| `small`         | ~2GB | moderate    | good (default)  |
| `medium`        | ~5GB | slow        | very good       |
| `large-v3`      | ~10GB| slowest     | best            |

Set with an env var before launching, e.g. `WHISPER_MODEL=medium`. With an
NVIDIA GPU, use `WHISPER_DEVICE=cuda WHISPER_COMPUTE=float16` for a big speedup.

## Notes / limitations

- Whisper is a *transcriber*, so it grades **"did you say the right words?"** —
  not phoneme-level accent. That's the right signal for beginners. For per-sound
  scoring you'd add a pronunciation-assessment pass (e.g. Azure) later; the
  backend response shape already leaves room for it.
- Keep this bound to `127.0.0.1` (localhost). It has no auth — it's an internal
  sidecar the .NET backend talks to, not a public endpoint.
