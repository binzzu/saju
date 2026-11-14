// 속궁합 — 두 사람의 끌림·스킨십 리듬·온도·분위기 매력·표현 균형을 사주로 본다.
// 노골적인 묘사 없이 애정 표현 방식·속도·분위기·소통을 다루고, 동의와 존중을 기본으로 둔다.
// 두 사람 모두 만 19세 이상일 때만 결과를 만든다.
import {
  ELEMENTS, ELEMENT_KO, STEMS, BRANCHES, BRANCHES_KO, RED_FLAME,
  branchRelation, stemsCombine, generates, peachBlossomBranch, yearMonthPillarsAt, seoulWallToUtc,
} from './saju.js';
import { ELEMENT_INFO, periodLove } from './reading.js';

export const ADULT_AGE = 19;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nim = (p) => `${p.name}님`;

/** 한국 시간 기준 만 나이 */
export function ageOf(a, nowMs = Date.now()) {
  const t = new Date(nowMs + 9 * 3600000);
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
  const s = a.solar;
  return y - s.year - (m < s.month || (m === s.month && d < s.day) ? 1 : 0);
}

// 일간 오행별 애정 표현 스타일
export const TOUCH = {
  wood: { type: '새싹형', emoji: '🌱', text: '손잡기, 포옹처럼 다정한 스킨십으로 애정을 확인하는 타입이에요. 설렘을 오래 유지하고 싶어 하고, 작은 표현에도 크게 기뻐해요.', like: '자주, 다정하게', care: '반응이 없으면 금방 서운해해요.' },
  fire: { type: '불꽃형', emoji: '🔥', text: '마음이 가면 바로 표현하는 직진형이에요. 분위기를 띄우고 먼저 다가가는 걸 좋아해요.', like: '솔직하게, 뜨겁게', care: '빨리 달아오르는 만큼 상대의 속도를 놓치기 쉬워요.' },
  earth: { type: '포근형', emoji: '🧸', text: '편안함과 안정감이 가장 중요한 타입이에요. 함께 기대 쉬는 순간, 같이 보내는 시간 자체에서 애정을 느껴요.', like: '편안하게, 천천히', care: '익숙해지면 표현이 줄어 상대가 심심해할 수 있어요.' },
  metal: { type: '보석형', emoji: '💎', text: '처음엔 절제되어 보이지만 신뢰가 쌓이면 확 열리는 타입이에요. 깔끔한 분위기와 매너를 중요하게 여겨요.', like: '정돈된 분위기에서, 확실하게', care: '마음을 열기 전엔 차가워 보일 수 있어요.' },
  water: { type: '물결형', emoji: '🌊', text: '분위기와 감성을 중시하는 타입이에요. 대화로 마음이 먼저 통해야 몸도 가까워지고, 한번 깊어지면 오래가요.', like: '분위기 있게, 깊게', care: '말하지 않은 마음을 혼자 짐작하다 지칠 수 있어요.' },
};
const LEAD = {
  strong: { label: '리드형', text: '먼저 다가가고 분위기를 이끄는 편' },
  weak: { label: '맞춤형', text: '상대의 반응을 살피며 맞춰 가는 편' },
  balanced: { label: '유연형', text: '상황에 따라 이끌기도, 맞추기도 하는 편' },
};

// 두 사람에게 함께 부족한 오행 → 분위기 처방
const MOOD = {
  wood: { light: '자연광이 드는 창가', scent: '숲·허브 향', music: '어쿠스틱 기타', place: '숲길 산책 뒤 홈데이트', color: '그린·민트' },
  fire: { light: '은은한 캔들과 따뜻한 조명', scent: '시나몬·앰버 향', music: '분위기 있는 R&B', place: '노을 맛집, 야경 루프탑', color: '레드·코랄' },
  earth: { light: '포근한 간접 조명', scent: '바닐라·우디 향', music: '잔잔한 재즈', place: '담요 덮고 홈시네마', color: '베이지·브라운' },
  metal: { light: '깔끔한 화이트 톤 조명', scent: '화이트 머스크·비누 향', music: '미니멀한 피아노', place: '정돈된 호텔·스테이', color: '화이트·실버' },
  water: { light: '푸른빛 무드등', scent: '마린·라벤더 향', music: '빗소리, 로파이', place: '바다 여행, 비 오는 밤 드라이브', color: '네이비·블루' },
};

const RHYTHM = {
  harmony: { pts: 25, short: '육합 — 리듬이 딱 맞는 사이', text: '두 사람의 배우자 자리가 "육합"이에요. 사주에서 가장 잘 맞는 스킨십 궁합으로 보는 조합이에요. 말하지 않아도 서로의 속도를 자연스럽게 맞춰요.' },
  trine: { pts: 21, short: '삼합 — 같은 박자를 타는 사이', text: '배우자 자리가 같은 삼합 그룹이에요. 함께하는 시간이 쌓일수록 호흡이 잘 맞아 가는 관계예요.' },
  same: { pts: 17, short: '같은 글자 — 서로를 잘 아는 사이', text: '배우자 자리 글자가 같아요. 취향이 비슷해서 편안하지만, 익숙함에 새로움이 줄어들지 않게 신경 써 주세요.' },
  neutral: { pts: 15, short: '무난 — 맞춰 가며 깊어지는 사이', text: '배우자 자리끼리 특별한 끌림도 충돌도 없어요. 서로 좋아하는 걸 이야기하며 맞춰 갈수록 깊어지는 관계예요.' },
  clash: { pts: 14, short: '충 — 강렬하지만 엇갈리는 리듬', text: '배우자 자리가 "충"이에요. 끌림은 강렬하지만 원하는 속도와 분위기가 달라 엇갈리기 쉬워요. 대화로 맞추면 오히려 짜릿한 사이가 돼요.' },
  wonjin: { pts: 12, short: '원진 — 밀당이 있는 사이', text: '배우자 자리가 "원진"이에요. 기분에 따라 가까워졌다 멀어졌다 하는 밀당이 있어요. 서운함을 그때그때 풀어야 거리가 생기지 않아요.' },
  punish: { pts: 10, short: '형 — 취향을 조율해야 하는 사이', text: '배우자 자리가 "형"의 관계예요. 좋아하는 방식이 달라 한쪽이 맞춰 주기만 하면 지칠 수 있어요. 서로의 취향을 존중하는 대화가 꼭 필요해요.' },
};

// 따뜻한 기운(화·목) − 차분한 기운(수·금)
const warmth = (x) => x.counts.fire + x.counts.wood * 0.5 - x.counts.water - x.counts.metal * 0.5;

export function analyzeIntimacy(a, b, nowMs = Date.now()) {
  const ages = [ageOf(a, nowMs), ageOf(b, nowMs)];
  if (ages.some((g) => g < ADULT_AGE)) {
    return { blocked: true, a, b, minors: [a, b].filter((_, i) => ages[i] < ADULT_AGE).map((x) => x.name) };
  }
  const A = nim(a), B = nim(b);
  const parts = [];

  // 1) 끌림 (25)
  let p1;
  const yinyang = a.dm % 2 !== b.dm % 2;
  if (stemsCombine(a.dm, b.dm)) p1 = { points: 25, short: '천간합 — 자석 같은 끌림', text: `${A}과 ${B}의 일간이 "천간합"이에요. 처음부터 묘하게 끌리고, 가까이 있으면 자꾸 손이 가는 강한 케미예요.` };
  else if (yinyang && (generates(a.dmEl, b.dmEl) || generates(b.dmEl, a.dmEl))) p1 = { points: 21, short: '음양이 맞물리는 상생', text: '음과 양이 만나고 한쪽이 다른 쪽을 살려 주는 관계예요. 함께 있을수록 서로를 편안하게 데워 줘요.' };
  else if (yinyang) p1 = { points: 18, short: '음양 조화 — 서로 다른 매력에 끌림', text: '한 사람은 양, 한 사람은 음의 기운이에요. 나에게 없는 매력에 끌리는, 설렘이 오래가는 조합이에요.' };
  else if (a.dmEl === b.dmEl) p1 = { points: 14, short: '같은 결 — 친구 같은 편안함', text: `두 사람 모두 ${ELEMENT_KO[a.dmEl]}(${ELEMENT_INFO[a.dmEl].name}) 기운이에요. 설렘보다는 편안함이 큰 사이라, 새로운 분위기를 일부러 만들어 주면 좋아요.` };
  else p1 = { points: 12, short: '비슷한 기운 — 천천히 데워지는 사이', text: '두 사람 모두 같은 음양이라 첫 끌림보다 시간이 지나며 깊어지는 관계예요.' };
  const peachHit = [peachBlossomBranch(a.yearBranch), peachBlossomBranch(a.dayBranch)].includes(b.dayBranch)
    || [peachBlossomBranch(b.yearBranch), peachBlossomBranch(b.dayBranch)].includes(a.dayBranch);
  if (peachHit) { p1.points = Math.min(25, p1.points + 4); p1.text += ' 게다가 한 사람의 배우자 자리가 상대의 도화(매력의 별)에 닿아 있어 끌림이 더 강해요.'; }
  parts.push({ id: 'pull', label: '끌림', icon: '🧲', max: 25, ...p1 });

  // 2) 리듬 (25)
  const r2 = branchRelation(a.dayBranch, b.dayBranch);
  parts.push({ id: 'rhythm', label: '스킨십 리듬', icon: '🎵', max: 25, points: RHYTHM[r2].pts, short: RHYTHM[r2].short, text: RHYTHM[r2].text, key: r2,
    detail: `${A} ${BRANCHES[a.dayBranch]}(${BRANCHES_KO[a.dayBranch]}) × ${B} ${BRANCHES[b.dayBranch]}(${BRANCHES_KO[b.dayBranch]})` });

  // 3) 온도 (20)
  const wa = warmth(a), wb = warmth(b);
  let p3;
  if ((wa > 0.5 && wb < -0.5) || (wb > 0.5 && wa < -0.5)) p3 = { points: 20, key: 'balance', short: '수화기제 — 뜨거움과 차분함의 균형', text: '한 사람은 따뜻한 불의 기운, 한 사람은 차분한 물의 기운이 강해요. 사주에서 "수화기제"라 부르는 이상적인 균형으로, 서로의 온도를 알맞게 맞춰 줘요.' };
  else if (wa + wb > 4) p3 = { points: 13, key: 'hot', short: '둘 다 뜨거움 — 빨리 타오르는 사이', text: '두 사람 모두 따뜻한 기운이 강해요. 금방 뜨거워지지만 그만큼 빨리 식을 수 있어서, 설렘을 오래 끄는 완급 조절이 필요해요.' };
  else if (wa + wb < -4) p3 = { points: 12, key: 'cool', short: '둘 다 차분함 — 분위기 만들기가 숙제', text: '두 사람 모두 차분한 기운이 강해요. 마음은 깊은데 표현이 느려서, 누군가 먼저 분위기를 만들어 줘야 가까워져요.' };
  else p3 = { points: 16, key: 'mild', short: '적당한 온도 차', text: '두 사람의 온도 차이가 크지 않아요. 무난하게 맞춰지는 대신, 가끔은 일부러 설레는 이벤트를 만들어 주면 좋아요.' };
  parts.push({ id: 'temp', label: '온도', icon: '🌡️', max: 20, ...p3 });

  // 4) 분위기 매력 (15)
  let p4 = 4;
  const glow = [];
  for (const x of [a, b]) {
    if (x.charms.includes('dohwa')) { p4 += 4; glow.push(`${nim(x)}의 도화(매력의 별)`); }
    if (x.charms.includes('hongyeom')) { p4 += 4; glow.push(`${nim(x)}의 홍염(분위기 미인의 별)`); }
  }
  if (peachHit) p4 += 3;
  p4 = Math.min(15, p4);
  parts.push({ id: 'glow', label: '분위기 매력', icon: '🌹', max: 15, points: p4, short: glow.length ? '은근한 분위기가 흐르는 사이' : '분위기는 함께 만들어 가는 사이', text: glow.length ? `${glow.join(', ')}이 있어 둘만 있을 때 은근한 분위기가 흘러요.` : '사주에 눈에 띄는 매력의 별은 없지만, 그래서 꾸밈없는 진심이 더 잘 통해요. 분위기는 조명·향·음악으로 충분히 만들 수 있어요.' });

  // 5) 표현 균형 (15)
  const sa = a.strength.key, sb = b.strength.key;
  let p5;
  if ((sa === 'strong' && sb === 'weak') || (sa === 'weak' && sb === 'strong')) p5 = { points: 15, short: '리드와 맞춤이 자연스러운 사이', text: `${sa === 'strong' ? A : B}이 이끌고 ${sa === 'strong' ? B : A}이 맞춰 주는 흐름이 자연스러워요. 맞춰 주는 쪽의 마음을 자주 물어봐 주면 완벽해요.` };
  else if (sa === 'strong' && sb === 'strong') p5 = { points: 8, short: '둘 다 리드하려는 사이', text: '두 사람 모두 주도하고 싶어 해요. 번갈아 리드하는 "차례"를 정하면 부딪힘이 재미로 바뀌어요.' };
  else if (sa === 'weak' && sb === 'weak') p5 = { points: 9, short: '둘 다 기다리는 사이', text: '두 사람 모두 상대가 먼저 다가와 주길 기다리는 편이에요. 작은 표현이라도 먼저 꺼내는 쪽이 관계를 데워요.' };
  else p5 = { points: 12, short: '유연하게 맞춰 가는 사이', text: '한 사람이 유연한 편이라 상황에 맞게 이끌기도, 맞추기도 해요.' };
  if (a.groupCounts.식상 >= 2 || b.groupCounts.식상 >= 2) { p5.points = Math.min(15, p5.points + 2); p5.text += ' 표현력의 별(식상)이 있어 좋은 건 좋다고 말로 전하는 힘도 있어요.'; }
  parts.push({ id: 'lead', label: '표현 균형', icon: '🤝', max: 15, ...p5 });

  const raw = parts.reduce((s, x) => s + x.points, 0);
  const score = clamp(Math.round(75 + (raw - 72) * 1.2), 40, 99);
  const grade = intimacyGrade(score);

  // 두 사람의 스타일
  const style = (x) => ({ ...TOUCH[x.dmEl], lead: LEAD[x.strength.key] });
  const styleA = style(a), styleB = style(b);

  // 강점·주의점·더 가까워지는 법
  const strengths = [], cautions = [], tips = [];
  if (p1.points >= 21) strengths.push('처음부터 끌리는 강한 케미');
  if (['harmony', 'trine'].includes(r2)) strengths.push('말하지 않아도 맞는 스킨십 리듬');
  if (p3.key === 'balance') strengths.push('뜨거움과 차분함이 균형 잡힌 온도');
  if (p4 >= 11) strengths.push('둘만 있을 때 흐르는 은근한 분위기');
  if (p5.points >= 14) strengths.push('리드와 맞춤이 자연스러운 호흡');
  if (r2 === 'clash') { cautions.push('원하는 속도와 분위기가 달라 엇갈리기 쉬워요'); tips.push('"오늘은 어떤 기분이야?"를 먼저 묻는 습관 들이기'); }
  if (r2 === 'wonjin') { cautions.push('기분에 따라 거리가 생기는 밀당이 있어요'); tips.push('서운함은 그날 풀기 — 마음이 먼저 풀려야 몸도 가까워져요'); }
  if (r2 === 'punish') { cautions.push('좋아하는 방식이 달라 한쪽이 지칠 수 있어요'); tips.push('서로 좋아하는 것·싫은 것을 3개씩 적어 교환해 보기'); }
  if (p3.key === 'hot') { cautions.push('빨리 타오른 만큼 빨리 식을 수 있어요'); tips.push('설렘을 아끼는 완급 조절 — 가끔은 손만 잡고 걷는 데이트도'); }
  if (p3.key === 'cool') { cautions.push('표현이 느려 서로 마음을 짐작만 하기 쉬워요'); tips.push('분위기는 한 사람이 먼저 — 이번 주는 A, 다음 주는 B가 데이트 무드 담당'); }
  if (sa === 'strong' && sb === 'strong') { cautions.push('둘 다 주도하려다 부딪힐 수 있어요'); tips.push('리드할 차례를 번갈아 정하기'); }
  if (sa === 'weak' && sb === 'weak') { cautions.push('둘 다 먼저 다가오길 기다리다 거리가 생길 수 있어요'); tips.push('작은 스킨십(손잡기·포옹)이라도 먼저 건네기'); }
  if (!strengths.length) strengths.push('맞춰 갈수록 깊어지는 성장형 케미');
  if (!cautions.length) cautions.push('큰 엇갈림은 적어요. 익숙함에 표현을 줄이는 것만 조심!');
  tips.push(`${A}은 ${styleA.type}이라 "${styleA.like}"를 좋아해요. ${B}이 이 방식을 기억해 주세요.`);
  tips.push(`${B}은 ${styleB.type}이라 "${styleB.like}"를 좋아해요. ${A}이 이 방식을 기억해 주세요.`);
  tips.push('좋은 것·싫은 것은 평소에 가볍게 이야기해 두기 — 말로 하기 어색하면 메시지로도 좋아요');

  // 분위기 처방: 두 사람에게 함께 부족한 기운
  const combined = Object.fromEntries(ELEMENTS.map((e) => [e, a.counts[e] + b.counts[e]]));
  const moodEl = ELEMENTS.reduce((m, e) => (combined[e] < combined[m] ? e : m), ELEMENTS[0]);
  const mood = MOOD[moodEl];

  // 설렘 지수가 높은 달
  const months = [];
  const now = new Date(nowMs + 9 * 3600000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    const ym = yearMonthPillarsAt(seoulWallToUtc(y, m, 15, 12, 0));
    const st = ym.month.stem, br = ym.month.branch;
    let s = (periodLove(a, st, br).score + periodLove(b, st, br).score) / 2;
    const why = [];
    for (const x of [a, b]) {
      if (x.peachBranches.includes(br)) { s += 6; why.push(`${nim(x)}의 도화가 피는 달`); }
      if (br === RED_FLAME[x.dm]) { s += 4; why.push(`${nim(x)}의 홍염이 뜨는 달`); }
      const rel = branchRelation(br, x.dayBranch);
      if (rel === 'harmony') { s += 5; why.push(`${nim(x)}의 배우자 자리와 합`); }
      if (rel === 'clash') { s -= 6; why.push(`${nim(x)}의 배우자 자리와 충`); }
      if (stemsCombine(st, x.dm)) { s += 4; why.push(`${nim(x)}의 일간과 합`); }
    }
    months.push({ year: y, month: m, score: clamp(Math.round(s), 12, 98), why });
    m++; if (m > 12) { m = 1; y++; }
  }
  const byDate = (p, q) => months.indexOf(p) - months.indexOf(q);
  const hot = [...months].sort((p, q) => q.score - p.score).slice(0, 2).sort(byDate);
  const rest = [...months].sort((p, q) => p.score - q.score)[0];

  return { blocked: false, a, b, parts, raw, score, grade, styleA, styleB, strengths, cautions, tips, moodEl, mood, months, hot, rest };
}

export function intimacyGrade(score) {
  if (score >= 90) return { title: '불꽃 케미', emoji: '🔥', line: '눈빛만 마주쳐도 통하는 사이다냥!' };
  if (score >= 82) return { title: '찰떡 케미', emoji: '💞', line: '속도도 온도도 잘 맞는 사이!' };
  if (score >= 74) return { title: '설렘 케미', emoji: '💗', line: '함께할수록 더 가까워지는 사이!' };
  if (score >= 66) return { title: '맞춰 가는 케미', emoji: '🌱', line: '대화할수록 호흡이 맞아 가는 사이!' };
  return { title: '천천히 데워지는 케미', emoji: '🫖', line: '서두르지 않을수록 깊어지는 사이!' };
}

export function summaryIntimacyForAI(r) {
  if (!r || r.blocked) return '';
  return [
    `속궁합(스킨십·애정 표현 궁합): ${r.a.name} × ${r.b.name} ${r.score}점 (${r.grade.title}) — ${r.parts.map((p) => `${p.label} ${p.points}/${p.max}: ${p.short}`).join(' / ')}`,
    `애정 표현 스타일: ${r.a.name} ${r.styleA.type}·${r.styleA.lead.label}, ${r.b.name} ${r.styleB.type}·${r.styleB.lead.label} / 설렘 지수 높은 달: ${r.hot.map((x) => `${x.year}.${x.month}`).join(', ')}`,
  ].join('\n');
}
