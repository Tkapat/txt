"""Cut a sticker sheet on a white background into transparent WebP pieces.

Usage:
    pip install opencv-python pillow numpy
    python scripts/slice_stickers.py my-sticker-sheet.png public/stickers

It is a starting point: open the output folder and delete any junk pieces.
"""

import pathlib
import sys

import cv2
import numpy as np
from PIL import Image

src, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

img = cv2.imread(src, cv2.IMREAD_COLOR)
fg = (img.min(axis=2) < 244).astype(np.uint8) * 255  # anything not near-white
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))  # bridge gaps
n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)

k = 0
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area < 2500:  # ignore specks
        continue
    mask = (labels[y : y + h, x : x + w] == i).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, cnts, -1, 255, -1)  # fill holes inside the piece
    filled = cv2.GaussianBlur(filled, (3, 3), 0)  # soften the edge
    rgba = cv2.cvtColor(img[y : y + h, x : x + w], cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = filled
    im = Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA))
    im.thumbnail((480, 480))
    k += 1
    im.save(out / f"sticker-{k:02d}.webp", quality=82, method=6)

print(k, "pieces written")
