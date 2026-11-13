# 의상 수정 도구

제공받은 일러스트(배경을 지운 1536×1024 한 장, 저장소에는 없음)에서 옷의 면적을 줄인 스크립트예요.

- `myo.py` — 묘연: 재킷을 지우고 그 아래 어깨·위팔·겨드랑이·옆구리를 다시 그림. 한쪽 다리의 스타킹은
  반대쪽 맨다리의 피부색을 밝기별로 옮겨 칠해 맨다리로(가터 고리·끈 포함).
- `coco.py` — 코코: 무릎까지 오는 부츠를 발목 높이에서 잘라 앵클부츠로 만들고, 종아리는 무릎 바로 위
  다리의 가로 색 분포를 본떠 칠함. 부츠 입구에는 흰 테두리와 하늘색 줄을 그림.
- `export.py` — 결과를 사이트용 전신 그림(`public/img/*-full.webp`)과 표정 생성기 원본(`../expressions/base/`)으로 자름.

```bash
# numpy · Pillow · scipy 필요
python myo.py 원본.png 1단계.png
python coco.py 1단계.png 완성.png
python export.py 완성.png
cd ../expressions && node render.cjs && python3 export.py   # 표정 10종 다시 만들기
```

`--debug`를 붙이면 수정 범위를 그린 확대 그림(`debug-*.png`)을 함께 저장해요.
코코는 소매 뒤에 긴 머리카락이 있어 소매를 지우면 머리카락까지 새로 그려야 하므로 손대지 않았어요.
수정 전 그림은 git 기록(`1649556` 이전 커밋)의 `public/img/*-full.webp`에 남아 있어요.
