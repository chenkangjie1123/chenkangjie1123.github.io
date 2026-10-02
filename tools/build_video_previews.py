"""Build fast-start H.264 previews for the result videos used on both pages.

Run from a full checkout with ffmpeg and ffprobe installed. Originals are not modified.
"""

from pathlib import Path
import json
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
PAGES = (ROOT / "Co-Adaptation-3DGS/index.html", ROOT / "SLGaussian/index.html")
MAX_WIDTH = 768
MIN_SOURCE_SIZE = 200_000


def probe(path):
    result = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,codec_name", "-of", "json", str(path),
    ], text=True)
    return json.loads(result)["streams"][0]


def source_paths():
    for page in PAGES:
        for src in re.findall(r'data-src="([^"]+\.mp4)"', page.read_text()):
            source = (page.parent / src).resolve()
            if source.stat().st_size >= MIN_SOURCE_SIZE:
                yield source


def build_preview(source):
    target = source.with_name(source.stem + ".preview.mp4")
    info = probe(source)
    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(source)]
    if info["width"] > MAX_WIDTH:
        command += ["-vf", f"scale={MAX_WIDTH}:-2:flags=lanczos"]
    command += [
        "-c:v", "libx264", "-preset", "medium", "-crf", "25",
        "-pix_fmt", "yuv420p", "-profile:v", "main", "-movflags", "+faststart",
        "-an", str(target),
    ]
    subprocess.run(command, check=True)
    if target.stat().st_size >= source.stat().st_size:
        target.unlink()
        raise RuntimeError(f"Preview is not smaller than the original: {source}")
    return source.stat().st_size, target.stat().st_size


if __name__ == "__main__":
    sizes = [build_preview(source) for source in sorted(set(source_paths()))]
    original = sum(size[0] for size in sizes)
    preview = sum(size[1] for size in sizes)
    print(f"Built {len(sizes)} previews: {original / 1e6:.1f} MB → {preview / 1e6:.1f} MB")
