// 웹툰 조각 — 말풍선 패널·정보 패널·회차 제목·하트 게이지·보기 스위치 (HTML 문자열을 만드는 순수 함수)
import { drawCharacter } from './characters.js';

const NAMES = { myo: '묘연', coco: '코코' };

export function talk(who, expr, html, { side = 'left', scene = 'pink', sfx = '', sfxPos = '', caption = '' } = {}) {
  const right = side === 'right';
  const art = drawCharacter(who, expr, { title: NAMES[who] });
  return `<section class="panel scene-${scene}">
    ${caption ? `<p class="caption">${caption}</p>` : ''}
    <div class="talk ${right ? 'is-right' : ''}">
      <div class="art">${art}</div>
      <div class="bubble-wrap"><div class="bubble"><span class="who who--${who}">${NAMES[who]}</span>${html}</div></div>
    </div>
    ${sfx ? `<span class="sfx ${sfxPos || (right ? 'sfx--tl' : 'sfx--tr')}" aria-hidden="true">${sfx}</span>` : ''}
  </section>`;
}

export function info(inner, scene = 'paper', extraClass = '') {
  return `<section class="panel scene-${scene} ${extraClass}"><div class="info">${inner}</div></section>`;
}

export function episode(no, title) {
  return `<div class="episode"><span class="episode__no">${no}</span><h2 class="episode__title">${title}</h2></div>`;
}

export const p = (t) => `<p>${t}</p>`;

export function heartGauge(score) {
  const top = 12 + (100 - score) * 0.84;
  return `<svg class="heart" viewBox="0 0 120 108" role="img" aria-label="궁합 ${score}점">
    <defs><clipPath id="heartClip"><path d="M60 102 C 20 76, 4 54, 4 32 C 4 14, 18 4, 32 4 C 44 4, 54 11, 60 22 C 66 11, 76 4, 88 4 C 102 4, 116 14, 116 32 C 116 54, 100 76, 60 102 Z"/></clipPath></defs>
    <path d="M60 102 C 20 76, 4 54, 4 32 C 4 14, 18 4, 32 4 C 44 4, 54 11, 60 22 C 66 11, 76 4, 88 4 C 102 4, 116 14, 116 32 C 116 54, 100 76, 60 102 Z" fill="#fff"/>
    <g clip-path="url(#heartClip)"><rect class="heart__fill" x="0" y="${top}" width="120" height="120" fill="#FF6FA8"/>
      <path d="M0 ${top} q 15 -6 30 0 t 30 0 t 30 0 t 30 0" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/></g>
    <path d="M60 102 C 20 76, 4 54, 4 32 C 4 14, 18 4, 32 4 C 44 4, 54 11, 60 22 C 66 11, 76 4, 88 4 C 102 4, 116 14, 116 32 C 116 54, 100 76, 60 102 Z" fill="none" stroke="#2A1B3D" stroke-width="4" stroke-linejoin="round"/>
    <text class="heart__num" x="60" y="62" text-anchor="middle" font-size="30" fill="#2A1B3D" data-count="${score}">${score}</text>
    <text x="60" y="80" text-anchor="middle" font-size="11" fill="#2A1B3D">점</text>
  </svg>`;
}

export function switchNav(label, items, cur) {
  return `<nav class="modes" aria-label="${label}">${items.map(([key, text]) => `<a href="#${key}" class="${key === cur ? 'is-on' : ''}" ${key === cur ? 'aria-current="page"' : ''}>${text}</a>`).join('')}</nav>`;
}

export function riskHeart(risk, { label = '이별수', color = '#7E63C9', seam = 'crack' } = {}) {
  const top = 12 + (100 - risk) * 0.84;
  const heart = 'M60 102 C 20 76, 4 54, 4 32 C 4 14, 18 4, 32 4 C 44 4, 54 11, 60 22 C 66 11, 76 4, 88 4 C 102 4, 116 14, 116 32 C 116 54, 100 76, 60 102 Z';
  const line = seam === 'none' ? '' : seam === 'crack'
    ? '<path d="M60 22 L54 38 L64 50 L55 64 L63 78 L58 92" fill="none" stroke="#2A1B3D" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>'
    : `<path d="M60 22 L56 40 L62 56 L57 74 L60 96" fill="none" stroke="#2A1B3D" stroke-width="1.6" stroke-dasharray="3 3"/>
       ${[30, 44, 58, 72, 86].map((y) => `<path d="M${52} ${y - 3} L${66} ${y + 3}" stroke="#2A1B3D" stroke-width="2.4" stroke-linecap="round"/>`).join('')}`;
  return `<svg class="heart" viewBox="0 0 120 108" role="img" aria-label="${label} ${risk}점">
    <defs><clipPath id="gaugeClip"><path d="${heart}"/></clipPath></defs>
    <path d="${heart}" fill="#fff"/>
    <g clip-path="url(#gaugeClip)"><rect class="heart__fill" x="0" y="${top}" width="120" height="120" fill="${color}"/></g>
    ${line}
    <path d="${heart}" fill="none" stroke="#2A1B3D" stroke-width="4" stroke-linejoin="round"/>
    <text class="heart__num" x="60" y="58" text-anchor="middle" font-size="28" fill="#2A1B3D" stroke="#fff" stroke-width="5" stroke-linejoin="round" paint-order="stroke" data-count="${risk}">${risk}</text>
    <text x="60" y="73" text-anchor="middle" font-size="10.5" fill="#2A1B3D" stroke="#fff" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${label}</text>
  </svg>`;
}
