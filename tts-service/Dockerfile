# PolePole Kinyarwanda TTS sidecar — container image.
#
# Build context is this directory (tts-service/), not the repo root:
#   az acr build -r <registry> -t polepole-tts:<tag> tts-service
#   docker build -t polepole-tts tts-service
#
# The voice (about 1.1 GB) is downloaded at BUILD time and baked into the
# image, so a new container never depends on Hugging Face being up.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TTS_VOICE_DIR=/opt/voice \
    # numba and matplotlib (pulled in by Coqui) cache next to their packages by
    # default, which the unprivileged user cannot write to.
    NUMBA_CACHE_DIR=/tmp/numba \
    MPLCONFIGDIR=/tmp/matplotlib

WORKDIR /app

# CPU-only PyTorch from its own index: the default wheel drags in several GB
# of CUDA libraries this service never uses.
RUN pip install --no-cache-dir torch==2.8.0 torchaudio==2.8.0 \
      --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Run unprivileged. The user is created BEFORE the download so the voice is
# written with the right owner — a chown afterwards would copy the whole model
# into a second image layer. The folder must stay writable: the service writes
# its patched config and the cloned-speaker cache there.
RUN useradd --create-home --uid 10001 tts && mkdir -p /opt/voice && chown tts /opt/voice
USER tts

# (Python is kept in files, not inline `python -c`: the `az acr build`
# dependency scanner reads a continuation line starting with "from" as a FROM
# instruction and aborts the build.)
COPY download_voice.py .
RUN python download_voice.py /opt/voice

# Synthesize one real phrase with the code the service runs. See smoke_test.py.
COPY voice.py smoke_test.py ./
RUN python smoke_test.py

# The voice is local now — never reach out to the hub at runtime.
ENV HF_HUB_OFFLINE=1

COPY app.py .

EXPOSE 8082
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8082"]
