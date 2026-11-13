// 웹툰 캐릭터 — 사용자 제공 일러스트를 배경 없이 잘라 쓴다 (public/img/*.webp)
// 묘연: 검은 단발 + 보라 브릿지, 금빛 눈, 초승달 초커, 검은 크롭탑·숏팬츠 (사주방 주인)
// 코코: 은발 롱헤어 + 하늘색 리본, 파란 눈, 방울 초커, 흰 오프숄더 크롭탑·미니스커트 (조수)
// 표정 10종은 원본 위에 눈·입을 다시 그려 만든 변형 그림(img/expr/)이고, 머리 옆 만화 기호로 감정을 한 번 더 강조한다.
// 변형 그림 생성 도구: tools/expressions/

const INK = '#2A1B3D';

export const CHARACTERS = {
  myo: {
    name: '묘연',
    role: '사주방 주인 · 검은 고양이',
    bio: '장난기 많고 거침없지만, 연애 고민 앞에선 누구보다 다정한 점술사.',
    bust: { w: 403, h: 470 },
    full: { src: 'img/myo-full.webp', w: 570, h: 1015 },
    // 감정 기호 위치 (그림 폭·높이 대비 %)
    emote: { x: 0, y: 12 },
  },
  coco: {
    name: '코코',
    role: '묘연의 조수 · 하얀 고양이',
    bio: '수줍음이 많은 조수. 어려운 사주 용어를 대신 물어봐 줘요.',
    bust: { w: 435, h: 520 },
    full: { src: 'img/coco-full.webp', w: 610, h: 1012 },
    emote: { x: 76, y: 2 },
  },
};

const stroke = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

const heart = (x, y, s, fill = '#FF6FA8') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 9 C-9 3,-7 -6,0 -2 C7 -6,9 3,0 9 Z" fill="${fill}" ${stroke}/>`;
const spark = (x, y, s, fill = '#F7D54A') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill="${fill}" ${stroke}/>`;

// 만화식 감정 기호 (viewBox 0 0 60 60)
const EMOTES = {
  smile: '',
  happy: `<g fill="#FF6FA8" ${stroke}><path d="M18 40 V16 L34 12 V34"/><ellipse cx="14" cy="41" rx="5" ry="4"/><ellipse cx="30" cy="35" rx="5" ry="4"/></g>
    <g fill="#B9A2FF" ${stroke}><path d="M46 46 V28 L50 30"/><ellipse cx="42.5" cy="47" rx="4.2" ry="3.4"/></g>`,
  wink: heart(30, 30, 1.9) + spark(50, 12, 0.6),
  surprise: `<g fill="#F0524F" ${stroke}><path d="M22 6 L32 6 L29 38 L25 38 Z"/><circle cx="27" cy="48" r="4.5"/>
    <path d="M40 10 L48 10 L46 34 L42 34 Z"/><circle cx="44" cy="42" r="3.6"/></g>
    <path d="M8 14 L14 18 M6 28 L13 28 M8 42 L14 38" ${stroke} fill="none"/>`,
  think: `<path d="M18 20 C18 8, 42 8, 42 20 C42 30, 30 30, 30 38 L30 41" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M18 20 C18 8, 42 8, 42 20 C42 30, 30 30, 30 38 L30 41" fill="none" stroke="#B9A2FF" stroke-width="5" stroke-linecap="round"/>
    <circle cx="30" cy="52" r="4.5" fill="#B9A2FF" ${stroke}/>`,
  worry: `<path d="M30 6 C22 22, 16 30, 16 38 C16 47, 23 54, 30 54 C37 54, 44 47, 44 38 C44 30, 38 22, 30 6 Z" fill="#9ED8FF" ${stroke}/>
    <path d="M23 38 C23 33, 25 30, 27 27" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  smug: spark(22, 24, 1.5) + spark(46, 12, 0.8, '#fff') + spark(44, 44, 0.6),
  love: heart(20, 34, 1.6) + heart(44, 18, 1.15, '#FF8DBB') + heart(46, 46, 0.8),
  sparkle: spark(20, 20, 1.3) + spark(44, 30, 1.0, '#fff') + spark(22, 48, 0.7) + spark(50, 8, 0.55),
  pout: `<g fill="none" stroke="#F0524F" stroke-width="6" stroke-linecap="round">
    <path d="M14 14 Q24 20 24 10"/><path d="M46 14 Q36 20 36 10"/><path d="M14 46 Q24 40 24 50"/><path d="M46 46 Q36 40 36 50"/></g>`,
};

export const EXPRESSION_NAMES = Object.keys(EMOTES);

function emoteSvg(expr) {
  const body = EMOTES[expr];
  if (!body) return '';
  return `<svg class="emote emote--${expr}" viewBox="0 0 60 60" aria-hidden="true">${body}</svg>`;
}

/**
 * 대화 패널용 상반신 그림
 * @param {'myo'|'coco'} key
 * @param {keyof EMOTES} expr
 * @param {{title?:string, className?:string}} opts
 */
export function drawCharacter(key, expr = 'smile', opts = {}) {
  const c = CHARACTERS[key];
  const e = c.emote;
  return `<div class="char char--bust ${opts.className || ''}" role="img" aria-label="${opts.title || c.name}" style="--ex:${e.x}%;--ey:${e.y}%">
    <img class="char__img" src="img/expr/${key}-${EMOTES[expr] === undefined ? 'smile' : expr}.webp" width="${c.bust.w}" height="${c.bust.h}" alt="" loading="lazy" decoding="async">
    ${emoteSvg(expr)}
  </div>`;
}

/** 등장인물 소개용 전신 그림 */
export function fullBody(key, { eager = false } = {}) {
  const c = CHARACTERS[key];
  return `<img class="char__full" src="${c.full.src}" width="${c.full.w}" height="${c.full.h}" alt="${c.name}: ${c.role}" ${eager ? '' : 'loading="lazy"'} decoding="async">`;
}

/** 상담실 아바타 (묘연 얼굴, 표정별) */
export function faceAvatar(key, expr = 'smile') {
  const e = EMOTES[expr] === undefined ? 'smile' : expr;
  return `<img class="char char--face" src="img/expr/${key}-${e}-face.webp" width="256" height="256" alt="" decoding="async">`;
}
