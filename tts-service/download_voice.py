"""
Download the Kinyarwanda voice into a folder (run by the Dockerfile, and by
hand for local development).

    python download_voice.py <target dir>

Pinned to one commit of the model repository. The checkpoint is a PyTorch
pickle, which runs code when it is loaded, so the image must never pick up a
changed file just because the repository moved on. To take a newer version of
the voice, review it and change REVISION.
"""
import sys

from huggingface_hub import snapshot_download

REPO = "DigitalUmuganda/KinyarwandaTTS_female_voice"
REVISION = "b02032eaccec592e9ab5bd1843a31213faad3d31"

target = sys.argv[1] if len(sys.argv) > 1 else "/opt/voice"
snapshot_download(
    REPO,
    revision=REVISION,
    local_dir=target,
    allow_patterns=[
        "model.pth", "config.json", "speakers.pth",
        "SE_checkpoint.pth.tar", "config_se.json", "conditioning_audio.wav",
    ],
)
print(f"voice downloaded to {target}")
