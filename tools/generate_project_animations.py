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
BG = (9, 18, 39)
WHITE = (238, 245, 255)
MUTED = (153, 174, 205)
BLUE = (100, 171, 255)
CYAN = (91, 223, 222)
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size, bold=False):
    paths = ([BOLD_PATH, "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold
             else [FONT_PATH, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    for path in paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size * SCALE)
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
    d.rounded_rectangle((20, 18, 940, 522), radius=26, outline=(64, 91, 139, 110), width=2)
    d.text((48, 43), "CO-ADAPTATION OF 3DGS", font=font(16, True), fill=CYAN)
    d.text((48, 73), "How co-adaptation creates color artifacts", font=font(30, True), fill=WHITE)
    return im


def pill(d, box, label, color=CYAN):
    d.rounded_rectangle(box, radius=15, fill=(32, 49, 77), outline=(82, 114, 158), width=1)
    d.text((box[0]+13, box[1]+7), label, font=font(15, True), fill=color)


def panel(d, box, title):
    d.rounded_rectangle(box, radius=18, fill=(18, 33, 61), outline=(70, 96, 137), width=2)
    d.text((box[0]+18, box[1]+15), title, font=font(17, True), fill=MUTED)


def gaussian_field(im, centers, bounds):
    x0, y0, x1, y1 = [value * SCALE for value in bounds]
    h, w = y1-y0, x1-x0
    yy, xx = np.mgrid[0:h, 0:w]
    field = np.zeros((h, w, 3), dtype=np.float32)
    for (cx, cy), channel in zip(centers, range(3)):
        r = ((xx - (cx*SCALE-x0))/(44*SCALE)) ** 2 + ((yy - (cy*SCALE-y0))/(66*SCALE)) ** 2
        field[:, :, channel] += 246 * np.exp(-r * 1.05)
    opacity = np.max(field, axis=2)
    field += np.stack([opacity*.07, opacity*.09, opacity*.13], axis=2)
    scene = np.array(im.crop((x0, y0, x1, y1)).convert("RGB"), dtype=np.float32)
    scene = np.clip(scene + field, 0, 255).astype("uint8")
    im.paste(Image.fromarray(scene), (x0, y0))


def coadapt_frame(index):
    phase = index / FRAMES
    # Pause at both important viewpoints so the mechanism is readable as a GIF.
    orbit = (1 - math.cos(2 * math.pi * phase)) / 2
    shift = 55 * (orbit ** 1.15)
    im = base().copy()
    d = ScaledDraw(im)
    panel(d, (49, 143, 259, 422), "TRAINING VIEW")
    panel(d, (701, 143, 911, 422), "NOVEL VIEW")
    d.rounded_rectangle((342, 153, 618, 400), radius=18, fill=(13, 27, 51), outline=(66, 94, 135), width=2)
    # An overlapped white projection is held on the left; the actual points separate as the camera rotates.
    d.rounded_rectangle((77, 211, 231, 366), radius=16, fill=(239, 244, 247), outline=(190, 211, 229), width=3)
    d.ellipse((119, 250, 190, 322), fill=(255, 255, 255), outline=(220, 227, 233), width=2)
    d.rounded_rectangle((729, 211, 883, 366), radius=16, fill=(235, 239, 242), outline=(188, 210, 229), width=3)
    # RGB splats in the new projection become offset as the orbit grows.
    for x, rgb in ((806 - shift*.78, (246, 83, 104)), (806, (89, 218, 161)), (806 + shift*.78, (78, 143, 255))):
        color = tuple(round(240 * (1 - orbit) + component * orbit) for component in rgb)
        ScaledDraw(im).ellipse((x-30, 256, x+30, 316), fill=color)
    layer = Image.new("RGBA", (W, H))
    ScaledDraw(layer).ellipse((776, 256, 836, 316), fill=(255, 255, 255, int(255*(1-orbit))))
    im = Image.alpha_composite(im, layer)
    d = ScaledDraw(im)
    centers = [(480-shift, 281), (480, 281), (480+shift, 281)]
    gaussian_field(im, centers, (360, 183, 600, 382))
    d = ScaledDraw(im)
    for (cx, cy), channel_color in zip(centers, ((255, 105, 122), (115, 239, 174), (110, 165, 255))):
        color = tuple(round(246 * (1 - orbit) + component * orbit) for component in channel_color)
        d.ellipse((cx-4, cy-4, cx+4, cy+4), fill=color)
    d.line((263, 283, 320, 283), fill=(125, 171, 231), width=6)
    d.polygon([(334, 283), (317, 272), (317, 294)], fill=(125, 171, 231))
    d.line((630, 283, 687, 283), fill=(125, 171, 231), width=6)
    d.polygon([(701, 283), (684, 272), (684, 294)], fill=(125, 171, 231))
    d.text((369, 412), "R", font=font(18, True), fill=(255, 105, 122))
    d.text((474, 412), "G", font=font(18, True), fill=(115, 239, 174))
    d.text((579, 412), "B", font=font(18, True), fill=(110, 165, 255))
    pill(d, (49, 459, 289, 493), "White appearance in input")
    pill(d, (663, 459, 911, 493), "Color error in new view", (255, 161, 170))
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
