// 표정 변형 생성기: 원본 상반신 위에 피부 패치 + 새 눈/입을 그린 SVG를 얹어 투명 PNG로 렌더
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const F = JSON.parse(fs.readFileSync(path.join(HERE, 'features.json'), 'utf8'));
const SKIN = JSON.parse(fs.readFileSync(path.join(HERE, 'skin.json'), 'utf8'));
const DIM = { myo: [403, 470], coco: [435, 520] };
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
const DEBUG = process.argv.includes('--debug');

const EXPR = {
  smile: {},
  happy: { eyes: 'closed' },
  wink: { eyeR: 'closed' },
  surprise: { mouth: 'o', brows: 'up' },
  think: { mouth: 'flat', brows: 'flat' },
  worry: { mouth: 'wavy', brows: 'worry', gloom: true },
  smug: { mouthByChar: { myo: 'smirk', coco: 'soft' } },
  love: { eyes: 'heart', blush: true },
  sparkle: { eyes: 'star' },
  pout: { eyes: 'squeeze', mouth: 'pout', blush: true, brows: 'angry' },
};

const n = (v) => Math.round(v * 100) / 100;
let gid = 0;

function patch(cx, cy, rx, ry, ang, color) {
  const id = `pg${gid++}`;
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}"/><stop offset=".72" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
  <ellipse cx="0" cy="0" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})" filter="url(#soft)" transform="translate(${cx} ${cy}) rotate(${ang})"/>`;
}

function at(cx, cy, ang, inner) {
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})">${inner}</g>`;
}

function eyeShape(kind, w, h, side, f) {
  const L = `fill="none" stroke="${f.lash}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  if (kind === 'closed') {
    return `<path d="M ${n(-w / 2)} ${n(h * 0.18)} Q 0 ${n(-h * 0.75)} ${n(w / 2)} ${n(h * 0.18)}" ${L}/>`
      + `<path d="M ${n(side * w / 2)} ${n(h * 0.18)} l ${n(side * 3)} ${n(-2.5)}" ${L} stroke-width="1.8"/>`;
  }
  if (kind === 'squeeze') {
    const s = side; // 왼눈 '>' 오른눈 '<'
    return `<path d="M ${n(s * w * 0.3)} ${n(-h * 0.42)} L ${n(-s * w * 0.26)} 0 L ${n(s * w * 0.3)} ${n(h * 0.42)}" ${L}/>`;
  }
  if (kind === 'heart') {
    const s = h * 0.78;
    const p = (x, y) => `${n(x * s)} ${n(y * s)}`;
    return `<path d="M ${p(0, 0.5)} C ${p(-1.05, -0.1)}, ${p(-0.6, -0.95)}, ${p(0, -0.4)} C ${p(0.6, -0.95)}, ${p(1.05, -0.1)}, ${p(0, 0.5)} Z" fill="#FF4F93" stroke="#7A1440" stroke-width="1"/>`
      + `<ellipse cx="${n(-s * 0.32)}" cy="${n(-s * 0.38)}" rx="${n(s * 0.16)}" ry="${n(s * 0.11)}" fill="#fff" opacity=".9"/>`;
  }
  if (kind === 'star') {
    const s = h * 0.42;
    const star = (x, y, r) => `<path d="M ${n(x)} ${n(y - r)} L ${n(x + r * 0.22)} ${n(y - r * 0.22)} L ${n(x + r)} ${n(y)} L ${n(x + r * 0.22)} ${n(y + r * 0.22)} L ${n(x)} ${n(y + r)} L ${n(x - r * 0.22)} ${n(y + r * 0.22)} L ${n(x - r)} ${n(y)} L ${n(x - r * 0.22)} ${n(y - r * 0.22)} Z" fill="#FFFBE0" stroke="#D4A21C" stroke-width=".7"/>`;
    return star(0, -h * 0.05, s) + star(w * 0.22, h * 0.25, s * 0.42);
  }
  return '';
}

function mouthShape(kind, w, h, f) {
  const S = `fill="none" stroke="${f.lip}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 'o': return `<ellipse cx="0" cy="${n(h * 0.05)}" rx="${n(w * 0.17)}" ry="${n(h * 0.27)}" fill="#8C2C40" stroke="${f.lip}" stroke-width="1.1"/><ellipse cx="0" cy="${n(h * 0.17)}" rx="${n(w * 0.1)}" ry="${n(h * 0.1)}" fill="#E07A8E"/>`;
    case 'flat': return `<path d="M ${n(-w * 0.24)} ${n(h * 0.06)} Q 0 ${n(-h * 0.04)} ${n(w * 0.24)} ${n(h * 0.13)}" ${S}/>`;
    case 'wavy': return `<path d="M ${n(-w * 0.3)} 0 q ${n(w * 0.075)} ${n(-h * 0.2)} ${n(w * 0.15)} 0 t ${n(w * 0.15)} 0 t ${n(w * 0.15)} 0" ${S}/>`;
    case 'smirk': return `<path d="M ${n(-w * 0.3)} ${n(-h * 0.02)} Q ${n(-w * 0.04)} ${n(h * 0.2)} ${n(w * 0.32)} ${n(-h * 0.2)}" ${S}/><path d="M ${n(w * 0.07)} ${n(h * 0.05)} l ${n(w * 0.06)} ${n(h * 0.22)} l ${n(w * 0.06)} ${n(-h * 0.25)} Z" fill="#fff" stroke="${f.lip}" stroke-width=".8"/>`;
    case 'cat': return `<path d="M ${n(-w * 0.3)} ${n(-h * 0.05)} Q ${n(-w * 0.15)} ${n(h * 0.24)} 0 ${n(-h * 0.02)} Q ${n(w * 0.15)} ${n(h * 0.24)} ${n(w * 0.3)} ${n(-h * 0.05)}" ${S}/>`;
    case 'soft': return `<path d="M ${n(-w * 0.27)} ${n(-h * 0.06)} Q 0 ${n(h * 0.32)} ${n(w * 0.27)} ${n(-h * 0.06)}" ${S}/>`;
    case 'pout': return `<path d="M ${n(-w * 0.13)} ${n(h * 0.12)} Q 0 ${n(-h * 0.2)} ${n(w * 0.13)} ${n(h * 0.12)}" ${S}/>`;
    default: return '';
  }
}

function browShape(kind, w, h, side, f) {
  if (!f.brow || !kind) return '';
  const S = `fill="none" stroke="${f.brow}" stroke-width="2" stroke-linecap="round" opacity=".9"`;
  const up = { up: -1.45, flat: -1.05, worry: -1.05, angry: -0.95 }[kind] * h;
  // side: -1 = 화면 왼쪽 눈 (안쪽 끝이 +x), +1 = 화면 오른쪽 눈 (안쪽 끝이 -x)
  const inner = -side;
  const lift = { up: 0, flat: 0, worry: -h * 0.45, angry: h * 0.4 }[kind];
  const xo = -inner * w * 0.32, xi = inner * w * 0.32;
  const yo = up, yi = up + lift;
  const bend = kind === 'up' ? -h * 0.35 : -h * 0.1;
  return `<path d="M ${n(xo)} ${n(yo)} Q ${n((xo + xi) / 2)} ${n((yo + yi) / 2 + bend)} ${n(xi)} ${n(yi)}" ${S}/>`;
}

function overlay(key, exprName) {
  const f = F[key], sk = SKIN[key], e = EXPR[exprName];
  const ang = f.angle;
  let defs = `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".9"/></filter>
    <filter id="blur3"><feGaussianBlur stdDeviation="2.4"/></filter>`;
  let g = '';
  const eyes = { eyeL: { side: -1 }, eyeR: { side: 1 } };
  const eyeKind = (part) => e[part] || e.eyes;
  // 1) 지울 부분 덮기
  for (const part of ['eyeL', 'eyeR']) {
    const k = eyeKind(part);
    if (k === 'closed' || k === 'squeeze') {
      const [cx, cy, w, h] = f[part];
      g += patch(cx, cy + 1, w * 0.64, h * 0.72, ang, sk[part]);
    }
  }
  const mouthKind = e.mouth || (e.mouthByChar && e.mouthByChar[key]);
  if (mouthKind) {
    const [cx, cy, w, h] = f.mouth;
    g += patch(cx, cy - (key === 'coco' ? 1 : 0), w * 0.66, h * (key === 'coco' ? 0.62 : 0.7), ang, sk.mouth);
  }
  // 2) 볼터치·그늘
  if (e.gloom) {
    const [lx, ly] = f.eyeL, [rx_, ry_] = f.eyeR;
    const cx = (lx + rx_) / 2, cy = (ly + ry_) / 2 - f.eyeL[3] * 0.9;
    defs += `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A64C8" stop-opacity=".42"/><stop offset="1" stop-color="#5A64C8" stop-opacity="0"/></linearGradient>`;
    g += at(cx, cy, ang, `<ellipse rx="${n(Math.hypot(rx_ - lx, ry_ - ly) * 1.15)}" ry="${n(f.eyeL[3] * 1.9)}" fill="url(#gl)" filter="url(#blur3)"/>`);
  }
  if (e.blush) {
    for (const [x, y] of [f.cheekL, f.cheekR]) {
      g += at(x, y, ang, `<ellipse rx="9" ry="5" fill="#FF5C8F" opacity=".38" filter="url(#blur3)"/>
        <path d="M -5 2.5 l 2.5 -4.5 M -1 2.5 l 2.5 -4.5 M 3 2.5 l 2.5 -4.5" stroke="#E2557F" stroke-width="1" stroke-linecap="round" opacity=".7"/>`);
    }
  }
  // 3) 새 이목구비
  for (const part of ['eyeL', 'eyeR']) {
    const k = eyeKind(part);
    const [cx, cy, w, h] = f[part];
    if (k) g += at(cx, cy, ang, eyeShape(k, w, h, eyes[part].side, f));
  }
  if (mouthKind) {
    const [cx, cy, w, h] = f.mouth;
    g += at(cx, cy, ang, mouthShape(mouthKind, w, h, f));
  }
  if (DEBUG) {
    for (const part of ['eyeL', 'eyeR', 'mouth']) {
      const [cx, cy, w, h] = f[part];
      g += at(cx, cy, ang, `<ellipse rx="${w / 2}" ry="${h / 2}" fill="none" stroke="red" stroke-width=".8"/><path d="M -2 0 H 2 M 0 -2 V 2" stroke="lime" stroke-width=".8"/>`);
    }
  }
  return `<defs>${defs}</defs>${g}`;
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ deviceScaleFactor: 1 });
  for (const key of ['myo', 'coco']) {
    const [W, H] = DIM[key];
    const src = 'data:image/webp;base64,' + fs.readFileSync(path.join(HERE, 'base', `${key}-bust.webp`)).toString('base64');
    for (const ex of Object.keys(EXPR)) {
      if (ONLY && !ONLY.includes(ex)) continue;
      const html = `<!doctype html><html><body style="margin:0;background:transparent">
        <div id="c" style="position:relative;width:${W}px;height:${H}px">
          <img src="${src}" style="position:absolute;inset:0;width:${W}px;height:${H}px">
          <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0">${overlay(key, ex)}</svg>
        </div></body></html>`;
      await page.setViewportSize({ width: W, height: H });
      await page.setContent(html, { waitUntil: 'load' });
      await page.locator('#c').screenshot({ path: path.join(OUT, `${key}-${ex}.png`), omitBackground: true });
    }
  }
  await b.close();
  console.log('rendered');
})();
