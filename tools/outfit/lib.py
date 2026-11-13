"""Small raster helpers for outfit edits (sheet coordinates)."""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

SS = 4  # supersampling for anti-aliased masks


def catmull(pts, closed=False, n=10):
    """Catmull-Rom spline through pts."""
    P = [np.array(p, float) for p in pts]
    if closed:
        P = [P[-1]] + P + [P[0], P[1]]
    else:
        P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-2])
    return [tuple(p) for p in out]


def poly(shape, pts, smooth=True):
    """Anti-aliased filled polygon mask (float 0..1)."""
    H, W = shape
    if smooth:
        pts = catmull(pts, closed=True)
    im = Image.new('L', (W * SS, H * SS), 0)
    ImageDraw.Draw(im).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return np.array(im.resize((W, H), Image.BOX)).astype(np.float32) / 255


def line(shape, pts, width, smooth=True):
    H, W = shape
    if smooth and len(pts) > 2:
        pts = catmull(pts, closed=False)
    im = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(im)
    d.line([(x * SS, y * SS) for x, y in pts], fill=255, width=max(1, int(round(width * SS))), joint='curve')
    r = width * SS / 2
    for x, y in (pts[0], pts[-1]):  # round caps
        d.ellipse([x * SS - r, y * SS - r, x * SS + r, y * SS + r], fill=255)
    return np.array(im.resize((W, H), Image.BOX)).astype(np.float32) / 255


def taper(shape, pts, w0, w1, wmid=None, smooth=True):
    """Stroke whose width goes w0 -> wmid -> w1 (line-art style)."""
    if smooth and len(pts) > 2:
        pts = catmull(pts, closed=False)
    H, W = shape
    im = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(im)
    n = len(pts)
    wmid = (w0 + w1) / 2 if wmid is None else wmid
    for i in range(n - 1):
        t = i / max(1, n - 2)
        w = (w0 + (wmid - w0) * t * 2) if t < .5 else (wmid + (w1 - wmid) * (t - .5) * 2)
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        d.line([(x0 * SS, y0 * SS), (x1 * SS, y1 * SS)], fill=255, width=max(1, int(round(w * SS))))
        r = w * SS / 2
        d.ellipse([x1 * SS - r, y1 * SS - r, x1 * SS + r, y1 * SS + r], fill=255)
    return np.array(im.resize((W, H), Image.BOX)).astype(np.float32) / 255


def blur(m, s):
    return ndi.gaussian_filter(m, s) if s > 0 else m


def over(img, color_rgb, mask):
    """Composite a solid/per-pixel color over img (RGBA float) with coverage mask."""
    m = np.clip(mask, 0, 1)[..., None]
    c = np.asarray(color_rgb, np.float32)
    if c.ndim == 1:
        c = c[None, None, :3]
    a = img[..., 3:4] / 255
    out_a = m + a * (1 - m)
    rgb = (c[..., :3] * m + img[..., :3] * a * (1 - m)) / np.maximum(out_a, 1e-6)
    img[..., :3] = np.where(out_a > 0, rgb, img[..., :3])
    img[..., 3:4] = out_a * 255
    return img


def erase(img, mask):
    img[..., 3] *= (1 - np.clip(mask, 0, 1))
    return img


def skin_mask(img):
    r, g, b, al = (img[..., i] for i in range(4))
    L = 0.299 * r + 0.587 * g + 0.114 * b
    return (al > 128) & (r > 140) & (r > g + 12) & (g > b - 5) & (r - b > 25) & (L > 110)


def median_color(img, mask):
    return np.median(img[..., :3][mask > 0.5], axis=0)


def mix(a, b, t):
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
    t = np.asarray(t, np.float32)[..., None]
    return a * (1 - t) + b * t


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def preview(img, box, path, s=3, bg=(200, 255, 200), overlays=()):
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1].copy()
    a = sub[..., 3:4] / 255
    rgb = sub[..., :3] * a + np.array(bg, np.float32) * (1 - a)
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize(((x1 - x0) * s, (y1 - y0) * s), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for pts, col in overlays:
        d.line([((x - x0) * s, (y - y0) * s) for x, y in pts], fill=col, width=1)
        for x, y in pts:
            d.ellipse([(x - x0) * s - 2, (y - y0) * s - 2, (x - x0) * s + 2, (y - y0) * s + 2], outline=col)
    im.save(path)
