#!/usr/bin/env python3
"""Regenerate CrazyGames cover PNGs into release/covers/."""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "release", "covers")

VOID = (11, 28, 34)
TEAL = (22, 58, 68)
TEAL_L = (31, 77, 90)
EMBER = (232, 93, 4)
AMBER = (244, 140, 6)
CYAN = (46, 196, 182)
MIST = (232, 241, 242)


def try_font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_cover(w: int, h: int, path: str) -> None:
    img = Image.new("RGB", (w, h), VOID)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line(
            [(0, y), (w, y)],
            fill=(
                int(VOID[0] + (TEAL[0] - VOID[0]) * (0.35 + 0.4 * t)),
                int(VOID[1] + (TEAL[1] - VOID[1]) * (0.35 + 0.4 * t)),
                int(VOID[2] + (TEAL[2] - VOID[2]) * (0.35 + 0.4 * t)),
            ),
        )
    d.ellipse([int(-0.1 * w), int(-0.35 * h), int(1.1 * w), int(0.45 * h)], fill=TEAL)
    d.ellipse([int(-0.05 * w), int(-0.4 * h), int(1.05 * w), int(0.38 * h)], fill=VOID)
    for i in range(6):
        x = int(w * (0.12 + i * 0.14))
        d.line(
            [(x, int(h * 0.18)), (x + int(0.03 * w), int(h * 0.42)), (x - int(0.02 * w), int(h * 0.55))],
            fill=CYAN,
            width=max(2, w // 400),
        )
    d.polygon([(0, int(h * 0.72)), (w, int(h * 0.7)), (w, h), (0, h)], fill=TEAL)
    cx, cy = w // 2, int(h * 0.62)
    for radius, col in (
        (int(0.12 * min(w, h)), EMBER),
        (int(0.07 * min(w, h)), AMBER),
        (int(0.035 * min(w, h)), MIST),
    ):
        d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=col)
    vx, vy = int(w * 0.22), int(h * 0.55)
    d.ellipse([vx - int(0.06 * w), vy - int(0.08 * h), vx + int(0.06 * w), vy + int(0.08 * h)], fill=TEAL_L)
    d.ellipse([vx - int(0.025 * w), vy - int(0.04 * h), vx + int(0.02 * w), vy + int(0.03 * h)], fill=CYAN)
    for sx, sy in ((0.72, 0.48), (0.82, 0.58), (0.64, 0.4)):
        x, y = int(w * sx), int(h * sy)
        rw, rh = max(24, int(0.04 * w)), max(18, int(0.03 * h))
        d.rounded_rectangle([x - rw, y - rh, x + rw, y + rh], radius=max(4, w // 200), fill=TEAL_L)
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=EMBER if sx > 0.7 else CYAN)
    title = try_font(max(42, w // 16))
    text = "Embervein"
    bbox = d.textbbox((0, 0), text, font=title)
    tw = bbox[2] - bbox[0]
    d.text(((w - tw) // 2, int(h * 0.12)), text, font=title, fill=MIST)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(path, img.size)


if __name__ == "__main__":
    draw_cover(1920, 1080, os.path.join(OUT, "cover-1920x1080.png"))
    draw_cover(800, 1200, os.path.join(OUT, "cover-800x1200.png"))
    draw_cover(800, 800, os.path.join(OUT, "cover-800x800.png"))
