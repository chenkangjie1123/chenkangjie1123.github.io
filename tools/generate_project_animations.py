"""Render the two lightweight, reproducible project explanation animations.

Requires Pillow and NumPy. MP4/GIF encoding uses ffmpeg.
"""

from pathlib import Path
import math
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 960, 540
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
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def base(title, eyebrow):
    yy = np.linspace(0, 1, H)[:, None, None]
    xx = np.linspace(0, 1, W)[None, :, None]
    top = np.array([12, 27, 56])
    bottom = np.array(BG)
    glow = np.maximum(0, 1 - np.sqrt(((xx - .52) / .8) ** 2 + ((yy - .52) / .8) ** 2))
    arr = top[None, None, :] * (1 - yy) + bottom[None, None, :] * yy + glow * np.array([5, 8, 17])
    im = Image.fromarray(np.uint8(np.broadcast_to(arr, (H, W, 3)).clip(0, 255))).convert("RGBA")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((20, 18, W-20, H-18), radius=26, outline=(64, 91, 139, 110), width=2)
    d.text((48, 43), eyebrow.upper(), font=font(16, True), fill=CYAN)
    d.text((48, 73), title, font=font(30, True), fill=WHITE)
    return im


def pill(d, box, label, color=CYAN):
    d.rounded_rectangle(box, radius=15, fill=(32, 49, 77), outline=(82, 114, 158), width=1)
    d.text((box[0]+13, box[1]+7), label, font=font(15, True), fill=color)


def panel(d, box, title):
    d.rounded_rectangle(box, radius=18, fill=(18, 33, 61), outline=(70, 96, 137), width=2)
    d.text((box[0]+18, box[1]+15), title, font=font(17, True), fill=MUTED)


def gaussian_field(im, centers, bounds):
    x0, y0, x1, y1 = bounds
    h, w = y1-y0, x1-x0
    yy, xx = np.mgrid[0:h, 0:w]
    field = np.zeros((h, w, 3), dtype=np.float32)
    for (cx, cy), channel in zip(centers, range(3)):
        r = ((xx - (cx-x0))/44) ** 2 + ((yy - (cy-y0))/66) ** 2
        field[:, :, channel] += 246 * np.exp(-r * 1.05)
    opacity = np.max(field, axis=2)
    field += np.stack([opacity*.07, opacity*.09, opacity*.13], axis=2)
    scene = np.array(im.crop(bounds).convert("RGB"), dtype=np.float32)
    scene = np.clip(scene + field, 0, 255).astype("uint8")
    im.paste(Image.fromarray(scene), (x0, y0))


def coadapt_frame(index):
    phase = index / FRAMES
    # Pause at both important viewpoints so the mechanism is readable as a GIF.
    orbit = (1 - math.cos(2 * math.pi * phase)) / 2
    shift = 55 * (orbit ** 1.15)
    im = base("How co-adaptation creates color artifacts", "Co-Adaptation of 3DGS")
    d = ImageDraw.Draw(im)
    panel(d, (49, 143, 259, 422), "TRAINING VIEW")
    panel(d, (701, 143, 911, 422), "NOVEL VIEW")
    d.rounded_rectangle((342, 153, 618, 400), radius=18, fill=(13, 27, 51), outline=(66, 94, 135), width=2)
    for y in range(206, 391, 31):
        d.line((360, y, 600, y), fill=(44, 64, 100), width=1)
    for x in range(375, 598, 37):
        d.line((x, 183, x, 381), fill=(44, 64, 100), width=1)
    # An overlapped white projection is held on the left; the actual points separate as the camera rotates.
    d.rounded_rectangle((77, 211, 231, 366), radius=16, fill=(239, 244, 247), outline=(190, 211, 229), width=3)
    d.ellipse((119, 250, 190, 322), fill=(255, 255, 255), outline=(220, 227, 233), width=2)
    d.rounded_rectangle((729, 211, 883, 366), radius=16, fill=(235, 239, 242), outline=(188, 210, 229), width=3)
    # RGB splats in the new projection become offset as the orbit grows.
    for x, color in [(806 - shift*.78, (246, 83, 104, int(210*orbit))), (806, (89, 218, 161, int(195*orbit))), (806 + shift*.78, (78, 143, 255, int(210*orbit)))]:
        layer = Image.new("RGBA", (W, H))
        ImageDraw.Draw(layer).ellipse((x-30, 256, x+30, 316), fill=color)
        im = Image.alpha_composite(im, layer)
    layer = Image.new("RGBA", (W, H))
    ImageDraw.Draw(layer).ellipse((776, 256, 836, 316), fill=(255, 255, 255, int(255*(1-orbit))))
    im = Image.alpha_composite(im, layer)
    d = ImageDraw.Draw(im)
    centers = [(480-shift, 281), (480, 281), (480+shift, 281)]
    gaussian_field(im, centers, (360, 183, 600, 382))
    d = ImageDraw.Draw(im)
    for cx, cy in centers:
        d.ellipse((cx-3, cy-3, cx+3, cy+3), fill=(242, 248, 255))
    d.arc((416, 317, 544, 379), 12, 168, fill=(125, 171, 231), width=3)
    d.polygon([(424, 345), (411, 338), (419, 355)], fill=(125, 171, 231))
    d.line((260, 283, 331, 283), fill=(90, 125, 168), width=3)
    d.polygon([(332, 283), (319, 276), (319, 290)], fill=(90, 125, 168))
    d.line((627, 283, 699, 283), fill=(90, 125, 168), width=3)
    d.polygon([(700, 283), (687, 276), (687, 290)], fill=(90, 125, 168))
    d.text((369, 412), "R", font=font(18, True), fill=(255, 105, 122))
    d.text((474, 412), "G", font=font(18, True), fill=(115, 239, 174))
    d.text((579, 412), "B", font=font(18, True), fill=(110, 165, 255))
    pill(d, (49, 459, 289, 493), "White appearance in input")
    pill(d, (663, 459, 911, 493), "Color error in new view", (255, 161, 170))
    return im.convert("RGB")


def room(d, box, highlight=False):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=13, fill=(31, 51, 82), outline=(80, 108, 149), width=2)
    d.polygon([(x0+9,y1-45),(x1-9,y1-45),(x1-9,y1-10),(x0+9,y1-10)], fill=(54, 75, 96))
    d.line((x0+8,y1-44,x1-9,y1-44), fill=(120, 143, 160), width=2)
    chair = (x0+42, y0+55, x0+104, y1-35)
    cc = (76, 210, 213) if highlight else (207, 148, 100)
    d.rounded_rectangle((chair[0]+9,chair[1],chair[2]-5,chair[3]-21), radius=9, fill=cc)
    d.rounded_rectangle((chair[0],chair[3]-27,chair[2],chair[3]), radius=8, fill=cc)
    d.line((chair[0]+8,chair[3],chair[0]+8,y1-17), fill=(24, 30, 42), width=5)
    d.line((chair[2]-9,chair[3],chair[2]-9,y1-17), fill=(24, 30, 42), width=5)
    d.ellipse((x1-67,y1-88,x1-20,y1-76), fill=(160, 178, 189))
    d.line((x1-42,y1-80,x1-42,y1-20), fill=(140, 159, 170), width=5)
    return chair


def sl_frame(index):
    phase = index / FRAMES
    pulse = (1 - math.cos(2 * math.pi * phase)) / 2
    im = base("From two views to a queryable 3D scene", "SLGaussian")
    d = ImageDraw.Draw(im)
    panel(d, (44, 146, 282, 428), "TWO RGB VIEWS")
    panel(d, (678, 146, 916, 428), "LANGUAGE QUERY")
    room(d, (65, 211, 186, 338))
    room(d, (136, 244, 257, 372))
    pill(d, (74, 383, 252, 417), "Sparse-view input")
    d.rounded_rectangle((353, 176, 607, 400), radius=17, fill=(12, 29, 53), outline=(71, 101, 142), width=2)
    # A 3D Gaussian scene is assembled progressively, then retains its structure.
    count = int(44 + 120 * min(1, phase * 2.7))
    for i in range(count):
        theta = i * 2.39996
        radius = 7.2 * math.sqrt(i)
        xx = 480 + math.cos(theta)*radius*1.1
        yy = 292 + math.sin(theta)*radius*.67
        hue = [(96, 184, 247), (105, 221, 190), (230, 163, 122)][i % 3]
        rr = 2 + i % 3
        d.ellipse((xx-rr, yy-rr, xx+rr, yy+rr), fill=hue)
    d.text((397, 367), "Language Gaussians", font=font(17, True), fill=WHITE)
    d.line((282, 284, 345, 284), fill=(92, 143, 190), width=3)
    d.polygon([(346,284),(333,276),(333,292)], fill=(92,143,190))
    d.line((609, 284, 674, 284), fill=(92, 143, 190), width=3)
    d.polygon([(675,284),(662,276),(662,292)], fill=(92,143,190))
    d.rounded_rectangle((707, 200, 886, 251), radius=19, fill=(43, 63, 94), outline=(117, 157, 196), width=2)
    d.text((726, 215), '"chair"', font=font(21, True), fill=WHITE)
    chair = room(d, (710, 267, 883, 385), highlight=True)
    if pulse > .15:
        d.rounded_rectangle((chair[0]-6, chair[1]-6, chair[2]+6, chair[3]+8), radius=11, outline=(104, 239, 236), width=2 + int(2*pulse))
    pill(d, (46, 459, 275, 493), "Fast scene inference")
    pill(d, (691, 459, 914, 493), "3D object localization")
    return im.convert("RGB")


def render(name, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    frame_function = coadapt_frame if name == "coadapt" else sl_frame
    with tempfile.TemporaryDirectory(prefix="project-animation-") as temp:
        tmp = Path(temp)
        for i in range(FRAMES):
            frame_function(i).save(tmp / f"frame-{i:03}.png", optimize=True)
        source = str(tmp / "frame-%03d.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", source,
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", str(output.with_suffix(".mp4"))], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", source,
                        "-vf", "fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
                        "-loop", "0", str(output.with_suffix(".gif"))], check=True)
        frame_function(FRAMES//2).save(output.with_suffix(".png"), optimize=True)


if __name__ == "__main__":
    render("coadapt", ROOT / "Co-Adaptation-3DGS/assets/coadapt-explained")
    render("sl", ROOT / "SLGaussian/static/images/slgaussian-explained")
