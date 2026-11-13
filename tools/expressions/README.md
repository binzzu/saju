# 표정 변형 그림 만들기

`base/`의 상반신 원본(배경을 지운 제공 일러스트) 위에 표정마다 눈·입을 다시 그려
`public/img/expr/`에 표정 10종(smile, happy, wink, surprise, think, worry, smug, love, sparkle, pout)을 만들어요.

1. `features.json` — 캐릭터별 눈·입 위치(중심 x, y, 폭, 높이), 고개 기울기, 속눈썹·입술 색
2. `python3 skin.py` — 눈·입 주변 피부색을 뽑아 `skin.json`에 저장 (Pillow 필요)
3. `node render.cjs [표정,표정]` — 덮개와 새 이목구비를 그려 `out/*.png`로 렌더 (Playwright 필요, `--debug`면 위치 표시)
4. `python3 export.py` — WebP로 변환해 `public/img/expr/`에 저장

그림을 바꾸면 `base/`의 파일과 `features.json`의 좌표만 새로 맞추면 돼요.
