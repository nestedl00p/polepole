"""
Loads the Kinyarwanda voice and turns text into WAV bytes.

Shared by app.py (the service) and smoke_test.py (the image build check), so
the build exercises exactly the code path a learner's request takes.

The voice is Digital Umuganda's YourTTS model, trained with Coqui TTS:
https://huggingface.co/DigitalUmuganda/KinyarwandaTTS_female_voice (CC-BY-SA 4.0).
It is a multi-speaker model; the speaker is picked by a short reference
recording that ships with it (conditioning_audio.wav).
"""
import io
import json
import os
import threading
import wave
from pathlib import Path

import numpy as np
import torch

VOICE_DIR = Path(os.getenv("TTS_VOICE_DIR", "/opt/voice")).resolve()
# Name the cloned speaker is cached under (<VOICE_DIR>/voices/<name>.pth). The
# first synthesis computes it from the reference recording; later ones reuse it.
SPEAKER = "du_female"
# The authors' config.json points at paths on their own server.
PUBLISHED_PREFIX = "/code/tts-api/KinyarwandaTTS_female_voice/"

_lock = threading.Lock()
_synth = None


def _local_config() -> Path:
    """Write a copy of the published config with its paths pointed at VOICE_DIR."""
    raw = (VOICE_DIR / "config.json").read_text(encoding="utf-8")
    cfg = json.loads(raw.replace(PUBLISHED_PREFIX, VOICE_DIR.as_posix() + "/"))
    # The speaker encoder is referenced by URL upstream; use the bundled copy so
    # nothing is fetched at runtime.
    cfg["model_args"]["speaker_encoder_model_path"] = (VOICE_DIR / "SE_checkpoint.pth.tar").as_posix()
    cfg["model_args"]["speaker_encoder_config_path"] = (VOICE_DIR / "config_se.json").as_posix()
    out = VOICE_DIR / "config.local.json"
    out.write_text(json.dumps(cfg), encoding="utf-8")
    return out


def load():
    """Load the model once. Slow (tens of seconds on CPU)."""
    global _synth
    if _synth is None:
        # Imported here so `import voice` stays cheap for callers that only
        # need the constants.
        from TTS.utils.synthesizer import Synthesizer

        _synth = Synthesizer(
            tts_checkpoint=str(VOICE_DIR / "model.pth"),
            tts_config_path=str(_local_config()),
            tts_speakers_file=str(VOICE_DIR / "speakers.pth"),
            encoder_checkpoint=str(VOICE_DIR / "SE_checkpoint.pth.tar"),
            encoder_config=str(VOICE_DIR / "config_se.json"),
            use_cuda=False,
        )
    return _synth


def synthesize(text: str, rate: float = 1.0) -> bytes:
    """Return `text` spoken in Kinyarwanda as 16-bit mono WAV.

    rate < 1 slows the speech down (0.85 = 15% slower), matching what the
    backend's Tts:Rate means for the cloud voices.
    """
    synth = load()
    rate = min(max(rate, 0.5), 1.5)
    # One synthesis at a time: the model is not thread-safe and length_scale is
    # set on the shared instance.
    with _lock:
        # VITS samples its durations and pitch from noise. A fixed seed makes
        # the same text come out the same on every replica and every rebuild.
        torch.manual_seed(0)
        synth.tts_model.length_scale = 1.0 / rate
        samples = synth.tts(
            text,
            speaker_name=SPEAKER,
            speaker_wav=str(VOICE_DIR / "conditioning_audio.wav"),
            split_sentences=False,
        )
    pcm = (np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(synth.output_sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()
