# out/*.png → public/img/expr/*.webp (+ 상담실 아바타용 묘연 얼굴)
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, '..', '..', 'public', 'img', 'expr')
EX = ['smile', 'happy', 'wink', 'surprise', 'think', 'worry', 'smug', 'love', 'sparkle', 'pout']
FACE = (68, 18, 260, 210)  # 묘연 얼굴 영역 (상반신 좌표)
os.makedirs(DEST, exist_ok=True)
for key in ['myo', 'coco']:
    for ex in EX:
        im = Image.open(os.path.join(HERE, 'out', f'{key}-{ex}.png')).convert('RGBA')
        im.save(os.path.join(DEST, f'{key}-{ex}.webp'), 'WEBP', quality=86, method=6)
        if key == 'myo':
            im.crop(FACE).resize((256, 256), Image.LANCZOS).save(os.path.join(DEST, f'myo-{ex}-face.webp'), 'WEBP', quality=86, method=6)
print('exported to', os.path.normpath(DEST))
