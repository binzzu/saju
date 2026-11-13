import { drawCharacter, faceAvatar } from './characters.js';
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
  ai: null, // null | 'server'(Node + API 키) | 'artifact'(Claude 아티팩트의 sample)
  sample: null,
  busy: false,
};
const memo = {};

function me() {
  if (!state.me) return null;
  if (!memo.me) {
    memo.me = analyzePerson(state.me);
    memo.fc = memo.me ? buildForecast(memo.me) : null;
  }
  return memo.me;
}
function forecast() { me(); return memo.fc; }
function partner() {
  if (!state.partner) return null;
  if (!memo.partner) memo.partner = analyzePerson(state.partner);
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

const counselor = createCounselor(() => ({ a: me(), fc: forecast(), compat: compat() }));

/* ───────────── 웹툰 조각 ───────────── */

const NAMES = { myo: '묘연', coco: '코코' };

function talk(who, expr, html, { side = 'left', scene = 'pink', sfx = '', sfxPos = '', caption = '' } = {}) {
  const right = side === 'right';
  const art = drawCharacter(who, expr, { flip: right, title: `${NAMES[who]} (${expr})` });
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
  const head = isMe
    ? `<h2>연애 사주 신청서</h2><p>적어 준 기운으로 묘연이 인연의 실을 읽어요</p>`
    : `<h2>궁합 신청서</h2><p>궁금한 그 사람의 정보를 적어 주세요</p>${meA ? `<span class="talisman__me">나: ${esc(meA.name)} · ${STEMS[meA.dm]}${BRANCHES[meA.dayBranch]} 일주</span>` : ''}`;
  return `<form class="talisman" data-form="${kind}" novalidate>
    <div class="talisman__head">${head}</div>
    <div class="field">
      <label for="${id('name')}">${isMe ? '이름' : '상대 이름'}</label>
      <input class="input" id="${id('name')}" name="name" maxlength="12" autocomplete="off" required value="${esc(v.name || '')}" placeholder="${isMe ? '예: 김민지' : '예: 이준호'}">
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
        <input class="input" type="time" id="${id('time')}" name="time" value="${time}" ${v.name && !v.timeKnown ? 'disabled' : ''}>
        <label class="check"><input type="checkbox" name="unknown" ${v.name && !v.timeKnown ? 'checked' : ''}> 시간을 몰라요</label>
      </div>
      <p class="hint">한국 표준시 기준으로 적어 주세요. 서머타임·지역 시차는 자동으로 보정해요.</p>
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
        <span class="seal__label">${isMe ? '도장 찍고 사주 펼치기' : '도장 찍고 궁합 보기'}</span>
      </button>
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
    const m = /^(\d{1,2}):(\d{2})/.exec(time);
    if (!m) return { error: '태어난 시간을 적거나 "시간을 몰라요"를 체크해 주세요.', focus: 'time' };
    hour = Number(m[1]); minute = Number(m[2]);
  }
  const person = { name, gender, calendar, leap: calendar === 'lunar' && leap, year, month, day, hour, minute, timeKnown: !unknown };
  if (f.has('status')) person.status = f.get('status') || 'solo';
  return { person };
}

/* ───────────── 화면: 처음 ───────────── */

function viewHome() {
  const a = me();
  let html = '';
  html += talk('myo', 'smile', p('어서 와라냥. 여기는 인연(緣)을 읽어 주는 <strong>묘연 사주방</strong>이야.') + p('연애운, 궁합, 고민 상담까지 전부 웹툰으로 쉽게 풀어 줄게.'), { scene: 'night', sfx: '딸랑♪', caption: '골목 끝, 방울 소리가 나는 작은 점집' });
  if (a) {
    html += talk('coco', 'sparkle', p(`앗, <strong>${esc(a.name)}님</strong> 다시 왔네요! 저장해 둔 사주로 바로 볼까요?`), { side: 'right', scene: 'mint' });
    html += todayCard(a);
    html += `<div class="actions"><a class="btn btn--pink" href="#reading">${esc(a.name)}님 사주 다시 보기</a><a class="btn btn--lilac" href="#chat">상담실 가기</a></div>`;
    html += talk('coco', 'wink', p('다른 사람으로 새로 보고 싶으면 아래 부적을 고쳐 써요!'), { side: 'right', scene: 'pink' });
  } else {
    html += talk('coco', 'happy', p('이름, 생년월일, 태어난 시간을 이 <strong>부적</strong>에 적어 주세요!') + p('음력 생일도 괜찮고, 시간을 몰라도 볼 수 있어요.'), { side: 'right', scene: 'pink', sfx: '쓱쓱' });
  }
  html += talisman('me', state.me);
  return html;
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
  let h = '';

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
  h += `<div class="actions"><a class="btn btn--ghost" href="#home" style="color:#fff;border-color:#fff">정보 고쳐서 다시 보기</a></div>`;
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
  h += `<div class="actions"><a class="btn btn--pink" href="#chat">이 궁합으로 상담하기</a><button class="btn btn--lilac" type="button" data-action="new-partner">다른 사람과 궁합 보기</button><button class="btn" type="button" data-action="share-compat">궁합 공유하기</button></div>`;
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
  h += talisman('partner', state.partner);
  const c = compat();
  if (c) h += `<div id="compat-result">${compatResultHtml(c)}</div>`;
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
  const context = summaryForAI(me(), forecast(), compat());
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
  let html;
  if (route === 'reading') html = viewReading();
  else if (route === 'compat') html = viewCompat();
  else if (route === 'chat') html = viewChat();
  if (html == null) html = viewHome();
  app.innerHTML = html;
  document.querySelectorAll('.tabs a').forEach((t) => {
    if (t.dataset.tab === route) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.title = {
    reading: '내 연애 사주 — 묘연의 연애사주', compat: '궁합 — 묘연의 연애사주', chat: '상담실 — 묘연의 연애사주',
  }[route] || '묘연의 연애사주 — 고양이 점술사가 웹툰으로 풀어 주는 연애 사주·궁합';
  if (route === 'chat') scrollChat();
  if (route === 'compat' && pendingScroll === 'compat-result') {
    document.getElementById('compat-result')?.scrollIntoView({ block: 'start' });
    animateScore();
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
    const prev = state.me;
    state.me = res.person;
    resetMemo('me');
    if (!analyzePerson(state.me)) { state.me = prev; showError(form, { error: '날짜를 확인해 주세요.', focus: 'day' }); return; }
    const changedPerson = !prev || ['name', 'year', 'month', 'day', 'hour', 'minute', 'gender', 'calendar', 'leap'].some((k) => prev[k] !== state.me[k]);
    if (changedPerson) { state.chat = []; store.del('chat'); }
    store.set('me', state.me);
    stampThen(form, () => { location.hash = '#reading'; if (location.hash === '#reading') render(); });
  } else if (kind === 'partner') {
    state.partner = res.person;
    resetMemo('partner');
    store.set('partner', state.partner);
    stampThen(form, () => { pendingScroll = 'compat-result'; render(); });
  }
});

app.addEventListener('change', (ev) => {
  const t = ev.target;
  const form = t.closest('form.talisman');
  if (!form) return;
  if (t.name === 'unknown') {
    const time = form.querySelector('[name="time"]');
    time.disabled = t.checked;
    if (t.checked) time.value = '';
  }
  if (t.name === 'calendar') {
    form.querySelector('[data-leap]').hidden = t.value !== 'lunar';
  }
  form.querySelector('.form-error').textContent = '';
});

app.addEventListener('click', (ev) => {
  const chip = ev.target.closest('[data-chip]');
  if (chip) { ask(chip.dataset.chip); return; }
  const act = ev.target.closest('[data-action]');
  if (!act) return;
  if (act.dataset.action === 'clear-chat') {
    state.chat = [];
    store.del('chat');
    render();
  }
  if (act.dataset.action === 'share-reading') shareReading();
  if (act.dataset.action === 'share-compat') shareCompat();
  if (act.dataset.action === 'new-partner') {
    const form = document.querySelector('form[data-form="partner"]');
    form.reset();
    form.querySelectorAll('input[type=radio]').forEach((r) => { r.checked = r.value === 'solar'; });
    form.querySelector('[name="time"]').disabled = false;
    form.querySelector('[data-leap]').hidden = true;
    form.querySelector('.form-error').textContent = '';
    form.scrollIntoView({ block: 'start' });
    form.querySelector('[name="name"]').focus();
  }
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

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toast" id="toast" role="status" aria-live="polite"></div>');
    el = document.getElementById('toast');
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-on'), 2600);
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

function shareCompat() {
  const c = compat();
  if (!c) return;
  share(`🐾 묘연의 연애사주\n${c.a.name} ♥ ${c.b.name} 궁합 ${c.score}점, ${c.grade.title} ${c.grade.emoji}\n"${c.grade.line}"`);
}

render();
