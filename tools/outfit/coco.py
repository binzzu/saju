"""코코: 무릎까지 오는 부츠 → 앵클부츠 (종아리를 맨다리로).

사용: python coco.py 입력.png 출력.png [--debug]   (좌표는 myo.py와 같은 원본 한 장 기준)
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
r, g, b, al = (src[..., i] for i in range(4))
yy, xx = np.mgrid[0:S[0], 0:S[1]]
skin = (al > 128) & (r > 150) & (r > b + 6) & (r > g + 10)

# ── 다리별 윤곽 (종아리 바깥선·안쪽선) 과 자르는 선(발목) ──
LEGS = {
    'L': dict(
        left=[(998, 672), (992, 686), (984, 715), (976, 755), (967, 800), (957, 838), (950, 858), (948, 866)],
        right=[(1057, 676), (1057, 688), (1056, 694), (1051, 706), (1046, 718), (1041, 735), (1036, 765), (1027, 800), (1013, 830), (999, 856), (991, 876)],
        cut=[(933, 866), (947, 867), (961, 870), (977, 875), (993, 881)],
        boot=[(975, 684), (1050, 688), (1060, 715), (1058, 760), (1050, 810), (1012, 860), (996, 884), (928, 870), (932, 840), (962, 760)],
        knee_y=700, fade=(674, 692),
        profile_rows=(668, 684),
    ),
    'R': dict(
        left=[(1058, 682), (1063, 692), (1067, 698), (1066, 715), (1065, 745), (1066, 785), (1068, 825), (1069, 860), (1067, 884)],
        right=[(1120, 686), (1123, 700), (1125, 718), (1124, 750), (1120, 790), (1112, 830), (1105, 862), (1102, 889)],
        cut=[(1054, 884), (1066, 885), (1078, 887), (1092, 889), (1106, 891)],
        boot=[(1050, 708), (1135, 712), (1138, 770), (1128, 840), (1112, 893), (1050, 890), (1048, 800)],
        knee_y=724, fade=(688, 712),
        profile_rows=(694, 710),
    ),
}
LINE = np.array([150, 96, 104], np.float32)       # 코코 피부 외곽선(분홍빛 갈색)
BOOT = np.array([243, 238, 250], np.float32)
BOOT_LINE = np.array([116, 104, 146], np.float32)
RIBBON = np.array([143, 178, 232], np.float32)

overlays = []
# 무릎 사이에 남은 부츠 조각(라벤더색) 지우기
sliver = poly(S, [(1050, 660), (1075, 660), (1075, 704), (1050, 704)], False) * ((b > r + 4) & (al > 0))
img = erase(img, sliver)
for k, L in LEGS.items():
    leg = poly(S, L['left'] + L['cut'][::-1][1:-1] + L['right'][::-1], smooth=True)
    # 자르는 선 아래는 남김
    below = poly(S, L['cut'] + [(L['cut'][-1][0] + 30, 1000), (L['cut'][0][0] - 30, 1000)], smooth=False)
    above = 1 - below
    boot = poly(S, L['boot'], smooth=False) * above
    # 1) 부츠 윗부분 지우기 (드러난 무릎 피부는 남김)
    knee = skin & (yy < L['knee_y'])          # 무릎 위로 드러난 피부만 보호
    img = erase(img, boot * (1 - knee))
    # 2) 종아리 색: 부츠 바로 위 다리의 가로 색 분포를 본뜬다
    y0, y1 = L['profile_rows']
    prof = []
    for y in range(y0, y1):
        xs = np.nonzero(skin[y, 900:1160])[0] + 900
        if k == 'L': xs = xs[xs < 1056]
        else: xs = xs[xs > 1058]
        if len(xs) < 10: continue
        seg = src[y, xs.min():xs.max() + 1, :3]
        prof.append(np.array([seg[int(t * (len(seg) - 1))] for t in np.linspace(0, 1, 64)]))
    prof = ndi.uniform_filter1d(np.median(np.stack(prof), 0), 5, axis=0)
    dl = ndi.distance_transform_edt(1 - line(S, L['left'], 1.2, True).round())
    dr = ndi.distance_transform_edt(1 - line(S, L['right'], 1.2, True).round())
    t = np.clip(dl / np.maximum(dl + dr, 1e-3), 0, 1)
    col = prof[(t * 63).astype(int)]
    # 발목 쪽은 살짝 그늘
    col = mix(col, col * np.array([0.93, 0.86, 0.88]), smoothstep(830, 885, yy) * 0.6)
    fade = smoothstep(L['fade'][0], L['fade'][1], yy)        # 무릎 쪽은 원래 피부로 서서히 이어짐
    img = over(img, col, leg * above * fade)
    # 3) 외곽선
    ink = np.maximum(taper(S, L['left'], 1.0, 1.4, 1.5), taper(S, L['right'], 1.0, 1.3, 1.5)) * above * fade
    img = over(img, LINE, ink)
    # 4) 앵클부츠 입구 테두리 (흰 띠 + 하늘색 리본선)
    cut = L['cut']
    band_top = [(x, y - 5) for x, y in cut]
    band = poly(S, band_top + cut[::-1], smooth=False)
    band = np.maximum(band, line(S, [(x, y - 2.5) for x, y in cut], 5.2, True))
    img = over(img, BOOT, band)
    img = over(img, RIBBON, line(S, [(x, y - 2) for x, y in cut], 1.6, True))
    img = over(img, BOOT_LINE, line(S, band_top, 1.3, True))
    img = over(img, BOOT_LINE, line(S, [(x, y + 0.5) for x, y in cut], 1.1, True) * 0.7)
    overlays += [(L['left'], (255, 0, 0)), (L['right'], (255, 0, 0)), (L['cut'], (0, 0, 255)), (L['boot'] + [L['boot'][0]], (0, 160, 0))]

Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ARGS[1])
if DEBUG:  # 빨강: 종아리 윤곽, 파랑: 앵클부츠 입구, 초록: 지운 부츠 범위
    preview(img, (900, 600, 1160, 1010), 'debug-coco-legs.png', 2, overlays=overlays)
