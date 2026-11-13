"""옷을 고친 원본 한 장 → 사이트용 전신 그림 + 표정 생성기의 상반신 원본으로 잘라 저장.

사용: python export.py 고친그림.png
그다음 ../expressions 에서 `node render.cjs && python3 export.py` 로 표정 그림을 다시 만든다.
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
CROPS = [  # (자를 범위, 저장 위치)
    ((110, 0, 680, 1015), 'public/img/myo-full.webp'),
    ((820, 0, 1430, 1012), 'public/img/coco-full.webp'),
    ((242, 0, 645, 470), 'tools/expressions/base/myo-bust.webp'),
    ((815, 0, 1250, 520), 'tools/expressions/base/coco-bust.webp'),
]
sheet = Image.open(sys.argv[1]).convert('RGBA')
for box, rel in CROPS:
    sheet.crop(box).save(os.path.join(ROOT, rel), 'WEBP', quality=88, method=6)
    print('saved', rel)
