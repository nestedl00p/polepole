# PolePole Whisper sidecar — container image.
#
# Build context is this directory (whisper-service/), not the repo root:
#   az acr build -r <registry> -t polepole-whisper:<tag> whisper-service
#   docker build -t polepole-whisper whisper-service
#
# The Whisper model is downloaded at BUILD time and baked into the image, so a
# new container starts in seconds and never depends on Hugging Face being up.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/hf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Which model to bake in. `small` is the practical minimum for Swahili.
ARG WHISPER_MODEL=small
ENV WHISPER_MODEL=${WHISPER_MODEL} \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE=int8

# Run unprivileged. The user is created BEFORE the model download so the cache
# is written with the right owner — a chown afterwards would copy the whole
# model into a second image layer.
RUN useradd --create-home --uid 10001 whisper && mkdir -p /opt/hf && chown whisper /opt/hf
USER whisper

# Download the model, then transcribe one second of silence with the exact
# options app.py uses. Loading the model is not enough of a check: a broken
# audio-decoding dependency only shows up on the first real transcription, and
# it is far better for that to fail the build than the first learner.
# (Kept in a file, not an inline `python -c`: the `az acr build` dependency
# scanner reads a continuation line starting with "from" as a FROM instruction
# and aborts the build.)
COPY smoke_test.py .
RUN python smoke_test.py

# The model is local now — never reach out to the hub at runtime. (This also
# means overriding WHISPER_MODEL at runtime to a model that was not baked in
# fails at startup; rebuild with --build-arg WHISPER_MODEL=<size> instead.)
ENV HF_HUB_OFFLINE=1

COPY app.py .

EXPOSE 8081
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8081"]
