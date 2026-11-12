// 웹툰 캐릭터 — 고양이 귀·꼬리를 가진 사주 상담가 두 명 (SVG로 그림)
// 묘연: 흑발 롱헤어, 보라 눈, 검은 오프숄더 크롭탑, 빨간 방울 목줄
// 코코: 주황 단발, 민트 눈, 핑크 홀터 크롭탑, 하늘색 하트 목줄

const INK = '#2A1B3D';

export const CHARACTERS = {
  myo: {
    name: '묘연',
    hair: '#2E2245', hairLight: '#6B54A3', hairShade: '#1C1430',
    earInner: '#FF9EC4',
    irisTop: '#5B2BB8', irisBottom: '#D3B6FF',
    skin: '#FFE6D8', skinShade: '#F5C4AE',
    top: '#2B2036', topTrim: '#B9A2FF', bottom: '#3B2D52',
    collar: '#D7263D', tag: 'bell', leash: '#D7263D',
    longHair: true, accessory: 'moon',
  },
  coco: {
    name: '코코',
    hair: '#FF9550', hairLight: '#FFC58F', hairShade: '#E0702E',
    earInner: '#FFC2D4',
    irisTop: '#127E6C', irisBottom: '#8BF0D2',
    skin: '#FFE9DC', skinShade: '#F7C9B3',
    top: '#FF6FA8', topTrim: '#FFFFFF', bottom: '#4A6FD8',
    collar: '#6EC3FF', tag: 'heart', leash: '#6EC3FF',
    longHair: false, accessory: 'bow',
  },
};

let uid = 0;

function eye(cx, cy, c, kind, side, id) {
  // side: -1 왼쪽 눈, 1 오른쪽 눈 (바깥 꼬리 방향)
  const o = side; // outer direction
  const x = (dx) => cx + dx * o;
  if (kind === 'closed' || (kind === 'wink' && side === 1)) {
    return `<path d="M ${cx - 11} ${cy + 1} Q ${cx} ${cy - 10} ${cx + 11} ${cy + 1}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
  }
  if (kind === 'line') {
    return `<path d="M ${cx - 11} ${cy} Q ${cx} ${cy + 3} ${cx + 11} ${cy}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  const big = kind === 'surprise';
  const ry = big ? 15 : 13.5;
  const almond = `M ${x(-13)} ${cy - 2} Q ${cx} ${cy - ry - 4} ${x(12)} ${cy - 3} Q ${x(11)} ${cy + ry} ${cx} ${cy + ry + 1} Q ${x(-12)} ${cy + ry - 1} ${x(-13)} ${cy - 2} Z`;
  const clip = `eye${id}${side > 0 ? 'r' : 'l'}`;
  let iris;
  if (kind === 'heart') {
    iris = `<path d="M ${cx} ${cy + 9} C ${cx - 14} ${cy - 1}, ${cx - 8} ${cy - 12}, ${cx} ${cy - 4} C ${cx + 8} ${cy - 12}, ${cx + 14} ${cy - 1}, ${cx} ${cy + 9} Z" fill="#FF4F93" stroke="#C2185B" stroke-width="1"/>
      <circle cx="${cx - 4}" cy="${cy - 4}" r="2" fill="#fff"/>`;
  } else if (kind === 'star') {
    iris = `<ellipse cx="${cx}" cy="${cy + 1}" rx="8.5" ry="11" fill="url(#iris${id})"/>
      <path d="M ${cx} ${cy - 7} L ${cx + 2.5} ${cy - 1} L ${cx + 8} ${cy} L ${cx + 3} ${cy + 3} L ${cx + 4.5} ${cy + 9} L ${cx} ${cy + 5.5} L ${cx - 4.5} ${cy + 9} L ${cx - 3} ${cy + 3} L ${cx - 8} ${cy} L ${cx - 2.5} ${cy - 1} Z" fill="#FFF6B0"/>`;
  } else {
    const irx = big ? 6.5 : 9, iry = big ? 8.5 : 11.5;
    const lookUp = kind === 'think' ? -3 : 0;
    const lookSide = kind === 'think' ? 3 : 0;
    iris = `<ellipse cx="${cx + lookSide}" cy="${cy + 1 + lookUp}" rx="${irx}" ry="${iry}" fill="url(#iris${id})"/>
      <ellipse cx="${cx + lookSide}" cy="${cy + 1 + lookUp}" rx="${big ? 1.6 : 2.6}" ry="${big ? 4 : 7}" fill="${INK}"/>
      <circle cx="${cx - 3.5 + lookSide}" cy="${cy - 4 + lookUp}" r="${big ? 2.4 : 3.2}" fill="#fff"/>
      <circle cx="${cx + 4 + lookSide}" cy="${cy + 6 + lookUp}" r="1.5" fill="#fff" opacity=".9"/>`;
  }
  let lid = '';
  if (kind === 'smug') {
    lid = `<path d="M ${x(-15)} ${cy - 18} L ${x(14)} ${cy - 18} L ${x(13)} ${cy - 1} Q ${cx} ${cy - 5} ${x(-14)} ${cy} Z" fill="${c.skin}"/>`;
  }
  const lashY = kind === 'smug' ? cy + 1 : cy - 2;
  const lash = kind === 'smug'
    ? `<path d="M ${x(-14)} ${lashY} Q ${cx} ${cy - 5} ${x(13)} ${cy - 1}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`
    : `<path d="M ${x(-14)} ${cy - 1} Q ${cx} ${cy - ry - 5} ${x(13)} ${cy - 4}" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/>
       <path d="M ${x(-13)} ${cy - 1} L ${x(-18)} ${cy - 6}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  return `<clipPath id="${clip}"><path d="${almond}"/></clipPath>
    <path d="${almond}" fill="#fff"/>
    <g clip-path="url(#${clip})">${iris}${lid}</g>
    ${lash}
    <path d="M ${x(-9)} ${cy + ry - 1} Q ${cx} ${cy + ry + 2} ${x(8)} ${cy + ry - 2}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".45" stroke-linecap="round"/>`;
}

function brows(kind) {
  const s = `fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" opacity=".85"`;
  if (kind === 'worry') return `<path d="M 90 92 Q 99 91 107 85" ${s}/><path d="M 150 92 Q 141 91 133 85" ${s}/>`;
  if (kind === 'surprise') return `<path d="M 90 86 Q 98 79 107 82" ${s}/><path d="M 150 86 Q 142 79 133 82" ${s}/>`;
  if (kind === 'angry') return `<path d="M 90 86 Q 99 88 107 93" ${s}/><path d="M 150 86 Q 141 88 133 93" ${s}/>`;
  if (kind === 'smug') return `<path d="M 90 91 Q 98 88 107 89" ${s}/><path d="M 150 87 Q 142 81 133 85" ${s}/>`;
  return `<path d="M 90 90 Q 98 85 107 87" ${s}/><path d="M 150 90 Q 142 85 133 87" ${s}/>`;
}

function mouth(kind) {
  const line = `fill="none" stroke="#8A2F4F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 'open':
      return `<path d="M 111 144 Q 120 158 129 144 Z" fill="#9C2F55" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M 115 151 Q 120 155 125 151 Q 120 148 115 151 Z" fill="#FF8FB1"/>
        <path d="M 124 144 L 125.5 147.5 L 127 144 Z" fill="#fff"/>`;
    case 'o':
      return `<ellipse cx="120" cy="149" rx="4" ry="5" fill="#9C2F55" stroke="${INK}" stroke-width="1.4"/>`;
    case 'fang':
      return `<path d="M 111 145 Q 115.5 150 120 145 Q 124.5 150 129 145" ${line}/>
        <path d="M 123 147.2 L 124.6 151 L 126.2 147" fill="#fff" stroke="#8A2F4F" stroke-width="1"/>`;
    case 'wavy':
      return `<path d="M 112 149 Q 116 145.5 120 149 Q 124 152.5 128 149" ${line}/>`;
    case 'flat':
      return `<path d="M 115 148 Q 120 149.5 125 148" ${line}/>`;
    case 'pout':
      return `<path d="M 116 150 Q 120 146 124 150" ${line}/>`;
    default: // cat smile ω
      return `<path d="M 111 145 Q 115.5 150.5 120 145 Q 124.5 150.5 129 145" ${line}/>`;
  }
}

const EXPRESSIONS = {
  smile: { eyes: 'open', mouth: 'cat', brows: 'normal' },
  happy: { eyes: 'closed', mouth: 'open', brows: 'normal' },
  wink: { eyes: 'wink', mouth: 'fang', brows: 'normal' },
  surprise: { eyes: 'surprise', mouth: 'o', brows: 'surprise', sweat: true },
  think: { eyes: 'think', mouth: 'flat', brows: 'normal' },
  worry: { eyes: 'open', mouth: 'wavy', brows: 'worry', sweat: true },
  smug: { eyes: 'smug', mouth: 'fang', brows: 'smug' },
  love: { eyes: 'heart', mouth: 'open', brows: 'normal' },
  sparkle: { eyes: 'star', mouth: 'open', brows: 'surprise' },
  pout: { eyes: 'open', mouth: 'pout', brows: 'angry' },
};

function hairBack(c) {
  if (c.longHair) {
    return `<path d="M 120 34 C 58 34, 46 88, 52 140 C 56 186, 40 236, 46 300 L 194 300 C 200 236, 184 186, 188 140 C 194 88, 182 34, 120 34 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 66 160 C 62 200, 58 240, 60 296" fill="none" stroke="${c.hairLight}" stroke-width="2" opacity=".5"/>
      <path d="M 176 160 C 180 200, 184 240, 182 296" fill="none" stroke="${c.hairLight}" stroke-width="2" opacity=".5"/>`;
  }
  return `<path d="M 120 34 C 60 34, 52 88, 56 130 C 58 162, 62 182, 74 188 Q 80 176 86 186 L 154 186 Q 160 176 166 188 C 178 182, 182 162, 184 130 C 188 88, 180 34, 120 34 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
}

function ears(c) {
  const ear = (pts, inner, tuft) => `<path d="${pts}" fill="${c.hair}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${inner}" fill="${c.earInner}"/>
    <path d="${tuft}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".8" stroke-linecap="round"/>`;
  return ear('M 64 70 L 70 10 L 112 44 Z', 'M 74 60 L 77 24 L 102 46 Z', 'M 80 50 l -3 -6 M 84 52 l -1 -7')
    + ear('M 176 70 L 170 10 L 128 44 Z', 'M 166 60 L 163 24 L 138 46 Z', 'M 160 50 l 3 -6 M 156 52 l 1 -7');
}

function body(c, id) {
  // 어깨·팔·배(크롭탑 아래) — 피부
  const skin = `<path d="M 107 176 C 98 190, 80 194, 64 202 C 50 210, 44 236, 44 300 L 196 300 C 196 236, 190 210, 176 202 C 160 194, 142 190, 133 176 Z" fill="${c.skin}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 72 238 Q 76 268 73 300" fill="none" stroke="${c.skinShade}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 168 238 Q 164 268 167 300" fill="none" stroke="${c.skinShade}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 94 204 Q 106 210 115 206" fill="none" stroke="${c.skinShade}" stroke-width="2" stroke-linecap="round"/>
    <path d="M 125 206 Q 134 210 146 204" fill="none" stroke="${c.skinShade}" stroke-width="2" stroke-linecap="round"/>
    <path d="M 120 274 L 120 280" stroke="${c.skinShade}" stroke-width="2" stroke-linecap="round"/>`;
  // 목
  const neck = `<path d="M 107 148 L 107 182 Q 120 190 133 182 L 133 148 Z" fill="${c.skin}" stroke="${INK}" stroke-width="2.2"/>
    <path d="M 107 160 Q 120 170 133 160 L 133 150 L 107 150 Z" fill="${c.skinShade}" opacity=".7"/>`;
  let top;
  if (c.top === CHARACTERS.myo.top) {
    // 오프숄더 반도 크롭탑 + 러플
    top = `<path d="M 66 226 Q 120 238 174 226 L 171 262 Q 120 270 69 262 Z" fill="${c.top}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 68 230 Q 120 242 172 230" fill="none" stroke="${c.topTrim}" stroke-width="2.4"/>
      <path d="M 70 258 Q 120 266 170 258" fill="none" stroke="${c.topTrim}" stroke-width="1.6" stroke-dasharray="4 4"/>
      <path d="M 46 224 q 6 -6 12 0 q 6 -6 12 0 q 2 -2 4 2 L 72 244 q -8 6 -13 0 q -6 6 -11 0 q -4 2 -4 -6 Z" fill="${c.top}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M 194 224 q -6 -6 -12 0 q -6 -6 -12 0 q -2 -2 -4 2 L 168 244 q 8 6 13 0 q 6 6 11 0 q 4 2 4 -6 Z" fill="${c.top}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M 66 290 Q 120 298 174 290 L 176 300 L 64 300 Z" fill="${c.bottom}" stroke="${INK}" stroke-width="2.2"/>`;
  } else {
    // 홀터넥 크롭탑 + 리본
    top = `<path d="M 112 186 L 88 228 L 100 228 L 118 190 Z" fill="${c.top}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M 128 186 L 152 228 L 140 228 L 122 190 Z" fill="${c.top}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M 70 230 Q 120 220 170 230 L 168 262 Q 120 270 72 262 Z" fill="${c.top}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 74 256 Q 120 264 166 256" fill="none" stroke="${c.topTrim}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>
      <path d="M 120 232 l -12 -7 l 0 14 Z M 120 232 l 12 -7 l 0 14 Z" fill="${c.topTrim}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="120" cy="232" r="3.2" fill="${c.top}" stroke="${INK}" stroke-width="1.4"/>
      <path d="M 66 290 Q 120 297 174 290 L 176 300 L 64 300 Z" fill="${c.bottom}" stroke="${INK}" stroke-width="2.2"/>`;
  }
  return { skin, neck, top };
}

function collar(c, leash) {
  const band = `<path d="M 105 166 Q 120 174 135 166 L 135 176 Q 120 184 105 176 Z" fill="${c.collar}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 107 170 Q 120 177 133 170" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/>`;
  const ring = `<circle cx="120" cy="183" r="4.2" fill="none" stroke="#C9A227" stroke-width="2"/>`;
  let charm;
  if (c.tag === 'heart') {
    charm = `<path d="M 120 199 C 110 192, 111 184, 116 184 C 118 184, 119.5 185.5, 120 187 C 120.5 185.5, 122 184, 124 184 C 129 184, 130 192, 120 199 Z" fill="#FF6FA8" stroke="${INK}" stroke-width="1.6"/>
      <circle cx="129" cy="191" r="4.5" fill="#F2C14E" stroke="${INK}" stroke-width="1.4"/>`;
  } else {
    charm = `<circle cx="120" cy="191" r="6.5" fill="#F2C14E" stroke="${INK}" stroke-width="1.6"/>
      <path d="M 114.5 190 L 125.5 190" stroke="${INK}" stroke-width="1.2"/>
      <circle cx="120" cy="194" r="1.4" fill="${INK}"/>
      <circle cx="117.5" cy="188" r="1.4" fill="#fff" opacity=".8"/>`;
  }
  const strap = leash
    ? `<path d="M 123 185 C 140 200, 158 214, 166 240 S 176 286, 190 300" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
       <path d="M 123 185 C 140 200, 158 214, 166 240 S 176 286, 190 300" fill="none" stroke="${c.leash}" stroke-width="3" stroke-linecap="round"/>`
    : '';
  return band + ring + charm + strap;
}

function accessory(c) {
  if (c.accessory === 'moon') {
    return `<path d="M 72 60 A 13 13 0 1 0 90 78 A 10 10 0 1 1 72 60 Z" fill="#F7D54A" stroke="${INK}" stroke-width="1.8"/>
      <path d="M 96 62 l 1.6 3.4 3.6 .4 -2.7 2.4 .8 3.6 -3.3 -1.9 -3.2 1.9 .8 -3.6 -2.7 -2.4 3.6 -.4 Z" fill="#F7D54A" stroke="${INK}" stroke-width="1"/>`;
  }
  return `<path d="M 160 58 l -14 -9 l 0 18 Z M 160 58 l 14 -9 l 0 18 Z" fill="#FF6FA8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="160" cy="58" r="4" fill="#FF8DBB" stroke="${INK}" stroke-width="1.6"/>`;
}

function tail(c) {
  return `<path d="M 200 300 C 236 276, 210 230, 232 196 C 238 186, 230 180, 224 190" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
    <path d="M 200 300 C 236 276, 210 230, 232 196 C 238 186, 230 180, 224 190" fill="none" stroke="${c.hair}" stroke-width="10.5" stroke-linecap="round"/>`;
}

/**
 * 캐릭터 SVG 문자열
 * @param {'myo'|'coco'} key
 * @param {keyof EXPRESSIONS} expr
 * @param {{flip?:boolean, leash?:boolean, crop?:'bust'|'face', className?:string, title?:string}} opts
 */
export function drawCharacter(key, expr = 'smile', opts = {}) {
  const c = CHARACTERS[key];
  const e = EXPRESSIONS[expr] || EXPRESSIONS.smile;
  const id = `${key}${++uid}`;
  const flip = opts.flip ? 'transform="translate(240 0) scale(-1 1)"' : '';
  const viewBox = opts.crop === 'face' ? '40 6 160 160' : '0 0 240 300';
  const leash = opts.leash !== false;
  const b = body(c, id);
  const sideLocks = c.longHair
    ? `<path d="M 70 92 C 60 132, 62 176, 72 212 C 80 186, 82 140, 86 106 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
       <path d="M 170 92 C 180 132, 178 176, 168 212 C 160 186, 158 140, 154 106 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
    : `<path d="M 70 92 C 62 122, 64 150, 72 168 C 78 150, 80 126, 86 106 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
       <path d="M 170 92 C 178 122, 176 150, 168 168 C 162 150, 160 126, 154 106 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  const sweat = e.sweat
    ? `<path d="M 168 84 C 162 94, 164 102, 170 102 C 176 102, 177 94, 168 84 Z" fill="#9ED8FF" stroke="${INK}" stroke-width="1.6"/>`
    : '';
  const blush = `<ellipse cx="91" cy="137" rx="9" ry="4.5" fill="#FF7FA8" opacity=".38"/>
    <ellipse cx="149" cy="137" rx="9" ry="4.5" fill="#FF7FA8" opacity=".38"/>
    <path d="M 86 139 l 3 -5 M 91 139 l 3 -5 M 96 139 l 3 -5" stroke="#E85A8A" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
    <path d="M 144 139 l 3 -5 M 149 139 l 3 -5 M 154 139 l 3 -5" stroke="#E85A8A" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`;

  const title = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg class="char ${opts.className || ''}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.title || c.name}">${title}
  <defs>
    <linearGradient id="iris${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.irisTop}"/><stop offset="1" stop-color="${c.irisBottom}"/>
    </linearGradient>
  </defs>
  <g ${flip}>
    ${opts.crop === 'face' ? '' : tail(c)}
    ${hairBack(c)}
    ${ears(c)}
    ${b.skin}
    ${b.top}
    ${b.neck}
    ${collar(c, leash && opts.crop !== 'face')}
    <path d="M 72 100 C 72 58, 168 58, 168 100 L 166 120 C 162 142, 140 162, 120 166 C 100 162, 78 142, 74 120 Z" fill="${c.skin}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    ${blush}
    ${eye(100, 120, c, e.eyes, -1, id)}
    ${eye(140, 120, c, e.eyes === 'wink' ? 'wink' : e.eyes, 1, id)}
    <path d="M 120.5 134 L 119 138" stroke="${c.skinShade}" stroke-width="1.8" stroke-linecap="round"/>
    ${mouth(e.mouth)}
    <path d="M 66 108 C 62 58, 92 36, 120 36 C 148 36, 178 58, 174 108 Q 166 92 158 102 Q 152 80 138 96 Q 128 74 118 94 Q 106 76 98 98 Q 88 82 82 104 Q 74 94 66 108 Z" fill="${c.hair}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 84 58 Q 120 44 156 58" fill="none" stroke="${c.hairLight}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    ${sideLocks}
    ${brows(e.brows)}
    ${accessory(c)}
    ${sweat}
  </g>
</svg>`;
}

export function faceAvatar(key, expr = 'smile') {
  return drawCharacter(key, expr, { crop: 'face', leash: false, className: 'char--face' });
}

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
