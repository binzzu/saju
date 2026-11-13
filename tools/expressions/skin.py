# 눈·입 주변 피부색 샘플링 → skin.json (render.cjs가 덮개 색으로 사용)
import json, math, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
def ring_color(im, cx, cy, rx, ry, ang, pad=4):
    px = im.load(); W, H = im.size
    a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    acc = [0, 0, 0]; n = 0
    for y in range(int(cy - ry - pad - 2), int(cy + ry + pad + 3)):
        for x in range(int(cx - rx - pad - 2), int(cx + rx + pad + 3)):
            if not (0 <= x < W and 0 <= y < H): continue
            dx, dy = x - cx, y - cy
            u = dx * ca + dy * sa; v = -dx * sa + dy * ca
            d_in = (u / rx) ** 2 + (v / ry) ** 2
            d_out = (u / (rx + pad)) ** 2 + (v / (ry + pad)) ** 2
            if d_in > 1 and d_out <= 1:
                r, g, b, al = px[x, y]
                lum = 0.3 * r + 0.59 * g + 0.11 * b
                if al > 200 and lum > 150 and r > b:  # skin only, skip lashes/hair
                    acc[0] += r; acc[1] += g; acc[2] += b; n += 1
    if not n: return None
    return '#%02x%02x%02x' % tuple(round(c / n) for c in acc)
F = json.load(open(os.path.join(HERE, 'features.json')))
out = {}
for key, f in F.items():
    im = Image.open(os.path.join(HERE, 'base', f'{key}-bust.webp')).convert('RGBA')
    out[key] = {}
    for part in ['eyeL', 'eyeR', 'mouth']:
        cx, cy, w, h = f[part]
        rx, ry = (w * 0.62, h * 0.8) if part != 'mouth' else (w * 0.62, h * 0.66)
        out[key][part] = ring_color(im, cx, cy, rx, ry, f['angle'])
print(json.dumps(out))
json.dump(out, open(os.path.join(HERE, 'skin.json'), 'w'))
