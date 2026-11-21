#!/usr/bin/env python3
"""Build the AR / 3D menu models from the menu photos.

Output per pizza (id from js/data.js):
  assets/ar/<id>.glb    glTF for <model-viewer>, Android Scene Viewer and WebXR
  assets/ar/<id>.usdz   USDZ for iPhone / iPad Quick Look (pre-built: more reliable than converting on the phone)

Source photos: tools/ar-src/<id>.webp (full-size originals from ugospizzas.com/menu),
falling back to the site's assets/img/pizza-<id>.webp.

Each photo is a cut-out shot from a 3/4 angle. The script:
  1. finds the top ellipse in the silhouette and unwarps it into a top-down texture,
  2. unrolls the visible crust wall into a 360° side texture,
  3. estimates the crust height from the viewing angle (sin θ = b / a),
  4. finds the crust rim in the top view (how far in the crust colour reaches),
  5. builds real geometry: a raised, rounded crust lip, the cheese sunk inside it, and
     toppings lifted off the cheese (by how different they are from the cheese colour),
  6. bakes a normal map from the same height field so small details catch the light,
  7. writes a real-size GLB (Y-up, metres) and a USDZ.

Usage:  python3 tools/build-ar-models.py            # every pizza
        python3 tools/build-ar-models.py ugos mexicana
Needs:  pip install pillow numpy usd-core
"""
import io
import json
import math
import re
import shutil
import struct
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ar"
SRC = ROOT / "tools" / "ar-src"

# Real diameter in metres. Single source of truth: UGOS.ar.diameterCm in js/data.js.
DIAMETER_M = float(re.search(r"diameterCm:\s*([\d.]+)", (ROOT / "js" / "data.js").read_text()).group(1)) / 100
R = DIAMETER_M / 2
TEX = 1024           # top colour / normal / height maps
SIDE_W, SIDE_H = 1024, 256          # power-of-two everywhere: safest for Scene Viewer / Quick Look
RINGS_IN, RINGS_RIM, SEGS = 36, 52, 192
# Pizzas with a centre "volcano" cup (Ugo's: "volcán de crema de queso cheddar").
VOLCANO = {"ugos"}
# Pizzas whose border is wider than the usual crust (Ugo's: "borde de salchichas").
WIDE_RIM = {"ugos"}


# ---------------------------------------------------------------- image helpers
def bilinear(img, xs, ys):
    h, w = img.shape[:2]
    xs = np.clip(xs, 0, w - 1.001); ys = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    fx = xs - x0; fy = ys - y0
    if img.ndim == 3:
        fx = fx[..., None]; fy = fy[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def blur(a, radius):
    """Separable Gaussian blur of a float 2-D array (sigma = radius px, edge-padded)."""
    k = int(math.ceil(radius * 3))
    w = np.exp(-0.5 * (np.arange(-k, k + 1) / radius) ** 2); w /= w.sum()
    out = np.pad(a.astype(np.float64), k, mode="edge")
    out = sum(w[i] * out[:, i:i + out.shape[1] - 2 * k] for i in range(2 * k + 1))
    out = sum(w[i] * out[i:i + out.shape[0] - 2 * k, :] for i in range(2 * k + 1))
    return out


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def jpeg(arr, q=88):
    buf = io.BytesIO()
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(buf, "JPEG", quality=q, optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- photo analysis
def analyse(path):
    im = Image.open(path).convert("RGBA")
    scale = 2 if im.width < 900 else 1
    if scale > 1:
        im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    alpha = arr[..., 3] > 128
    rows = np.where(alpha.any(axis=1))[0]
    y_top = rows[0]
    widths = np.zeros(arr.shape[0]); lefts = np.zeros(arr.shape[0]); rights = np.zeros(arr.shape[0])
    for y in rows:
        xs = np.where(alpha[y])[0]
        lefts[y], rights[y], widths[y] = xs[0], xs[-1], xs[-1] - xs[0]
    W = widths.max()
    y_mid = int(np.argmax(widths >= 0.985 * W))
    a = W / 2
    b = max(8.0, y_mid - y_top)
    cx = (lefts[y_mid] + rights[y_mid]) / 2
    sin_t = min(0.98, b / a); cos_t = math.sqrt(1 - sin_t ** 2)
    col_bottom = np.array([np.where(alpha[:, x])[0][-1] if alpha[:, x].any() else y_mid for x in range(arr.shape[1])])

    rgb = arr[..., :3].copy()
    below = alpha & (np.arange(arr.shape[0])[:, None] > y_mid + b)
    crust = np.median(rgb[below], axis=0)
    rgb[~alpha] = crust

    # top-down colour: unit disc -> source ellipse
    g = (np.arange(TEX) + 0.5) / TEX * 2 - 1
    u, v = np.meshgrid(g, g)
    r = np.sqrt(u ** 2 + v ** 2)
    k = np.where(r > 1, 1 / np.maximum(r, 1e-6), 1)
    top = bilinear(rgb, cx + u * k * a * 0.995, y_mid + v * k * b * 0.995)
    # gentle unsharp mask: the ellipse is squashed vertically, so the unwarp softens it
    soft = np.stack([blur(top[..., c], 2.0) for c in range(3)], -1)
    top = np.clip(top + 0.25 * (top - soft), 0, 255)

    # side: the sharp front part of the wall, stretched all round
    phis = (np.arange(SIDE_W) + 0.5) / SIDE_W * 2 * math.pi
    cosx = 0.7 * np.cos(phis)
    sx = cx + a * cosx
    ye = y_mid + b * np.sqrt(1 - cosx ** 2)
    yb = col_bottom[np.clip(sx.astype(int), 0, arr.shape[1] - 1)].astype(np.float32)
    yb = np.maximum(yb, ye + 4)
    t = 0.10 + 0.82 * (np.arange(SIDE_H) + 0.5) / SIDE_H
    side = bilinear(rgb, np.tile(sx, (SIDE_H, 1)), ye[None, :] + t[:, None] * (yb - ye)[None, :])

    hv = col_bottom[int(cx)] - (y_mid + b)
    ratio = float(np.clip((hv / max(cos_t, 0.2)) / W, 0.09, 0.125))
    return top, side, ratio, crust


# ---------------------------------------------------------------- height field
def height_field(pid, top, side, crust, H):
    """Height (metres) over the top-down texture square.
    Returns (coarse for the mesh, fine for normals, rim_in, top colour with a clean crust lip)."""
    g = (np.arange(TEX) + 0.5) / TEX * 2 - 1
    u, v = np.meshgrid(g, g)
    r = np.sqrt(u ** 2 + v ** 2)

    # How "crust-like" each pixel is.
    d_crust = np.linalg.norm(top - crust, axis=-1) / 255
    crusty = blur(np.exp(-(d_crust / 0.16) ** 2), 2.5)

    # Rim: walk in from the edge until the ring stops looking like crust.
    nb = 200
    rb = np.clip((r * nb).astype(int), 0, nb - 1)
    prof = np.bincount(rb.ravel(), crusty.ravel(), nb) / np.maximum(np.bincount(rb.ravel(), None, nb), 1)
    edge = prof[int(0.94 * nb):int(0.99 * nb)].mean()
    rim_in = 0.90
    for i in range(int(0.97 * nb), int(0.60 * nb), -1):
        if prof[i] < 0.55 * edge:
            rim_in = (i + 1) / nb
            break
    # Red/orange toppings (tomato, salame) can look like crust, so keep the usual crust width.
    rim_in = float(np.clip(rim_in, 0.76 if pid in WIDE_RIM else 0.86, 0.92))

    # The photo barely shows the lip (and smears toppings onto it near the front), so paint the lip
    # and the inner crust wall with the real crust from the side texture, wrapped round by angle.
    if pid not in WIDE_RIM:
        phi = np.mod(np.arctan2(v, u), 2 * math.pi)
        r0 = rim_in - 0.015
        tt = np.clip((r - r0) / (1 - r0), 0, 1)
        lipcol = bilinear(side, phi / (2 * math.pi) * SIDE_W - 0.5, (0.08 + 0.5 * np.abs(tt - 0.45)) * SIDE_H)
        k = smoothstep(r0, rim_in - 0.01, r)[..., None]
        top = top * (1 - k) + lipcol * k
        # toasted outer edge
        top = top * (1 - 0.18 * smoothstep(0.93, 1.0, r))[..., None]
        crusty = np.where(r > rim_in, 0.6, crusty)

    # Cheese and toppings sit ABOVE the crust; the crust rim is lower and rounds off at the edge.
    cheese_lvl, lip_top, lip_edge = 1.0 * H, 0.86 * H, 0.70 * H
    wall = smoothstep(rim_in - 0.03, rim_in + 0.03, r)           # cheese edge melting down onto the crust
    rmid = (rim_in + 1) / 2
    lip = lip_top - (lip_top - lip_edge) * np.clip((r - rmid) / (1 - rmid), 0, 1) ** 2
    base = cheese_lvl + (lip - cheese_lvl) * wall
    base += (1 - wall) * 0.003 * (1 - (r / rim_in) ** 2).clip(0)   # slight dome in the middle
    # Lumpy crust: lift where the rim really is crust-coloured (also shapes Ugo's sausage border).
    base += wall * (blur(crusty, 5.0) - 0.6) * 0.14 * H

    # Toppings: how far a pixel is from the cheese colour, lifted up to ~7 mm.
    inside = r < rim_in - 0.08
    cheese = np.median(top[inside], axis=0)
    d_cheese = np.linalg.norm(top - cheese, axis=-1) / 255
    topping = blur(np.clip((d_cheese - 0.12) / 0.30, 0, 1), 5.0)
    base += (1 - wall) * topping * 0.007

    if pid in VOLCANO:
        # Centre cup: find the crust-coloured blob near the middle.
        m = (crusty > 0.5) & (r < 0.45)
        if m.sum() > 50:
            ys, xs = np.nonzero(m)
            cu, cv = g[xs].mean(), g[ys].mean()
            ro = min(0.3, math.sqrt(m.sum() / math.pi) / TEX * 2 * 1.15)
            rc = np.sqrt((u - cu) ** 2 + (v - cv) ** 2) / ro
            cup = smoothstep(1.15, 0.85, rc)                 # outer wall
            bowl = smoothstep(0.55, 0.35, rc)                # cheddar sits a little lower
            base = base * (1 - cup) + cup * (cheese_lvl + 0.025 - bowl * 0.008)

    coarse = blur(base, 3.0)
    # Fine detail for the normal map only: luminance high-pass (bubbles, edges of toppings).
    lum = top @ np.array([0.299, 0.587, 0.114]) / 255
    fine = coarse + blur(lum - blur(lum, 8.0), 1.2) * 0.0012
    return coarse, fine, rim_in, top


def normal_map(h):
    """Tangent-space normal map (OpenGL convention: +G toward the top of the image)."""
    px = 2 * R / TEX
    dx = np.gradient(h, axis=1) / px
    dz = np.gradient(h, axis=0) / px                   # image rows run toward +z
    n = np.stack([-dx, dz, np.ones_like(h)], -1)       # G = +dh/dz: "up" in the image is -z
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return (n * 0.5 + 0.5) * 255


# ---------------------------------------------------------------- mesh
def build_mesh(coarse, crust_rgb):
    """Returns two primitives (top, wall+bottom) as dicts of numpy arrays."""
    rim_rings = np.linspace(0.80, 1.0, RINGS_RIM)
    radii = np.unique(np.concatenate([np.linspace(0, 0.80, RINGS_IN, endpoint=False), rim_rings]))
    phis = np.linspace(0, 2 * math.pi, SEGS, endpoint=False)
    rr, pp = np.meshgrid(radii, phis, indexing="ij")
    uu, vv = rr * np.cos(pp), rr * np.sin(pp)
    col = (uu + 1) / 2 * TEX - 0.5; row = (vv + 1) / 2 * TEX - 0.5
    hh = bilinear(coarse, col, row)
    px = 2 * R / TEX
    gx = np.gradient(coarse, axis=1) / px; gz = np.gradient(coarse, axis=0) / px
    nx = -bilinear(gx, col, row); nz = -bilinear(gz, col, row)
    nrm = np.stack([nx, np.ones_like(nx), nz], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    pos = np.stack([uu * R, hh, vv * R], -1)
    uv = np.stack([(uu + 1) / 2, (vv + 1) / 2], -1)
    nr, ns = len(radii), SEGS
    idx = []
    for i in range(nr - 1):
        for j in range(ns):
            a = i * ns + j; b = i * ns + (j + 1) % ns; c = a + ns; d = b + ns
            if i == 0:
                idx += [a, d, c]          # centre ring is a single point: one triangle per segment
            else:
                idx += [a, b, c, b, d, c]
    # Tangents for the normal map: u runs along +x; w=+1 makes the bitangent point to image-top (-z),
    # matching the normal map's +G (glTF: bitangent = cross(normal, tangent) * w).
    n2 = nrm.reshape(-1, 3)
    t = np.array([1.0, 0, 0]) - n2 * n2[:, :1]
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    top = {"pos": pos.reshape(-1, 3), "nrm": n2, "uv": uv.reshape(-1, 2), "idx": np.array(idx),
           "tan": np.concatenate([t, np.ones((len(t), 1))], 1)}
    top["idx"] = fix_winding(top["pos"], top["idx"], lambda p: np.array([0, 1, 0]))

    # Outer wall: from the lip edge down to the base, tucking in slightly at the bottom.
    edge_h = hh[-1]
    steps = 8
    P, N, T = [], [], []
    for s in range(steps + 1):
        t = s / steps
        rad = 1.0 - 0.035 * t ** 1.6
        for j in range(ns + 1):
            f = 2 * math.pi * j / ns
            y = edge_h[j % ns] * (1 - t)
            P.append((rad * R * math.cos(f), y, rad * R * math.sin(f)))
            tilt = -0.1 - 0.4 * t
            nv = np.array([math.cos(f), tilt, math.sin(f)]); N.append(nv / np.linalg.norm(nv))
            T.append((j / ns, t))
    idx = []
    for s in range(steps):
        for j in range(ns):
            a = s * (ns + 1) + j; b = a + 1; c = a + ns + 1; d = c + 1
            idx += [a, b, c, b, d, c]
    base0 = len(P)
    P.append((0, 0, 0)); N.append(np.array([0, -1, 0])); T.append((0.3, 0.97))
    for j in range(ns + 1):
        f = 2 * math.pi * j / ns
        P.append((0.965 * R * math.cos(f), 0, 0.965 * R * math.sin(f))); N.append(np.array([0, -1, 0])); T.append((j / ns, 0.97))
    for j in range(ns):
        idx += [base0, base0 + 1 + j, base0 + 2 + j]
    wall = {"pos": np.array(P), "nrm": np.array(N), "uv": np.array(T), "idx": np.array(idx)}

    def wall_out(p):
        if abs(p[1]) < 1e-9 and np.hypot(p[0], p[2]) < 0.9 * R:
            return np.array([0, -1, 0])
        return np.array([p[0], 0, p[2]])
    wall["idx"] = fix_winding(wall["pos"], wall["idx"], wall_out)
    return top, wall


def fix_winding(pos, idx, outward):
    idx = idx.reshape(-1, 3).copy()
    for k, (a, b, c) in enumerate(idx):
        n = np.cross(pos[b] - pos[a], pos[c] - pos[a])
        if np.dot(n, outward((pos[a] + pos[b] + pos[c]) / 3)) < 0:
            idx[k] = [a, c, b]
    return idx.ravel()


# ---------------------------------------------------------------- GLB
def write_glb(path, name, prims, images, materials):
    blobs, views, accessors = bytearray(), [], []

    def view(data, target=None):
        while len(blobs) % 4: blobs.append(0)
        views.append({"buffer": 0, "byteOffset": len(blobs), "byteLength": len(data), **({"target": target} if target else {})})
        blobs.extend(data)
        return len(views) - 1

    def acc(arr, ctype, typ, target, mm=False):
        a = {"bufferView": view(arr.tobytes(), target), "componentType": ctype, "count": int(arr.shape[0]), "type": typ}
        if mm: a["min"] = arr.min(axis=0).tolist(); a["max"] = arr.max(axis=0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    gprims = []
    for p, mat in prims:
        attrs = {"POSITION": acc(p["pos"].astype(np.float32), 5126, "VEC3", 34962, True),
                 "NORMAL": acc(p["nrm"].astype(np.float32), 5126, "VEC3", 34962),
                 "TEXCOORD_0": acc(p["uv"].astype(np.float32), 5126, "VEC2", 34962)}
        if "tan" in p:
            attrs["TANGENT"] = acc(p["tan"].astype(np.float32), 5126, "VEC4", 34962)
        big = p["pos"].shape[0] > 65535
        ind = acc(p["idx"].astype(np.uint32 if big else np.uint16), 5125 if big else 5123, "SCALAR", 34963)
        gprims.append({"attributes": attrs, "indices": ind, "material": mat})
    img_views = [view(b) for b in images]
    while len(blobs) % 4: blobs.append(0)
    gltf = {
        "asset": {"version": "2.0", "generator": "ugos tools/build-ar-models.py"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": gprims}],
        "materials": materials,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071},
                     {"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 33071}],
        "images": [{"bufferView": v, "mimeType": "image/jpeg"} for v in img_views],
        "textures": [{"source": 0, "sampler": 0}, {"source": 1, "sampler": 0}, {"source": 2, "sampler": 1}],
        "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(blobs)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blobs))
    out += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(blobs), 0x004E4942) + bytes(blobs)
    path.write_bytes(out)
    return len(out)


GLTF_MATERIALS = [
    {"name": "top", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 0.6},
     "normalTexture": {"index": 1, "scale": 1.0}},
    {"name": "crust", "pbrMetallicRoughness": {"baseColorTexture": {"index": 2}, "metallicFactor": 0, "roughnessFactor": 0.85}},
]


# ---------------------------------------------------------------- USDZ (Quick Look)
def write_usdz(path, name, prims, files):
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt
    tmp = Path(tempfile.mkdtemp())
    try:
        for fn, data in files.items():
            (tmp / fn).write_bytes(data)
        usda = tmp / "pizza.usdc"
        stage = Usd.Stage.CreateNew(str(usda))
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        root = UsdGeom.Xform.Define(stage, "/Pizza")
        stage.SetDefaultPrim(root.GetPrim())
        Usd.ModelAPI(root).SetKind("component")

        def material(mname, color_file, normal_file, rough):
            m = UsdShade.Material.Define(stage, f"/Pizza/Materials/{mname}")
            pbr = UsdShade.Shader.Define(stage, f"/Pizza/Materials/{mname}/PBR")
            pbr.CreateIdAttr("UsdPreviewSurface")
            pbr.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(rough)
            pbr.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
            m.CreateSurfaceOutput().ConnectToSource(pbr.ConnectableAPI(), "surface")
            st = UsdShade.Shader.Define(stage, f"/Pizza/Materials/{mname}/st")
            st.CreateIdAttr("UsdPrimvarReader_float2")
            st.CreateInput("varname", Sdf.ValueTypeNames.String).Set("st")
            st_out = st.CreateOutput("result", Sdf.ValueTypeNames.Float2)

            def tex(tname, f, raw):
                t = UsdShade.Shader.Define(stage, f"/Pizza/Materials/{mname}/{tname}")
                t.CreateIdAttr("UsdUVTexture")
                t.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(f)
                t.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(st_out)
                t.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("repeat")
                t.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("clamp")
                if raw:
                    t.CreateInput("sourceColorSpace", Sdf.ValueTypeNames.Token).Set("raw")
                    t.CreateInput("scale", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(2, 2, 2, 1))
                    t.CreateInput("bias", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(-1, -1, -1, 0))
                else:
                    t.CreateInput("sourceColorSpace", Sdf.ValueTypeNames.Token).Set("sRGB")
                return t
            c = tex("color", color_file, False)
            pbr.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(c.ConnectableAPI(), "rgb")
            if normal_file:
                n = tex("normal", normal_file, True)
                pbr.CreateInput("normal", Sdf.ValueTypeNames.Normal3f).ConnectToSource(n.ConnectableAPI(), "rgb")
            return m

        mats = [material("Top", "./top.jpg", "./normal.jpg", 0.6), material("Crust", "./side.jpg", None, 0.85)]
        for k, (p, mi) in enumerate(prims):
            mesh = UsdGeom.Mesh.Define(stage, f"/Pizza/Part{k}")
            pts = p["pos"].astype(np.float32)
            mesh.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(pts))
            mesh.CreateFaceVertexCountsAttr(Vt.IntArray.FromNumpy(np.full(len(p["idx"]) // 3, 3, np.int32)))
            # USD's default orientation is right-handed (CCW = front), same as glTF.
            mesh.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(p["idx"].astype(np.int32)))
            mesh.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(p["nrm"].astype(np.float32)))
            mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
            mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
            mesh.CreateExtentAttr(Vt.Vec3fArray([Gf.Vec3f(*pts.min(0).tolist()), Gf.Vec3f(*pts.max(0).tolist())]))
            st = p["uv"].astype(np.float32).copy(); st[:, 1] = 1 - st[:, 1]   # USD texture origin is bottom-left
            pv = UsdGeom.PrimvarsAPI(mesh).CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
            pv.Set(Vt.Vec2fArray.FromNumpy(st))
            UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(mats[mi])
        stage.GetRootLayer().Save()
        path.unlink(missing_ok=True)
        ok = UsdUtils.CreateNewARKitUsdzPackage(str(usda), str(path))
        if not ok:
            raise RuntimeError("USDZ packaging failed")
        from pxr import UsdValidation
        reg = UsdValidation.ValidationRegistry()
        ctx = UsdValidation.ValidationContext(reg.GetOrLoadAllValidators())
        errs = [e for e in ctx.Validate(Usd.Stage.Open(str(path)))
                if e.GetType() in (UsdValidation.ValidationErrorType.Error, UsdValidation.ValidationErrorType.Warn)]
        if errs:
            raise RuntimeError("USDZ validation: " + "; ".join(e.GetMessage() for e in errs))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return path.stat().st_size


# ---------------------------------------------------------------- main
def main():
    data = (ROOT / "js" / "data.js").read_text()
    menu = re.findall(r'\{ id: "([^"]+)", name: "([^"]+)", price: \d+, desc: "[^"]*", img: "(assets/img/pizza-[^"]+)"', data)
    wanted = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    for pid, name, img in menu:
        if wanted and pid not in wanted:
            continue
        src = SRC / f"{pid}.webp"
        top, side, ratio, crust = analyse(src if src.exists() else ROOT / img)
        H = DIAMETER_M * ratio
        coarse, fine, rim_in, top = height_field(pid, top, side, crust, H)
        top_p, wall_p = build_mesh(coarse, crust)
        files = {"top.jpg": jpeg(top, 88), "normal.jpg": jpeg(normal_map(fine), 92), "side.jpg": jpeg(side, 85)}
        prims = [(top_p, 0), (wall_p, 1)]
        g = write_glb(OUT / f"{pid}.glb", name, prims, [files["top.jpg"], files["normal.jpg"], files["side.jpg"]], GLTF_MATERIALS)
        u = write_usdz(OUT / f"{pid}.usdz", name, prims, files)
        print(f"{pid:18s} Ø {DIAMETER_M*100:.0f} cm  alto {H*100:.1f} cm  borde {rim_in:.2f}  glb {g/1024:.0f} KB  usdz {u/1024:.0f} KB")


if __name__ == "__main__":
    main()
