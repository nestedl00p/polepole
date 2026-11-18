"""
Build-time check for the container image (run by the Dockerfile).

Loads the voice and synthesizes one real phrase through the same function the
service uses. Loading alone is not enough of a check: a broken audio or text
dependency only shows up on the first synthesis, and it should fail the build,
not the first learner. It also leaves the cloned-speaker cache in the image, so
a new container does not have to recompute it.
"""
import io
import wave

import voice

audio = voice.synthesize("Mwaramutse", rate=0.85)
with wave.open(io.BytesIO(audio)) as w:
    seconds = w.getnframes() / w.getframerate()

# A greeting takes about a second and a half; far outside that means the model
# produced silence or noise rather than speech.
assert 0.5 < seconds < 6, f"unexpected clip length: {seconds:.2f}s"
print(f"smoke test ok: synthesized {seconds:.2f}s of audio")
