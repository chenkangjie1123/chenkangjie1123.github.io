"""Render the Co-Adaptation project explanation animation.

Requires Pillow and NumPy. MP4/GIF encoding uses ffmpeg.
"""

from pathlib import Path
from functools import lru_cache
import math
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCALE = 4
W, H = 960 * SCALE, 540 * SCALE
EXPORT_SIZE = (1920, 1080)
FPS = 15
FRAMES = 72
BG = (10, 18, 34)
WHITE = (242, 246, 251)
MUTED = (169, 184, 207)
CYAN = (105, 213, 211)
FONT_PATH = "/System/Library/Fonts/SFNS.ttf"


@lru_cache(maxsize=None)
def font(size, weight="regular"):
    paths = [FONT_PATH, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for path in paths:
        if Path(path).exists():
            face = ImageFont.truetype(path, size * SCALE)
            if path == FONT_PATH:
                face.set_variation_by_name({"regular": "Regular", "medium": "Medium", "semibold": "Semibold"}[weight])
            return face
    return ImageFont.load_default(size)


class ScaledDraw:
    """Draw layout coordinates at export resolution without raster upscaling."""

    def __init__(self, image):
        self.draw = ImageDraw.Draw(image)

    @staticmethod
    def coords(values):
        return tuple(round(value * SCALE) for value in values)

    def rounded_rectangle(self, box, radius, width=1, **kwargs):
        self.draw.rounded_rectangle(self.coords(box), radius=radius * SCALE,
                                    width=width * SCALE, **kwargs)

    def ellipse(self, box, width=1, **kwargs):
        self.draw.ellipse(self.coords(box), width=width * SCALE, **kwargs)

    def line(self, coords, width=1, **kwargs):
        self.draw.line(self.coords(coords), width=width * SCALE, **kwargs)

    def polygon(self, points, **kwargs):
        self.draw.polygon([self.coords(point) for point in points], **kwargs)

    def text(self, point, value, **kwargs):
        self.draw.text(self.coords(point), value, **kwargs)


@lru_cache(maxsize=1)
def base():
    im = Image.new("RGBA", (W, H), BG)
    d = ScaledDraw(im)
    d.text((48, 39), "CO-ADAPTATION OF 3DGS", font=font(13, "semibold"), fill=CYAN)
    d.text((48, 70), "How co-adaptation creates color artifacts", font=font(30, "semibold"), fill=WHITE)
    d.line((48, 126, 912, 126), fill=(47, 66, 94), width=1)
    return im


def centered_text(d, box, y, label, size, weight="medium", color=WHITE):
    """Keep component labels centered even when the font metrics change."""
    d.text(((box[0] + box[2]) / 2, y), label, font=font(size, weight), fill=color, anchor="mt")


def panel(d, box, title, caption, caption_color):
    d.rounded_rectangle(box, radius=17, fill=(20, 32, 53), outline=(54, 76, 109), width=1)
    centered_text(d, box, 185, title, 16, "semibold", MUTED)
    centered_text(d, box, 410, caption, 14, "medium", caption_color)


def gaussian_field(im, centers, bounds):
    x0, y0, x1, y1 = [value * SCALE for value in bounds]
    h, w = y1-y0, x1-x0
    yy, xx = np.mgrid[0:h, 0:w]
    field = np.zeros((h, w, 3), dtype=np.float32)
    colors = ((239, 91, 107), (74, 211, 160), (83, 139, 238))
    for (cx, cy), color in zip(centers, colors):
        r = ((xx - (cx*SCALE-x0))/(31*SCALE)) ** 2 + ((yy - (cy*SCALE-y0))/(50*SCALE)) ** 2
        field += np.exp(-r * 1.05)[:, :, None] * np.asarray(color, dtype=np.float32)
    scene = np.array(im.crop((x0, y0, x1, y1)).convert("RGB"), dtype=np.float32)
    scene = np.clip(scene + field, 0, 255).astype("uint8")
    im.paste(Image.fromarray(scene), (x0, y0))


def coadapt_frame(index):
    phase = index / FRAMES
    # Pause at both important viewpoints so the mechanism is readable as a GIF.
    orbit = (1 - math.cos(2 * math.pi * phase)) / 2
    shift = 51 * (orbit ** 1.15)
    im = base().copy()
    d = ScaledDraw(im)
    panel(d, (48, 163, 270, 453), "TRAINING VIEW", "White appearance in input", CYAN)
    panel(d, (690, 163, 912, 453), "NOVEL VIEW", "Color error in new view", (246, 160, 173))
    d.rounded_rectangle((332, 163, 628, 453), radius=17, fill=(16, 27, 47), outline=(54, 76, 109), width=1)
    # An overlapped white projection is held on the left; the actual points separate as the camera rotates.
    d.rounded_rectangle((74, 226, 244, 382), radius=13, fill=(229, 236, 242))
    d.ellipse((124, 269, 194, 339), fill=(255, 255, 255), outline=(201, 213, 223), width=1)
    d.rounded_rectangle((716, 226, 886, 382), radius=13, fill=(229, 236, 242))
    # RGB splats in the new projection become offset as the orbit grows.
    for x, rgb in ((801 - shift*.82, (239, 91, 107)), (801, (74, 211, 160)), (801 + shift*.82, (83, 139, 238))):
        color = tuple(round(240 * (1 - orbit) + component * orbit) for component in rgb)
        ScaledDraw(im).ellipse((x-29, 275, x+29, 333), fill=color)
    layer = Image.new("RGBA", (W, H))
    ScaledDraw(layer).ellipse((772, 275, 830, 333), fill=(255, 255, 255, int(255*(1-orbit))))
    im = Image.alpha_composite(im, layer)
    d = ScaledDraw(im)
    centers = [(480-shift, 303), (480, 303), (480+shift, 303)]
    gaussian_field(im, centers, (350, 213, 610, 390))
    d = ScaledDraw(im)
    for (cx, cy), channel_color in zip(centers, ((239, 91, 107), (74, 211, 160), (83, 139, 238))):
        color = tuple(round(246 * (1 - orbit) + component * orbit) for component in channel_color)
        d.ellipse((cx-3, cy-3, cx+3, cy+3), fill=color)
    for start, end in ((280, 320), (640, 680)):
        d.line((start, 303, end-8, 303), fill=(124, 159, 206), width=3)
        d.polygon([(end, 303), (end-10, 297), (end-10, 309)], fill=(124, 159, 206))
    for center, label, color in ((410, "R", (239, 91, 107)), (480, "G", (74, 211, 160)), (550, "B", (83, 139, 238))):
        centered_text(d, (center-18, 0, center+18, 0), 410, label, 17, "semibold", color)
    return im.convert("RGB")


def render(output):
    output.parent.mkdir(parents=True, exist_ok=True)
    def export_frame(index):
        return coadapt_frame(index).resize(EXPORT_SIZE, Image.Resampling.LANCZOS)

    with tempfile.TemporaryDirectory(prefix="project-animation-") as temp:
        tmp = Path(temp)
        for i in range(FRAMES):
            export_frame(i).save(tmp / f"frame-{i:03}.png", optimize=True)
        source = str(tmp / "frame-%03d.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", source,
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", str(output.with_suffix(".mp4"))], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", source,
                        "-vf", "fps=15,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a",
                        "-loop", "0", str(output.with_suffix(".gif"))], check=True)
        export_frame(FRAMES//2).save(output.with_suffix(".png"), optimize=True)


if __name__ == "__main__":
    render(ROOT / "Co-Adaptation-3DGS/assets/coadapt-explained")
