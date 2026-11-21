#!/usr/bin/env python3
"""Build the AR / 3D menu models (assets/ar/<id>.glb) from the menu photos.

Every pizza photo in assets/img/pizza-*.webp is a cut-out shot from a 3/4 angle
(transparent background). For each one this script:

  1. finds the top ellipse of the pizza in the silhouette (widest row = ellipse
     centre, first opaque row = ellipse top),
  2. unwarps that ellipse into a circular top-down texture,
  3. unrolls the visible crust wall (between the front of the ellipse and the
     bottom of the silhouette) into a 360° side texture,
  4. estimates the crust height from the viewing angle (sin θ = b / a),
  5. writes a real-size cylinder GLB (Y-up, metres) with those two textures.

The GLB works in <model-viewer>, Android Scene Viewer / WebXR, and iOS Quick
Look (model-viewer converts it to USDZ on the device).

Usage:  python3 tools/build-ar-models.py            # all pizzas in js/data.js
        python3 tools/build-ar-models.py ugos mexicana
Needs:  pip install pillow numpy
"""
import io
import json
import math
import re
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ar"

# Real diameter of the pizza in metres. Keep in sync with UGOS.ar.diameterCm in js/data.js.
DIAMETER_M = float(re.search(r"diameterCm:\s*([\d.]+)", (ROOT / "js" / "data.js").read_text()).group(1)) / 100
SEGMENTS = 96
TOP_PX = 1024
SIDE_W, SIDE_H = 1024, 128


def bilinear(img, xs, ys):
    """Sample an HxWxC float array at float coords (clamped)."""
    h, w = img.shape[:2]
    xs = np.clip(xs, 0, w - 1.001)
    ys = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    fx = (xs - x0)[..., None]; fy = (ys - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def analyse(path):
    im = Image.open(path).convert("RGBA")
    # Work at 2x for cleaner resampling.
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    alpha = arr[..., 3] > 128
    rows = np.where(alpha.any(axis=1))[0]
    y_top = rows[0]
    widths = np.zeros(arr.shape[0]); lefts = np.zeros(arr.shape[0]); rights = np.zeros(arr.shape[0])
    for y in rows:
        xs = np.where(alpha[y])[0]
        lefts[y], rights[y] = xs[0], xs[-1]
        widths[y] = xs[-1] - xs[0]
    W = widths.max()
    y_mid = int(np.argmax(widths >= 0.985 * W))
    a = W / 2
    b = max(8.0, y_mid - y_top)
    cx = (lefts[y_mid] + rights[y_mid]) / 2
    sin_t = min(0.98, b / a)
    cos_t = math.sqrt(1 - sin_t ** 2)
    col_bottom = np.array([np.where(alpha[:, x])[0][-1] if alpha[:, x].any() else y_mid for x in range(arr.shape[1])])

    # Fill transparent pixels with the nearest opaque colour so edge samples don't go black.
    rgb = arr[..., :3].copy()
    mean_crust = rgb[alpha & (np.arange(arr.shape[0])[:, None] > y_mid + b)].mean(axis=0)
    rgb[~alpha] = mean_crust

    # --- top texture: unit disc -> source ellipse
    g = (np.arange(TOP_PX) + 0.5) / TOP_PX * 2 - 1
    u, v = np.meshgrid(g, g)
    r = np.sqrt(u ** 2 + v ** 2)
    k = np.where(r > 1, 1 / np.maximum(r, 1e-6), 1)  # clamp outside the disc onto its edge
    top = bilinear(rgb, cx + u * k * a * 0.995, y_mid + v * k * b * 0.995)

    # --- side texture: front half of the crust wall, mirrored for the back half
    phis = (np.arange(SIDE_W) + 0.5) / SIDE_W * 2 * math.pi
    # Only the front-facing part of the wall (|x| < 0.7a) is sharp in the photo; stretch it all round.
    cosx = 0.7 * np.cos(phis)
    sx = cx + a * cosx
    ye = y_mid + b * np.sqrt(1 - cosx ** 2)
    yb = col_bottom[np.clip(sx.astype(int), 0, arr.shape[1] - 1)].astype(np.float32)
    yb = np.maximum(yb, ye + 4)
    t = 0.12 + 0.8 * (np.arange(SIDE_H) + 0.5) / SIDE_H  # skip cheese bleed at the top and the dark edge at the bottom
    SX = np.tile(sx, (SIDE_H, 1))
    SY = ye[None, :] + t[:, None] * (yb - ye)[None, :]
    side = bilinear(rgb, SX, SY)

    # Crust height from the front-centre wall: visible = h·cosθ
    xc = int(cx)
    hv = col_bottom[xc] - (y_mid + b)
    ratio = (hv / max(cos_t, 0.2)) / W
    ratio = float(np.clip(ratio, 0.06, 0.14))
    return top, side, ratio, mean_crust


def jpeg(arr, q=85):
    buf = io.BytesIO()
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(buf, "JPEG", quality=q, optimize=True, progressive=False)
    return buf.getvalue()


def geometry(radius, height):
    n = SEGMENTS
    pos, nor, uv, top_idx, side_idx = [], [], [], [], []

    def vert(p, nm, t):
        pos.append(p); nor.append(nm); uv.append(t)
        return len(pos) - 1

    # Top cap (material 0): UV from top-down projection, image rows run back (-z) -> front (+z).
    c = vert((0, height, 0), (0, 1, 0), (0.5, 0.5))
    ring = []
    for i in range(n + 1):
        f = 2 * math.pi * i / n
        x, z = math.cos(f), math.sin(f)
        ring.append(vert((radius * x, height, radius * z), (0, 1, 0), (0.5 + 0.5 * x, 0.5 + 0.5 * z)))
    for i in range(n):
        top_idx += [c, ring[i + 1], ring[i]]  # CCW seen from +Y

    # Side wall (material 1)
    side_start = len(pos)
    for i in range(n + 1):
        f = 2 * math.pi * i / n
        x, z = math.cos(f), math.sin(f)
        vert((radius * x, height, radius * z), (x, 0, z), (i / n, 0.0))
        vert((radius * x * 0.985, 0, radius * z * 0.985), (x, -0.1, z), (i / n, 1.0))
    for i in range(n):
        a0, b0 = side_start + 2 * i, side_start + 2 * i + 1
        a1, b1 = a0 + 2, b0 + 2
        side_idx += [a0, a1, b0, a1, b1, b0]  # outward-facing

    # Bottom cap (material 1, sampled from the lower crust)
    bc = vert((0, 0, 0), (0, -1, 0), (0.25, 0.95))
    bring = []
    for i in range(n + 1):
        f = 2 * math.pi * i / n
        bring.append(vert((radius * 0.985 * math.cos(f), 0, radius * 0.985 * math.sin(f)), (0, -1, 0), (0.25, 0.95)))
    for i in range(n):
        side_idx += [bc, bring[i], bring[i + 1]]
    return pos, nor, uv, top_idx, side_idx


def fix_winding(pos, idx, outward):
    """Make every triangle face the intended direction (guards against sign slips)."""
    P = np.array(pos)
    out = []
    for i in range(0, len(idx), 3):
        a, b, c = idx[i:i + 3]
        nrm = np.cross(P[b] - P[a], P[c] - P[a])
        want = outward(P[a], P[b], P[c])
        out += [a, b, c] if np.dot(nrm, want) >= 0 else [a, c, b]
    return out


def write_glb(path, name, top_jpg, side_jpg, radius, height):
    pos, nor, uv, ti, si = geometry(radius, height)
    ti = fix_winding(pos, ti, lambda a, b, c: np.array([0, 1, 0]))
    def side_out(a, b, c):
        m = (a + b + c) / 3
        if abs(m[1]) < 1e-9 and abs(a[1]) < 1e-9 and abs(b[1]) < 1e-9:
            return np.array([0, -1, 0])  # bottom cap
        return np.array([m[0], 0, m[2]])
    si = fix_winding(pos, si, side_out)

    blobs, views, accessors = bytearray(), [], []

    def add_view(data, target=None):
        while len(blobs) % 4: blobs.append(0)
        views.append({"buffer": 0, "byteOffset": len(blobs), "byteLength": len(data), **({"target": target} if target else {})})
        blobs.extend(data)
        return len(views) - 1

    def add_acc(arr, ctype, typ, target, minmax=False):
        v = add_view(arr.tobytes(), target)
        acc = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"] = arr.min(axis=0).tolist(); acc["max"] = arr.max(axis=0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    P = add_acc(np.array(pos, np.float32), 5126, "VEC3", 34962, True)
    N_ = np.array(nor, np.float32); N_ /= np.linalg.norm(N_, axis=1, keepdims=True)
    N = add_acc(N_, 5126, "VEC3", 34962)
    T = add_acc(np.array(uv, np.float32), 5126, "VEC2", 34962)
    I0 = add_acc(np.array(ti, np.uint16), 5123, "SCALAR", 34963)
    I1 = add_acc(np.array(si, np.uint16), 5123, "SCALAR", 34963)
    img0 = add_view(top_jpg); img1 = add_view(side_jpg)
    while len(blobs) % 4: blobs.append(0)

    gltf = {
        "asset": {"version": "2.0", "generator": "ugos tools/build-ar-models.py"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": [
            {"attributes": {"POSITION": P, "NORMAL": N, "TEXCOORD_0": T}, "indices": I0, "material": 0},
            {"attributes": {"POSITION": P, "NORMAL": N, "TEXCOORD_0": T}, "indices": I1, "material": 1},
        ]}],
        "materials": [
            {"name": "top", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 0.7}},
            {"name": "crust", "pbrMetallicRoughness": {"baseColorTexture": {"index": 1}, "metallicFactor": 0, "roughnessFactor": 0.85}},
        ],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}, {"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 33071}],
        "images": [{"bufferView": img0, "mimeType": "image/jpeg"}, {"bufferView": img1, "mimeType": "image/jpeg"}],
        "textures": [{"source": 0, "sampler": 0}, {"source": 1, "sampler": 1}],
        "accessors": accessors, "bufferViews": views,
        "buffers": [{"byteLength": len(blobs)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blobs))
    out += struct.pack("<II", len(js), 0x4E4F534A) + js
    out += struct.pack("<II", len(blobs), 0x004E4942) + bytes(blobs)
    path.write_bytes(out)
    return len(out)


def main():
    data = (ROOT / "js" / "data.js").read_text()
    menu = re.findall(r'\{ id: "([^"]+)", name: "([^"]+)", price: \d+, desc: "[^"]*", img: "(assets/img/pizza-[^"]+)"', data)
    wanted = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    for pid, name, img in menu:
        if wanted and pid not in wanted:
            continue
        top, side, ratio, _ = analyse(ROOT / img)
        r = DIAMETER_M / 2
        h = DIAMETER_M * ratio
        size = write_glb(OUT / f"{pid}.glb", name, jpeg(top), jpeg(side), r, h)
        print(f"{pid:18s} Ø {DIAMETER_M*100:.0f} cm  alto {h*100:.1f} cm  {size/1024:.0f} KB")


if __name__ == "__main__":
    main()
