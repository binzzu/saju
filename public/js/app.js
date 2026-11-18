import { drawCharacter, faceAvatar, fullBody, CHARACTERS } from './characters.js';
import {
  analyzePerson, buildForecast, formatBirth, summaryForAI, computeDaewoon, dailyLove,
  ELEMENT_INFO, CHARMS, DAY_MASTERS, LUCK, STATUS_LABEL,
  ELEMENTS, ELEMENT_KO, ELEMENT_HANJA, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO,
} from './reading.js';
import { analyzeCompat } from './compat.js';
import { createCounselor } from './counsel.js';
import { lunarToSolar, lunarMonthInfo } from './lunar.js';
import { escapeHtml as esc, renderRich, josa, hasBatchim } from './text.js';
import { SYSTEM_PROMPT, contextBlock, todayKST } from './persona.js';
import { HOUR_LABELS } from './saju.js';
import { analyzeBreakup, summaryBreakupForAI } from './breakup.js';
import { analyzeReunion, summaryReunionForAI } from './reunion.js';
import { analyzeIntimacy, summaryIntimacyForAI } from './intimacy.js';
import { dailyFortune, weekFortune, summaryDailyForAI } from './daily.js';
import { suggestQuestions, lastTopicOf } from './suggest.js';
import { futurePartner, futureAvatar } from './future.js';
import {
  rankCompat, analyzeSsum, analyzeAnniv, monthReport, findIdeal,
  affinityLevel, unlockedExpr, gainAffinity, EXPR_UNLOCK, AFFINITY_LINES,
} from './extras.js';
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
  dayOffset: 0,                               // 오늘의 운세: 오늘로부터 며칠 뒤(음수면 전)
  futureWant: store.get('futureWant'),        // 미래의 연인: 보고 싶은 성별 'M' | 'F'
  monthOffset: 0,                             // 이달의 연애 리포트: 이번 달로부터 몇 달 뒤
  anniv: store.get('anniv'),                  // 기념일: 사귄 날 {y,m,d}
  affinity: store.get('affinity'),            // 묘연·코코 호감도
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
  delete memo.intimacy;
  delete memo.ssum;
  delete memo.anniv;
}
// 속궁합 (나 × 궁합 상대, 두 사람 모두 만 19세 이상일 때만 결과)
function intimacy() {
  const a = me(), b = partner();
  if (!a || !b) return null;
  if (!memo.intimacy) memo.intimacy = analyzeIntimacy(a, b);
  return memo.intimacy;
}
const compatResultId = () => {
  const route = (location.hash || '').slice(1);
  return ['intimacy', 'ssum', 'anniv'].includes(route) ? `${route}-result` : 'compat-result';
};

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

const counselor = createCounselor(() => ({ a: me(), fc: forecast(), compat: compat(), breakup: breakup(), reunion: reunion(), intimacy: intimacy() }));

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
    <div class="talisman__top"><button class="mini" type="button" data-action="form-clear" aria-label="입력한 정보 모두 지우기">🔄 초기화</button></div>
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
    <button class="theme theme--inline" type="button" data-theme-toggle>${document.documentElement.dataset.theme === 'dark' ? '☀️ 밝게' : '🌙 어둡게'}</button>
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
    html += talk('coco', 'wink', p('다른 사람 사주가 궁금하면 <strong>🔄 초기화</strong>를 누르고 적어요!') + p('<strong>📌 프리셋에 저장</strong>해 두면 다음엔 한 번에 꺼내 볼 수 있어요.'), { side: 'right', scene: 'pink' });
  } else {
    html += talk('coco', 'happy', p('이름, 생년월일, 태어난 시간을 이 <strong>부적</strong>에 적어 주세요!') + p('음력 생일도 괜찮고, 시간을 몰라도 볼 수 있어요.'), { side: 'right', scene: 'pink', sfx: '쓱쓱' });
  }
  html += talisman('me', state.me);
  html += affinityCard();
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
  // 사주 풀이·오늘의 운세 화면에서는 그 화면 그대로 사람만 바꾼다
  if (location.hash === '#reading' || location.hash === '#today') render();
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
  toast('입력 칸을 모두 비웠어요. 저장해 둔 사주와 프리셋은 그대로예요.');
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
    </div>
    <div class="today__more"><a class="mini mini--pink" href="#today">☀️ 오늘의 운세 전체 보기</a></div>`, 'mint');
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
  h += readingSwitch('reading');

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

/* ───────────── 화면: 오늘의 운세 ───────────── */

function readingSwitch(mode) {
  return switchNav('내 사주 보기 선택', [['reading', '📖 사주 풀이'], ['today', '☀️ 오늘 운세'], ['month', '🗓️ 이달 리포트'], ['ideal', '🔍 이상형'], ['future', '🔮 미래 연인']], mode).replace('class="modes"', 'class="modes modes--5"');
}

const DAY_MIN = -7, DAY_MAX = 30;

function viewToday() {
  const a = me();
  if (!a) {
    return readingSwitch('today') + talk('coco', 'worry', p('오늘의 운세를 보려면 먼저 <strong>내 사주</strong>부터 알려 줘야 해요!'), { side: 'right', scene: 'pink' })
      + '<div class="actions"><a class="btn btn--pink" href="#start">내 정보 입력하러 가기</a></div>';
  }
  const off = state.dayOffset;
  const f = dailyFortune(a, Date.now(), off);
  const n = esc(a.name);
  const week = weekFortune(a, Date.now(), 0, 7);
  const rel = { '-1': '어제', 0: '오늘', 1: '내일' }[off] || `${f.date.m}월 ${f.date.d}일`;
  let h = viewingBar(a);
  h += readingSwitch('today');
  h += `<div class="daynav" id="daynav">
    <button class="mini" type="button" data-day="${off - 1}" ${off <= DAY_MIN ? 'disabled' : ''} aria-label="하루 전">◀ 전날</button>
    <div class="daynav__now"><b>${f.date.m}월 ${f.date.d}일(${f.date.wd})</b><small>${{ '-1': '어제 · ', 0: '오늘 · ', 1: '내일 · ' }[off] || ''}${f.pillar.hanja}일 · ${f.pillar.animal}의 날</small></div>
    <button class="mini" type="button" data-day="${off + 1}" ${off >= DAY_MAX ? 'disabled' : ''} aria-label="하루 뒤">다음 날 ▶</button>
  </div>
  <ul class="week" aria-label="이번 주 총운">${week.map((w) => `<li><button type="button" class="week__day ${w.offset === off ? 'is-on' : ''} lv-${w.grade.key}" data-day="${w.offset}">
    <span class="week__wd">${w.offset === 0 ? '오늘' : w.wd}</span><span class="week__emoji" aria-hidden="true">${w.grade.emoji}</span><b>${w.overall}</b><small>${w.m}/${w.d}</small></button></li>`).join('')}</ul>
  ${off !== 0 ? '<div class="daynav__back"><button class="mini mini--pink" type="button" data-day="0">☀️ 오늘로 돌아가기</button></div>' : ''}`;

  h += talk('myo', f.overall >= 72 ? 'sparkle' : f.overall >= 58 ? 'smile' : f.overall >= 45 ? 'think' : 'worry',
    p(`${n}님의 ${rel}은 ${f.theme.emoji} <strong>${f.theme.word}</strong>의 날이다냥.`) + p(f.theme.line + '.'), { scene: 'night', caption: `${f.pillar.hanja}일 · 묘연의 일진 풀이` });
  h += `<section class="panel scene-speed"><div class="score">${riskHeart(f.overall, { label: '총운', color: '#F7D54A', seam: 'none' })}
      <p class="score__grade">${f.grade.emoji} ${f.grade.label}</p><p class="score__line">${f.theme.emoji} ${f.theme.word} · ${f.sub.emoji} ${f.sub.word}</p></div></section>`;
  h += info(`<h3>분야별 운세</h3><ul class="cats">${f.cats.map((c) => `<li class="cat">
      <div class="cat__head"><h4>${c.icon} ${c.label}</h4><span class="cat__grade">${c.grade.emoji} ${c.grade.label} · <b>${c.score}</b></span></div>
      <div class="meter"><span style="width:${c.score}%"></span></div>
      ${c.sub ? `<p class="cat__sub">${c.sub}</p>` : ''}<p class="cat__line">${esc(c.line)}</p>
    </li>`).join('')}</ul>`);
  h += info(`<h3>🌊 ${rel}의 흐름</h3><p>${esc(f.relText)}</p><p>오늘 기운의 아랫글자는 ${f.sub.emoji} <b>${f.sub.word}</b>: ${esc(f.sub.line)}.</p>${f.combo ? '<p>✨ 게다가 오늘의 천간이 내 일간과 <b>합</b>을 이뤄요. 마음먹은 일이 잘 맞물리는 날이에요.</p>' : ''}`, 'lilac');
  h += info(`<h3>🕰️ 시간대별 운세</h3><ul class="blocks">${f.blocks.map((b) => `<li class="block ${b.key === f.bestBlock.key ? 'is-best' : b.key === f.careBlock.key ? 'is-care' : ''}">
      <span class="block__label">${b.label}<small>${b.range}</small></span>
      <div class="meter"><span style="width:${b.score}%"></span></div><b>${b.score}</b></li>`).join('')}</ul>
    <p class="note">⭐ 가장 좋은 시간: <b>${f.bestHour.name}(${f.bestHour.range})</b> · ⚠️ 조심할 시간: <b>${f.worstHour.name}(${f.worstHour.range})</b></p>`);
  h += info(`<h3>🍀 ${rel}의 행운</h3><dl class="luck">
      <div class="luck__row"><dt>컬러</dt><dd><span class="swatches">${f.lucky.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}</span>${f.lucky.color}</dd></div>
      <div class="luck__row"><dt>숫자</dt><dd>${f.lucky.number}</dd></div>
      <div class="luck__row"><dt>방향</dt><dd>${f.lucky.direction}</dd></div>
      <div class="luck__row"><dt>시간</dt><dd>${f.lucky.time}</dd></div>
      <div class="luck__row"><dt>아이템</dt><dd>${f.lucky.item}</dd></div>
      <div class="luck__row"><dt>음식</dt><dd>${f.lucky.food}</dd></div>
      <div class="luck__row"><dt>장소</dt><dd>${f.lucky.place}</dd></div>
    </dl><p class="note">오늘 부족한 ${ELEMENT_KO[f.lucky.el]}(${ELEMENT_INFO[f.lucky.el].name}) 기운을 채워 주는 것들이에요.</p>`, 'mint');
  h += info(`<div class="dolist"><div><h3>⭕ 하면 좋은 일</h3><ul class="ticks">${f.todo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <div><h3>❌ 피할 일</h3><ul class="ticks ticks--x">${f.avoid.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>`, 'yellow');
  h += talk('coco', f.overall >= 58 ? 'happy' : 'wink', p(f.overall >= 72 ? `${rel}은 기운이 좋아요! 미뤄 둔 일 있으면 지금이에요!` : f.overall >= 58 ? `무난한 하루예요. ${f.lucky.color} 소품 하나로 기분 전환해 봐요!` : `조금 쉬어 가는 날이에요. ${f.bestBlock.label} 시간에 중요한 일만 끝내고 푹 쉬어요!`), { side: 'right', scene: 'pink' });
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">오늘 운세 상담하기</a><button class="btn" type="button" data-action="share-today">운세 공유하기</button>${cardBtn('today')}<a class="btn btn--lilac" href="#reading">📖 내 사주 풀이 보기</a></div>`;
  return h;
}

/* ───────────── 궁합 칸: 썸 확률 · 기념일 · 랭킹 ───────────── */

function compatSwitch(mode) {
  return switchNav('궁합 보기 선택', [['compat', '💞 궁합'], ['ssum', '💭 썸 확률'], ['anniv', '💍 기념일'], ['rank', '💯 랭킹']], mode).replace('class="modes"', 'class="modes modes--4"');
}
const cardBtn = (kind, label = '📸 결과 카드 저장') => `<button class="btn btn--yellow" type="button" data-card="${kind}">${label}</button>`;

// 상대가 필요한 화면 공통: 프리셋 + 상대 부적 (없으면 안내)
function needPartner(what) {
  const a = me();
  if (!a) {
    return talk('coco', 'worry', p(`${what}을 보려면 먼저 <strong>내 사주</strong>부터 알려 줘야 해요!`), { side: 'right', scene: 'pink' })
      + '<div class="actions"><a class="btn btn--pink" href="#start">내 정보 입력하러 가기</a></div>';
  }
  return null;
}

function ssum() {
  const a = me(), b = partner();
  if (!a || !b) return null;
  if (!memo.ssum) memo.ssum = analyzeSsum(a, b);
  return memo.ssum;
}

function viewSsum() {
  let h = compatSwitch('ssum');
  const stop = needPartner('썸 성공 확률');
  if (stop) return h + stop;
  const a = me();
  h += talk('myo', 'smug', p(`${esc(a.name)}님, 썸 타는 사람이 있다고? 😼 그 사람 정보를 알려 주면 <strong>연애로 이어질 확률</strong>을 봐 줄게냥.`) + p('고백하기 좋은 날, 밀당 강도, 상대의 관심 신호까지 알려 줄게.'), { scene: 'lilac' });
  h += partnerPresets();
  h += talisman('partner', state.partner);
  const r = ssum();
  if (!r) return h;
  const A = esc(r.a.name), B = esc(r.b.name);
  let o = episode('썸편', `${A} → ${B}`);
  o += talk('coco', 'surprise', p(`${A}님과 ${B}님이 연애로 이어질 확률은…!`), { side: 'right', scene: 'pink', sfx: '두근두근' });
  o += `<section class="panel scene-speed"><div class="score">${riskHeart(r.prob, { label: '썸 성공', color: '#FF6FA8', seam: 'none' })}
      <p class="score__grade">${r.stage.emoji} ${r.stage.title}</p><p class="score__line">${esc(r.stage.line)}</p></div></section>`;
  o += info(`<h3>확률을 이렇게 계산했어요</h3>
    <ul class="ticks ticks--plain"><li>💞 두 사람 궁합 <b>${r.compat}점</b></li><li>📅 이번 달 연애운 — ${A}님 <b>${r.monthA}</b> · ${B}님 <b>${r.monthB}</b></li></ul>
    <h4>👍 확률을 올려 주는 것</h4><ul class="ticks">${r.plus.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    ${r.minus.length ? `<h4>🤏 조심할 것</h4><ul class="ticks ticks--x">${r.minus.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`);
  o += info(`<h3>💌 고백하기 좋은 날</h3><p>앞으로 45일 중 두 사람의 연애 기운이 함께 오르는 날이에요.</p>
    <ul class="days">${r.confess.map((d) => `<li class="day"><b>${d.m}월 ${d.d}일</b><span>${d.wd}요일</span><small>두 사람 설렘 지수 ${Math.min(99, Math.round(d.v))}</small></li>`).join('')}</ul>`, 'mint');
  o += info(`<h3>🎚️ ${B}님에게 맞는 밀당 강도</h3>
    <div class="pushbar" role="img" aria-label="밀당 강도 5단계 중 ${r.push.level}단계">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= r.push.level ? 'is-on' : ''}"></span>`).join('')}</div>
    <p class="style__type"><b>${r.push.level}단계 · ${r.push.label}</b></p><p>${esc(r.push.text)}</p>`, 'lilac');
  o += info(`<h3>👀 ${B}님이 관심 있을 때 보이는 신호</h3><ul class="ticks">${r.signals.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="note">🙅 ${B}님에게 하면 안 되는 것: <b>${esc(r.dont)}</b></p>`, 'pink');
  o += talk('myo', 'wink', `<p>다음 한 걸음은 이렇게 해 봐라냥.</p><ol class="ticks ticks--num">${r.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`, { scene: 'night' });
  o += info('<p class="disclaimer">🔮 <b>사주는 완벽하지 않아요.</b> 확률은 두 사람의 기운으로 본 "흐름"일 뿐이에요. 상대의 진짜 마음은 상대의 말과 행동에 있어요. 거절도 존중해 주세요.</p>');
  o += `<div class="actions"><a class="btn btn--pink" href="#chat">썸 고민 상담하기</a>${cardBtn('ssum')}<a class="btn btn--lilac" href="#compat">💞 궁합 자세히 보기</a></div>`;
  return h + `<div id="ssum-result">${o}</div>`;
}

function anniv() {
  const a = me(), b = partner(), d = state.anniv;
  if (!a || !b || !d) return null;
  if (!memo.anniv) memo.anniv = analyzeAnniv(a, b, d);
  return memo.anniv;
}

function viewAnniv() {
  let h = compatSwitch('anniv');
  const stop = needPartner('기념일 운세');
  if (stop) return h + stop;
  const a = me(), b = partner();
  h += talk('coco', 'love', p('두 사람이 <strong>사귄 날</strong>을 알려 주세요! 그날의 기운으로 커플의 시작을 풀이하고, 다가오는 100일·주년 기념일 운세도 봐 드릴게요.'), { side: 'right', scene: 'pink' });
  if (!b) {
    h += partnerPresets();
    h += talk('myo', 'think', p('먼저 연인 정보를 부적에 적어 줘냥.'), { scene: 'lilac' });
    return h + talisman('partner', state.partner);
  }
  const d = state.anniv;
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const val = d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : '';
  h += partnerPresets();
  h += info(`<form class="annivform" data-form="anniv">
      <h3>💍 ${esc(a.name)} ♥ ${esc(b.name)}</h3>
      <div class="field"><label for="anniv-start">사귄 날 (1일째)</label><input class="input" id="anniv-start" type="date" name="start" value="${val}" max="${today}" min="1950-01-01" required></div>
      <p class="form-error" role="alert"></p>
      <div class="actions"><button class="btn btn--pink" type="submit">기념일 운세 보기</button>${d ? '<button class="btn" type="button" data-action="anniv-clear">🔄 초기화</button>' : ''}</div>
    </form>`, 'paper');
  const r = anniv();
  if (!r) return h;
  if (r.error) return h + info(`<p>${esc(r.error)}</p>`);
  const A = esc(r.a.name), B = esc(r.b.name);
  let o = episode('기념일편', `${A} ♥ ${B}`);
  o += `<section class="panel scene-night"><div class="dcount"><small>함께한 지</small><b>${r.daysTogether.toLocaleString()}</b><span>일째</span>
      <p>${r.start.y}년 ${r.start.m}월 ${r.start.d}일(${r.start.wd})부터</p></div></section>`;
  o += talk('myo', 'smile', p(`두 사람은 <strong>${r.pillar.hanja}(${r.pillar.hangul})일</strong>, ${r.pillar.animal}의 날에 시작했다냥.`) + p(`그래서 <strong>${esc(r.theme.title)}</strong>야!`), { scene: 'lilac', caption: '시작한 날의 기운' });
  o += info(`<h3>🌱 우리 커플의 시작 기운</h3><p>${esc(r.theme.text)}</p><ul class="ticks">${r.startNotes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'mint');
  o += info(`<h3>🎉 다가오는 기념일</h3><ul class="annivs">${r.upcoming.map((u) => `<li class="anniv lv-${u.grade.key}">
      <div class="anniv__head"><b>${u.label}</b><span class="tag ${u.kind === 'year' ? 'tag--gold' : ''}">D-${u.dday || 'DAY'}</span></div>
      <p class="anniv__date">${u.y}년 ${u.m}월 ${u.d}일(${u.wd}) · ${u.hanja}일</p>
      <div class="meter"><span style="width:${u.score}%"></span></div>
      <p class="anniv__line">${u.grade.emoji} 커플 연애운 <b>${u.score}</b> (${u.grade.label}) · 추천: ${esc(u.idea)}</p>
    </li>`).join('')}</ul>${r.passed ? `<p class="note">지금까지 함께 지나온 기념일만 <b>${r.passed}번</b>이에요. 🥹</p>` : ''}`);
  o += `<div class="actions">${cardBtn('anniv')}<a class="btn btn--lilac" href="#compat">💞 우리 궁합 보기</a><a class="btn" href="#breakup">💔 위기 시기 미리 보기</a></div>`;
  return h + `<div id="anniv-result">${o}</div>`;
}

function rankList() {
  const a = me();
  if (!a) return [];
  const meKey = personKey(state.me);
  const people = state.presets.filter((x) => personKey(x.person) !== meKey).map((x) => ({ id: x.id, x: analyzeCached(x.person) })).filter((x) => x.x);
  const key = meKey + '|' + people.map((x) => x.id).join(',');
  if (memo.rankKey !== key) { memo.rank = rankCompat(a, people); memo.rankKey = key; }
  return memo.rank;
}

function viewRank() {
  let h = compatSwitch('rank');
  const stop = needPartner('궁합 랭킹');
  if (stop) return h + stop;
  const a = me();
  const list = rankList();
  h += talk('myo', 'smug', p(`${esc(a.name)}님 프리셋에 저장된 사람들과의 궁합을 <strong>한 번에</strong> 줄 세워 봤다냥. 😼`), { scene: 'night' });
  if (!list.length) {
    return h + talk('coco', 'worry', p('아직 프리셋에 다른 사람이 없어요! 처음으로 화면에서 사람을 저장하면 여기서 순위를 볼 수 있어요.'), { side: 'right', scene: 'pink' })
      + '<div class="actions"><a class="btn btn--pink" href="#start">📒 프리셋 저장하러 가기</a></div>';
  }
  const medal = ['🥇', '🥈', '🥉'];
  const top = list.slice(0, 3);
  let o = `<section class="panel scene-speed"><ol class="podium">${top.map((r, i) => `<li class="podium__item podium__item--${i + 1}">
      <span class="podium__medal" aria-hidden="true">${medal[i]}</span><span class="podium__emoji" aria-hidden="true">${r.emoji}</span>
      <b>${esc(r.name)}</b><span class="podium__score">${r.score}점</span><small>${r.grade.emoji} ${r.grade.title}</small></li>`).join('')}</ol></section>`;
  o += info(`<h3>💯 ${esc(a.name)}님과의 궁합 순위</h3><ol class="ranks">${list.map((r, i) => `<li class="rank">
      <span class="rank__no">${i < 3 ? medal[i] : i + 1}</span>
      <div class="rank__body"><div class="rank__head"><b>${r.emoji} ${esc(r.name)}</b><span>${r.score}점 · ${r.grade.title}</span></div>
        <div class="meter"><span style="width:${r.score}%"></span></div><small>${esc(r.best)}</small></div>
      <button class="mini mini--pink" type="button" data-rank-open="${esc(r.id)}">자세히</button></li>`).join('')}</ol>
    <p class="note">"자세히"를 누르면 그 사람과의 궁합 풀이로 바로 가요.</p>`);
  o += talk('coco', 'wink', p(`1위는 <strong>${esc(top[0].name)}님</strong>이에요! 하지만 점수가 낮다고 인연이 아닌 건 아니에요. 맞춰 가는 사이도 멋지니까요!`), { side: 'right', scene: 'mint' });
  o += `<div class="actions">${cardBtn('rank')}<a class="btn btn--lilac" href="#start">📒 사람 더 저장하기</a></div>`;
  return h + `<div id="rank-result">${o}</div>`;
}

/* ───────────── 내 사주 칸: 이달 리포트 · 이상형 ───────────── */

function monthNav(r) {
  return `<div class="daynav" id="monthnav">
    <button class="mini" type="button" data-month="${state.monthOffset - 1}" ${state.monthOffset <= -3 ? 'disabled' : ''} aria-label="지난달">◀ 지난달</button>
    <div class="daynav__now"><b>${r.y}년 ${r.m}월</b><small>${state.monthOffset === 0 ? '이번 달' : state.monthOffset > 0 ? `${state.monthOffset}달 뒤` : `${-state.monthOffset}달 전`}</small></div>
    <button class="mini" type="button" data-month="${state.monthOffset + 1}" ${state.monthOffset >= 11 ? 'disabled' : ''} aria-label="다음 달">다음 달 ▶</button>
  </div>`;
}
function monthAt(offset) {
  const n = new Date(Date.now() + 9 * 3600000);
  const t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + offset, 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
}
function monthRep() {
  const a = me();
  if (!a) return null;
  const { y, m } = monthAt(state.monthOffset);
  const key = `${personKey(state.me)}|${y}-${m}`;
  if (memo.monthKey !== key) { memo.month = monthReport(a, y, m); memo.monthKey = key; }
  return memo.month;
}

function viewMonth() {
  const a = me();
  if (!a) return readingSwitch('month') + needPartner('이달의 연애 리포트');
  const r = monthRep();
  const n = esc(a.name);
  let h = viewingBar(a) + readingSwitch('month') + monthNav(r);
  h += talk('myo', r.avg >= 66 ? 'sparkle' : r.avg >= 56 ? 'smile' : 'think', p(`${n}님의 ${r.m}월 연애 흐름은 ${r.month.reason.emoji} <strong>${r.month.reason.label}</strong>이다냥.`) + p(esc(a.person.status === 'couple' ? r.month.reason.couple : r.month.reason.solo)), { scene: 'night', caption: `${r.y}년 ${r.m}월 · 월간 연애 리포트` });
  const cells = Array.from({ length: r.firstWd }, () => '<li class="cal__blank" aria-hidden="true"></li>').join('')
    + r.days.map((d) => `<li class="cal__day lv-${d.grade.key} ${d.isToday ? 'is-today' : ''}" title="${r.m}월 ${d.d}일 연애운 ${d.love}"><span class="cal__d">${d.d}</span><span class="cal__e" aria-hidden="true">${d.grade.emoji}</span><b>${d.love}</b></li>`).join('');
  h += info(`<h3>🗓️ ${r.m}월 연애운 달력</h3><ul class="cal__wd" aria-hidden="true">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<li>${w}</li>`).join('')}</ul>
    <ul class="cal" aria-label="${r.m}월 날짜별 연애운">${cells}</ul>
    <p class="note">평균 <b>${r.avg}</b> · 설레는 날(💖 이상) <b>${r.goodCount}일</b> · 🔥최고 💖좋음 🙂보통 🌧️조심 🛌쉼표</p>`);
  h += info(`<h3>📊 주차별 흐름</h3><ul class="weeks">${r.weekly.map((w) => `<li><div class="weeks__head"><b>${w.no}주차</b><small>${r.m}/${w.from}~${r.m}/${w.to}</small><span>${w.grade.emoji} ${w.avg}</span></div>
      <div class="meter"><span style="width:${w.avg}%"></span></div><p>${esc(w.line)} <small>(가장 좋은 날 ${r.m}/${w.best})</small></p></li>`).join('')}</ul>`, 'lilac');
  h += info(`<div class="dolist"><div><h3>💖 좋은 날</h3><ul class="ticks">${r.best.map((d) => `<li><b>${r.m}월 ${d.d}일</b> (${['일', '월', '화', '수', '목', '금', '토'][d.wd]}) · ${d.love}점</li>`).join('')}</ul></div>
    <div><h3>🌧️ 조심할 날</h3><ul class="ticks ticks--x">${r.care.map((d) => `<li><b>${r.m}월 ${d.d}일</b> (${['일', '월', '화', '수', '목', '금', '토'][d.wd]}) · ${d.love}점</li>`).join('')}</ul></div></div>
    <p class="note">💡 ${esc(r.month.reason.tip)}</p>`, 'yellow');
  h += `<div class="actions">${cardBtn('month')}<a class="btn btn--lilac" href="#today">☀️ 오늘의 운세</a><a class="btn btn--pink" href="#chat">이달 연애운 상담하기</a></div>`;
  return h;
}

function idealRes() {
  const a = me();
  if (!a) return null;
  const meKey = personKey(state.me);
  const people = state.presets.filter((x) => personKey(x.person) !== meKey).map((x) => ({ id: x.id, x: analyzeCached(x.person) })).filter((x) => x.x);
  return findIdeal(a, people);
}

function viewIdeal() {
  const a = me();
  if (!a) return readingSwitch('ideal') + needPartner('이상형 찾기');
  const r = idealRes();
  const n = esc(a.name);
  let h = viewingBar(a) + readingSwitch('ideal');
  h += talk('coco', 'sparkle', p(`${n}님 사주만으로 <strong>나와 잘 맞는 사람</strong>을 찾아볼게요! 상대 정보는 필요 없어요.`), { side: 'right', scene: 'pink' });
  h += info(`<h3>🔍 ${n}님과 잘 맞는 연애 캐릭터 TOP 3</h3><ol class="ideals">${r.types.map((t, i) => `<li class="ideal">
      <span class="ideal__emoji" aria-hidden="true">${t.emoji}</span>
      <div><p class="ideal__name"><b>${i + 1}. ${esc(t.cat)}</b> <span class="tile tile--sm el-${t.el}"><span class="hanja">${t.hanja}</span></span></p>
      <p class="ideal__why">${esc(t.why)}</p><p class="note">${esc(t.nature)} · ${t.keywords.map((k) => `#${k}`).join(' ')}</p></div></li>`).join('')}</ol>
    <p class="note">일간(태어난 날의 천간)이 ${r.types.map((t) => `${t.hanja}(${t.ko})`).join('·')}인 사람이에요. 상대 사주를 보면 바로 알 수 있어요.</p>`, 'lilac');
  h += info(`<h3>💗 이런 성격에 끌려요</h3><ul class="ticks">${r.traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="note">사주 속 이상형 한 줄: ${esc(r.ideal)}</p>`, 'pink');
  h += info(`<div class="dolist"><div><h3>🐾 잘 맞는 띠</h3><p class="bigtags">${r.goodZodiac.map((z) => `<span class="tag tag--gold">${z}띠</span>`).join('')}</p></div>
    <div><h3>🙊 조심할 띠</h3><p class="bigtags">${r.cautionZodiac.map((z) => `<span class="tag">${z}띠</span>`).join('')}</p></div></div>
    <p class="note">조심할 띠라도 노력하면 얼마든지 잘 맞아요. 처음에 오해만 조심!</p>`, 'mint');
  h += info(`<h3>📍 이런 곳에서 만나기 쉬워요</h3><ul class="ticks">${r.meet.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'yellow');
  if (r.matches.length) {
    h += info(`<h3>📒 내 프리셋 중 이상형에 가까운 사람</h3><ul class="ranks">${r.matches.map((m) => `<li class="rank"><span class="rank__no">${m.emoji}</span>
        <div class="rank__body"><b>${esc(m.name)}</b><small>${m.hits.map((x) => `✔ ${x}`).join(' · ')}</small></div>
        <button class="mini mini--pink" type="button" data-rank-open="${esc(m.id)}">궁합 보기</button></li>`).join('')}</ul>`);
  }
  h += info('<p class="disclaimer">🔮 <b>사주는 완벽하지 않아요.</b> 사주로 본 "잘 맞을 가능성이 높은 유형"일 뿐이에요. 진짜 인연은 조건보다 함께 있을 때의 마음으로 알 수 있어요.</p>');
  h += `<div class="actions">${cardBtn('ideal')}<a class="btn btn--pink" href="#future">🔮 미래의 연인 보기</a><a class="btn" href="#chat">이상형 상담하기</a><a class="btn btn--lilac" href="#compat">💞 궁합 보러 가기</a></div>`;
  return h;
}


/* ───────────── 🔮 미래의 연인 ───────────── */

function future() {
  const a = me();
  if (!a) return null;
  return futurePartner(a, state.futureWant);
}

function viewFuture() {
  const a = me();
  if (!a) return readingSwitch('future') + needPartner('미래의 연인');
  const r = future();
  const n = esc(a.name), W = r.word;
  let h = viewingBar(a) + readingSwitch('future');
  h += `<div class="fwant" role="group" aria-label="보고 싶은 연인"><span>보고 싶은 연인:</span>
    <button class="mini ${r.gender === 'M' ? 'mini--pink' : ''}" type="button" data-future-want="M" aria-pressed="${r.gender === 'M'}">👦 남자친구</button>
    <button class="mini ${r.gender === 'F' ? 'mini--pink' : ''}" type="button" data-future-want="F" aria-pressed="${r.gender === 'F'}">👧 여자친구</button></div>`;
  h += talk('myo', 'smug', p(`${n}님 사주 속 <strong>인연의 별(${r.elName} 기운)</strong>과 <strong>배우자 자리</strong>를 수정 구슬에 비춰 볼게냥. 🔮`) + p(`미래의 ${W}, 슬쩍 보여 줄게.`), { scene: 'night', caption: '묘연의 수정 구슬' });
  let o = episode('미래 연인편', `${n}님의 미래 ${W}`);
  o += `<section class="panel scene-lilac"><div class="future">
      <div class="future__pic">${futureAvatar(r)}</div>
      <p class="future__cat">${r.cat.emoji} <b>${esc(r.cat.name)}</b> 타입</p>
      <ul class="chips">${r.cat.keywords.map((k) => `<li class="chip">#${k}</li>`).join('')}<li class="chip">#${r.mbti.type}</li></ul>
    </div></section>`;
  o += talk('coco', 'love', p(`꺅, ${r.look.vibe}의 사람이에요! ${W === '남자친구' ? '멋있다…' : '예쁘다…'} (두근)`), { side: 'right', scene: 'pink', sfx: '두근' });
  o += info(`<h3>👀 대략적인 생김새</h3><dl class="luck">
      <div class="luck__row"><dt>얼굴</dt><dd>${r.look.face}</dd></div>
      <div class="luck__row"><dt>눈</dt><dd>${r.look.eyes}</dd></div>
      <div class="luck__row"><dt>머리</dt><dd>${r.look.hair}</dd></div>
      <div class="luck__row"><dt>분위기</dt><dd>${r.look.vibe}</dd></div>
      <div class="luck__row"><dt>스타일</dt><dd>${r.look.style}</dd></div>
      <div class="luck__row"><dt>체형</dt><dd>${r.look.body}</dd></div>
    </dl><p class="note">얼굴과 머리는 인연의 별(${r.elName}), 분위기·스타일·체형은 배우자 자리(${r.palaceName}) 기운으로 그렸어요. 그림은 느낌만 보여 주는 거예요!</p>`);
  o += info(`<div class="fstats">
      <div class="fstat"><small>키</small><b>${r.height.mid}<span>cm</span></b><span class="fstat__sub">${r.height.min}~${r.height.max}cm</span></div>
      <div class="fstat"><small>MBTI</small><b>${r.mbti.type}</b><span class="fstat__sub">또는 ${r.mbti.alt}</span></div>
      <div class="fstat"><small>나이</small><b>${r.age.top.label}</b><span class="fstat__sub">${esc(r.age.gap)}</span></div>
    </div>
    <p class="note" style="margin-top:10px">🧠 ${r.mbti.type}: ${esc(r.mbti.line)}</p>
    <div class="agebar" role="img" aria-label="${r.age.list.map((x) => `${x.label} ${x.pct}%`).join(', ')}">${r.age.list.map((x) => `<span class="agebar__${x.key}" style="width:${x.pct}%">${x.label} ${x.pct}%</span>`).join('')}</div>`, 'pink');
  const sn = r.when;
  o += info(`<h3>📅 언제 만날까?</h3><p class="fwhen"><b>${sn.year}년 ${sn.month}월</b> (${sn.season})</p>
    <p>${sn.reason.emoji} ${esc(sn.reason.label)} — ${esc(sn.reason.solo)}</p>
    <p class="note">${sn.soon ? '⏰ 곧이에요! 요즘 들어오는 약속은 웬만하면 나가 보세요.' : `두 번째 기회: <b>${sn.second.year}년 ${sn.second.month}월</b>`} · 💡 ${esc(sn.reason.tip)}</p>`, 'mint');
  o += info(`<h3>📍 어디서 만날까?</h3><ul class="ticks">${r.meets.map((m) => `<li><b>${esc(m.where)}</b> — ${esc(m.detail)}</li>`).join('')}</ul>
    <p class="note">🍀 인연의 별이 좋아하는 장소: ${r.places.map(esc).join(', ')}</p>`, 'yellow');
  o += talk('myo', 'wink', p(`그때가 오면 ${esc(r.look.style)} 차림의 사람을 눈여겨봐라냥. 😼`), { scene: 'night' });
  o += info('<p class="disclaimer">🔮 <b>사주는 완벽하지 않아요.</b> 사주 속 인연의 별로 그려 본 "가능성 높은 모습"일 뿐이에요. 진짜 인연은 조건표와 달라도 마음이 먼저 알아봐요. 재미로 즐겨 주세요!</p>');
  o += `<div class="actions">${cardBtn('future')}<a class="btn btn--lilac" href="#ideal">🔍 이상형 자세히</a><a class="btn btn--pink" href="#chat">연애운 상담하기</a></div>`;
  return h + `<div id="future-result">${o}</div>`;
}

/* ───────────── 🐱 캐릭터 호감도 ───────────── */

const todayKey = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function addAffinity(who, pts) {
  const r = gainAffinity(state.affinity, who, pts, todayKey());
  state.affinity = r.state;
  store.set('affinity', state.affinity);
  if (r.levelUp) {
    const L = r.levelUp.level;
    setTimeout(() => toast(`${L.emoji} ${CHARACTERS[who].name} 호감도 Lv.${L.lv} "${L.name}"! 새 표정이 열렸어요.`, { label: '보러 가기', fn: () => { location.hash = '#home'; setTimeout(() => document.getElementById('affinity')?.scrollIntoView({ block: 'start' }), 50); } }), 400);
  }
}
// 하루 첫 방문 보너스
function dailyVisit() {
  const s = state.affinity || {};
  if (s.visit === todayKey()) return;
  addAffinity('myo', 3); addAffinity('coco', 3);
  state.affinity = { ...state.affinity, visit: todayKey() };
  store.set('affinity', state.affinity);
}

// 호감도 얼굴: 묘연은 얼굴 그림, 코코는 상반신 그림의 윗부분
const affFace = (who, e) => (who === 'myo' ? faceAvatar('myo', e)
  : `<span class="char char--face face-crop"><img src="img/expr/coco-${e}.webp" width="435" height="520" alt="" loading="lazy" decoding="async"></span>`);
const EXPR_KO = { smile: '미소', happy: '신남', wink: '윙크', think: '고민', surprise: '깜짝', pout: '삐짐', sparkle: '반짝', smug: '의기양양', love: '두근', worry: '걱정' };
function affinityCard() {
  const s = state.affinity || {};
  const one = (who) => {
    const L = affinityLevel(s[who] || 0);
    const open = unlockedExpr(L.lv);
    const all = EXPR_UNLOCK.flat();
    return `<div class="aff">
      <div class="aff__head">${affFace(who, open[open.length - 1])}<div><p class="aff__name"><b>${CHARACTERS[who].name}</b> <span class="tag tag--now">Lv.${L.lv} ${L.emoji} ${L.name}</span></p>
        <div class="meter meter--aff"><span style="width:${L.pct}%"></span></div>
        <small>${L.next ? `다음 단계까지 ${L.toNext}점` : '최고 단계 달성!'} · 호감도 ${s[who] || 0}</small></div></div>
      <p class="aff__line">“${esc(AFFINITY_LINES[who][L.lv])}”</p>
      <ul class="exprs" aria-label="${CHARACTERS[who].name} 표정 도감">${all.map((e) => open.includes(e)
    ? `<li>${affFace(who, e)}<small>${EXPR_KO[e]}</small></li>`
    : `<li class="is-locked" aria-label="잠긴 표정"><span aria-hidden="true">🔒</span><small>Lv.${EXPR_UNLOCK.findIndex((g) => g.includes(e))}</small></li>`).join('')}</ul>
    </div>`;
  };
  return `<div id="affinity">${info(`<h3>🐾 묘연·코코 호감도</h3><p class="note">하루 첫 방문 +3 · 상담 질문 +2(묘연) · 결과 보기 +1(코코), 하루 최대 12점씩 올라요. 레벨이 오르면 새 표정과 대사가 열려요!</p>
    <div class="affs">${one('myo')}${one('coco')}</div>`, 'lilac')}</div>`;
}

/* ───────────── 📸 결과 카드 이미지 ───────────── */

function cardSpec(kind) {
  const a = me();
  if (kind === 'compat') { const c = compat(); return c && { tag: '💞 궁합', title: `${c.a.name} ♥ ${c.b.name}`, score: c.score, unit: '점', grade: `${c.grade.emoji} ${c.grade.title}`, line: c.grade.line, bullets: c.strengths.slice(0, 3) }; }
  if (kind === 'intimacy') { const r = intimacy(); return r && !r.blocked && { tag: '🔥 속궁합', title: `${r.a.name} ♥ ${r.b.name}`, score: r.score, unit: '점', grade: `${r.grade.emoji} ${r.grade.title}`, line: r.grade.line, bullets: [`${r.a.name}: ${r.styleA.type} · ${r.styleA.lead.label}`, `${r.b.name}: ${r.styleB.type} · ${r.styleB.lead.label}`, r.lead.type.title] }; }
  if (kind === 'today') { if (!a) return null; const f = dailyFortune(a, Date.now(), state.dayOffset); return { tag: `☀️ ${f.date.m}월 ${f.date.d}일 운세`, title: `${a.name}님`, score: f.overall, unit: '점', grade: `${f.grade.emoji} ${f.grade.label} · ${f.theme.word}의 날`, line: f.theme.line, bullets: [`💗 연애운 ${f.cats[0].score}`, `🍀 행운 컬러: ${f.lucky.color}`, `⭐ 좋은 시간: ${f.bestBlock.label}`] }; }
  if (kind === 'breakup') { const r = breakup(); return r && { tag: '💔 이별수', title: `${r.a.name} × ${r.b.name}`, score: r.risk, unit: '점', grade: `${r.grade.emoji} ${r.grade.title}`, line: r.grade.line, bullets: r.rules.slice(0, 3) }; }
  if (kind === 'reunion') { const r = reunion(); return r && { tag: '💞 재회운', title: `${r.a.name} → ${r.b.name}`, score: r.score, unit: '점', grade: `${r.grade.emoji} ${r.grade.title}`, line: r.grade.line, bullets: [`다시 닿기 좋은 때: ${r.best[0].year}년 ${r.best[0].month}월`, `${r.b.name}님은 "${r.mind.type}"`] }; }
  if (kind === 'ssum') { const r = ssum(); return r && { tag: '💭 썸 성공 확률', title: `${r.a.name} → ${r.b.name}`, score: r.prob, unit: '%', grade: `${r.stage.emoji} ${r.stage.title}`, line: r.stage.line, bullets: [`💌 고백 추천일: ${r.confess.map((d) => `${d.m}/${d.d}`).join(', ')}`, `🎚️ 밀당 강도: ${r.push.label}`] }; }
  if (kind === 'anniv') { const r = anniv(); return r && !r.error && { tag: '💍 우리 기념일', title: `${r.a.name} ♥ ${r.b.name}`, score: r.daysTogether, unit: '일째', grade: r.theme.title, line: `${r.start.y}.${r.start.m}.${r.start.d} 시작 · ${r.pillar.hanja}일`, bullets: r.upcoming.slice(0, 3).map((u) => `${u.label} ${u.m}/${u.d} — 연애운 ${u.score}`) }; }
  if (kind === 'rank') { const l = rankList(); return l.length && a && { tag: '💯 궁합 랭킹', title: `${a.name}님의 인연 순위`, score: l[0].score, unit: '점', grade: `🥇 ${l[0].name}님`, line: l[0].best, bullets: l.slice(0, 3).map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${r.name} · ${r.score}점`) }; }
  if (kind === 'month') { const r = monthRep(); return r && { tag: `🗓️ ${r.m}월 연애 리포트`, title: `${a.name}님`, score: r.avg, unit: '점', grade: `${r.month.reason.emoji} ${r.month.reason.label}`, line: `설레는 날 ${r.goodCount}일`, bullets: [`💖 좋은 날: ${r.best.map((d) => `${r.m}/${d.d}`).join(', ')}`, `🌧️ 조심할 날: ${r.care.map((d) => `${r.m}/${d.d}`).join(', ')}`] }; }
  if (kind === 'future') { const r = future(); return r && { tag: `🔮 미래의 ${r.word}`, title: `${a.name}님의 미래 ${r.word}`, score: null, svg: futureAvatar(r), grade: `${r.cat.emoji} ${r.cat.name}`, line: r.look.vibe, bullets: [`📅 ${r.when.year}년 ${r.when.month}월 · 📍 ${r.meets[0].where}`, `📏 ${r.height.min}~${r.height.max}cm · 🧠 ${r.mbti.type} · ${r.age.gap}`, `👀 ${r.look.face}, ${r.look.hair}`] }; }
  if (kind === 'ideal') { const r = idealRes(); return r && { tag: '🔍 사주 이상형', title: `${a.name}님의 이상형`, score: null, grade: `${r.types[0].emoji} ${r.types[0].cat}`, line: r.types[0].why, bullets: [`💗 ${r.traits[0]}`, `🐾 잘 맞는 띠: ${r.goodZodiac.join('·')}`, `📍 ${r.meet[0]}`] }; }
  return null;
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch.trim() ? ch : ''; } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

async function drawCard(spec) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const D = '"Black Han Sans", "Apple SD Gothic Neo", sans-serif', B = '"Gowun Dodum", "Apple SD Gothic Neo", sans-serif';
  try { await Promise.race([Promise.all([document.fonts.load(`60px ${D}`), document.fonts.load(`30px ${B}`)]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* 기본 글꼴 */ }
  const [myo, coco] = await Promise.all([loadImg('img/myo-full.webp'), loadImg('img/coco-full.webp')]);
  // 배경
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2A1B3D'); g.addColorStop(1, '#4B3470');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff88';
  for (let i = 0; i < 70; i++) { const x = (i * 197) % W, y = (i * 331) % 300 + (i % 3) * 10; ctx.beginPath(); ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2); ctx.fill(); }
  // 머리
  ctx.fillStyle = '#D7263D'; ctx.beginPath(); ctx.arc(110, 100, 44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `48px ${D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('緣', 110, 102);
  ctx.textAlign = 'left'; ctx.font = `46px ${D}`; ctx.fillText('묘연의 연애사주', 172, 102);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F7D54A'; ctx.font = `52px ${D}`; ctx.fillText(spec.tag, W / 2, 200);
  ctx.fillStyle = '#fff'; ctx.font = `64px ${D}`;
  ctx.fillText(wrapText(ctx, spec.title, 940)[0], W / 2, 278);
  // 판
  const px = 60, py = 330, pw = 960, ph = 700;
  ctx.fillStyle = '#2A1B3D'; roundRect(ctx, px + 10, py + 14, pw, ph, 40); ctx.fill();
  ctx.fillStyle = '#FFF8FB'; roundRect(ctx, px, py, pw, ph, 40); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#2A1B3D'; ctx.stroke();
  let y = py + 70;
  if (spec.score != null) {
    ctx.fillStyle = '#FF6FA8'; ctx.font = `200px ${D}`; ctx.textBaseline = 'alphabetic';
    const num = String(spec.score);
    const nw = ctx.measureText(num).width;
    ctx.font = `60px ${D}`; const uw = ctx.measureText(spec.unit || '').width;
    ctx.font = `200px ${D}`; ctx.textAlign = 'left';
    const sx = W / 2 - (nw + uw + 10) / 2;
    ctx.fillText(num, sx, py + 230);
    ctx.fillStyle = '#2A1B3D'; ctx.font = `60px ${D}`; ctx.fillText(spec.unit || '', sx + nw + 10, py + 230);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    y = py + 300;
  } else if (spec.svg) {
    const im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(spec.svg));
    if (im) ctx.drawImage(im, W / 2 - 125, py + 34, 250, 275);
    y = py + 350;
  } else y = py + 110;
  ctx.fillStyle = '#C2185B'; ctx.font = `56px ${D}`;
  for (const l of wrapText(ctx, spec.grade, 880).slice(0, 2)) { ctx.fillText(l, W / 2, y); y += 66; }
  ctx.fillStyle = '#2A1B3D'; ctx.font = `36px ${B}`;
  for (const l of wrapText(ctx, spec.line || '', 860).slice(0, 2)) { ctx.fillText(l, W / 2, y); y += 50; }
  y += 18;
  ctx.strokeStyle = '#E7E0F2'; ctx.lineWidth = 4; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(px + 60, y); ctx.lineTo(px + pw - 60, y); ctx.stroke(); ctx.setLineDash([]);
  y += 50;
  ctx.textAlign = 'left'; ctx.font = `34px ${B}`; ctx.fillStyle = '#3D2A5C';
  for (const bl of (spec.bullets || []).slice(0, 3)) {
    const ls = wrapText(ctx, `• ${bl}`, 840).slice(0, 2);
    for (const l of ls) { if (y > py + ph - 30) break; ctx.fillText(l, px + 60, y); y += 46; }
    y += 6;
  }
  // 캐릭터 (아래에서 빼꼼)
  const peek = (im, x, w) => { if (!im) return; const h = (im.height / im.width) * w; ctx.drawImage(im, x, 1050, w, h); };
  peek(myo, 20, 300); peek(coco, 760, 300);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `40px ${D}`; ctx.fillText('나도 사주 보러 가기 🐾', W / 2, 1200);
  ctx.fillStyle = '#CBBCEB'; ctx.font = `28px ${B}`; ctx.fillText('고양이 점술사의 웹툰 연애사주', W / 2, 1252);
  return cv;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function openCard(kind) {
  const spec = cardSpec(kind);
  if (!spec) { toast('먼저 결과를 확인해 주세요!'); return; }
  toast('📸 결과 카드를 그리는 중…');
  const cv = await drawCard(spec);
  const url = cv.toDataURL('image/png');
  const file = `묘연-${kind}-${todayKey()}.png`;
  document.querySelector('.cardview')?.remove();
  const box = document.createElement('div');
  box.className = 'cardview';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '결과 카드');
  box.innerHTML = `<div class="cardview__inner"><img src="${url}" alt="${esc(spec.tag)} 결과 카드: ${esc(spec.title)} ${spec.score ?? ''}${spec.unit || ''} ${esc(spec.grade)}">
    <p class="note">휴대폰에서는 이미지를 길게 눌러 사진에 저장할 수도 있어요.</p>
    <div class="actions"><a class="btn btn--pink" href="${url}" download="${file}">💾 이미지 저장</a><button class="btn btn--lilac" type="button" data-cv="share">📤 공유하기</button><button class="btn" type="button" data-cv="close">닫기</button></div></div>`;
  document.body.appendChild(box);
  box.querySelector('[data-cv="close"]').focus();
  const close = () => box.remove();
  box.addEventListener('click', async (ev) => {
    if (ev.target === box || ev.target.closest('[data-cv="close"]')) { close(); return; }
    if (ev.target.closest('[data-cv="share"]')) {
      try {
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        const f = new File([blob], file, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: '묘연의 연애사주' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      toast('이 기기에선 바로 공유가 안 돼요. 💾 저장 후 올려 주세요!');
    }
  });
  box.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  addAffinity('coco', 1);
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
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 궁합으로 상담하기</a><button class="btn btn--lilac" type="button" data-action="new-partner">다른 사람과 궁합 보기</button><button class="btn" type="button" data-action="share-compat">궁합 공유하기</button>${cardBtn('compat')}<a class="btn" href="#ssum">💭 썸 성공 확률</a><a class="btn" href="#intimacy">19금 속궁합 보기</a><button class="btn" type="button" data-action="breakup-from-compat">💔 이 커플 이별수 보기</button>${state.me && state.me.status === 'after' ? '<button class="btn" type="button" data-action="reunion-from-compat">💞 이 사람과 재회운 보기</button>' : ''}</div>`;
  return h;
}

function viewCompat(mode = 'compat') {
  const a = me();
  if (mode === 'intimacy' && !adultOk()) return adultGate();
  if (!a) {
    return talk('coco', 'worry', p(`${mode === 'intimacy' ? '속궁합' : '궁합'}을 보려면 먼저 <strong>내 사주</strong>부터 알려 줘야 해요!`), { side: 'right', scene: 'pink' })
      + `<div class="actions"><a class="btn btn--pink" href="#home">내 정보 입력하러 가기</a></div>`;
  }
  let h = mode === 'intimacy' ? '' : compatSwitch('compat');
  h += mode === 'intimacy'
    ? talk('myo', 'smug', p(`${esc(a.name)}님, 여기는 어른들의 칸 <strong>19금</strong>이야. 😼`) + p('둘의 속궁합, 어울리는 분위기, 상대가 좋아할 스킨십과 귀여운 약점, 서로 마음을 여는 대화 카드까지 볼 수 있어. 두 사람 모두 <strong>만 19세 이상</strong>이어야 결과가 나와냥.'), { scene: 'night', caption: '19금 · 묘연 사주방 안쪽 방' })
    : talk('myo', 'smug', p(`${esc(a.name)}님, 궁합을 볼 상대가 있다고? 그 사람 정보를 부적에 적어 줘냥.`) + p('상대의 태어난 시간을 몰라도 괜찮아.'), { scene: 'lilac' });
  h += partnerPresets();
  h += talisman('partner', state.partner);
  if (mode === 'intimacy') {
    const r = intimacy();
    if (r) h += `<div id="intimacy-result">${intimacyResultHtml(r)}</div>`;
  } else {
    const c = compat();
    if (c) h += `<div id="compat-result">${compatResultHtml(c)}</div>`;
  }
  return h;
}

// 19금 칸 들어가기 전 확인 (나이 확인 탭이 생기면 adultOk·adultGate만 바꾸면 된다)
const ADULT_KEY = 'adultOk';
function adultOk() { return store.get(ADULT_KEY) === true; }
function adultGate() {
  return talk('coco', 'surprise', p('잠깐만요! 여기는 <strong>19금</strong> 칸이에요.') + p('<strong>만 19세 이상</strong>만 들어올 수 있어요.'), { side: 'right', scene: 'pink', sfx: '19금' })
    + info(`<div class="gate"><p class="gate__mark" aria-hidden="true">19</p><h3>성인 확인</h3>
      <p>이 칸에는 두 사람의 속궁합, 분위기, 스킨십 이야기가 담겨 있어요. 만 19세 이상인가요?</p>
      <div class="gate__btns"><button class="btn btn--pink" type="button" data-action="adult-yes">네, 만 19세 이상이에요</button><a class="btn" href="#home">아니요, 돌아갈래요</a></div>
      <p class="note">확인은 이 기기에만 기억돼요. 결과는 두 사람의 생일이 모두 만 19세 이상일 때만 나와요.</p></div>`, 'paper');
}

function intimacyMonths(r) {
  const hotSet = new Set(r.hot.map((m) => `${m.year}-${m.month}`));
  const restKey = `${r.rest.year}-${r.rest.month}`;
  const items = r.months.map((m) => {
    const k = `${m.year}-${m.month}`;
    const cls = hotSet.has(k) ? 'is-best' : k === restKey ? 'is-worst' : '';
    return `<li class="month ${cls}">
      <div class="month__bar" style="height:${Math.max(8, Math.round(8 + ((m.score - 30) / 68) * 92))}%">${hotSet.has(k) ? '<span class="month__heart">🔥</span>' : ''}</div>
      <div class="month__label">${m.month === 1 ? `${String(m.year).slice(2)}.` : ''}${m.month}월<span class="month__score">${m.score}</span></div>
    </li>`;
  }).join('');
  const sr = r.months.map((m) => `${m.year}년 ${m.month}월 ${m.score}`).join(', ');
  return `<p class="sr">월별 설렘 지수: ${sr}</p><ul class="months" aria-hidden="true">${items}</ul>
    <p class="legend"><span><i style="background:var(--blush)"></i>설렘 TOP 2</span><span><i style="background:var(--lilac)"></i>보통</span><span><i style="background:#D8D2E4"></i>쉬어 가기</span></p>`;
}

function intimacyResultHtml(r) {
  if (r.blocked) {
    return talk('coco', 'worry', p('앗, <strong>속궁합</strong>은 두 사람 모두 <strong>만 19세 이상</strong>일 때만 볼 수 있어요.') + p(`${r.minors.map((n) => `${esc(n)}님`).join(', ')}의 생일로는 아직 볼 수 없어요. 대신 💞 궁합에서 두 사람이 얼마나 잘 맞는지 볼 수 있어요!`), { side: 'right', scene: 'pink' })
      + '<div class="actions"><a class="btn btn--pink" href="#compat">💞 궁합 보러 가기</a></div>';
  }
  const A = esc(r.a.name), B = esc(r.b.name);
  const base = new Date().getFullYear();
  const side = (x) => `<div class="vs__side"><div class="vs__emoji" aria-hidden="true">${DAY_MASTERS[x.dm].emoji}</div>
    <div class="tile el-${x.dmEl}"><span class="hanja">${STEMS[x.dm]}</span><small>${STEMS_KO[x.dm]}·${ELEMENT_KO[x.dmEl]}</small></div>
    <div class="vs__name">${esc(x.name)}</div><div class="vs__cat">${DAY_MASTERS[x.dm].cat}</div></div>`;
  const styleCard = (x, st) => `<div class="style">
      <p class="style__type">${st.emoji} ${esc(x.name)}님 <b>${st.type}</b><span class="tag">${st.lead.label}</span></p>
      <p>${st.text}</p>
      <p class="note">💗 좋아하는 방식: ${st.like}<br>🙊 조심: ${st.care}<br>🎛️ ${st.lead.text}</p>
    </div>`;
  let h = '';
  h += episode('속궁합편', `${A} × ${B}`);
  h += talk('myo', 'smug', p(`${A}님과 ${B}님, 둘만 있을 때의 케미를 살짝 들여다볼게냥. 😼`), { scene: 'night' });
  h += info(`<div class="vs">${side(r.a)}<div class="vs__x" aria-hidden="true">🔥</div>${side(r.b)}</div>`, 'lilac');
  h += talk('coco', 'love', p('히익… 결과 나왔어요! (귀까지 빨개짐)'), { side: 'right', scene: 'pink', sfx: '두근' });
  h += `<section class="panel scene-speed"><div class="score">${riskHeart(r.score, { label: '속궁합', color: '#F0524F', seam: 'none' })}
      <p class="score__grade">${r.grade.emoji} ${r.grade.title}</p><p class="score__line">${r.grade.line}</p></div></section>`;
  h += info(`<h3>속궁합 상세 풀이</h3><ul class="parts">${r.parts.map((pt) => `<li class="part">
      <div class="part__head"><h4>${pt.icon} ${pt.label}</h4><span class="part__pts">${pt.points} / ${pt.max}</span></div>
      <div class="meter meter--hot"><span style="width:${(pt.points / pt.max) * 100}%"></span></div>
      ${pt.detail ? `<p class="part__detail">${esc(pt.detail)}</p>` : ''}
      <p class="part__short">${esc(pt.short)}</p><p class="part__text">${esc(pt.text)}</p>
    </li>`).join('')}</ul>`);
  h += info(`<h3>두 사람의 애정 표현 스타일</h3><div class="styles">${styleCard(r.a, r.styleA)}${styleCard(r.b, r.styleB)}</div>`, 'pink');
  const touchCard = (to, from, t) => `<div class="style">
      <p class="style__type">💗 <b>${esc(to.name)}님</b>이 좋아할 스킨십</p>
      <ul class="ticks">${t.likes.map((x) => `<li>${x}</li>`).join('')}</ul>
      <p class="note">🪶 간지럼 타는 곳: <b>${t.soft.tickle}</b><br>💬 약한 말: <b>${t.soft.words}</b><br>🫠 마음이 녹는 순간: <b>${t.soft.melt}</b></p>
      <p class="note">→ ${esc(from.name)}님이 기억해 두세요!</p>
    </div>`;
  h += info(`<h3>💗 상대가 좋아할 스킨십 · 귀여운 약점</h3><div class="styles">${touchCard(r.b, r.a, r.touchB)}${touchCard(r.a, r.b, r.touchA)}</div>`, 'lilac');
  const openCard = (to, from, list) => `<div class="style">
      <p class="style__type">🗝️ <b>${esc(to.name)}님</b>의 마음을 여는 법 <small class="note">— ${esc(from.name)}님께</small></p>
      <ol class="opens">${list.map((o) => `<li><span class="opens__stars" aria-label="가능성 ${o.stars}단계">${'★'.repeat(o.stars)}${'☆'.repeat(3 - o.stars)}</span> <b>${esc(o.act)}</b><br><small>${esc(o.why)}</small></li>`).join('')}</ol>
    </div>`;
  h += info(`<h3>🗝️ 상대의 마음을 여는 법</h3><p class="note">사주로 가능성이 가장 높은 3가지만 골랐어요.</p>
    <div class="styles">${openCard(r.b, r.a, r.openB)}${openCard(r.a, r.b, r.openA)}</div>
    <p class="disclaimer">🔮 <b>사주는 완벽하지 않아요.</b> 태어난 순간의 기운으로 본 "가능성이 높은 흐름"일 뿐, 사람의 마음은 사주보다 훨씬 다양해요. 진짜 답은 상대에게 직접 물어보는 거예요. 아래 대화 카드를 활용해 보고, 상대가 원하지 않는 표현은 아무리 잘 맞는다고 나와도 멈춰 주세요.</p>`, 'pink');
  const weaponCard = (me, to, list) => `<div class="style">
      <p class="style__type">💘 <b>${esc(me.name)}님</b>의 연애 무기 <small class="note">— ${esc(to.name)}님에게</small></p>
      <ol class="opens">${list.map((w) => `<li><span class="opens__stars" aria-label="효과 ${w.stars}단계">${'★'.repeat(w.stars)}${'☆'.repeat(3 - w.stars)}</span> <b>${esc(w.name)}</b><br><small>${esc(w.why)}${w.fit ? ` ${esc(w.fit)}` : ''}</small><br><small class="opens__use">👉 ${esc(w.use)}</small></li>`).join('')}</ol>
    </div>`;
  h += info(`<h3>💘 나만의 연애 무기</h3><p class="note">내 사주에서 가장 강한 매력 3가지와, 그게 상대에게 잘 통하는 이유예요.</p>
    <div class="styles">${weaponCard(r.a, r.b, r.weaponsA)}${weaponCard(r.b, r.a, r.weaponsB)}</div>
    <p class="disclaimer">🔮 <b>사주는 완벽하지 않아요.</b> 무기는 "내가 가진 좋은 점"일 뿐, 상대를 마음대로 움직이는 기술이 아니에요. 상대가 좋아하는지 반응을 보며 써 주세요.</p>`, 'lilac');
  const L = r.lead;
  h += info(`<h3>🎯 주도권 밸런스</h3>
    <p class="style__type">${L.type.emoji} <b>${esc(L.type.title)}</b></p><p>${esc(L.type.text)}</p>
    <div class="leadbar" role="img" aria-label="${A}님 ${L.pctA}%, ${B}님 ${100 - L.pctA}%"><span style="width:${L.pctA}%">${A} ${L.pctA}%</span><span>${B} ${100 - L.pctA}%</span></div>
    <ul class="leads">${L.areas.map((x) => `<li><div class="leads__head">${x.icon} <b>${x.label}</b><span class="tag">${x.who ? `${esc(x.who)}님 리드` : '번갈아'}</span></div><p>${esc(x.text)}</p></li>`).join('')}</ul>
    <ul class="ticks">${L.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="disclaimer">🔮 <b>사주는 완벽하지 않아요.</b> 사주로 본 "편한 흐름"일 뿐이에요. 누가 이끌지는 두 사람이 이야기해서 정하는 게 정답이에요.</p>`, 'mint');
  h += talk('coco', 'love', `<p>두 사람의 좋은 점!</p><ul class="ticks">${r.strengths.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, { side: 'right', scene: 'mint' });
  h += talk('myo', 'think', `<p>이건 맞춰 가야 한다냥.</p><ul class="ticks">${r.cautions.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, { scene: 'lilac' });
  h += info(`<h3>🔥 설렘 지수가 높은 달</h3>${intimacyMonths(r)}<ul class="ticks ticks--plain">${r.hot.map((m) => `<li><b>🔥 ${monthName(m, base)}</b> — ${esc(m.why.slice(0, 2).join(' / ') || '두 사람의 연애운이 함께 오르는 달')}. 특별한 데이트는 이때!</li>`).join('')}<li><b>🫖 ${monthName(r.rest, base)}</b> — 서로 피곤하기 쉬운 달이에요. 무리한 이벤트보다 편안한 휴식 데이트로.</li></ul>`);
  h += info(`<h3>🌙 둘만의 시간</h3><p>사주로 본 두 사람이 가장 설레는 날과 시간이에요.</p>
    <ul class="days">${r.goodDates.map((d) => `<li class="day"><b>${d.m}월 ${d.d}일</b><span>${d.wd}요일</span><small>${esc(d.why[0] || '두 사람 기운이 잘 맞는 날')}</small></li>`).join('')}</ul>
    <p class="note" style="margin-top:10px">📅 특히 <b>${r.goodWeekday}요일</b>에 좋은 날이 많아요 · 🕯️ 분위기가 무르익는 시간: <b>${r.goodHour.name}(${r.goodHour.range})</b></p>`, 'mint');
  h += info(`<h3>💞 더 가까워지는 법</h3><ul class="ticks">${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'mint');
  h += `<section class="panel"><div class="rx">
      <div class="rx__head"><h3 class="lead-em" style="font-size:var(--s-5)">무드 처방전</h3><span>${A} ♥ ${B} · ${ELEMENT_KO[r.moodEl]} 기운 채우기</span></div>
      <dl class="luck">
        <div class="luck__row"><dt>조명</dt><dd>${r.mood.light}</dd></div>
        <div class="luck__row"><dt>향</dt><dd>${r.mood.scent}</dd></div>
        <div class="luck__row"><dt>음악</dt><dd>${r.mood.music}</dd></div>
        <div class="luck__row"><dt>데이트</dt><dd>${r.mood.place}</dd></div>
        <div class="luck__row"><dt>컬러</dt><dd>${r.mood.color}</dd></div>
      </dl>
      <span class="rx__stamp" aria-hidden="true">緣</span>
    </div></section>`;
  h += talk('myo', 'smile', p('속궁합 점수보다 중요한 건 서로의 속도를 존중하는 마음이야.') + p('좋은 건 좋다고, 싫은 건 싫다고 편하게 말할 수 있는 사이가 최고의 속궁합이다냥.'), { scene: 'night' });
  h += info(`<h3>💬 대화 카드</h3><p class="note">원하는 것·싫은 것은 말해야 알아요. 한 장씩 골라 서로에게 물어보세요.</p>
    <ul class="msgs talkcards">${r.cards.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'yellow');
  h += info(`<h3>✅ 동의·안전 체크리스트</h3><ul class="ticks">${r.consent.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'paper');
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 결과로 상담하기</a><a class="btn btn--lilac" href="#compat">💞 일반 궁합 보기</a><button class="btn" type="button" data-action="share-intimacy">결과 공유하기</button>${cardBtn('intimacy')}</div>`;
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

function switchNav(label, items, cur) {
  return `<nav class="modes" aria-label="${label}">${items.map(([key, text]) => `<a href="#${key}" class="${key === cur ? 'is-on' : ''}" ${key === cur ? 'aria-current="page"' : ''}>${text}</a>`).join('')}</nav>`;
}
function modeSwitch(mode) {
  return switchNav('이별·재회 보기 선택', [['breakup', '💔 이별수'], ['reunion', '💞 재회운']], mode);
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
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 결과로 상담하기</a><button class="btn btn--lilac" type="button" data-action="pair-again">다른 두 사람 보기</button><button class="btn" type="button" data-action="share-breakup">결과 공유하기</button>${cardBtn('breakup')}<a class="btn" href="#reunion">💞 같은 두 사람 재회운 보기</a></div>`;
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
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 결과로 상담하기</a><a class="btn btn--lilac" href="#breakup">💔 같은 두 사람 이별수 보기</a><button class="btn" type="button" data-action="share-reunion">결과 공유하기</button>${cardBtn('reunion')}<button class="btn" type="button" data-action="pair-again">다른 두 사람 보기</button></div>`;
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
    <div class="chat__suggest" id="chat-chips">${chipsHtml(chatSuggestions())}</div>
    <form class="chat__form" data-form="chat">
      <label class="sr" for="chat-input">고민 입력</label>
      <textarea id="chat-input" name="q" rows="1" maxlength="800" placeholder="연애 고민을 편하게 적어 주세요" required></textarea>
      <button class="btn btn--pink" type="submit">보내기</button>
    </form>
  </section>`;
}

// 추천 질문: 방금 나눈 주제·연애 상태·저장된 결과로 다음 질문을 고른다
function chatSuggestions(handlerChips) {
  const a = me();
  if (!a) return { chips: [], link: null, title: '' };
  const asked = state.chat.filter((m) => m.role === 'user').map((m) => m.content);
  if (handlerChips === undefined) {
    const lastBot = [...state.chat].reverse().find((m) => m.role === 'assistant');
    handlerChips = lastBot && lastBot.source === 'local' && asked.length ? lastBot.chips || [] : [];
  }
  const c = compat(), it = intimacy();
  // 이별수·재회운은 그 결과의 A가 지금 상담 중인 사람일 때만 맞춤 질문에 쓴다
  const mine = state.pair.a && personKey(state.pair.a) === personKey(state.me);
  return suggestQuestions({
    status: a.person.status || 'solo', asked, topic: lastTopicOf(asked), handlerChips,
    partnerName: c ? c.b.name : null, hasCompat: !!c,
    breakup: mine ? breakup() : null, reunion: mine ? reunion() : null,
    intimacy: it, adult: it ? !it.blocked : undefined,
  });
}

function chipsHtml(sug) {
  if (!sug.chips.length && !sug.link) return '';
  return `<p class="chat__suggest-title">${sug.title}</p>
    <div class="chat__chips">${sug.chips.map((c) => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}${sug.link ? `<a class="chat__link" href="${sug.link.href}">${esc(sug.link.label)} →</a>` : ''}</div>`;
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
  addAffinity('myo', 2);
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
  document.getElementById('chat-chips').innerHTML = chipsHtml(chatSuggestions(reply.source === 'local' ? reply.chips || [] : []));
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
  const br = breakup(), ru = reunion(), it = intimacy();
  const context = summaryForAI(me(), forecast(), compat()) + (br ? `\n${summaryBreakupForAI(br)}` : '') + (ru ? `\n${summaryReunionForAI(ru)}` : '')
    + (it && !it.blocked ? `\n${summaryIntimacyForAI(it)}` : '') + `\n${summaryDailyForAI(dailyFortune(me()))}`;
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
  const TAB = { home: 'start', start: 'start', reunion: 'breakup', today: 'reading', month: 'reading', ideal: 'reading', future: 'reading', ssum: 'compat', anniv: 'compat', rank: 'compat' };
  const tab = TAB[route] || route;
  let html;
  if (route === 'reading') html = viewReading();
  else if (route === 'compat') html = viewCompat('compat');
  else if (route === 'intimacy') html = viewCompat('intimacy');
  else if (route === 'today') html = viewToday();
  else if (route === 'month') html = viewMonth();
  else if (route === 'ideal') html = viewIdeal();
  else if (route === 'future') html = viewFuture();
  else if (route === 'ssum') html = viewSsum();
  else if (route === 'anniv') html = viewAnniv();
  else if (route === 'rank') html = viewRank();
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
    reading: '내 연애 사주 — 묘연의 연애사주', compat: '궁합 — 묘연의 연애사주', chat: '상담실 — 묘연의 연애사주', breakup: '이별수 — 묘연의 연애사주', reunion: '재회운 — 묘연의 연애사주', intimacy: '19금 속궁합 — 묘연의 연애사주', today: '오늘의 운세 — 묘연의 연애사주',
    month: '이달의 연애 리포트 — 묘연의 연애사주', ideal: '사주로 보는 이상형 — 묘연의 연애사주', future: '미래의 연인 — 묘연의 연애사주', ssum: '썸 성공 확률 — 묘연의 연애사주', anniv: '우리 기념일 운세 — 묘연의 연애사주', rank: '궁합 랭킹 — 묘연의 연애사주',
  }[route] || '묘연의 연애사주 — 고양이 점술사가 웹툰으로 풀어 주는 연애 사주·궁합';
  if (route === 'chat') scrollChat();
  if (route === 'start') {
    document.getElementById('start')?.scrollIntoView({ block: 'start' });
  } else if (pendingScroll && document.getElementById(pendingScroll)) {
    document.getElementById(pendingScroll).scrollIntoView({ block: 'start' });
    if (['compat-result', 'breakup-result', 'reunion-result', 'intimacy-result', 'ssum-result'].includes(pendingScroll)) animateScore();
  } else {
    window.scrollTo(0, 0);
  }
  pendingScroll = null;
  // 결과 화면을 보면 코코 호감도 +1 (하루 한도 있음)
  if (document.querySelector('#compat-result, #intimacy-result, #breakup-result, #reunion-result, #ssum-result, #anniv-result, #rank-result')
    || (['today', 'month', 'ideal', 'future', 'reading'].includes(route) && me())) addAffinity('coco', 1);
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
  if (kind === 'anniv') {
    const v = form.querySelector('[name="start"]').value;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) { showError(form, { error: '사귄 날을 골라 주세요.', focus: 'start' }); return; }
    const d = { y: +m[1], m: +m[2], d: +m[3] };
    const t = new Date(Date.now() + 9 * 3600000);
    if (Date.UTC(d.y, d.m - 1, d.d) > Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())) { showError(form, { error: '사귄 날은 오늘이거나 오늘 이전이어야 해요.', focus: 'start' }); return; }
    state.anniv = d; store.set('anniv', d); delete memo.anniv;
    pendingScroll = 'anniv-result'; render();
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
    stampThen(form, () => { pendingScroll = compatResultId(); render(); });
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
    pendingScroll = compatResultId();
    render();
    return;
  }
  const cardB = ev.target.closest('[data-card]');
  if (cardB) { openCard(cardB.dataset.card); return; }
  const rankOpen = ev.target.closest('[data-rank-open]');
  if (rankOpen) {
    const x = state.presets.find((it) => it.id === rankOpen.dataset.rankOpen);
    if (!x || !analyzeCached(x.person)) return;
    state.partner = { ...x.person };
    resetMemo('partner');
    store.set('partner', state.partner);
    pendingScroll = 'compat-result';
    if (location.hash === '#compat') render(); else location.hash = '#compat';
    return;
  }
  const fw = ev.target.closest('[data-future-want]');
  if (fw) { state.futureWant = fw.dataset.futureWant; store.set('futureWant', state.futureWant); pendingScroll = null; const y = scrollY; render(); scrollTo(0, y); return; }
  const monBtn = ev.target.closest('[data-month]');
  if (monBtn) {
    state.monthOffset = Math.max(-3, Math.min(11, Number(monBtn.dataset.month) || 0));
    pendingScroll = 'monthnav';
    render();
    return;
  }
  const dayBtn = ev.target.closest('[data-day]');
  if (dayBtn) {
    state.dayOffset = Math.max(DAY_MIN, Math.min(DAY_MAX, Number(dayBtn.dataset.day) || 0));
    pendingScroll = 'daynav';
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
  if (action === 'share-intimacy') { shareIntimacy(); return; }
  if (action === 'share-today') { shareToday(); return; }
  if (action === 'anniv-clear') { state.anniv = null; store.del('anniv'); delete memo.anniv; render(); return; }
  if (action === 'adult-yes') { store.set(ADULT_KEY, true); render(); return; }
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

function shareToday() {
  const a = me();
  if (!a) return;
  const f = dailyFortune(a, Date.now(), state.dayOffset);
  share(`🐾 묘연의 연애사주\n${a.name}님의 ${f.date.m}월 ${f.date.d}일 운세: 총운 ${f.overall}점 ${f.grade.emoji} ${f.grade.label}\n${f.theme.emoji} ${f.theme.word}의 날 — ${f.theme.line}\n행운 컬러 ${f.lucky.color} · 좋은 시간 ${f.bestBlock.label}`);
}

function shareIntimacy() {
  const r = intimacy();
  if (!r || r.blocked) return;
  share(`🐾 묘연의 연애사주\n${r.a.name} ♥ ${r.b.name} 속궁합 ${r.score}점, ${r.grade.title} ${r.grade.emoji}\n"${r.grade.line}"`);
}

function shareCompat() {
  const c = compat();
  if (!c) return;
  share(`🐾 묘연의 연애사주\n${c.a.name} ♥ ${c.b.name} 궁합 ${c.score}점, ${c.grade.title} ${c.grade.emoji}\n"${c.grade.line}"`);
}


/* ───────────── 🌙 다크 모드 ───────────── */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    const inline = b.classList.contains('theme--inline');
    b.textContent = t === 'dark' ? (inline ? '☀️ 밝게' : '☀️') : (inline ? '🌙 어둡게' : '🌙');
    b.setAttribute('aria-label', t === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기');
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#140D1F' : '#2A1B3D');
}
applyTheme(store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-theme-toggle]')) return;
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('theme', t);
  applyTheme(t);
  toast(t === 'dark' ? '🌙 어두운 화면으로 바꿨어요.' : '☀️ 밝은 화면으로 바꿨어요.');
});

dailyVisit();

render();
