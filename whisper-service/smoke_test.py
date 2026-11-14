"""
Build-time check for the container image (run by the Dockerfile).

Downloads the model into the image's cache, then transcribes one second of
silence with the same options app.py uses. Loading the model alone is not
enough: a broken audio-decoding dependency only shows up on the first real
transcription, and it should fail the build, not the first learner.
"""
import os
import tempfile
import wave

from faster_whisper import WhisperModel

model = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")

path = os.path.join(tempfile.gettempdir(), "smoke.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(16000)
    w.writeframes(bytes(32000))  # 1 s of 16-bit silence

try:
    segments, info = model.transcribe(
        path, language="sw", word_timestamps=True, vad_filter=True, beam_size=5)
    list(segments)  # the generator is lazy — force the decode
finally:
    os.remove(path)

print(f"smoke test ok: decoded {info.duration:.1f}s")
