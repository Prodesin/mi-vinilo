#!/usr/bin/env python3
"""Iconos de «Mi vinilo»: disco de vinilo estilizado sobre fondo berenjena (sin texto, con margen maskable)."""
from PIL import Image, ImageDraw, ImageFilter
import math, os

S = 2048
img = Image.new("RGB", (S, S))
px = img.load()
top, bot = (112, 46, 128), (58, 20, 78)
for y in range(S):
    t = y / (S - 1)
    c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(S):
        px[x, y] = c
img = img.convert("RGBA")
cx = cy = S / 2
R = 640  # radio del disco: queda dentro de la zona segura (≈ 62 % del lienzo)

shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((cx - R, cy - R + 30, cx + R, cy + R + 30), fill=(20, 0, 30, 130))
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(36)))

disc = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(disc)
d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=(18, 16, 20, 255))
# surcos sutiles
for r in range(int(R * 0.40), int(R * 0.96), 22):
    a = 38 if (r // 22) % 3 else 70
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, a), width=3)
# brillo en dos sectores opuestos
sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(sheen)
for k in (0, 180):
    sd.pieslice((cx - R, cy - R, cx + R, cy + R), 300 + k, 330 + k, fill=(255, 255, 255, 12))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
sheen.putalpha(Image.eval(sheen.split()[3], lambda v: v).copy())
disc = Image.alpha_composite(disc, Image.composite(sheen, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))
d = ImageDraw.Draw(disc)
# etiqueta central mostaza
L = 215
d.ellipse((cx - L, cy - L, cx + L, cy + L), fill=(232, 168, 28, 255))
d.ellipse((cx - L + 26, cy - L + 26, cx + L - 26, cy + L - 26), outline=(150, 96, 10, 255), width=6)
d.ellipse((cx - 36, cy - 36, cx + 36, cy + 36), fill=(30, 16, 40, 255))
img = Image.alpha_composite(img, disc).convert("RGB")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, name), optimize=True)
print("ok")
