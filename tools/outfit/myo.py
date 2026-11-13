"""묘연: 재킷을 벗기고(어깨·위팔·겨드랑이를 다시 그림) 한쪽 스타킹을 맨다리로.

사용: python myo.py 입력.png 출력.png [--debug]
좌표는 배경을 지운 원본 일러스트 한 장(1536×1024, 두 캐릭터가 함께 있는 그림) 기준이다.
"""
import sys
import numpy as np
from PIL import Image
from lib import *

DEBUG = '--debug' in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
src = np.array(Image.open(ARGS[0]).convert('RGBA')).astype(np.float32)
img = src.copy()
S = img.shape[:2]
skin0 = skin_mask(src)

# ── 색 견본 ──
arm_box = np.zeros(S, bool); arm_box[235:270, 262:318] = True
SKIN = median_color(src, skin0 & arm_box)                        # 위팔 기본 피부
lit = skin0 & arm_box & (src[..., 0] > np.percentile(src[..., 0][skin0 & arm_box], 70))
SKIN_LIT = median_color(src, lit)
dark = skin0 & arm_box & (src[..., 0] < np.percentile(src[..., 0][skin0 & arm_box], 20))
SKIN_SH = median_color(src, dark)
LINE = np.array([92, 52, 56], np.float32)                         # 피부 외곽선 색

# ── 왼쪽(화면 기준) 팔: 어깨 → 위팔 바깥선 / 안쪽선 ──
L_OUT = [(397, 150), (380, 151), (362, 156), (346, 165), (332, 178), (318, 194), (303, 210), (289, 225), (272, 242), (256, 259), (246, 273)]
L_IN = [(391, 244), (375, 247), (356, 248), (338, 249), (323, 251)]
L_ARM = L_OUT + [(260, 282), (296, 268)] + L_IN[::-1] + [(397, 240)]
# 몸통(크롭탑) 왼쪽 경계 — 이 선의 오른쪽은 보존
L_TORSO = [(398, 146), (397, 200), (394, 245), (395, 270), (400, 300), (405, 313), (407, 330), (410, 346)]
L_JACKET = [(250, 150), (300, 147), (345, 149), (398, 146)] + L_TORSO[1:6] + [(406, 331), (398, 333), (384, 333), (370, 334), (356, 339), (352, 347), (334, 347), (330, 334), (322, 338), (315, 330), (300, 300), (250, 300)]

# ── 오른쪽 팔(들어 올린 팔) 밑 어깨·겨드랑이 ──
R_BODY = [(552, 148), (545, 159), (537, 174), (530, 188), (521, 203), (514, 216), (511, 232), (510, 248), (508, 262)]   # 팔 아랫선 → 겨드랑이 → 옆가슴
R_HOLE = [(491, 198), (499, 203), (505, 209), (510, 218)]                                        # 크롭탑 팔둘레 선
R_TOPLINE = [(470, 132), (482, 122), (494, 114), (507, 108), (519, 103), (529, 101)]                 # 어깨 윗선
R_SKIN = R_TOPLINE + [(534, 130), (538, 160)] + R_BODY[2:6] + R_HOLE[::-1] + [(484, 190), (474, 178), (466, 160)]
R_TORSO = [(468, 126), (466, 160), (474, 178), (484, 190), (491, 198), (499, 203), (504, 208), (510, 218), (511, 232), (510, 248), (508, 262), (508, 300), (503, 312), (500, 345), (510, 350), (513, 380), (520, 405), (528, 440), (533, 470)]
R_JACKET = [(468, 124), (482, 116), (494, 110), (507, 104), (519, 98), (530, 96), (536, 130), (540, 162), (552, 150), (566, 140), (600, 140), (600, 470)] + R_TORSO[::-1]

# ── 1) 재킷 지우기 (피부는 남김) ──
jacket = np.maximum(poly(S, L_JACKET, False), poly(S, R_JACKET, False))
r_, g_, b_ = src[..., 0], src[..., 1], src[..., 2]
hairlike = (((b_ - g_) > 22) & ~skin0) | (((r_ + g_ + b_) / 3 > 150) & ((b_ - r_) > 0))
band = poly(S, [(462, 110), (505, 100), (505, 200), (462, 200)], False) > .5
hair_keep = band & hairlike & ~skin0
hair_keep = ndi.binary_opening(hair_keep, iterations=1)
lab, n = ndi.label(hair_keep)
sizes = ndi.sum(hair_keep, lab, range(1, n + 1))
hair_keep = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= 30])
jacket = np.where(hair_keep, 0, jacket)
keep_skin = skin0.astype(np.float32)
jacket = np.maximum(jacket, poly(S, [(360, 328), (393, 328), (393, 337), (386, 339.5), (374, 339.5), (361, 336)], False))
img = erase(img, jacket * (1 - keep_skin))

# ── 2) 왼팔 칠하기 ──
armL = poly(S, L_ARM)
# 재킷 그림자가 진 피부 경계도 덮도록 살짝 넓힘
seam = blur((ndi.binary_dilation(~skin0, iterations=5) & (armL > .5)).astype(np.float32), 1.2)
fillL = np.clip(np.maximum(armL * (1 - keep_skin), seam * armL), 0, 1)
d_out = ndi.distance_transform_edt(1 - line(S, L_OUT, 1.5, False).round())
d_in = ndi.distance_transform_edt(1 - line(S, L_IN + [(305, 266), (296, 275)], 1.5, False).round())
t = d_out / np.maximum(d_out + d_in, 1e-3)                       # 0 = 바깥(밝음), 1 = 안쪽(그늘)
col = mix(SKIN_LIT, SKIN, smoothstep(0.1, 0.55, t))
col = mix(col, SKIN_SH, smoothstep(0.62, 0.9, t) * 0.85)
img = over(img, col, fillL)

# ── 3) 오른쪽 겨드랑이 칠하기 ──
r_box = np.zeros(S, bool); r_box[115:160, 535:575] = True
RSKIN = median_color(src, skin0 & r_box)
skR = poly(S, R_SKIN) * (1 - blur(hair_keep.astype(np.float32), 0.5))
dR = ndi.distance_transform_edt(1 - line(S, R_BODY, 1.5, False).round())
colR = mix(RSKIN, SKIN_LIT, 0.35)
colR = mix(colR, SKIN_SH, (1 - smoothstep(0, 10, dR)) * 0.5)
colR = mix(colR, SKIN_SH, (1 - smoothstep(0, 7, ndi.distance_transform_edt(~hair_keep))) * 0.6)   # 머리카락 그림자
seamR = blur((ndi.binary_dilation(~skin0, iterations=4) & (skR > .5)).astype(np.float32), 1.0)
img = over(img, colR, np.clip(np.maximum(skR * (1 - keep_skin), seamR * skR), 0, 1))

# ── 3b) 왼쪽 옆구리의 지퍼 손잡이를 옆 무늬로 덮기 ──
zip_area = poly(S, [(396, 270), (426, 270), (428, 346), (409, 346)] , False) * (1 - poly(S, [(300, 260)] + L_TORSO[3:] + [(300, 346)], False))
shifted = np.roll(src, -26, axis=1)
img = over(img, shifted[..., :3], blur(zip_area, 0.6))

# ── 4) 외곽선 ──
ink = np.maximum.reduce([
    taper(S, L_OUT, 1.2, 1.6, 2.0),
    taper(S, L_IN, 1.0, 1.6, 1.4),
    taper(S, R_BODY, 1.6, 1.0, 1.8),
    taper(S, R_HOLE, 1.0, 1.2, 1.5),
    taper(S, R_TOPLINE, 0.6, 1.2, 1.6) * (1 - blur(hair_keep.astype(np.float32), 1)),
    taper(S, [(394, 245), (395, 270), (400, 300), (404, 309)], 1.4, 1.2, 1.6),      # 크롭탑 옆선(왼쪽)
    taper(S, [(404, 309), (407, 330), (410, 346)], 1.2, 1.0, 1.5),                  # 허리(왼쪽)
    taper(S, [(508, 262), (508, 300), (504, 309)], 1.3, 1.2, 1.5),                  # 크롭탑 옆선(오른쪽)
    taper(S, [(504, 309), (501, 330), (500, 346)], 1.2, 1.0, 1.4),                  # 허리(오른쪽)
])
img = over(img, LINE, ink)
crease = taper(S, [(529, 108), (533, 130), (537, 156)], 0.4, 0.4, 0.9)  # 들어 올린 팔 앞쪽 주름
img = over(img, LINE, crease * 0.45)

# ── 5) 스타킹 → 맨다리 ──
r, g, b, al = (src[..., i] for i in range(4))
Lum = 0.299 * r + 0.587 * g + 0.114 * b
yy, xx = np.mgrid[0:S[0], 0:S[1]]
leg_zone = (xx > 250) & (xx < 412) & (yy >= 556) & (yy <= 823)
stock = leg_zone & (al > 40) & ~skin0
clip = poly(S, [(361, 546), (393, 546), (394, 592), (362, 592)], False) > .5   # 고리·끈도 함께 지움
stock = stock | (clip & (al > 40) & (yy >= 553))
stock = stock | ((yy >= 554) & (yy <= 568) & (xx > 300) & (xx < 408) & (al > 128) & (Lum < 205))   # 스타킹 윗단 선
stock = ndi.binary_fill_holes(stock)
lab, _ = ndi.label(stock)
stock = lab == lab[700, 330]                                     # 다리와 이어진 부분만 (꼬리 제외)
# 다른 쪽 맨다리에서 피부 밝기별 색 표를 만든다
other = skin0 & (xx > 440) & (xx < 590) & (yy > 600) & (yy < 820)
sl = Lum[other]; sc = src[..., :3][other]
order = np.argsort(sl); sl, sc = sl[order], sc[order]
q = np.linspace(0, 1, 101)
lut = np.array([sc[int(min(len(sc) - 1, max(0, t * (len(sc) - 1))))] for t in q])
lut = ndi.uniform_filter1d(lut, 9, axis=0)
# 스타킹의 입체감(부드러운 밝기) → 백분위 → 피부색
F = Lum.copy()
band = (yy >= 556) & (yy < 584)
F[band] = F[596][None, :].repeat(S[0], 0)[band]                 # 스타킹 밴드·고리 줄은 고리 아래 밝기로
F[(yy >= 584) & (yy < 596)] = F[596][None, :].repeat(S[0], 0)[(yy >= 584) & (yy < 596)]
# 고리 자리는 같은 줄의 좌우 밝기를 이어서 채움
for y in range(553, 597):
    cols = np.nonzero(stock[y, 330:430] & (F[y, 330:430] > 25))[0]
    if not len(cols): continue
    xr = 330 + cols.max() - 3
    F[y, 359:xr] = np.linspace(F[y, 358], F[y, xr], xr - 359)
Fm = np.where(stock, F, np.nan)
Fs = ndi.gaussian_filter(np.nan_to_num(Fm, nan=np.nanmedian(Fm)), 2.2)
vals = Fs[stock]
pct = np.zeros(S, np.float32)
ranks = np.argsort(np.argsort(vals))
pct[stock] = ranks / max(1, len(vals) - 1)
pct = np.clip(pct * 0.9 + 0.08, 0, 1)                            # 너무 어둡거나 밝은 끝은 피함
legcol = lut[(pct * 100).astype(int)]
# 맨 위는 허벅지 피부색과 자연스럽게 이어지게
row = src[551, :, :3].copy()
ok = skin0[551] & (src[551, :, 3] > 200)
xs = np.arange(S[1]); good = xs[ok & (xs > 300) & (xs < 410)]
for ch in range(3):                                             # 끈이 지나가던 칸은 좌우 피부색으로
    row[300:410, ch] = np.interp(xs[300:410], good, row[good, ch])
top_skin = row[None, :, :].repeat(S[0], 0)
wtop = (1 - smoothstep(556, 600, yy)) * 0.7
legcol = mix(legcol, top_skin, wtop * ((top_skin[..., 0] > 150) | ((xx > 300) & (xx < 410))))
img = over(img, legcol, stock.astype(np.float32))
# 허벅지 윗부분의 세로 줄무늬를 부드럽게
zone = (stock & (yy >= 553) & (yy < 610)).astype(np.float32)
sm = np.stack([ndi.gaussian_filter(img[..., c] * zone, (1.0, 3.0)) / np.maximum(ndi.gaussian_filter(zone, (1.0, 3.0)), 1e-3) for c in range(3)], -1)
img[..., :3] = np.where(zone[..., None] > 0, sm, img[..., :3])
# 바깥 윤곽선
edge = stock & ndi.binary_dilation(al < 128, iterations=1)
img = over(img, LINE, blur(edge.astype(np.float32), 0.4) * 0.9)

Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ARGS[1])
if DEBUG:  # 확인용 확대 그림 (빨강: 새로 그린 피부, 파랑: 지운 재킷 범위)
    ov = [(L_ARM + [L_ARM[0]], (255, 0, 0)), (L_JACKET + [L_JACKET[0]], (0, 0, 255)), (R_SKIN + [R_SKIN[0]], (255, 0, 0)), (R_JACKET + [R_JACKET[0]], (0, 0, 255))]
    preview(img, (240, 95, 600, 360), 'debug-myo-top.png', 2, overlays=ov)
    preview(img, (250, 500, 600, 880), 'debug-myo-leg.png', 2)
