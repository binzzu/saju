import { drawCharacter, faceAvatar, fullBody, CHARACTERS } from './characters.js';
import {
  analyzePerson, buildForecast, formatBirth, summaryForAI, computeDaewoon, dailyLove,
  ELEMENT_INFO, CHARMS, DAY_MASTERS, LUCK, STATUS_LABEL,
  ELEMENTS, ELEMENT_KO, ELEMENT_HANJA, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO,
} from './reading.js';
import { analyzeCompat } from './compat.js';
import { createCounselor, starterChips } from './counsel.js';
import { lunarToSolar, lunarMonthInfo } from './lunar.js';
import { escapeHtml as esc, renderRich, josa, hasBatchim } from './text.js';
import { SYSTEM_PROMPT, contextBlock, todayKST } from './persona.js';
import { HOUR_LABELS } from './saju.js';
import { analyzeBreakup, summaryBreakupForAI } from './breakup.js';
import { analyzeReunion, summaryReunionForAI } from './reunion.js';
import {
  PRESET_LIMIT, personKey, loadPresets, findPreset, upsertPreset, removePreset, restorePreset, shortBirth, sanitizePerson,
} from './presets.js';

/* ───────────── 상태 ───────────── */

const KEY = 'myoyeon:';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
  del(k) { try { localStorage.removeItem(KEY + k); } catch { /* noop */ } },
};

const state = {
  me: store.get('me'),
  partner: store.get('partner'),
  chat: store.get('chat') || [],
  presets: loadPresets(store.get('presets')), // 프리셋(인연 수첩): 저장해 둔 사람들
  pair: loadPair(store.get('pair')),          // 이별수: 두 사람 A·B, 결과 보기를 눌렀는지
  pairEdit: null,                             // 'a' | 'b' — 직접 입력 신청서가 열린 칸
  ai: null, // null | 'server'(Node + API 키) | 'artifact'(Claude 아티팩트의 sample)
  sample: null,
  busy: false,
};
const memo = {};

function loadPair(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { a: sanitizePerson(r.a), b: sanitizePerson(r.b), done: r.done === true };
}
function savePair() { store.set('pair', state.pair); }

function me() {
  if (!state.me) return null;
  if (!memo.me) {
    memo.me = analyzeCached(state.me);
    memo.fc = memo.me ? buildForecast(memo.me) : null;
  }
  return memo.me;
}
function forecast() { me(); return memo.fc; }
function partner() {
  if (!state.partner) return null;
  if (!memo.partner) memo.partner = analyzeCached(state.partner);
  return memo.partner;
}
function compat() {
  const a = me(), b = partner();
  if (!a || !b) return null;
  if (!memo.compat) memo.compat = analyzeCompat(a, b);
  return memo.compat;
}
function resetMemo(which) {
  if (which === 'me') { delete memo.me; delete memo.fc; }
  if (which === 'partner') delete memo.partner;
  delete memo.compat;
}

// 지금 보는 사람을 바꾼다 (다른 사람이면 상담 기록은 새로 시작)
function setMe(person) {
  if (!analyzeCached(person)) return false;
  const prev = state.me;
  const changed = !prev || personKey(prev) !== personKey(person);
  state.me = person;
  resetMemo('me');
  if (changed) { state.chat = []; store.del('chat'); }
  store.set('me', state.me);
  return true;
}

const presetMemo = new Map();
function analyzeCached(person) {
  const k = personKey(person);
  if (!presetMemo.has(k)) {
    let a = null;
    try { a = analyzePerson(person); } catch { a = null; }
    presetMemo.set(k, a);
  }
  return presetMemo.get(k);
}

function savePresets() { store.set('presets', state.presets); }

// 재회운 결과 (이별수와 같은 두 사람·같은 "결과 보기" 상태를 쓴다)
function reunion() {
  const { a: pa, b: pb, done } = state.pair;
  if (!done || !pa || !pb || personKey(pa) === personKey(pb)) return null;
  const key = `${personKey(pa)}#${personKey(pb)}`;
  if (memo.reunionKey !== key) {
    const A = analyzeCached(pa), B = analyzeCached(pb);
    memo.reunion = A && B ? analyzeReunion(A, B) : null;
    memo.reunionKey = key;
  }
  return memo.reunion;
}

// 이별수 결과 (두 사람이 정해지고 "결과 보기"를 눌렀을 때만)
function breakup() {
  const { a: pa, b: pb, done } = state.pair;
  if (!done || !pa || !pb || personKey(pa) === personKey(pb)) return null;
  const key = `${personKey(pa)}#${personKey(pb)}`;
  if (memo.breakupKey !== key) {
    const A = analyzeCached(pa), B = analyzeCached(pb);
    memo.breakup = A && B ? analyzeBreakup(A, B) : null;
    memo.breakupKey = key;
  }
  return memo.breakup;
}

const counselor = createCounselor(() => ({ a: me(), fc: forecast(), compat: compat(), breakup: breakup(), reunion: reunion() }));

/* ───────────── 웹툰 조각 ───────────── */

const NAMES = { myo: '묘연', coco: '코코' };

function talk(who, expr, html, { side = 'left', scene = 'pink', sfx = '', sfxPos = '', caption = '' } = {}) {
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

const p = (t) => `<p>${t}</p>`;

function info(inner, scene = 'paper', extraClass = '') {
  return `<section class="panel scene-${scene} ${extraClass}"><div class="info">${inner}</div></section>`;
}

function episode(no, title) {
  return `<div class="episode"><span class="episode__no">${no}</span><h2 class="episode__title">${title}</h2></div>`;
}

const stemLabel = (s) => `${STEMS[s]}(${STEMS_KO[s]})`;
const elLabel = (e) => `${ELEMENT_KO[e]}(${ELEMENT_INFO[e].name})`;
const monthLabel = (m, baseYear) => (m.year !== baseYear ? `${m.year}년 ${m.month}월` : `${m.month}월`);

/* ───────────── 24시간 시각 입력 ───────────── */

// 입력 중: 숫자만 쳐도 "0102" → "01:02" 로 콜론을 넣는다
function formatTimeTyping(raw) {
  if (raw.includes(':')) {
    const [h, m = ''] = raw.split(':');
    return `${h.replace(/\D/g, '').slice(0, 2)}:${m.replace(/\D/g, '').slice(0, 2)}`;
  }
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

// 입력을 마치면: "1:2" → "01:02", "9" → "09:00"
function normalizeTime(v) {
  const s = String(v).trim();
  let m = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (m) return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
  m = /^(\d{1,2})$/.exec(s);
  if (m) return `${m[1].padStart(2, '0')}:00`;
  return s;
}

function parseTime(v) {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? { h, m: mi } : null;
}

// 시진(時辰): 동경 127.5° 기준이라 한국 표준시로는 매시 30분에 바뀐다 (자시 23:30~01:29)
function timeHint(v) {
  const t = parseTime(v);
  if (!t) return '24시간 기준으로 적어 주세요. 오후 3시 30분은 15:30, 새벽 1시 2분은 01:02예요.';
  const idx = Math.floor((((t.h * 60 + t.m - 30) % 1440 + 1440) % 1440 + 60) / 120) % 12;
  return `🕐 ${v} → <b>${HOUR_LABELS[idx]}</b>에 태어났어요. 서머타임·지역 시차는 자동으로 보정해요.`;
}

/* ───────────── 부적 신청서 ───────────── */

function talisman(kind, person) {
  const v = person || {};
  const id = (n) => `${kind}-${n}`;
  const nowY = new Date().getFullYear();
  const years = [];
  for (let y = nowY; y >= 1930; y--) years.push(y);
  const opt = (val, label, cur) => `<option value="${val}" ${String(cur) === String(val) ? 'selected' : ''}>${label}</option>`;
  const time = v.timeKnown ? `${String(v.hour).padStart(2, '0')}:${String(v.minute || 0).padStart(2, '0')}` : '';
  const isMe = kind === 'me';
  const meA = me();
  const slot = kind === 'pairA' ? 'A' : kind === 'pairB' ? 'B' : '';
  const head = isMe
    ? `<h2>연애 사주 신청서</h2><p>적어 준 기운으로 묘연이 인연의 실을 읽어요</p>`
    : slot
      ? `<h2>${slot} 신청서</h2><p>이별수를 볼 ${slot === 'A' ? '첫 번째' : '두 번째'} 사람의 정보를 적어 주세요</p>`
      : `<h2>궁합 신청서</h2><p>궁금한 그 사람의 정보를 적어 주세요</p>${meA ? `<span class="talisman__me">나: ${esc(meA.name)} · ${STEMS[meA.dm]}${BRANCHES[meA.dayBranch]} 일주</span>` : ''}`;
  const nameLabel = isMe ? '이름' : slot ? `${slot} 이름` : '상대 이름';
  const sealLabel = isMe ? '도장 찍고 사주 펼치기' : slot ? `도장 찍고 ${slot}로 정하기` : '도장 찍고 궁합 보기';
  return `<form class="talisman" data-form="${kind}" novalidate>
    ${v.name ? `<div class="talisman__top"><button class="mini" type="button" data-action="form-clear">✏️ 새로 쓰기</button></div>` : ''}
    <div class="talisman__head">${head}</div>
    <div class="field">
      <label for="${id('name')}">${nameLabel}</label>
      <input class="input" id="${id('name')}" name="name" maxlength="12" autocomplete="off" required value="${esc(v.name || '')}" placeholder="${isMe || slot === 'A' ? '예: 김민지' : '예: 이준호'}">
    </div>
    <fieldset class="field">
      <legend>성별</legend>
      <div class="seg">
        <label><input type="radio" name="gender" value="F" ${v.gender === 'F' ? 'checked' : ''}><span>여성</span></label>
        <label><input type="radio" name="gender" value="M" ${v.gender === 'M' ? 'checked' : ''}><span>남성</span></label>
      </div>
    </fieldset>
    <fieldset class="field">
      <legend>생년월일</legend>
      <div class="cal-row">
        <div class="seg seg--sm">
          <label><input type="radio" name="calendar" value="solar" ${v.calendar !== 'lunar' ? 'checked' : ''}><span>양력</span></label>
          <label><input type="radio" name="calendar" value="lunar" ${v.calendar === 'lunar' ? 'checked' : ''}><span>음력</span></label>
        </div>
        <label class="check" data-leap ${v.calendar === 'lunar' ? '' : 'hidden'}><input type="checkbox" name="leap" ${v.leap ? 'checked' : ''}> 윤달</label>
      </div>
      <div class="date-row">
        <select class="select" name="year" aria-label="태어난 해"><option value="">년</option>${years.map((y) => opt(y, `${y}년`, v.year)).join('')}</select>
        <select class="select" name="month" aria-label="태어난 달"><option value="">월</option>${Array.from({ length: 12 }, (_, i) => opt(i + 1, `${i + 1}월`, v.month)).join('')}</select>
        <select class="select" name="day" aria-label="태어난 날"><option value="">일</option>${Array.from({ length: 31 }, (_, i) => opt(i + 1, `${i + 1}일`, v.day)).join('')}</select>
      </div>
    </fieldset>
    <div class="field">
      <label for="${id('time')}">태어난 시간</label>
      <div class="time-row">
        <input class="input input--time" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="예: 01:02"
          id="${id('time')}" name="time" value="${time}" aria-describedby="${id('time-hint')}" ${v.name && !v.timeKnown ? 'disabled' : ''}>
        <label class="check"><input type="checkbox" name="unknown" ${v.name && !v.timeKnown ? 'checked' : ''}> 시간을 몰라요</label>
      </div>
      <p class="hint" id="${id('time-hint')}" data-time-hint>${v.name && !v.timeKnown ? '시간을 모르면 시주 없이 여섯 글자로 풀이해요.' : timeHint(time)}</p>
    </div>
    ${isMe ? `<fieldset class="field">
      <legend>지금 내 연애 상태</legend>
      <div class="seg seg--sm">
        ${Object.entries(STATUS_LABEL).map(([k, label]) => `<label><input type="radio" name="status" value="${k}" ${(v.status || 'solo') === k ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </div>
    </fieldset>` : ''}
    <p class="form-error" role="alert"></p>
    <div class="seal-wrap">
      <button class="seal" type="submit">
        <span class="seal__glyph" aria-hidden="true">緣</span>
        <span class="seal__label">${sealLabel}</span>
      </button>
    </div>
    <div class="talisman__tools">
      <button class="mini" type="button" data-action="preset-save-form">📌 프리셋에 저장만 하기</button>
    </div>
    <span class="imprint" aria-hidden="true">緣</span>
  </form>`;
}

function readForm(form) {
  const f = new FormData(form);
  const name = String(f.get('name') || '').trim();
  const gender = f.get('gender');
  const calendar = f.get('calendar') || 'solar';
  const leap = f.get('leap') === 'on';
  const year = Number(f.get('year')), month = Number(f.get('month')), day = Number(f.get('day'));
  const unknown = f.get('unknown') === 'on';
  const time = String(f.get('time') || '');
  if (!name) return { error: '이름을 적어 주세요.', focus: 'name' };
  if (!gender) return { error: '성별을 골라 주세요.', focus: 'gender' };
  if (!year || !month || !day) return { error: '생년월일을 모두 골라 주세요.', focus: 'year' };
  let solar;
  if (calendar === 'lunar') {
    const info2 = lunarMonthInfo(year, month);
    if (leap && !info2.hasLeap) return { error: `${year}년에는 윤${month}월이 없어요.`, focus: 'leap' };
    const days = leap ? info2.leapDays : info2.days;
    if (day > days) return { error: `음력 ${year}년 ${leap ? '윤' : ''}${month}월은 ${days}일까지 있어요.`, focus: 'day' };
    solar = lunarToSolar(year, month, day, leap);
    if (!solar) return { error: '음력 날짜를 확인해 주세요.', focus: 'day' };
  } else {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) return { error: `${month}월 ${day}일은 없는 날짜예요.`, focus: 'day' };
    solar = { year, month, day };
  }
  if (Date.UTC(solar.year, solar.month - 1, solar.day) > Date.now()) return { error: '미래의 날짜는 볼 수 없어요.', focus: 'year' };
  let hour = null, minute = null;
  if (!unknown) {
    if (!time.trim()) return { error: '태어난 시간을 적거나 "시간을 몰라요"를 체크해 주세요.', focus: 'time' };
    const t = parseTime(normalizeTime(time));
    if (!t) return { error: '태어난 시간은 24시간 기준으로 00:00~23:59 사이로 적어 주세요. (예: 오후 3시 30분 → 15:30)', focus: 'time' };
    hour = t.h; minute = t.m;
  }
  const person = { name, gender, calendar, leap: calendar === 'lunar' && leap, year, month, day, hour, minute, timeKnown: !unknown };
  if (f.has('status')) person.status = f.get('status') || 'solo';
  return { person };
}

/* ───────────── 화면: 처음 ───────────── */

function cover() {
  const cast = ['myo', 'coco'].map((k) => `<figure class="cover__char cover__char--${k}">
      ${fullBody(k, { eager: true })}
      <figcaption><b>${CHARACTERS[k].name}</b><span>${CHARACTERS[k].role}</span></figcaption>
    </figure>`).join('');
  return `<section class="panel scene-night cover">
    <div class="cover__head">
      <span class="cover__seal" aria-hidden="true">緣</span>
      <h1 class="cover__title">묘연<small>의</small> 연애사주</h1>
      <p class="cover__sub">고양이 점술사들이 웹툰으로 풀어 주는 연애 사주 · 궁합 · 1:1 상담</p>
    </div>
    <div class="cover__cast">${cast}</div>
  </section>`;
}

function viewHome() {
  const a = me();
  let html = cover();
  html += talk('myo', 'smile', p('어서 와라냥. 여기는 인연(緣)을 읽어 주는 <strong>묘연 사주방</strong>이야.') + p('연애운, 궁합, 고민 상담까지 전부 웹툰으로 쉽게 풀어 줄게.'), { scene: 'night', sfx: '딸랑♪', caption: '골목 끝, 방울 소리가 나는 작은 점집' });
  if (a) {
    html += talk('coco', 'sparkle', p(`앗, <strong>${esc(a.name)}님</strong> 다시 왔네요! 지난번에 본 사주로 바로 볼까요?`), { side: 'right', scene: 'mint' });
    html += todayCard(a);
    html += `<div class="actions"><a class="btn btn--pink" href="#reading">${esc(a.name)}님 사주 다시 보기</a><a class="btn btn--lilac" href="#chat">상담실 가기</a></div>`;
  }
  // "처음으로" 버튼이 오는 자리: 프리셋 + 신청서
  html += `<div id="start" class="start">${episode('처음으로', '누구의 사주를 펼칠까?')}</div>`;
  html += presetBook();
  if (state.presets.length) {
    html += talk('coco', 'happy', p('위 <strong>프리셋</strong>에서 이름을 누르면 그 사람 사주가 바로 펼쳐져요!') + p('새로운 사람은 부적에 적고 <strong>📌 저장</strong>해 두면 다음엔 한 번에 꺼내 볼 수 있어요.'), { side: 'right', scene: 'pink' });
  } else if (a) {
    html += talk('coco', 'wink', p('다른 사람 사주가 궁금하면 <strong>✏️ 새로 쓰기</strong>를 누르고 적어요!') + p('<strong>📌 프리셋에 저장</strong>해 두면 다음엔 한 번에 꺼내 볼 수 있어요.'), { side: 'right', scene: 'pink' });
  } else {
    html += talk('coco', 'happy', p('이름, 생년월일, 태어난 시간을 이 <strong>부적</strong>에 적어 주세요!') + p('음력 생일도 괜찮고, 시간을 몰라도 볼 수 있어요.'), { side: 'right', scene: 'pink', sfx: '쓱쓱' });
  }
  html += talisman('me', state.me);
  return html;
}

/* ───────────── 프리셋 ───────────── */

const presetEmoji = (person) => { const x = analyzeCached(person); return x ? x.profile.emoji : '🐾'; };

// 홈의 프리셋 목록 (누르면 바로 그 사람 사주로)
function presetBook() {
  const list = state.presets;
  const cur = state.me ? personKey(state.me) : '';
  const rows = list.map((x) => {
    const pp = x.person;
    const xa = analyzeCached(pp);
    const isCur = personKey(pp) === cur;
    const name = esc(pp.name);
    return `<li class="preset ${isCur ? 'is-current' : ''}">
      <button class="preset__open" type="button" data-preset-open="${esc(x.id)}" aria-label="${name}님 사주 바로 보기">
        <span class="preset__emoji" aria-hidden="true">${xa ? xa.profile.emoji : '🐾'}</span>
        <span class="preset__body">
          <span class="preset__name">${name}<small>${pp.gender === 'F' ? '여' : '남'}</small>${isCur ? '<span class="tag tag--now">보는 중</span>' : ''}</span>
          <span class="preset__meta">${shortBirth(pp)}${xa ? ` · ${xa.profile.cat}` : ''}</span>
        </span>
        <span class="preset__go" aria-hidden="true">›</span>
      </button>
      <button class="preset__del" type="button" data-preset-del="${esc(x.id)}" aria-label="${name} 프리셋 지우기">×</button>
    </li>`;
  }).join('');
  const body = list.length
    ? `<ul class="presets">${rows}</ul>`
    : '<p class="note">아직 저장한 사람이 없어요. 부적을 쓰고 <b>📌 프리셋에 저장</b>을 누르면 여기 모여요. 가족·친구·썸 상대까지 저장해 두고 바로 꺼내 보세요!</p>';
  return `<div data-presets="book">${info(`<h3>📒 내 프리셋 <small class="h-sub">${list.length} / ${PRESET_LIMIT}명</small></h3>${body}`, 'paper', 'presetbook')}</div>`;
}

// 사주 화면 맨 위: 지금 보는 사람 + 저장 + 처음으로 + 다른 프리셋으로 바로 전환
function viewingBar(a) {
  const cur = personKey(state.me);
  const saved = findPreset(state.presets, state.me);
  const others = state.presets.filter((x) => personKey(x.person) !== cur);
  return `<div data-presets="viewing"><div class="viewing">
    <div class="viewing__row">
      <span class="viewing__who">📖 <b>${esc(a.name)}</b>님의 사주</span>
      <span class="viewing__btns">
        ${saved ? '<span class="mini mini--done">✓ 프리셋 저장됨</span>' : '<button class="mini mini--pink" type="button" data-action="preset-save-current">📌 프리셋 저장</button>'}
        <a class="mini" href="#start">🏠 처음으로</a>
      </span>
    </div>
    ${others.length ? `<div class="viewing__switch" role="group" aria-label="다른 프리셋 사주 보기"><span>다른 사람:</span>${others.map((x) => `<button class="mini" type="button" data-preset-open="${esc(x.id)}">${presetEmoji(x.person)} ${esc(x.person.name)}</button>`).join('')}</div>` : ''}
  </div></div>`;
}

// 궁합 화면: 프리셋에서 상대를 고르면 바로 궁합
function partnerPresets() {
  const meKey = personKey(state.me);
  const cur = state.partner ? personKey(state.partner) : '';
  const list = state.presets.filter((x) => personKey(x.person) !== meKey);
  if (!list.length) return '<div data-presets="partner"></div>';
  return `<div data-presets="partner">${info(`<h3>📒 프리셋에서 상대 고르기</h3><p class="note">이름을 누르면 바로 궁합을 봐요.</p>
    <div class="pchips">${list.map((x) => `<button class="mini ${personKey(x.person) === cur ? 'mini--pink' : ''}" type="button" data-preset-partner="${esc(x.id)}">${presetEmoji(x.person)} ${esc(x.person.name)}</button>`).join('')}</div>`, 'mint')}</div>`;
}

function refreshPresets() {
  document.querySelectorAll('[data-presets]').forEach((el) => {
    const kind = el.dataset.presets;
    if (kind === 'book') el.outerHTML = presetBook();
    else if (kind === 'partner') el.outerHTML = partnerPresets();
    else if (kind === 'viewing' && me()) el.outerHTML = viewingBar(me());
  });
}

function savePreset(person) {
  const { list, result } = upsertPreset(state.presets, person);
  if (result === 'full') { toast(`프리셋은 ${PRESET_LIMIT}명까지 저장돼요. 안 보는 사람을 지워 주세요.`); return false; }
  state.presets = list;
  savePresets();
  refreshPresets();
  toast(result === 'added' ? `📌 ${person.name}님을 프리셋에 저장했어요.` : `📌 ${person.name}님 프리셋을 지금 정보로 고쳤어요.`);
  return true;
}

function openPreset(id) {
  const x = state.presets.find((it) => it.id === id);
  if (!x) return;
  if (!setMe({ ...x.person })) { toast('이 프리셋의 날짜를 읽을 수 없어요.'); return; }
  if (location.hash === '#reading') render();
  else location.hash = '#reading';
}

function deletePreset(id) {
  const { list, removed, index } = removePreset(state.presets, id);
  if (!removed) return;
  state.presets = list;
  savePresets();
  refreshPresets();
  toast(`${removed.person.name}님을 프리셋에서 지웠어요.`, {
    label: '되돌리기',
    fn: () => { state.presets = restorePreset(state.presets, removed, index); savePresets(); refreshPresets(); },
  });
}

// 신청서를 빈 칸으로 다시 그린다 (form.reset()은 미리 채운 값으로 돌아가서 쓰지 않음)
function clearForm(form) {
  const kind = form.dataset.form;
  form.outerHTML = talisman(kind, null);
  const fresh = document.querySelector(`form[data-form="${kind}"]`);
  fresh.scrollIntoView({ block: 'start' });
  fresh.querySelector('[name="name"]').focus({ preventScroll: true });
}

/* ───────────── 오늘의 연애운 · 대운 ───────────── */

function todayCard(a) {
  const t = dailyLove(a);
  const couple = a.person.status === 'couple';
  return info(`<h3>🗓️ 오늘의 연애운 <small class="h-sub">${t.m}월 ${t.day}일(${t.weekday}) · ${t.pillar.hanja}일</small></h3>
    <div class="today">
      <div class="today__score" aria-label="${t.score}점">${t.score}<small>점</small></div>
      <div>
        <p class="today__label">${t.reason.emoji} ${t.reason.label}</p>
        <p>${couple ? t.reason.couple : t.reason.solo}</p>
        <p class="note">💡 ${t.reason.tip}</p>
      </div>
    </div>`, 'mint');
}

function daewoonList(dw) {
  return `<ol class="dw">${dw.periods.map((d) => {
    const past = d.to < dw.ageNow && !d.isNow;
    return `<li class="dw__item ${d.isNow ? 'is-now' : ''} ${d.isGolden ? 'is-golden' : ''} ${past ? 'is-past' : ''}">
      <div class="dw__age">만 ${d.from}~${d.to}세<small>${d.startYear}년~</small></div>
      <div class="dw__gz hanja">${d.pillar.hanja}</div>
      <div class="dw__body">
        <div class="meter"><span style="width:${d.score}%"></span></div>
        <div class="year__line"><span>${d.reason.emoji} ${d.reason.label}</span><b>${d.score}점</b></div>
        ${d.isNow ? '<span class="tag tag--now">지금 여기</span>' : ''}${d.isGolden ? '<span class="tag tag--gold">연애 황금기</span>' : ''}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

/* ───────────── 화면: 내 사주 웹툰 ───────────── */

function pillarsCard(a) {
  const cols = a.positions.map((pos) => {
    if (pos.empty) {
      return `<div class="pillar"><div class="pillar__label">${pos.label}</div><div class="pillar__god">&nbsp;</div><div class="tile tile--empty">?</div><div class="tile tile--empty">?</div><div class="pillar__god">&nbsp;</div><div class="pillar__read">시간 모름</div></div>`;
    }
    return `<div class="pillar ${pos.key === 'day' ? 'is-me' : ''}">
      <div class="pillar__label">${pos.label}${pos.key === 'day' ? '<b class="me-badge">나</b>' : ''}</div>
      <div class="pillar__god">${pos.stemGod === '나' ? '일간' : pos.stemGod}</div>
      <div class="tile el-${pos.stemEl}"><span class="hanja">${STEMS[pos.stem]}</span><small>${STEMS_KO[pos.stem]} · ${ELEMENT_KO[pos.stemEl]}</small></div>
      <div class="tile el-${pos.branchEl}"><span class="hanja">${BRANCHES[pos.branch]}</span><small>${BRANCHES_KO[pos.branch]} · ${ELEMENT_KO[pos.branchEl]}</small></div>
      <div class="pillar__god">${pos.branchGod}</div>
      <div class="pillar__read">${pos.meaning}</div>
    </div>`;
  }).join('');
  const sr = a.positions.map((pos) => (pos.empty ? `${pos.label} 모름` : `${pos.label} ${STEMS_KO[pos.stem]}${BRANCHES_KO[pos.branch]}`)).join(', ');
  return `<p class="sr">사주 원국: ${sr}</p><div class="pillars" aria-hidden="true">${cols}</div>`;
}

function elementBars(a) {
  const max = Math.max(...ELEMENTS.map((e) => a.counts[e]), 1);
  return `<ul class="elbars">${ELEMENTS.map((e) => {
    const n = a.counts[e];
    return `<li class="elbar el-${e}">
      <span class="elbar__name"><span class="hanja">${ELEMENT_HANJA[e]}</span> ${ELEMENT_KO[e]} · ${ELEMENT_INFO[e].name}</span>
      <span class="elbar__track"><span class="elbar__fill ${n ? '' : 'is-zero'}" style="width:${(n / max) * 100}%"></span></span>
      <span class="elbar__num">${n}</span>
    </li>`;
  }).join('')}</ul>`;
}

function yearsList(fc, couple) {
  return `<ul class="years">${fc.years.map((y) => `<li class="year">
    <div class="year__when">${y.year}<small>${y.pillar.hangul}년 · ${y.animal}띠</small></div>
    <div>
      <div class="meter" role="img" aria-label="${y.score}점"><span style="width:${y.score}%"></span></div>
      <div class="year__line"><span>${y.reason.emoji} ${y.reason.label}</span><b>${y.score}점</b></div>
      <div class="note">${couple ? y.reason.couple : y.reason.solo}</div>
    </div>
  </li>`).join('')}</ul>`;
}

function monthChart(fc) {
  const bestSet = new Set(fc.best.map((m) => `${m.year}-${m.month}`));
  const worstKey = `${fc.worst.year}-${fc.worst.month}`;
  const items = fc.months.map((m) => {
    const k = `${m.year}-${m.month}`;
    const cls = bestSet.has(k) ? 'is-best' : k === worstKey ? 'is-worst' : '';
    return `<li class="month ${cls}">
      <div class="month__bar" style="height:${Math.max(8, Math.round(8 + ((m.score - 30) / 68) * 92))}%">${bestSet.has(k) ? '<span class="month__heart">💗</span>' : ''}</div>
      <div class="month__label">${m.month === 1 ? `${String(m.year).slice(2)}.` : ''}${m.month}월<span class="month__score">${m.score}</span></div>
    </li>`;
  }).join('');
  const sr = fc.months.map((m) => `${m.year}년 ${m.month}월 ${m.score}점`).join(', ');
  return `<p class="sr">월별 연애운: ${sr}</p><ul class="months" aria-hidden="true">${items}</ul>
    <p class="legend"><span><i style="background:var(--blush)"></i>인연운 TOP 3</span><span><i style="background:var(--lilac)"></i>보통</span><span><i style="background:#D8D2E4"></i>쉬어 가기</span></p>`;
}

function luckList(l, lucky) {
  return `<dl class="luck">
    <div class="luck__row"><dt>컬러</dt><dd><span class="swatches">${l.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}</span>${l.color}</dd></div>
    <div class="luck__row"><dt>장소</dt><dd>${l.places.join(', ')}</dd></div>
    <div class="luck__row"><dt>아이템</dt><dd>${l.items.join(', ')}</dd></div>
    <div class="luck__row"><dt>숫자·방향</dt><dd>${l.numbers} · ${l.direction}</dd></div>
    <div class="luck__row"><dt>음식</dt><dd>${l.food}</dd></div>
    <div class="luck__row"><dt>행동</dt><dd>${l.action}</dd></div>
  </dl>`;
}

function viewReading() {
  const a = me();
  if (!a) return null;
  const fc = forecast();
  const n = esc(a.name);
  const couple = a.person.status === 'couple';
  const pr = a.profile;
  const baseYear = fc.current.sajuYear;
  let h = viewingBar(a);

  // 1화
  h += episode('1화', '사주팔자 대공개');
  h += talk('myo', 'smile', p(`<strong>${n}님</strong>, 기다리고 있었다냥.`) + p(`${formatBirth(a)}에 태어난 당신의 연애 운명을 펼쳐 볼게.`), { scene: 'night', caption: '딸랑— 묘연 사주방의 문이 열렸다' });
  h += info(`<h3>${n}님의 사주팔자</h3>${pillarsCard(a)}
    <p class="note" style="margin-top:12px">사주(四柱)는 태어난 해·달·날·시간의 네 기둥, 팔자(八字)는 그 기둥에 적힌 여덟 글자예요. 글자 색은 오행이에요: <b style="color:var(--wood)">목</b> · <b style="color:var(--fire)">화</b> · <b style="color:#B88A00">토</b> · <b style="color:#7D7891">금</b> · <b style="color:var(--water)">수</b></p>
    ${a.saju.monthAmbiguous ? '<p class="note">⚠️ 태어난 날에 절기가 바뀌어서, 태어난 시간에 따라 월주가 달라질 수 있어요.</p>' : ''}`);
  h += talk('coco', 'surprise', p(`우와, 이게 ${n}님의 여덟 글자예요? 근데 어디부터 봐야 해요?`), { side: 'right', scene: 'pink', sfx: '두둥!' });
  h += talk('myo', 'smug', p(`핑크색 칸, 일주의 윗글자인 <strong>일간 ${stemLabel(a.dm)}</strong>${hasBatchim(STEMS_KO[a.dm]) ? '이' : '가'} 바로 ${n}님 자신이다냥.`) + p('나머지 일곱 글자는 나를 둘러싼 사람과 환경이야. 이 관계를 읽는 게 사주 풀이지.'), { scene: 'lilac' });

  // 2화
  h += episode('2화', '나는 어떤 고양이?');
  h += info(`<div class="typecard">
      <div class="typecard__emoji" aria-hidden="true">${pr.emoji}</div>
      <p class="typecard__who">${n}님의 연애 캐릭터는</p>
      <p class="typecard__name">${pr.cat}</p>
      <p class="typecard__nature"><span class="hanja">${STEMS[a.dm]}</span> ${STEMS_KO[a.dm]}${ELEMENT_KO[a.dmEl]} — ${pr.nature}</p>
      <ul class="chips">${pr.keywords.map((k) => `<li class="chip">#${k}</li>`).join('')}</ul>
    </div>`, 'yellow');
  h += talk('myo', 'happy', p(pr.love), { scene: 'pink' });
  h += talk('coco', 'love', p(`매력 포인트는요~ ${pr.charm}`), { side: 'right', scene: 'mint', sfx: '반짝' });
  h += talk('myo', 'worry', p(`다만 조심할 점도 있다냥.`) + p(pr.weak), { scene: 'lilac' });

  // 3화
  h += episode('3화', '오행 밸런스 체크');
  h += talk('coco', 'think', p('오행은 또 뭐예요? 나무, 불, 흙…?'), { side: 'right', scene: 'mint' });
  h += talk('myo', 'smile', p('세상을 이루는 다섯 기운이야. 여덟 글자에 각 기운이 몇 개씩 있는지 보면 연애 성향이 보인다냥.'), { scene: 'pink' });
  const strongInfo = ELEMENT_INFO[a.strongest];
  const lackLine = a.missing.length
    ? `<p><b>${a.missing.map(elLabel).join(', ')}</b> 기운이 없어요. ${ELEMENT_INFO[a.missing[0]].few}</p>`
    : `<p>가장 약한 기운은 <b>${a.weakest.map(elLabel).join(', ')}</b>이에요. ${ELEMENT_INFO[a.weakest[0]].few}</p>`;
  h += info(`<h3>${n}님의 오행 분포</h3>${elementBars(a)}
    <p><b>${elLabel(a.strongest)}</b> 기운이 가장 강해요. ${strongInfo.many}</p>
    ${lackLine}
    <p><b>${a.strength.label}</b> — ${a.strength.desc}</p>`);
  h += talk('coco', 'worry', p('부족한 기운은 어떡해요?'), { side: 'right', scene: 'pink' });
  h += talk('myo', 'wink', p('그건 마지막 화에서 <strong>개운법</strong>으로 채워 줄게냥~'), { scene: 'lilac', sfx: '찡긋' });

  // 4화
  h += episode('4화', '나의 연애 스타일');
  const counts = Object.entries(a.groupCounts);
  const top = a.dominantGroup;
  h += info(`<h3>${a.style.emoji} ${a.style.title}</h3>
    <p>${a.style.desc}</p>
    <ul class="counts">${counts.map(([k, v]) => `<li class="${k === top ? 'is-top' : ''}">${k} ${v}</li>`).join('')}</ul>
    <p class="note" style="margin-top:10px">비겁 = 나와 같은 기운 · 식상 = 표현 · 재성 = 현실 · 관성 = 책임 · 인성 = 배려와 수용</p>`, 'paper');
  const starWhat = a.gender === 'F' ? '여성의 사주에서는 나를 다스리는 기운인 <strong>관성</strong>' : '남성의 사주에서는 내가 다스리는 기운인 <strong>재성</strong>';
  h += talk('myo', 'smug', p(`${starWhat}이 이성 인연을 뜻한다냥. ${n}님의 인연의 별은 <strong>${elLabel(a.partner.el)}</strong> 기운.`) + p(a.partner.text), { scene: 'night' });
  h += talk('coco', 'think', p(a.style.caution[a.gender]), { side: 'right', scene: 'mint' });

  // 5화
  h += episode('5화', '숨겨진 매력 포인트');
  if (a.charms.length) {
    const names = a.charms.map((c) => CHARMS[c].name).join(', ');
    h += talk('coco', 'love', p(`헉, ${n}님한테 <strong>${josa(names, '이', '가')}</strong> 있대요!`), { side: 'right', scene: 'pink', sfx: '반짝반짝' });
    h += info(`<div class="badges">${a.charms.map((c) => `<div class="badge"><div class="badge__icon" aria-hidden="true">${CHARMS[c].emoji}</div><div><h4>${CHARMS[c].name}</h4><p>${CHARMS[c].desc}</p><p class="tip">💡 ${CHARMS[c].tip}</p></div></div>`).join('')}</div>`, 'yellow');
  } else {
    h += talk('coco', 'smile', p('특별한 연애 살은 없대요. 그런데요!') + p(`살이 없다는 건 <strong>꾸밈없는 진정성</strong>으로 승부하는 타입이라는 뜻이에요. 오래 볼수록 좋은 사람!`), { side: 'right', scene: 'pink' });
  }
  if (a.peachCount >= 2) h += talk('myo', 'smug', p(`그리고 사람을 끄는 도화 글자(子·午·卯·酉)가 ${a.peachCount}개나 있다냥. 은근히 시선이 모이는 사주야.`), { scene: 'lilac' });

  // 6화
  h += episode('6화', '운명의 상대는 어떤 사람?');
  h += talk('myo', 'smile', p(`일주의 아랫글자 <strong>${BRANCHES[a.dayBranch]}(${BRANCHES_KO[a.dayBranch]})</strong>는 "배우자 자리"야.`) + p(a.spouse), { scene: 'pink' });
  const match = DAY_MASTERS[a.bestMatchStem];
  h += info(`<h3>💘 ${n}님의 이상형 지도</h3>
    <ul class="ticks">
      <li><b>마음이 끌리는 사람</b><br>${pr.ideal}</li>
      <li><b>운명처럼 엮이는 사람</b><br>${ELEMENT_INFO[a.partner.el].person} (${elLabel(a.partner.el)} 기운)</li>
      <li><b>찰떡 궁합 냥이</b><br>${match.emoji} ${match.cat} — ${stemLabel(a.bestMatchStem)} 일간</li>
    </ul>`, 'mint');
  h += talk('coco', 'sparkle', p('그런 사람을 만나면 바로 궁합 보러 와요! 점수까지 내 드릴게요.'), { side: 'right', scene: 'lilac' });

  // 7화
  h += episode('7화', '연애운 달력');
  h += talk('myo', 'smug', p(`이제 제일 궁금한 거! ${couple ? '관계가 깊어지는' : '인연이 들어오는'} 때를 볼까냥?`), { scene: 'night', sfx: '두근두근', sfxPos: 'sfx--tr sfx--pink' });
  h += todayCard(a);
  h += info(`<h3>앞으로 5년 연애운</h3>${yearsList(fc, couple)}`);
  h += info(`<h3>앞으로 12개월 연애운</h3>${monthChart(fc)}`);
  const b0 = fc.best[0];
  h += talk('coco', 'sparkle', p(`<strong>${monthLabel(b0, baseYear)}</strong>은 달력에 꼭 동그라미! (${b0.reason.emoji} ${b0.reason.label})`) + p(couple ? b0.reason.couple : b0.reason.solo), { side: 'right', scene: 'pink', sfx: '체크!' });
  const w = fc.worst;
  h += talk('myo', 'think', p(`<strong>${monthLabel(w, baseYear)}</strong>엔 ${w.reason.label} 기운이 있으니 살짝 쉬어 가자냥.`) + p(`💡 ${w.reason.tip}`), { scene: 'lilac' });
  const dw = computeDaewoon(a);
  h += talk('coco', 'think', p('더 길게 보면요? 몇 살 때 연애운이 제일 좋아요?'), { side: 'right', scene: 'mint' });
  h += talk('myo', 'smug', p('사주엔 <strong>10년마다 바뀌는 큰 흐름</strong>, 대운(大運)이 있다냥.') + p(dw.golden ? `${n}님의 연애 황금기는 <strong>만 ${dw.golden.from}~${dw.golden.to}세</strong>(${dw.golden.startYear}년~)야. ${dw.golden.reason.emoji} ${dw.golden.reason.label}!` : '앞으로의 흐름을 표로 보여 줄게.'), { scene: 'night' });
  h += info(`<h3>인생 연애 타임라인</h3>${daewoonList(dw)}
    <p class="note" style="margin-top:10px">대운은 ${dw.forward ? '순행' : '역행'}, 만 ${dw.startAge}세부터 10년씩 바뀌어요. 큰 흐름이라 그해·그달의 운과 함께 봐요.</p>`);

  // 8화
  h += episode('8화', '해결책 & 개운법');
  const li = ELEMENT_INFO[a.lucky];
  h += talk('myo', 'wink', p(`부족한 기운은 채우고 넘치는 기운은 흘려보내면 연애운이 부드러워진다냥.`) + p(`${n}님에게 필요한 건 <strong>${elLabel(a.lucky)}</strong> 기운, ${li.theme}의 힘이야!`), { scene: 'night' });
  h += info(`<h3>${li.emoji} 행운을 부르는 것들</h3>${luckList(a.luck, a.lucky)}`, 'yellow');
  const rx = [
    ...pr.tips,
    a.style.caution[a.gender],
    `${monthLabel(b0, baseYear)}에는 약속을 거절하지 말기 — ${b0.reason.tip}`,
    `행운 행동: ${a.luck.action}`,
  ];
  h += `<section class="panel"><div class="rx">
      <div class="rx__head"><h3 class="lead-em" style="font-size:var(--s-5)">연애 처방전</h3><span>환자: ${n}님 · 담당: 묘연</span></div>
      <ol>${rx.map((t) => `<li>${t}</li>`).join('')}</ol>
      <span class="rx__stamp" aria-hidden="true">緣</span>
    </div></section>`;
  h += talk('coco', 'happy', p('처방전은 캡처해 두기! 고민이 생기면 상담실에서 더 자세히 물어봐요.'), { side: 'right', scene: 'pink' });

  // 에필로그
  h += episode('에필로그', '이야기는 계속된다');
  h += talk('coco', 'smug', p('그 사람과의 <strong>궁합</strong>도 궁금하지 않아요?'), { side: 'right', scene: 'mint' });
  h += `<div class="actions"><a class="btn btn--pink" href="#compat">궁합 보러 가기</a><a class="btn btn--lilac" href="#chat">묘연에게 상담하기</a><button class="btn" type="button" data-action="share-reading">결과 공유하기</button></div>`;
  h += talk('myo', 'smile', p(`사주는 지도일 뿐, 길을 고르는 건 ${n}님이야. 언제든 놀러 와라냥.`), { scene: 'night' });
  h += `<div class="actions">${findPreset(state.presets, state.me) ? '' : '<button class="btn btn--pink" type="button" data-action="preset-save-current">📌 프리셋에 저장</button>'}<a class="btn btn--ghost" href="#start" style="color:#fff;border-color:#fff">🏠 처음으로 · 다른 사람 보기</a>${a.person.status === 'after' ? '<a class="btn btn--lilac" href="#reunion">💞 재회운 보러 가기</a>' : ''}</div>`;
  return h;
}

/* ───────────── 화면: 궁합 ───────────── */

function heartGauge(score) {
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

function compatResultHtml(c) {
  const A = esc(c.a.name), B = esc(c.b.name);
  const side = (x) => `<div class="vs__side"><div class="vs__emoji" aria-hidden="true">${DAY_MASTERS[x.dm].emoji}</div>
    <div class="tile el-${x.dmEl}"><span class="hanja">${STEMS[x.dm]}</span><small>${STEMS_KO[x.dm]}·${ELEMENT_KO[x.dmEl]}</small></div>
    <div class="vs__name">${esc(x.name)}</div><div class="vs__cat">${DAY_MASTERS[x.dm].cat}</div></div>`;
  let h = '';
  h += episode('궁합편', `${A} × ${B}`);
  h += talk('myo', 'smug', p(`${A}님과 ${B}님, 두 사람을 잇는 인연의 실을 확인해 볼까냥?`), { scene: 'night' });
  h += info(`<div class="vs">${side(c.a)}<div class="vs__x" aria-hidden="true">💞</div>${side(c.b)}</div>`, 'lilac');
  h += talk('coco', 'surprise', p('두구두구… 점수 나왔어요!'), { side: 'right', scene: 'pink', sfx: '두구두구' });
  h += `<section class="panel scene-speed"><div class="score">${heartGauge(c.score)}
      <p class="score__grade">${c.grade.emoji} ${c.grade.title}</p><p class="score__line">${c.grade.line}</p></div></section>`;
  h += info(`<h3>궁합 상세 풀이</h3><ul class="parts">${c.parts.map((pt) => `<li class="part">
      <div class="part__head"><h4>${pt.icon} ${pt.label}</h4><span class="part__pts">${pt.points} / ${pt.max}</span></div>
      <div class="meter"><span style="width:${(pt.points / pt.max) * 100}%"></span></div>
      <p class="part__short">${esc(pt.short)}</p><p class="part__text">${esc(pt.text)}</p>
    </li>`).join('')}</ul>`);
  h += talk('coco', 'love', `<p>두 사람의 좋은 점!</p><ul class="ticks">${c.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`, { side: 'right', scene: 'mint' });
  h += talk('myo', 'worry', `<p>이건 조심해야 한다냥.</p><ul class="ticks">${c.cautions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`, { scene: 'lilac' });
  const base = new Date().getFullYear();
  h += `<section class="panel"><div class="rx">
      <div class="rx__head"><h3 class="lead-em" style="font-size:var(--s-5)">커플 처방전</h3><span>${A} ♥ ${B}</span></div>
      <ol>${c.tips.map((t) => `<li>${esc(t)}</li>`).join('')}
        <li>둘이 함께 운이 좋은 달: <b>${c.bestMonths.map((m) => (m.year !== base ? `${m.year}년 ${m.month}월` : `${m.month}월`)).join(', ')}</b> — 여행·기념일 계획은 이때!</li>
      </ol>
      <span class="rx__stamp" aria-hidden="true">緣</span>
    </div></section>`;
  h += talk('myo', 'smile', p('궁합은 정해진 답이 아니라 서로를 이해하는 힌트야. 더 궁금한 건 상담실로 와라냥.'), { scene: 'night' });
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 궁합으로 상담하기</a><button class="btn btn--lilac" type="button" data-action="new-partner">다른 사람과 궁합 보기</button><button class="btn" type="button" data-action="share-compat">궁합 공유하기</button><button class="btn" type="button" data-action="breakup-from-compat">💔 이 커플 이별수 보기</button>${state.me && state.me.status === 'after' ? '<button class="btn" type="button" data-action="reunion-from-compat">💞 이 사람과 재회운 보기</button>' : ''}</div>`;
  return h;
}

function viewCompat() {
  const a = me();
  if (!a) {
    return talk('coco', 'worry', p('궁합을 보려면 먼저 <strong>내 사주</strong>부터 알려 줘야 해요!'), { side: 'right', scene: 'pink' })
      + `<div class="actions"><a class="btn btn--pink" href="#home">내 정보 입력하러 가기</a></div>`;
  }
  let h = '';
  h += talk('myo', 'smug', p(`${esc(a.name)}님, 궁합을 볼 상대가 있다고? 그 사람 정보를 부적에 적어 줘냥.`) + p('상대의 태어난 시간을 몰라도 괜찮아.'), { scene: 'lilac' });
  h += partnerPresets();
  h += talisman('partner', state.partner);
  const c = compat();
  if (c) h += `<div id="compat-result">${compatResultHtml(c)}</div>`;
  return h;
}

/* ───────────── 화면: 이별수 ───────────── */

function pairCandidates() {
  const out = [];
  const seen = new Set();
  const push = (person, id, tag) => {
    if (!person) return;
    const k = personKey(person);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ id, person, tag });
  };
  state.presets.forEach((x) => push(x.person, x.id, ''));
  push(state.me, 'me', '보는 중');
  push(state.partner, 'partner', '궁합 상대');
  return out;
}

function slotCard(slot) {
  const p = state.pair[slot];
  const tag = slot.toUpperCase();
  if (!p) return `<div class="slot is-empty"><span class="slot__tag">${tag}</span><span class="slot__empty">아래에서 골라 주세요</span></div>`;
  return `<div class="slot"><span class="slot__tag">${tag}</span>
    <span class="slot__emoji" aria-hidden="true">${presetEmoji(p)}</span>
    <span class="slot__name">${esc(p.name)}<small>${p.gender === 'F' ? '여' : '남'}</small></span>
    <span class="slot__meta">${shortBirth(p)}</span></div>`;
}

const PAIR_MODE = {
  breakup: { head: '💔 이별수를 볼 두 사람', run: '💔 이별수 결과 보기', resultId: 'breakup-result', hint: '' },
  reunion: { head: '💞 재회운을 볼 두 사람', run: '💞 재회운 결과 보기', resultId: 'reunion-result', hint: '<p class="note pair__hint">A에는 <b>나</b>, B에는 <b>다시 만나고 싶은 그 사람</b>을 넣어 주세요.</p>' },
};
const pairMode = () => ((location.hash || '').slice(1) === 'reunion' ? 'reunion' : 'breakup');

function modeSwitch(mode) {
  return `<nav class="modes" aria-label="이별·재회 보기 선택">
    <a href="#breakup" class="${mode === 'breakup' ? 'is-on' : ''}" ${mode === 'breakup' ? 'aria-current="page"' : ''}>💔 이별수</a>
    <a href="#reunion" class="${mode === 'reunion' ? 'is-on' : ''}" ${mode === 'reunion' ? 'aria-current="page"' : ''}>💞 재회운</a>
  </nav>`;
}

function pairPicker(mode = 'breakup') {
  const M = PAIR_MODE[mode];
  const cands = pairCandidates();
  const row = (slot) => {
    const cur = state.pair[slot] ? personKey(state.pair[slot]) : '';
    const chips = cands.map((c) => `<button class="mini ${personKey(c.person) === cur ? 'mini--pink' : ''}" type="button" data-pair-pick="${slot}" data-cand="${esc(c.id)}">${presetEmoji(c.person)} ${esc(c.person.name)}${c.tag ? `<small class="mini__tag">${c.tag}</small>` : ''}</button>`).join('');
    return `<div class="pick"><p class="pick__label">${slot.toUpperCase()} 고르기</p>
      <div class="pchips">${chips}<button class="mini mini--ghost ${state.pairEdit === slot ? 'is-on' : ''}" type="button" data-action="pair-input" data-slot="${slot}">✏️ 직접 입력</button></div></div>`;
  };
  return `<section class="panel scene-lilac pairbox" id="pairbox"><div class="info">
    <h3>${M.head}</h3>${M.hint}
    <div class="pair">${slotCard('a')}<button class="pair__swap" type="button" data-action="pair-swap" aria-label="A와 B 바꾸기">⇄</button>${slotCard('b')}</div>
    ${cands.length ? '' : '<p class="note">저장한 프리셋이 없어요. "직접 입력"으로 적거나, 처음 화면에서 프리셋을 저장해 두면 여기서 바로 고를 수 있어요.</p>'}
    ${row('a')}${row('b')}
    <p class="form-error" role="alert" data-pair-error></p>
    <div class="pair__run"><button class="btn btn--pink" type="button" data-action="pair-run">${M.run}</button></div>
  </div></section>`;
}

// 하트 게이지: 이별수(금 간 하트) · 재회운(꿰맨 하트)
function riskHeart(risk, { label = '이별수', color = '#7E63C9', seam = 'crack' } = {}) {
  const top = 12 + (100 - risk) * 0.84;
  const heart = 'M60 102 C 20 76, 4 54, 4 32 C 4 14, 18 4, 32 4 C 44 4, 54 11, 60 22 C 66 11, 76 4, 88 4 C 102 4, 116 14, 116 32 C 116 54, 100 76, 60 102 Z';
  const line = seam === 'crack'
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

const LEVEL_COLOR = { safe: 'var(--mint)', mild: 'var(--lilac)', care: 'var(--talisman)', high: 'var(--cinnabar)' };

function riskYears(r) {
  return `<ul class="years">${r.years.map((y) => `<li class="year">
    <div class="year__when">${y.year}<small>${y.pillar.hangul}년 · ${y.animal}띠</small></div>
    <div>
      <div class="meter meter--risk" role="img" aria-label="이별 위험 ${y.risk}"><span style="width:${y.risk}%;background:${LEVEL_COLOR[y.level.key]}"></span></div>
      <div class="year__line"><span>${y.level.emoji} ${y.main.label}</span><b>${y.level.label}</b></div>
      <div class="note">${esc(y.main.line)}</div>
    </div>
  </li>`).join('')}</ul>`;
}

function riskMonths(r) {
  const dangerSet = new Set(r.danger.map((m) => `${m.year}-${m.month}`));
  const repairSet = new Set(r.repair.map((m) => `${m.year}-${m.month}`));
  const items = r.months.map((m) => {
    const k = `${m.year}-${m.month}`;
    const mark = dangerSet.has(k) ? '⚠️' : repairSet.has(k) ? '🕊️' : '';
    return `<li class="month lv-${m.level.key}">
      <div class="month__bar" style="height:${Math.max(8, Math.round(8 + ((m.risk - 5) / 90) * 92))}%">${mark ? `<span class="month__heart">${mark}</span>` : ''}</div>
      <div class="month__label">${m.month === 1 ? `${String(m.year).slice(2)}.` : ''}${m.month}월<span class="month__score">${m.risk}</span></div>
    </li>`;
  }).join('');
  const sr = r.months.map((m) => `${m.year}년 ${m.month}월 ${m.risk}`).join(', ');
  return `<p class="sr">월별 이별 위험: ${sr}</p><ul class="months months--risk" aria-hidden="true">${items}</ul>
    <p class="legend"><span><i style="background:var(--cinnabar)"></i>위험</span><span><i style="background:var(--talisman)"></i>주의</span><span><i style="background:var(--lilac)"></i>보통</span><span><i style="background:var(--mint)"></i>안정</span></p>`;
}

function factorItem(f) {
  const protect = f.pts < 0;
  const w = Math.min(100, Math.round((Math.abs(f.pts) / 22) * 100));
  return `<li class="part ${protect ? 'part--protect' : f.pts >= 10 ? 'part--danger' : 'part--care'}">
    <div class="part__head"><h4>${f.icon} ${f.label}</h4><span class="part__pts">${protect ? '🛡️ 지켜 주는 힘' : f.pts >= 10 ? '🚨 강한 위험' : f.pts >= 5 ? '⚠️ 위험' : '🙂 약한 위험'}</span></div>
    <div class="meter"><span style="width:${Math.max(6, w)}%"></span></div>
    ${f.detail ? `<p class="part__detail">${esc(f.detail)}</p>` : ''}
    <p class="part__short">${esc(f.short)}</p><p class="part__text">${esc(f.text)}</p>
  </li>`;
}

function monthName(m, base) {
  return m.year !== base ? `${m.year}년 ${m.month}월` : `${m.month}월`;
}

function breakupResultHtml(r) {
  const A = esc(r.a.name), B = esc(r.b.name);
  const base = new Date().getFullYear();
  const side = (x) => `<div class="vs__side"><div class="vs__emoji" aria-hidden="true">${DAY_MASTERS[x.dm].emoji}</div>
    <div class="tile el-${x.dmEl}"><span class="hanja">${STEMS[x.dm]}</span><small>${STEMS_KO[x.dm]}·${ELEMENT_KO[x.dmEl]}</small></div>
    <div class="vs__name">${esc(x.name)}</div><div class="vs__cat">${DAY_MASTERS[x.dm].cat}</div></div>`;
  const top = r.dangers[0];
  let h = '';
  h += episode('이별편', `${A} × ${B}`);
  h += talk('myo', 'think', p(`${A}님과 ${B}님, 두 사람을 잇는 인연의 실에서 약한 곳을 찾아볼게냥.`) + p('이별수는 정해진 결말이 아니라 <strong>미리 보는 날씨</strong>야. 비 올 날을 알면 우산을 챙기면 되지.'), { scene: 'night' });
  h += info(`<div class="vs">${side(r.a)}<div class="vs__x" aria-hidden="true">💔</div>${side(r.b)}</div>`, 'lilac');
  h += talk('coco', 'worry', p('두근두근… 이별수 나왔어요!'), { side: 'right', scene: 'pink', sfx: '두근' });
  h += `<section class="panel scene-speed"><div class="score">${riskHeart(r.risk)}
      <p class="score__grade">${r.grade.emoji} ${r.grade.title}</p><p class="score__line">${r.grade.line}</p>
      <p class="note score__note">숫자가 높을수록 부딪히기 쉬운 지점이 많다는 뜻이에요. 100점 만점의 "헤어질 확률"이 아니에요.</p></div></section>`;

  // 1화: 진단
  h += episode('1화', '이별수 진단');
  h += info(`<h3>두 사람 사이의 요인</h3><ul class="parts">${r.couple.map(factorItem).join('')}</ul>`);
  const sigList = (x, list) => `<div class="sig"><h4>${DAY_MASTERS[x.dm].emoji} ${esc(x.name)}님</h4>${list.length
    ? `<ul class="ticks">${list.map((s) => `<li><b>${s.icon} ${esc(s.label)}</b><br>${esc(s.text)}</li>`).join('')}</ul>`
    : '<p class="note">사주 속에 특별한 이별 신호가 없어요. 관계를 안정적으로 지키는 편이에요.</p>'}</div>`;
  h += info(`<h3>각자의 사주 속 이별 신호</h3>${sigList(r.a, r.signalsA)}${sigList(r.b, r.signalsB)}`, 'paper', 'sigs');
  h += top
    ? talk('myo', 'worry', p(`가장 조심할 건 <strong>${esc(top.label)}</strong>${josa(top.label, '이야', '야').slice(top.label.length)}냥.`) + p(esc(top.short)) + (r.protects.length ? p(`그래도 <strong>${esc(r.protects[0].short)}</strong>${josa(r.protects[0].short, '이', '가').slice(r.protects[0].short.length)} 두 사람을 붙잡아 주는 힘이 돼.`) : ''), { scene: 'lilac' })
    : talk('myo', 'happy', p('두 사람 사이엔 큰 위험 요인이 거의 없다냥!') + p(r.protects.length ? `특히 <strong>${esc(r.protects[0].short)}</strong>${josa(r.protects[0].short, '이', '가').slice(r.protects[0].short.length)} 단단한 버팀목이야.` : '익숙함에 표현만 줄이지 않으면 돼.'), { scene: 'mint', sfx: '반짝' });

  // 2화: 이별 패턴
  h += episode('2화', '이별이 온다면 이런 모습');
  h += talk('myo', 'think', p(`두 사람에게 이별이 온다면 <strong>${r.pattern.emoji} ${r.pattern.title}</strong>일 가능성이 커.`) + p(r.pattern.text), { scene: 'night' });
  h += info(`<h3>🚩 미리 보이는 신호</h3><ul class="ticks">${r.pattern.signs.map((t) => `<li>${t}</li>`).join('')}</ul><p class="stop">✋ ${r.pattern.stop}</p>`, 'yellow');

  // 3화: 시기
  h += episode('3화', '조심해야 할 시기');
  h += info(`<h3>앞으로 5년, 해마다 이별 위험</h3>${riskYears(r)}`);
  const dangerLines = r.danger.map((m) => `<li><b>⚠️ ${monthName(m, base)}</b> — ${esc(m.bad.map((x) => x.line).slice(0, 2).join(' / '))}</li>`).join('');
  const repairLines = r.repair.map((m) => `<li><b>🕊️ ${monthName(m, base)}</b> — ${esc(m.good.length ? m.good[0].line : '큰 변수 없이 잔잔한 시기')}. 화해·중요한 대화·기념일 이벤트는 이때!</li>`).join('');
  h += info(`<h3>앞으로 12개월</h3>${riskMonths(r)}<ul class="ticks ticks--plain">${dangerLines || '<li>두드러지게 위험한 달은 없어요. 잔잔한 1년이에요.</li>'}${repairLines}</ul>`);
  h += talk('coco', 'surprise', p(r.danger.length ? `${r.danger.map((m) => monthName(m, base)).join(', ')}엔 조심해야겠네요!` : '위험한 달이 거의 없네요!'), { side: 'right', scene: 'pink', sfx: '메모!' });

  // 4화: 막는 법
  h += episode('4화', '이별을 막는 법');
  h += talk('coco', 'think', p('그럼 어떻게 하면 안 헤어질 수 있어요?'), { side: 'right', scene: 'mint' });
  h += talk('myo', 'smug', p('사주가 약한 곳을 알려 줬으니, 거기만 단단히 묶으면 된다냥. 처방을 써 줄게.'), { scene: 'lilac' });
  h += info(`<h3>🤝 두 사람의 약속</h3><ul class="ticks">${r.rules.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`);
  const forList = (x, list) => info(`<h3>${DAY_MASTERS[x.dm].emoji} ${esc(x.name)}님이 할 일</h3><ul class="ticks">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'pink');
  h += forList(r.a, r.forA);
  h += forList(r.b, r.forB);
  h += info(`<h3>🚨 위기가 왔을 때 행동 수칙</h3><ol class="steps">${r.crisis.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`, 'yellow');
  h += info(`<h3>🍀 관계를 지켜 주는 기운</h3><p>두 사람에게 함께 부족한 <b>${ELEMENT_KO[r.coupleEl]}(${ELEMENT_INFO[r.coupleEl].name})</b> 기운을 채우면 관계가 안정돼요.</p>
    <dl class="luck">
      <div class="luck__row"><dt>컬러</dt><dd><span class="swatches">${r.luck.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}</span>${r.luck.color} — 커플 아이템·데이트 옷차림에</dd></div>
      <div class="luck__row"><dt>데이트</dt><dd>${r.luck.places.join(', ')}</dd></div>
      <div class="luck__row"><dt>소품</dt><dd>${r.luck.items.join(', ')}</dd></div>
    </dl>`, 'mint');
  const rx = [r.rules[0], r.pattern.stop.replace(/^이 신호가 보이면 /, '신호가 보이면 '), r.crisis[0], `${r.luck.color} 커플 아이템과 ${r.luck.places[0]} 데이트로 관계에 ${ELEMENT_KO[r.coupleEl]} 기운 채우기`];
  h += `<section class="panel"><div class="rx">
      <div class="rx__head"><h3 class="lead-em" style="font-size:var(--s-5)">이별 방지 처방전</h3><span>${A} ♥ ${B} · 담당: 묘연</span></div>
      <ol>${rx.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <span class="rx__stamp" aria-hidden="true">緣</span>
    </div></section>`;

  // 에필로그
  h += talk('myo', 'smile', p('이별수가 있다고 꼭 헤어지는 게 아니고, 없다고 저절로 지켜지는 것도 아니야.') + p('약한 곳을 아는 커플이 제일 오래간다냥.'), { scene: 'night' });
  h += info('<p class="safety">💡 <b>꼭 기억해요.</b> 폭력·협박·통제·스토킹이 있는 관계라면 이별을 막는 게 답이 아니에요. 지금 안전이 먼저예요. 위험하면 <b>112</b>, 데이트폭력 상담은 <b>여성긴급전화 1366</b>(24시간).</p>', 'paper');
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 결과로 상담하기</a><button class="btn btn--lilac" type="button" data-action="pair-again">다른 두 사람 보기</button><button class="btn" type="button" data-action="share-breakup">결과 공유하기</button><a class="btn" href="#reunion">💞 같은 두 사람 재회운 보기</a></div>`;
  return h;
}

const RE_LEVEL_COLOR = { high: 'var(--blush)', mid: 'var(--lilac)', low: '#D8D2E4' };

function reunionYears(r) {
  return `<ul class="years">${r.years.map((y) => `<li class="year">
    <div class="year__when">${y.year}<small>${y.pillar.hangul}년 · ${y.animal}띠</small></div>
    <div>
      <div class="meter" role="img" aria-label="재회 기운 ${y.score}"><span style="width:${y.score}%;background:${RE_LEVEL_COLOR[y.level.key]}"></span></div>
      <div class="year__line"><span>${y.level.emoji} ${y.main.label}</span><b>${y.level.label}</b></div>
      <div class="note">${esc(y.main.line)}</div>
    </div>
  </li>`).join('')}</ul>`;
}

function reunionMonths(r) {
  const bestSet = new Set(r.best.map((m) => `${m.year}-${m.month}`));
  const avoidSet = new Set(r.avoid.map((m) => `${m.year}-${m.month}`));
  const items = r.months.map((m) => {
    const k = `${m.year}-${m.month}`;
    const mark = bestSet.has(k) ? '💌' : avoidSet.has(k) ? '🚫' : '';
    return `<li class="month lv-${m.level.key}">
      <div class="month__bar" style="height:${Math.max(8, Math.round(8 + ((m.score - 5) / 90) * 92))}%">${mark ? `<span class="month__heart">${mark}</span>` : ''}</div>
      <div class="month__label">${m.month === 1 ? `${String(m.year).slice(2)}.` : ''}${m.month}월<span class="month__score">${m.score}</span></div>
    </li>`;
  }).join('');
  const sr = r.months.map((m) => `${m.year}년 ${m.month}월 ${m.score}`).join(', ');
  return `<p class="sr">월별 재회 기운: ${sr}</p><ul class="months months--reunion" aria-hidden="true">${items}</ul>
    <p class="legend"><span><i style="background:var(--blush)"></i>기회</span><span><i style="background:var(--lilac)"></i>보통</span><span><i style="background:#D8D2E4"></i>쉬어 가기</span></p>`;
}

function pullItem(f) {
  const pull = f.pts > 0;
  const w = Math.min(100, Math.round((Math.abs(f.pts) / 14) * 100));
  return `<li class="part ${pull ? 'part--pull' : 'part--block'}">
    <div class="part__head"><h4>${f.icon} ${esc(f.label)}</h4><span class="part__pts">${pull ? (f.pts >= 8 ? '🧶 강하게 당김' : '🧶 당기는 힘') : '🚧 막는 힘'}</span></div>
    <div class="meter"><span style="width:${Math.max(6, w)}%"></span></div>
    ${f.detail ? `<p class="part__detail">${esc(f.detail)}</p>` : ''}
    <p class="part__short">${esc(f.short)}</p><p class="part__text">${esc(f.text)}</p>
  </li>`;
}

function reunionResultHtml(r) {
  const A = esc(r.a.name), B = esc(r.b.name);
  const base = new Date().getFullYear();
  const side = (x) => `<div class="vs__side"><div class="vs__emoji" aria-hidden="true">${DAY_MASTERS[x.dm].emoji}</div>
    <div class="tile el-${x.dmEl}"><span class="hanja">${STEMS[x.dm]}</span><small>${STEMS_KO[x.dm]}·${ELEMENT_KO[x.dmEl]}</small></div>
    <div class="vs__name">${esc(x.name)}</div><div class="vs__cat">${DAY_MASTERS[x.dm].cat}</div></div>`;
  const firstBest = r.best[0];
  let h = '';
  h += episode('재회편', `${A} → ${B}`);
  h += talk('myo', 'smile', p(`${A}님과 ${B}님 사이의 실, 아직 어디에 걸려 있는지 볼게냥.`) + p('재회운은 "다시 만날 수 있는 길"을 보여 줄 뿐, 그 길을 걸을지는 <strong>두 사람 모두의 마음</strong>이 정하는 거야.'), { scene: 'night' });
  h += info(`<div class="vs">${side(r.a)}<div class="vs__x" aria-hidden="true">🧶</div>${side(r.b)}</div>`, 'lilac');
  h += talk('coco', 'sparkle', p('두근두근… 재회운 나왔어요!'), { side: 'right', scene: 'pink', sfx: '두근' });
  h += `<section class="panel scene-speed"><div class="score">${riskHeart(r.score, { label: '재회운', color: '#FF6FA8', seam: 'stitch' })}
      <p class="score__grade">${r.grade.emoji} ${r.grade.title}</p><p class="score__line">${r.grade.line}</p>
      <p class="note score__note">사주로 본 "다시 이어지기 쉬운 정도"예요. 상대의 마음을 대신 정해 주는 점수는 아니에요.</p></div></section>`;

  // 1화: 다시 이어질 실
  h += episode('1화', '아직 이어진 실, 끊어진 실');
  h += info(`<h3>다시 당기는 힘 · 막는 힘</h3><ul class="parts">${r.factors.map(pullItem).join('')}</ul>`);
  h += info(`<h3>${r.mind.emoji} ${B}님의 마음 — ${r.mind.type}</h3><p>${esc(r.mindText)}</p><h3 style="margin-top:14px">🫧 ${A}님의 마음</h3><p>${esc(r.myMind)}</p>`, 'pink');
  h += r.pulls.length
    ? talk('myo', 'smug', p(`두 사람을 다시 당기는 가장 큰 힘은 <strong>${esc(r.pulls[0].short)}</strong>${josa(r.pulls[0].short, '이야', '야').slice(r.pulls[0].short.length)}.`) + (r.blocks.length ? p(`대신 <strong>${esc(r.blocks[0].short)}</strong> 부분은 조심해야 해.`) : p('막는 힘이 크지 않아서 타이밍만 잘 잡으면 돼냥.')), { scene: 'lilac' })
    : talk('myo', 'worry', p('사주로 보면 두 사람을 다시 당기는 힘이 약한 편이야.') + p('그래도 마음이 있다면, 아래 작전대로 한 번은 진심을 전해 봐도 돼. 답은 상대가 정하는 거니까.'), { scene: 'lilac' });

  // 2화: 지난 이별의 이유
  const bp = r.breakup.pattern;
  h += episode('2화', '같은 이유로 또 헤어지지 않으려면');
  h += talk('myo', 'think', p(`두 사람 사주로 보면 이별의 모양은 <strong>${bp.emoji} ${bp.title}</strong>에 가까워.`) + p(bp.text), { scene: 'night' });
  h += info(`<h3>🔁 재회 전에 해결할 것</h3><ul class="ticks">${r.breakup.rules.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="stop">✋ 헤어진 이유가 지금은 달라졌는지 먼저 확인하세요. 그대로라면 다시 만나도 같은 자리에서 멈추기 쉬워요.</p>`, 'yellow');

  // 3화: 시기
  h += episode('3화', '다시 닿는 시기');
  h += info(`<h3>앞으로 5년, 해마다 재회 기운</h3>${reunionYears(r)}`);
  const bestLines = r.best.map((m) => `<li><b>💌 ${monthName(m, base)}</b> — ${esc(m.good.map((x) => x.line).slice(0, 2).join(' / ') || '잔잔하게 기회가 열리는 시기')}</li>`).join('');
  const avoidLines = r.avoid.map((m) => `<li><b>🚫 ${monthName(m, base)}</b> — ${esc(m.bad.length ? m.bad[0].line : '엇갈리기 쉬운 시기')}. 이때는 연락을 쉬어 가세요.</li>`).join('');
  h += info(`<h3>앞으로 12개월</h3>${reunionMonths(r)}<ul class="ticks ticks--plain">${bestLines}${avoidLines}</ul>`);
  h += info(`<h3>📅 첫 연락 길일</h3><p class="note">가장 가까운 기회의 달(${monthName(firstBest, base)}) 안에서 고른 날이에요.</p>
    <ul class="days">${r.contactDays.map((d) => `<li class="day"><b>${d.month}월 ${d.day}일</b><span>${d.wd}요일</span><small>${esc(d.main.label)}</small></li>`).join('')}</ul>`, 'mint');

  // 4화: 재회 작전
  h += episode('4화', '재회 작전');
  h += talk('coco', 'think', p('그럼 어떻게 연락해야 해요?'), { side: 'right', scene: 'mint' });
  h += talk('myo', 'smug', p(`${B}님은 <strong>${r.mind.type}</strong>이니까, 거기에 맞춰 다가가야 해.`) + p(esc(r.mind.how)), { scene: 'lilac' });
  h += info(`<h3>🧭 단계별 작전</h3><ol class="steps">
      <li><b>마음 정리</b> — 첫 연락 전까지는 연락을 쉬고, 헤어진 이유와 "지금은 뭐가 달라졌는지"를 적어 보세요.</li>
      <li><b>첫 연락</b> — ${monthName(firstBest, base)}, 그중에서도 ${r.contactDays.map((d) => d.day).join('·')}일쯤. 짧고 가벼운 안부 한 줄이면 충분해요.</li>
      <li><b>답을 기다리기</b> — 답이 없으면 1~2주는 기다리세요. 끝내 답이 없거나 거절하면 그게 상대의 대답이에요.</li>
      <li><b>다시 만난다면</b> — 첫 만남은 짧고 가볍게, 지난 이야기는 두 번째 만남부터.</li>
      <li><b>다시 시작한다면</b> — 2화의 "재회 전에 해결할 것"을 둘의 약속으로 만들기.</li>
    </ol>`, 'yellow');
  h += info(`<h3>💬 첫 연락 메시지 예시</h3><ul class="msgs">${r.mind.msgs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="note">○○ 부분은 두 사람만 아는 장소·일로 바꿔 쓰세요.</p>`);
  h += info(`<h3>🙅 하지 말아야 할 것</h3><ul class="ticks">${r.dont.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'pink');
  h += info(`<h3>☕ 다시 만나는 날</h3><ul class="ticks">${r.meet.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'mint');
  const rx = [
    `${monthName(firstBest, base).replace(/\d+월$/, '')}${r.contactDays[0].month}월 ${r.contactDays[0].day}일(${r.contactDays[0].wd})쯤 가벼운 안부 한 줄`,
    r.mind.how,
    r.breakup.rules[0],
    `${r.luck.color} 포인트 아이템으로 두 사람 사이에 ${ELEMENT_KO[r.coupleEl]} 기운 채우기`,
  ];
  h += `<section class="panel"><div class="rx">
      <div class="rx__head"><h3 class="lead-em" style="font-size:var(--s-5)">재회 처방전</h3><span>${A} → ${B} · 담당: 묘연</span></div>
      <ol>${rx.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <span class="rx__stamp" aria-hidden="true">緣</span>
    </div></section>`;

  // 5화: 재회가 답이 아닐 때
  h += episode('5화', '재회가 답이 아닐 때');
  const nl = r.newLove.map((m) => `${monthName(m, base)}(${m.reason.label})`).join(', ');
  h += talk('myo', r.score < 40 ? 'worry' : 'think', p(r.score < 40 ? '솔직히 말하면, 지금은 다시 잇는 실보다 새로운 실이 더 가까이 있어 보여.' : '재회가 꼭 정답은 아니야. 그리움과 사랑은 다를 수 있거든.') + p(`${A}님에게 새 인연운이 좋은 달은 <strong>${nl}</strong>이야. 재회를 기다리느라 이 시기를 놓치지는 마냥.`), { scene: 'night' });
  h += info(`<p class="safety">💡 <b>이럴 땐 재회보다 나를 지키세요.</b><br>• 폭력·협박·통제·반복된 거짓말 때문에 헤어졌다면 다시 만나지 않는 게 맞아요. 위험하면 <b>112</b>, 데이트폭력 상담은 <b>여성긴급전화 1366</b>(24시간).<br>• 상대가 연락하지 말라고 했거나 차단했다면 그 뜻을 존중하세요. 거절 뒤에도 계속 연락하면 스토킹이 될 수 있어요.<br>• 재회를 생각할수록 내가 작아진다면, 지금 필요한 건 그 사람보다 나를 돌보는 시간이에요.</p>`, 'paper');
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 결과로 상담하기</a><a class="btn btn--lilac" href="#breakup">💔 같은 두 사람 이별수 보기</a><button class="btn" type="button" data-action="share-reunion">결과 공유하기</button><button class="btn" type="button" data-action="pair-again">다른 두 사람 보기</button></div>`;
  return h;
}

function viewBreakup(mode = 'breakup') {
  const M = PAIR_MODE[mode];
  let h = modeSwitch(mode);
  h += mode === 'breakup'
    ? talk('myo', 'think', p('이별수가 궁금하다고? 두 사람을 골라 줘냥.') + p('저장한 <strong>프리셋</strong>에서 고르거나, 직접 적어도 돼. 그 둘 사이에 언제, 어떻게 금이 가기 쉬운지, 그리고 <strong>어떻게 막는지</strong>까지 알려 줄게.'), { scene: 'night', caption: '묘연 사주방 · 인연의 실 점검' })
    : talk('myo', 'smile', p('다시 이어질 수 있을지 궁금하구나냥. 🧶') + p('너와 그 사람을 골라 줘. 끊어진 실이 아직 어디에 걸려 있는지, <strong>언제 연락하면 닿는지</strong>, 그리고 <strong>어떻게 다가가야 하는지</strong>까지 알려 줄게.'), { scene: 'night', caption: '묘연 사주방 · 끊어진 실 잇기' });
  h += pairPicker(mode);
  if (state.pairEdit) h += `<div id="pairform">${talisman(state.pairEdit === 'a' ? 'pairA' : 'pairB', null)}</div>`;
  const r = mode === 'breakup' ? breakup() : reunion();
  if (r) h += `<div id="${M.resultId}">${mode === 'breakup' ? breakupResultHtml(r) : reunionResultHtml(r)}</div>`;
  else if (state.pair.a && state.pair.b) h += talk('coco', 'happy', p(`두 사람이 정해졌어요! 위의 <strong>${M.run}</strong>를 눌러 주세요.`), { side: 'right', scene: 'pink' });
  return h;
}

/* ───────────── 화면: 상담실 ───────────── */

function botMsg(m) {
  return `<div class="msg msg--bot"><div class="avatar">${faceAvatar('myo', m.expr || 'smile')}</div>
    <div class="msg__bubble">${renderRich(m.content)}${m.source === 'ai' ? '<span class="msg__meta">AI 상담</span>' : ''}</div></div>`;
}
function meMsg(m) {
  return `<div class="msg msg--me"><div class="msg__bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
}

function viewChat() {
  const a = me();
  if (!a) {
    return talk('myo', 'worry', p('상담을 하려면 먼저 사주를 알려 줘야 한다냥. 그래야 맞춤 해결책을 줄 수 있어.'), { scene: 'lilac' })
      + `<div class="actions"><a class="btn btn--pink" href="#home">내 정보 입력하러 가기</a></div>`;
  }
  if (!state.chat.length) {
    const g = counselor.greet();
    state.chat.push({ role: 'assistant', content: g.text, expr: g.expr, source: 'local' });
    store.set('chat', state.chat);
  }
  const c = compat();
  const mode = state.ai ? 'Claude AI 상담 모드' : '사주 맞춤 상담 모드';
  return `<section class="chat" aria-label="묘연 상담실">
    <div class="chat__head">
      <div class="avatar">${faceAvatar('myo', 'smile')}</div>
      <div class="chat__title"><b>묘연 상담실</b><small><i></i>${esc(a.name)}님 사주 연결됨${c ? ` · ${esc(c.b.name)}님 궁합 포함` : ''} · ${mode}</small></div>
      <button class="btn btn--ghost chat__clear" type="button" data-action="clear-chat">대화 지우기</button>
    </div>
    <div class="chat__log" id="chat-log" role="log" aria-live="polite">${state.chat.map((m) => (m.role === 'user' ? meMsg(m) : botMsg(m))).join('')}</div>
    <div class="chat__chips" id="chat-chips">${chipsHtml(starterChips(a.person.status))}</div>
    <form class="chat__form" data-form="chat">
      <label class="sr" for="chat-input">고민 입력</label>
      <textarea id="chat-input" name="q" rows="1" maxlength="800" placeholder="연애 고민을 편하게 적어 주세요" required></textarea>
      <button class="btn btn--pink" type="submit">보내기</button>
    </form>
  </section>`;
}

function chipsHtml(chips) {
  return chips.map((c) => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join('');
}

function scrollChat() {
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

async function ask(question) {
  if (state.busy) return;
  const q = question.trim();
  if (!q) return;
  state.busy = true;
  state.chat.push({ role: 'user', content: q });
  const log = document.getElementById('chat-log');
  log.insertAdjacentHTML('beforeend', meMsg({ content: q }));
  log.insertAdjacentHTML('beforeend', `<div class="msg msg--bot" id="typing"><div class="avatar">${faceAvatar('myo', 'think')}</div><div class="msg__bubble typing" aria-label="묘연이 답을 쓰는 중"><span></span><span></span><span></span></div></div>`);
  scrollChat();

  let reply = null;
  if (state.ai) reply = await askAI();
  if (!state.ai) refreshChatHeader();
  if (!reply) {
    await new Promise((r) => setTimeout(r, 650));
    const r = counselor.respond(q);
    reply = { role: 'assistant', content: r.text, expr: r.expr, chips: r.chips, source: 'local' };
  }
  document.getElementById('typing')?.remove();
  document.getElementById('ai-live')?.remove();
  state.chat.push(reply);
  if (state.chat.length > 60) state.chat = state.chat.slice(-60);
  store.set('chat', state.chat);
  log.insertAdjacentHTML('beforeend', botMsg(reply));
  const chips = reply.chips && reply.chips.length ? reply.chips : starterChips(me().person.status);
  document.getElementById('chat-chips').innerHTML = chipsHtml(chips);
  scrollChat();
  state.busy = false;
}

// Claude 상담 — 서버(/api/chat) 또는 Claude 아티팩트의 sample. 실패하면 null → 규칙형 상담으로 대체
function chatHistory() {
  const history = state.chat.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  return history;
}

function showLive(text) {
  document.getElementById('typing')?.remove();
  const log = document.getElementById('chat-log');
  let live = document.getElementById('ai-live');
  if (!live) {
    log.insertAdjacentHTML('beforeend', `<div class="msg msg--bot" id="ai-live"><div class="avatar">${faceAvatar('myo', 'smile')}</div><div class="msg__bubble"></div></div>`);
    live = document.getElementById('ai-live');
  }
  live.querySelector('.msg__bubble').innerHTML = renderRich(text);
  scrollChat();
}

async function askAI() {
  const br = breakup(), ru = reunion();
  const context = summaryForAI(me(), forecast(), compat()) + (br ? `\n${summaryBreakupForAI(br)}` : '') + (ru ? `\n${summaryReunionForAI(ru)}` : '');
  const history = chatHistory();
  const text = state.ai === 'artifact' ? await askArtifact(history, context) : await askServer(history, context);
  if (!text || !text.trim()) return null;
  return { role: 'assistant', content: text.trim(), expr: guessExpr(text), source: 'ai' };
}

async function askServer(history, context) {
  try {
    const res = await fetch('api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, context }),
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      showLive(text);
    }
    return text;
  } catch {
    return null;
  }
}

// Claude 아티팩트로 열었을 때: 보는 사람의 Claude 계정으로 답한다 (첫 질문에 동의 요청)
async function askArtifact(history, context) {
  const intro = `${SYSTEM_PROMPT}\n\n${contextBlock(context, todayKST())}\n\n---\n아래는 상담자와의 대화야. 묘연으로서 마지막 질문에 답해 줘. 답변 본문만 써.\n\n`;
  const input = history.map((m, i) => (i === 0 ? { role: 'user', content: intro + m.content } : m));
  try {
    const res = await state.sample(input, { cache: false, onText: ({ text }) => { if (text) showLive(text); } });
    return res.text;
  } catch (err) {
    if (err && err.code === 'not_granted') state.ai = null; // 권한이 없으면 이후엔 규칙형 상담만
    return null;
  }
}

function refreshChatHeader() {
  const small = document.querySelector('.chat__title small');
  if (small) small.innerHTML = small.innerHTML.replace('Claude AI 상담 모드', '사주 맞춤 상담 모드');
}

function guessExpr(t) {
  if (/109|1366|112/.test(t)) return 'worry';
  if (/궁합|사랑|설레|고백/.test(t)) return 'love';
  if (/조심|주의|힘들|서운/.test(t)) return 'think';
  return 'smile';
}

/* ───────────── 라우팅 & 이벤트 ───────────── */

const app = document.getElementById('app');

function render() {
  const route = (location.hash || '#home').slice(1);
  const tab = route === 'home' || route === 'start' ? 'start' : route === 'reunion' ? 'breakup' : route;
  let html;
  if (route === 'reading') html = viewReading();
  else if (route === 'compat') html = viewCompat();
  else if (route === 'chat') html = viewChat();
  else if (route === 'breakup') html = viewBreakup('breakup');
  else if (route === 'reunion') html = viewBreakup('reunion');
  if (html == null) html = viewHome();
  app.innerHTML = html;
  document.querySelectorAll('.tabs a').forEach((t) => {
    if (t.dataset.tab === tab) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.title = {
    reading: '내 연애 사주 — 묘연의 연애사주', compat: '궁합 — 묘연의 연애사주', chat: '상담실 — 묘연의 연애사주', breakup: '이별수 — 묘연의 연애사주', reunion: '재회운 — 묘연의 연애사주',
  }[route] || '묘연의 연애사주 — 고양이 점술사가 웹툰으로 풀어 주는 연애 사주·궁합';
  if (route === 'chat') scrollChat();
  if (route === 'start') {
    document.getElementById('start')?.scrollIntoView({ block: 'start' });
  } else if (pendingScroll && document.getElementById(pendingScroll)) {
    document.getElementById(pendingScroll).scrollIntoView({ block: 'start' });
    if (['compat-result', 'breakup-result', 'reunion-result'].includes(pendingScroll)) animateScore();
  } else {
    window.scrollTo(0, 0);
  }
  pendingScroll = null;
}
let pendingScroll = null;

function animateScore() {
  const el = document.querySelector('.heart__num');
  const fill = document.querySelector('.heart__fill');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = Number(el.dataset.count);
  const y1 = Number(fill.getAttribute('y'));
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 1100);
    const e = 1 - (1 - t) ** 3;
    el.textContent = Math.round(target * e);
    fill.setAttribute('y', 96 - (96 - y1) * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showError(form, res) {
  form.querySelector('.form-error').textContent = res.error;
  const el = form.querySelector(`[name="${res.focus}"]`);
  if (el && !el.disabled) el.focus();
}

function stampThen(form, done) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  form.querySelector('.seal').classList.add('is-stamping');
  form.classList.add('is-stamped');
  setTimeout(done, reduce ? 0 : 900);
}

app.addEventListener('submit', (ev) => {
  const form = ev.target;
  const kind = form.dataset.form;
  if (!kind) return;
  ev.preventDefault();
  if (kind === 'chat') {
    const ta = form.querySelector('textarea');
    const q = ta.value;
    ta.value = '';
    ask(q);
    return;
  }
  const res = readForm(form);
  if (res.error) { showError(form, res); return; }
  if (kind === 'me') {
    if (!setMe(res.person)) { showError(form, { error: '날짜를 확인해 주세요.', focus: 'day' }); return; }
    // 프리셋에 있는 사람이면 연애 상태 등 바뀐 내용을 프리셋에도 반영
    if (findPreset(state.presets, state.me)) { state.presets = upsertPreset(state.presets, state.me).list; savePresets(); }
    stampThen(form, () => { location.hash = '#reading'; if (location.hash === '#reading') render(); });
  } else if (kind === 'pairA' || kind === 'pairB') {
    if (!analyzeCached(res.person)) { showError(form, { error: '날짜를 확인해 주세요.', focus: 'day' }); return; }
    state.pair[kind === 'pairA' ? 'a' : 'b'] = res.person;
    state.pair.done = false;
    state.pairEdit = null;
    savePair();
    stampThen(form, () => { pendingScroll = 'pairbox'; render(); });
  } else if (kind === 'partner') {
    state.partner = res.person;
    resetMemo('partner');
    store.set('partner', state.partner);
    stampThen(form, () => { pendingScroll = 'compat-result'; render(); });
  }
});

app.addEventListener('input', (ev) => {
  const t = ev.target;
  const form = t.closest('form.talisman');
  if (!form) return;
  // 오류 문구는 입력하는 동안 지운다 (버튼을 누를 때 지우면 레이아웃이 밀려 탭이 빗나감)
  form.querySelector('.form-error').textContent = '';
  if (t.name !== 'time') return;
  const next = formatTimeTyping(t.value);
  if (next !== t.value) t.value = next;
  t.closest('form').querySelector('[data-time-hint]').innerHTML = timeHint(t.value);
});

app.addEventListener('focusout', (ev) => {
  const t = ev.target;
  if (t.name !== 'time' || !t.closest('form.talisman') || !t.value) return;
  t.value = normalizeTime(t.value);
  t.closest('form').querySelector('[data-time-hint]').innerHTML = timeHint(t.value);
});

app.addEventListener('change', (ev) => {
  const t = ev.target;
  const form = t.closest('form.talisman');
  if (!form) return;
  if (t.name === 'unknown') {
    const time = form.querySelector('[name="time"]');
    time.disabled = t.checked;
    if (t.checked) time.value = '';
    form.querySelector('[data-time-hint]').innerHTML = t.checked ? '시간을 모르면 시주 없이 여섯 글자로 풀이해요.' : timeHint(time.value);
  }
  if (t.name === 'calendar') {
    form.querySelector('[data-leap]').hidden = t.value !== 'lunar';
  }
  form.querySelector('.form-error').textContent = '';
});

app.addEventListener('click', (ev) => {
  const chip = ev.target.closest('[data-chip]');
  if (chip) { ask(chip.dataset.chip); return; }
  const open = ev.target.closest('[data-preset-open]');
  if (open) { openPreset(open.dataset.presetOpen); return; }
  const del = ev.target.closest('[data-preset-del]');
  if (del) { deletePreset(del.dataset.presetDel); return; }
  const pick = ev.target.closest('[data-preset-partner]');
  if (pick) {
    const x = state.presets.find((it) => it.id === pick.dataset.presetPartner);
    if (!x || !analyzeCached(x.person)) return;
    state.partner = { ...x.person };
    resetMemo('partner');
    store.set('partner', state.partner);
    pendingScroll = 'compat-result';
    render();
    return;
  }
  const pairPick = ev.target.closest('[data-pair-pick]');
  if (pairPick) {
    const c = pairCandidates().find((x) => x.id === pairPick.dataset.cand);
    if (!c) return;
    state.pair[pairPick.dataset.pairPick] = { ...c.person };
    state.pair.done = false;
    state.pairEdit = null;
    savePair();
    pendingScroll = 'pairbox';
    render();
    return;
  }
  const act = ev.target.closest('[data-action]');
  if (!act) return;
  const action = act.dataset.action;
  if (action === 'pair-input') {
    state.pairEdit = state.pairEdit === act.dataset.slot ? null : act.dataset.slot;
    pendingScroll = state.pairEdit ? 'pairform' : 'pairbox';
    render();
    if (state.pairEdit) document.querySelector('#pairform [name="name"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'pair-swap') {
    const { a, b } = state.pair;
    state.pair.a = b; state.pair.b = a;
    savePair();
    pendingScroll = state.pair.done && breakup() ? PAIR_MODE[pairMode()].resultId : 'pairbox';
    render();
    return;
  }
  if (action === 'pair-run') {
    const err = document.querySelector('[data-pair-error]');
    const { a, b } = state.pair;
    if (!a || !b) { err.textContent = `${!a ? 'A' : 'B'}를 먼저 골라 주세요.`; return; }
    if (personKey(a) === personKey(b)) { err.textContent = 'A와 B가 같은 사람이에요. 다른 사람을 골라 주세요.'; return; }
    if (!analyzeCached(a) || !analyzeCached(b)) { err.textContent = '생년월일을 읽을 수 없는 사람이 있어요. 다시 골라 주세요.'; return; }
    state.pair.done = true;
    state.pairEdit = null;
    savePair();
    pendingScroll = PAIR_MODE[pairMode()].resultId;
    render();
    return;
  }
  if (action === 'pair-again') { pendingScroll = 'pairbox'; render(); return; }
  if (action === 'share-breakup') { shareBreakup(); return; }
  if (action === 'share-reunion') { shareReunion(); return; }
  if (action === 'reunion-from-compat') {
    if (!state.me || !state.partner) return;
    state.pair = { a: { ...state.me }, b: { ...state.partner }, done: true };
    state.pairEdit = null;
    savePair();
    pendingScroll = 'reunion-result';
    if (location.hash === '#reunion') render(); else location.hash = '#reunion';
    return;
  }
  if (action === 'breakup-from-compat') {
    if (!state.me || !state.partner) return;
    state.pair = { a: { ...state.me }, b: { ...state.partner }, done: true };
    state.pairEdit = null;
    savePair();
    pendingScroll = 'breakup-result';
    if (location.hash === '#breakup') render(); else location.hash = '#breakup';
    return;
  }
  if (act.dataset.action === 'preset-save-current' && state.me) savePreset(state.me);
  if (act.dataset.action === 'preset-save-form') {
    const form = act.closest('form');
    const res = readForm(form);
    if (res.error) { showError(form, res); return; }
    if (!analyzeCached(res.person)) { showError(form, { error: '날짜를 확인해 주세요.', focus: 'day' }); return; }
    savePreset(res.person);
  }
  if (act.dataset.action === 'form-clear') clearForm(act.closest('form'));
  if (act.dataset.action === 'clear-chat') {
    state.chat = [];
    store.del('chat');
    render();
  }
  if (act.dataset.action === 'share-reading') shareReading();
  if (act.dataset.action === 'share-compat') shareCompat();
  if (act.dataset.action === 'new-partner') clearForm(document.querySelector('form[data-form="partner"]'));
});

// 이미 그 주소에 있을 때 같은 링크(예: 처음으로)를 다시 누르면 그 자리로 다시 이동
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#"]');
  if (!a || ev.defaultPrevented || a.classList.contains('skip')) return;
  if (a.getAttribute('href') === location.hash) { ev.preventDefault(); render(); }
});

app.addEventListener('keydown', (ev) => {
  if (ev.target.id === 'chat-input' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    ev.target.form.requestSubmit();
  }
});

window.addEventListener('hashchange', render);

// AI 상담: Claude 아티팩트로 열렸으면 sample, 아니면 Node 서버(/api/chat)가 있는지 확인
function enableAI(mode) {
  state.ai = mode;
  if (location.hash === '#chat' && !state.busy) render();
}
if (window.claude && typeof window.claude.use === 'function') {
  window.claude.use('sample').then((sample) => {
    if (sample) { state.sample = sample; enableAI('artifact'); }
  }).catch(() => {});
} else {
  fetch('api/health').then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j && j.ai) enableAI('server');
  }).catch(() => {});
}

/* ───────────── 공유 ───────────── */

const inFrame = (() => { try { return window.top !== window; } catch { return true; } })();

function toast(msg, action) {
  let el = document.getElementById('toast');
  if (!el) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toast" id="toast" role="status" aria-live="polite"></div>');
    el = document.getElementById('toast');
  }
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="mini" type="button">${esc(action.label)}</button>` : ''}`;
  el.classList.toggle('has-action', !!action);
  if (action) {
    el.querySelector('button').addEventListener('click', () => {
      action.fn();
      el.classList.remove('is-on', 'has-action');
    }, { once: true });
  }
  el.classList.add('is-on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-on', 'has-action'), action ? 5000 : 2600);
}

async function share(text) {
  const url = inFrame ? '' : location.href.split('#')[0];
  if (!inFrame && navigator.share) {
    try { await navigator.share({ title: '묘연의 연애사주', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    toast('결과를 복사했어요. 친구에게 붙여 넣어 보내 보세요!');
  } catch {
    toast('이 화면에선 복사가 막혀 있어요. 캡처해서 공유해 주세요!');
  }
}

function shareReading() {
  const a = me(), fc = forecast();
  if (!a) return;
  const y = fc.years[0], b = fc.best[0];
  share(`🐾 묘연의 연애사주\n${a.name}님의 연애 캐릭터는 "${a.profile.cat}" ${a.profile.emoji}\n${y.year}년 연애운 ${y.score}점 (${y.reason.label}) · 인연운 최고의 달은 ${b.year}년 ${b.month}월!`);
}

function shareBreakup() {
  const r = breakup();
  if (!r) return;
  share(`🐾 묘연의 연애사주\n${r.a.name} × ${r.b.name} 이별수 ${r.risk}점, ${r.grade.title} ${r.grade.emoji}\n이별이 온다면 "${r.pattern.title}" — 막는 법: ${r.rules[0]}`);
}

function shareReunion() {
  const r = reunion();
  if (!r) return;
  const b0 = r.best[0];
  share(`🐾 묘연의 연애사주\n${r.a.name} → ${r.b.name} 재회운 ${r.score}점, ${r.grade.title} ${r.grade.emoji}\n다시 닿기 좋은 때: ${b0.year}년 ${b0.month}월 · ${r.b.name}님은 "${r.mind.type}"`);
}

function shareCompat() {
  const c = compat();
  if (!c) return;
  share(`🐾 묘연의 연애사주\n${c.a.name} ♥ ${c.b.name} 궁합 ${c.score}점, ${c.grade.title} ${c.grade.emoji}\n"${c.grade.line}"`);
}

render();
