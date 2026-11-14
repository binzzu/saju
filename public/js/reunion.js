// 재회운 — A(나)와 B(다시 만나고 싶은 사람)의 사주로 다시 이어질 힘·막는 힘·시기·연락 작전을 계산한다.
// 재회는 상대의 동의가 있어야 하는 일이라, 상대가 거절했거나 위험한 관계였다면 재회를 권하지 않는다.
import {
  ELEMENTS, ELEMENT_KO, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, ANIMALS, BRANCH_MAIN_STEM, TEN_GOD_GROUP,
  branchRelation, stemsCombine, generates, controls, tenGod, yearPillarOf, yearMonthPillarsAt, seoulWallToUtc, dayPillarOf,
} from './saju.js';
import { DAY_MASTERS, LUCK, ELEMENT_INFO, buildForecast } from './reading.js';
import { analyzeBreakup, personalSignals } from './breakup.js';
import { WEEKDAYS } from './text.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nim = (p) => `${p.name}님`;

/* ───────────── 그 사람의 마음 성향 (가장 강한 십신 그룹) ───────────── */

const MIND = {
  인성: {
    type: '추억형', emoji: '📷',
    text: (n) => `${n}은 지난 일을 오래 곱씹는 타입이에요. 겉으로는 정리한 척해도 좋았던 기억을 자주 떠올려서, 시간이 지나도 마음 한쪽에 자리가 남아 있기 쉬워요.`,
    how: '좋았던 추억 하나를 가볍게 꺼내는 연락이 잘 통해요. 지난 잘잘못 이야기는 꺼내지 마세요.',
    msgs: ['오늘 ○○ 지나가다가 우리 갔던 데 생각나더라. 잘 지내지?', '요즘 날씨 보니까 작년 이맘때 생각났어. 건강 잘 챙겨!'],
  },
  비겁: {
    type: '자존심형', emoji: '🦁',
    text: (n) => `${n}은 한 번 정한 마음을 쉽게 바꾸지 않는 자존심형이에요. 먼저 연락하는 일은 거의 없지만, 상대가 부담 없이 다가오면 받아 주는 경우가 많아요.`,
    how: '사과나 감정 고백보다 짧고 가벼운 안부가 좋아요. "우리 다시 생각해 보자"처럼 결정을 재촉하는 말은 자존심을 건드려요.',
    msgs: ['잘 지내? 갑자기 생각나서 안부 한 줄 남겨!', '요즘 ○○ 시작했다며? 응원할게!'],
  },
  식상: {
    type: '표현형', emoji: '💬',
    text: (n) => `${n}은 감정을 바로 표현하는 타입이에요. 마음이 남아 있다면 반응도 빨리 오고, 정리가 됐다면 답도 분명하게 해 줘요.`,
    how: '재치 있는 한마디나 공감 가는 주제로 가볍게 대화를 여는 게 좋아요. 무거운 장문은 피하세요.',
    msgs: ['이거 보자마자 너 생각나서 보내 😂', '너 좋아하던 그 가수 새 앨범 나왔더라! 들어 봤어?'],
  },
  재성: {
    type: '현실형', emoji: '🧮',
    text: (n) => `${n}은 감정보다 현실을 따지는 타입이에요. "다시 만나면 뭐가 달라지는데?"를 확인하고 싶어 해요.`,
    how: '자연스러운 이유가 있는 연락(돌려줄 물건, 같이 가기로 했던 곳)이 좋아요. 달라진 점은 말보다 행동으로 보여 주세요.',
    msgs: ['전에 빌린 책 아직 나한테 있어. 편할 때 돌려줄게!', '우리 가기로 했던 그 전시 이번 달까지래. 혹시 생각 있으면 말해 줘!'],
  },
  관성: {
    type: '책임형', emoji: '🎩',
    text: (n) => `${n}은 체면과 책임을 중요하게 여기는 타입이에요. 주변 시선이나 다시 만날 "명분"을 신경 써요.`,
    how: '장난스러운 연락보다 예의 바르고 진지한 톤이 좋아요. 그동안 고마웠던 점을 정중하게 전하면 마음이 열려요.',
    msgs: ['갑자기 연락해서 놀랐지? 그때 못 한 말이 있어서. 그동안 정말 고마웠어.', '잘 지내는지 궁금했어. 부담 갖지 말고 편할 때 답해 줘.'],
  },
};

function myMind(a) {
  const g = a.groupCounts, n = nim(a);
  if (g.인성 >= 3) return `${n}은 인성 기운이 강해서 지난 추억을 오래 곱씹는 편이에요. 미련이 오래가는 만큼, 재회를 원하는지 "그리움"인지 먼저 구분해 보세요.`;
  if (g.비겁 >= 3) return `${n}은 자존심을 지키는 비겁 기운이 강해서, 마음은 있어도 먼저 연락하기 어려워하는 타입이에요. 먼저 움직이는 게 지는 게 아니라는 걸 기억하세요.`;
  if (g.식상 >= 3) return `${n}은 표현력이 좋은 식상 기운이 강해서, 진심을 전하면 상대 마음을 움직일 힘이 있어요. 다만 감정이 앞서 말이 길어지지 않게 조심하세요.`;
  if (g.재성 >= 3) return `${n}은 현실 감각이 좋은 재성 기운이 강해서, 다시 만나면 뭐가 달라질지 차분히 계산할 수 있어요. 그 계획을 상대에게 강요하지만 않으면 돼요.`;
  if (g.관성 >= 3) return `${n}은 책임감이 강한 관성 기운이 많아서, 관계를 쉽게 놓지 못하는 편이에요. 재회가 "의무감"이 되지 않게 내 마음을 먼저 들여다보세요.`;
  return `${n}은 감정이 정리되는 속도가 평균적인 편이에요. 재회든 새 출발이든 스스로 선택할 수 있는 상태예요.`;
}

/* ───────────── 다시 이어질 힘 / 막는 힘 ───────────── */

const PALACE = {
  harmony: { pts: 12, short: '육합 — 원래 자리로 돌아오는 복원력', text: '두 사람의 배우자 자리가 "육합"이에요. 헤어져도 다시 맞물리려는 힘이 강해서, 재회 커플에게서 자주 보이는 조합이에요.' },
  trine: { pts: 8, short: '삼합 — 같은 방향을 보던 사이', text: '배우자 자리가 같은 삼합 그룹이에요. 같은 곳을 바라보던 기억이 남아, 다시 만나면 금방 예전 호흡을 되찾아요.' },
  same: { pts: 6, short: '같은 글자 — 익숙함이 끌어당기는 사이', text: '배우자 자리 글자가 같아요. 서로가 너무 익숙해서, 다른 사람을 만나도 자꾸 비교하게 되는 관계예요.' },
  wonjin: { pts: 3, short: '원진 — 미운 정 때문에 미련이 긴 사이', text: '배우자 자리가 "원진"이에요. 미운 정 고운 정이 깊어 미련이 오래 남아요. 다만 다시 만나면 같은 서운함이 반복되기 쉬우니, 그 부분을 먼저 해결해야 해요.' },
  neutral: { pts: 0, short: '무난 — 특별한 끌림도 막힘도 없는 사이', text: '배우자 자리끼리 특별한 끌림도 막힘도 없어요. 재회는 사주보다 두 사람의 의지와 타이밍에 달렸어요.' },
  punish: { pts: -5, short: '형 — 다시 만나도 잔소리가 돌아오는 사이', text: '배우자 자리가 "형"의 관계예요. 다시 만나도 서로를 고치려는 마찰이 돌아오기 쉬워서, 상대가 재회를 망설일 수 있어요.' },
  clash: { pts: -9, short: '충 — 다시 만나도 부딪히기 쉬운 사이', text: '배우자 자리가 정면으로 부딪히는 "충"이에요. 그리움은 커도, 다시 만나면 같은 문제로 부딪히기 쉬워 재회가 쉽지 않은 조합이에요.' },
};

function reunionFactors(a, b) {
  const F = [];
  const A = nim(a), B = nim(b);
  const starAB = b.dmEl === a.partner.el, starBA = a.dmEl === b.partner.el;

  // 1) 일간
  let dm;
  if (stemsCombine(a.dm, b.dm)) dm = { id: 'combo', pts: 14, short: '천간합 — 떨어져도 다시 끌어당기는 자석', text: `${A}과 ${B}의 일간이 "천간합"이에요. 멀어져도 다시 서로를 찾게 되는, 사주에서 가장 대표적인 재회 신호예요.` };
  else if (generates(a.dmEl, b.dmEl) || generates(b.dmEl, a.dmEl)) {
    const giver = generates(a.dmEl, b.dmEl) ? a : b, taker = giver === a ? b : a;
    dm = { id: 'give', pts: 6, short: '상생 — 그리운 마음이 남는 사이', text: `${nim(giver)}이 ${nim(taker)}을 살려 주던 관계예요. 받던 쪽은 그 따뜻함을, 주던 쪽은 챙겨 주던 습관을 그리워하게 돼요.` };
  } else if (a.dmEl === b.dmEl) dm = { id: 'same', pts: 5, short: '같은 오행 — 익숙함이 그리운 사이', text: `두 사람 모두 ${ELEMENT_KO[a.dmEl]}(${ELEMENT_INFO[a.dmEl].name}) 기운이에요. 말 안 해도 통하던 편안함이 그리워지기 쉬워요.` };
  else {
    const ctrl = controls(a.dmEl, b.dmEl) ? a : b, under = ctrl === a ? b : a;
    const star = ctrl === a ? starBA : starAB;
    dm = { id: 'control', pts: star ? 2 : -5, short: `상극 — ${nim(ctrl)}이 주도하던 사이`, text: `${nim(ctrl)}의 기운이 ${nim(under)}을 누르는 관계예요.${star ? ` ${nim(under)} 사주에서 ${nim(ctrl)}은 인연의 별이라 끌림은 남아 있어요.` : ''} 다시 만나려면 ${nim(under)}이 "이번엔 숨 막히지 않겠다"고 느끼게 해 주는 게 관건이에요.` };
  }
  F.push({ icon: '🧲', label: '다시 끌리는 힘', ...dm, detail: `${A} ${STEMS[a.dm]}(${STEMS_KO[a.dm]}) × ${B} ${STEMS[b.dm]}(${STEMS_KO[b.dm]})` });

  // 2) 배우자 자리
  const r = branchRelation(a.dayBranch, b.dayBranch);
  F.push({ id: `palace_${r}`, icon: '🏠', label: '배우자 자리의 복원력', ...PALACE[r], detail: `${A} ${BRANCHES[a.dayBranch]}(${BRANCHES_KO[a.dayBranch]}) × ${B} ${BRANCHES[b.dayBranch]}(${BRANCHES_KO[b.dayBranch]})` });

  // 3) 인연의 별
  const sp = (starAB ? 6 : 0) + (starBA ? 6 : 0);
  if (sp) F.push({ id: 'stars', icon: '⭐', label: '인연의 별', pts: sp, short: starAB && starBA ? '서로가 서로의 인연의 별' : `${starAB ? A : B} 사주에서 상대가 인연의 별`, text: '연인을 뜻하는 별이 상대를 가리켜요. 다른 사람을 만나도 "그래도 그 사람"이 떠오르기 쉬운 인연이에요.' });

  // 4) 그 사람의 성향
  const sigB = personalSignals(b);
  const has = (id) => sigB.some((s) => s.id === id);
  if (b.groupCounts.인성 >= 3) F.push({ id: 'memory', icon: '📷', label: `${B}의 미련`, pts: 5, short: '추억을 곱씹는 사주', text: `${B} 사주엔 지난 일을 오래 기억하는 인성 기운이 강해요. 시간이 지나도 좋은 기억이 남아 있기 쉬워요.` });
  if (b.groupCounts.비겁 >= 3 || has('lonely')) F.push({ id: 'pride', icon: '🦁', label: `${B}의 자존심`, pts: -4, short: '돌아보지 않으려는 사주', text: `${B} 사주엔 ${has('lonely') ? '혼자만의 시간이 필요한 별' : '자존심이 강한 비겁 기운'}이 있어요. 마음이 남아 있어도 먼저 돌아오지는 않으려 해요.` });
  if (has('temptation')) F.push({ id: 'newlove', icon: '🌸', label: `${B}의 새 인연`, pts: -4, short: '새 인연이 빨리 생기는 도화', text: `${B} 사주엔 매력의 별(도화)이 강해서 주변에 새 인연이 빨리 생기는 편이에요. 재회를 원한다면 너무 오래 기다리지 않는 게 좋아요.` });
  if (has('palaceClash')) F.push({ id: 'change', icon: '🌪️', label: `${B}의 변화 욕구`, pts: -3, short: '새로움을 좇는 배우자 자리', text: `${B}의 배우자 자리가 흔들리는 사주라, 지난 관계보다 새로운 변화에 마음이 가기 쉬워요. 재회한다면 "예전 그대로"가 아니라 "새로워진 우리"를 보여 줘야 해요.` });
  // 5) 나의 표현력
  if (a.groupCounts.식상 >= 3) F.push({ id: 'voice', icon: '💬', label: `${A}의 표현력`, pts: 3, short: '마음을 전하는 힘', text: `${A} 사주엔 표현력의 별(식상)이 강해서, 진심을 전하면 상대 마음을 움직일 힘이 있어요.` });
  // 6) 띠
  const rz = branchRelation(a.yearBranch, b.yearBranch);
  const zp = { harmony: 3, trine: 3, same: 1, clash: -3, punish: -2 }[rz];
  if (zp) F.push({ id: `zodiac_${rz}`, icon: '🐾', label: '띠 궁합', pts: zp, short: `${ANIMALS[a.yearBranch]}띠 × ${ANIMALS[b.yearBranch]}띠`, text: zp > 0 ? '띠끼리 잘 맞아서 기본 호감이 오래 남아요.' : '띠끼리 부딪혀서 가치관 차이가 다시 문제 될 수 있어요.' });
  return F;
}

/* ───────────── 시기 ───────────── */

const WHY = {
  harmony: { label: '마음이 다시 맞물림', good: true, text: (w) => `${w}의 배우자 자리와 합이 드는 시기 — 다시 연결되기 쉬워요` },
  back: { label: '익숙한 기운이 돌아옴', good: true, text: (w) => `${w}의 기운이 그대로 돌아오는 시기 — 옛 인연이 떠오르기 쉬워요` },
  combo: { label: '다시 끌어당김', good: true, text: (w) => `${w}의 일간과 합이 드는 시기 — 끌림이 되살아나요` },
  star: { label: '인연의 별', good: true, text: (w) => `${w}에게 연인을 뜻하는 별이 뜨는 시기` },
  memory: { label: '추억 소환', good: true, text: (w) => `${w}이 지난 일을 떠올리는 시기` },
  clash: { label: '엇갈림', good: false, text: (w) => `${w}의 배우자 자리가 흔들리는 시기 — 연락이 엇갈리기 쉬워요` },
  pride: { label: '자존심 대결', good: false, text: (w) => `${w}의 자존심이 세지는 시기` },
  newlove: { label: '그 사람의 새 인연', good: false, text: (w) => `${w}에게 새 인연이 들어오기 쉬운 시기` },
};

export function periodReunion(a, b, stem, branch) {
  let s = 42;
  const why = [];
  const add = (k, who, pts) => { s += pts; why.push({ k, who, pts }); };
  for (const p of [a, b]) {
    const rel = branchRelation(branch, p.dayBranch);
    if (rel === 'harmony') add('harmony', p, 9);
    else if (rel === 'same') add('back', p, 6);
    else if (rel === 'clash') add('clash', p, -8);
    if (stemsCombine(stem, p.dm)) add('combo', p, 6);
    const gS = tenGod(p.dm, stem), gB = tenGod(p.dm, BRANCH_MAIN_STEM[branch]);
    if (gS === p.partner.jeongName || gB === p.partner.jeongName) add('star', p, 5);
    if (gS === '겁재' || gB === '겁재') add('pride', p, -3);
    if (p === b && (TEN_GOD_GROUP[gS] === '인성' || TEN_GOD_GROUP[gB] === '인성')) add('memory', p, 4);
  }
  if (b.peachBranches.includes(branch)) add('newlove', b, -3);
  const score = clamp(Math.round(s), 5, 95);
  const good = why.filter((w) => w.pts > 0).sort((x, y) => y.pts - x.pts);
  const bad = why.filter((w) => w.pts < 0).sort((x, y) => x.pts - y.pts);
  const main = score >= 44 ? good[0] || bad[0] : bad[0] || good[0];
  const line = (w) => ({ key: w.k, label: WHY[w.k].label, good: WHY[w.k].good, line: WHY[w.k].text(nim(w.who)) });
  return {
    score, level: reunionLevel(score), good: good.map(line), bad: bad.map(line),
    main: main ? line(main) : { key: 'none', label: '잔잔함', good: true, line: '큰 변수 없이 잔잔한 시기' },
    pillar: { stem, branch, hanja: STEMS[stem] + BRANCHES[branch], hangul: STEMS_KO[stem] + BRANCHES_KO[branch] },
  };
}

export function reunionLevel(s) {
  if (s >= 58) return { key: 'high', label: '기회', emoji: '💌' };
  if (s >= 44) return { key: 'mid', label: '보통', emoji: '🙂' };
  return { key: 'low', label: '쉬어 가기', emoji: '🍂' };
}

export function reunionGrade(score) {
  if (score >= 70) return { key: 'strong', title: '재회운 강함', emoji: '💞', line: '끊어진 것 같아도 실이 아직 단단히 이어져 있다냥!' };
  if (score >= 55) return { key: 'good', title: '재회운 있음', emoji: '🌷', line: '타이밍만 잘 잡으면 다시 닿을 수 있는 인연!' };
  if (score >= 40) return { key: 'half', title: '재회운 반반', emoji: '🌗', line: '다시 이어질지는 두 사람의 노력과 타이밍에 달렸다냥.' };
  return { key: 'weak', title: '재회운 약함', emoji: '🍂', line: '다시 잇는 실보다 새로운 실이 더 가까이 있을지도 몰라.' };
}

/* ───────────── 전체 분석 ───────────── */

export function analyzeReunion(a, b, nowMs = Date.now()) {
  const factors = reunionFactors(a, b);
  const score = clamp(Math.round(45 + 1.35 * factors.reduce((t, f) => t + f.pts, 0)), 5, 95);
  const grade = reunionGrade(score);
  const pulls = factors.filter((f) => f.pts > 0).sort((x, y) => y.pts - x.pts);
  const blocks = factors.filter((f) => f.pts < 0).sort((x, y) => x.pts - y.pts);

  const bGroup = Object.keys(b.groupCounts).sort((x, y) => b.groupCounts[y] - b.groupCounts[x])[0];
  const mind = { ...MIND[bGroup], group: bGroup };
  const mindText = mind.text(nim(b));

  // 시기
  const cur = yearMonthPillarsAt(nowMs);
  const years = [];
  for (let k = 0; k < 5; k++) {
    const y = cur.sajuYear + k;
    const p = yearPillarOf(y);
    years.push({ year: y, animal: ANIMALS[p.branch], ...periodReunion(a, b, p.stem, p.branch) });
  }
  const months = [];
  const now = new Date(nowMs + 9 * 3600000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    const ym = yearMonthPillarsAt(seoulWallToUtc(y, m, 15, 12, 0));
    const mr = periodReunion(a, b, ym.month.stem, ym.month.branch);
    const yr = periodReunion(a, b, ym.year.stem, ym.year.branch);
    const sc = clamp(Math.round(mr.score * 0.75 + yr.score * 0.25), 5, 95);
    months.push({ year: y, month: m, ...mr, score: sc, level: reunionLevel(sc) });
    m++; if (m > 12) { m = 1; y++; }
  }
  const byDate = (p, q) => months.indexOf(p) - months.indexOf(q);
  const best = [...months].sort((p, q) => q.score - p.score).slice(0, 3).sort(byDate);
  const avoid = [...months].sort((p, q) => p.score - q.score).slice(0, 2).filter((x) => x.score < 42).sort(byDate);

  // 첫 연락 길일: 가장 가까운 좋은 달 안에서 고른 3일
  const target = best[0];
  const today = { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
  const days = [];
  const dim = new Date(Date.UTC(target.year, target.month, 0)).getUTCDate();
  for (let d = 1; d <= dim; d++) {
    if (target.year === today.y && target.month === today.m && d <= today.d) continue;
    const pz = dayPillarOf(target.year, target.month, d);
    const r = periodReunion(a, b, pz.stem, pz.branch);
    days.push({ year: target.year, month: target.month, day: d, wd: WEEKDAYS[new Date(Date.UTC(target.year, target.month - 1, d)).getUTCDay()], ...r });
  }
  const contactDays = days.sort((p, q) => q.score - p.score).slice(0, 3).sort((p, q) => p.day - q.day);

  // 지난 이별의 이유 — 다시 만나도 같은 이유로 헤어지지 않으려면
  const br = analyzeBreakup(a, b, nowMs);

  // 재회 작전
  const combined = Object.fromEntries(ELEMENTS.map((e) => [e, a.counts[e] + b.counts[e]]));
  const coupleEl = ELEMENTS.reduce((mm, e) => (combined[e] < combined[mm] ? e : mm), ELEMENTS[0]);
  const luck = LUCK[coupleEl];
  const fc = buildForecast(a, nowMs);
  const newLove = fc.best.slice(0, 2).sort((p, q) => fc.months.indexOf(p) - fc.months.indexOf(q));

  return {
    a, b, score, grade, factors, pulls, blocks, mind, mindText, myMind: myMind(a),
    years, months, best, avoid, contactDays,
    breakup: { pattern: br.pattern, rules: br.rules.slice(0, 3), top: br.dangers[0] || null },
    coupleEl, luck, newLove,
    dont: [
      '새벽이나 술 마신 뒤에 연락하지 않기',
      '답이 없는데 연달아 보내지 않기 — 한 번 보내고 최소 1~2주는 기다리기',
      'SNS 염탐, "좋아요" 폭탄으로 존재감 드러내지 않기',
      '친구를 통해 마음을 전하거나 만나 달라고 압박하지 않기',
      '첫 연락에서 "다시 만나자", 지난 잘잘못 따지기 금지',
    ],
    meet: [
      `첫 만남은 1~2시간 가볍게 — ${luck.places[0]}처럼 부담 없는 곳이 좋아요`,
      '지난 이야기는 두 번째 만남부터. 첫 만남은 "요즘의 나"를 보여 주는 자리',
      '달라진 점은 말로 약속하기보다 행동으로 보여 주기',
      `${luck.color} 계열 포인트 아이템이 두 사람 사이에 부족한 ${ELEMENT_KO[coupleEl]} 기운을 채워 줘요`,
    ],
  };
}

export function summaryReunionForAI(r) {
  const n = (x) => `${x.year}.${x.month}`;
  return [
    `재회운 분석: ${r.a.name} → ${r.b.name} (${r.b.gender === 'F' ? '여성' : '남성'}, 일간 ${STEMS[r.b.dm]} ${ELEMENT_KO[r.b.dmEl]})`,
    `재회운 지수 ${r.score}/100 (${r.grade.title}) — 다시 이어질 힘: ${r.pulls.map((f) => f.short).join(', ') || '없음'} / 막는 힘: ${r.blocks.map((f) => f.short).join(', ') || '없음'}`,
    `${r.b.name}님의 마음 성향: ${r.mind.type} — 연락법: ${r.mind.how}`,
    `재회 기회의 달: ${r.best.map((x) => `${n(x)}(${x.main.label})`).join(', ')} / 피할 달: ${r.avoid.map(n).join(', ') || '없음'} / 첫 연락 길일: ${r.contactDays.map((d) => `${d.month}.${d.day}`).join(', ')}`,
    `지난 이별 패턴(다시 만나면 해결할 것): ${r.breakup.pattern.title}`,
  ].join('\n');
}
