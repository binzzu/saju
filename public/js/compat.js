// 궁합 분석
import {
  ELEMENTS, ELEMENT_KO, stemsCombine, branchRelation, generates, controls,
  STEMS, STEMS_KO, BRANCHES, ANIMALS, seoulWallToUtc, yearMonthPillarsAt,
} from './saju.js';
import { hasBatchim } from './text.js';
import { DAY_MASTERS, LUCK, periodLove, ELEMENT_INFO } from './reading.js';

const BRANCH_REL_TEXT = {
  harmony: { pts: 25, short: '육합 — 찰떡같이 맞물리는 사이', text: '두 사람의 배우자 자리가 "합"을 이뤄요. 생활 리듬과 정서가 자연스럽게 맞물려, 같이 있을수록 편안해지는 관계예요.' },
  trine: { pts: 22, short: '삼합 — 같은 방향을 보는 사이', text: '배우자 자리가 같은 삼합 그룹이에요. 추구하는 방향이 비슷해서 함께 목표를 세우면 시너지가 커요.' },
  same: { pts: 16, short: '같은 기운 — 거울 같은 사이', text: '배우자 자리의 글자가 같아요. 서로를 잘 이해하지만, 단점도 닮아서 같은 지점에서 부딪힐 수 있어요.' },
  neutral: { pts: 16, short: '무난 — 서로 맞춰 가는 사이', text: '배우자 자리끼리 특별한 충돌도 끌림도 없는 무난한 관계예요. 노력하는 만큼 깊어져요.' },
  punish: { pts: 10, short: '형 — 잔소리 주의', text: '배우자 자리가 "형"의 관계예요. 서로를 고쳐 주려다 잔소리가 늘 수 있어요. 존중이 핵심!' },
  wonjin: { pts: 9, short: '원진 — 미운 정 고운 정', text: '배우자 자리가 "원진"이에요. 이유 없이 서운한 순간이 생기지만, 그만큼 정도 깊어지는 미운 정 고운 정 커플이에요.' },
  clash: { pts: 7, short: '충 — 강렬하지만 부딪히는 사이', text: '배우자 자리가 "충"이에요. 처음엔 강하게 끌리지만 생활 방식이 달라 부딪히기 쉬워요. 대신 서로를 크게 성장시키는 관계예요.' },
};

const ZODIAC_REL = { harmony: 10, trine: 10, same: 7, neutral: 7, punish: 5, wonjin: 4, clash: 3 };
const ZODIAC_TEXT = {
  harmony: '띠끼리 육합! 첫인상부터 호감이 생기기 쉬워요.',
  trine: '띠끼리 삼합! 가치관이 비슷해 대화가 잘 통해요.',
  same: '같은 띠라 서로를 잘 이해해요.',
  neutral: '띠 궁합은 무난해요.',
  punish: '띠끼리 형살이 있어 고집이 부딪힐 수 있어요.',
  wonjin: '띠끼리 원진이라 사소한 서운함이 쌓이지 않게 해 주세요.',
  clash: '띠끼리 충이라 성향 차이가 크지만, 그만큼 서로 보완돼요.',
};

export function analyzeCompat(a, b) {
  const parts = [];
  const catA = DAY_MASTERS[a.dm].cat, catB = DAY_MASTERS[b.dm].cat;

  // 1) 일간끼리 (30)
  let p1;
  const eA = a.dmEl, eB = b.dmEl;
  if (stemsCombine(a.dm, b.dm)) {
    p1 = { points: 30, short: '천간합 — 운명처럼 끌리는 자석 커플', text: `${STEMS[a.dm]}(${STEMS_KO[a.dm]})${hasBatchim(STEMS_KO[a.dm]) ? '과' : '와'} ${STEMS[b.dm]}(${STEMS_KO[b.dm]})${hasBatchim(STEMS_KO[b.dm]) ? '은' : '는'} 서로를 끌어당기는 "천간합"이에요. 처음 만났을 때부터 묘하게 끌리고, 함께하면 하나의 팀처럼 움직이는 관계예요.`, key: 'combo' };
  } else if (generates(eA, eB)) {
    p1 = { points: 25, short: `${a.name}님이 ${b.name}님을 키워 주는 상생`, text: `${a.name}님의 ${ELEMENT_KO[eA]} 기운이 ${b.name}님의 ${ELEMENT_KO[eB]} 기운을 살려 주는 상생 관계예요. ${a.name}님이 아낌없이 주고, ${b.name}님은 그 사랑 속에서 빛나요. 주는 쪽이 지치지 않게 고마움을 표현하는 게 포인트!`, key: 'giveA' };
  } else if (generates(eB, eA)) {
    p1 = { points: 25, short: `${b.name}님이 ${a.name}님을 키워 주는 상생`, text: `${b.name}님의 ${ELEMENT_KO[eB]} 기운이 ${a.name}님의 ${ELEMENT_KO[eA]} 기운을 살려 주는 상생 관계예요. ${b.name}님의 든든한 지원 속에서 ${a.name}님이 편안해져요. 받은 만큼 표현해 주면 완벽해요.`, key: 'giveB' };
  } else if (eA === eB) {
    p1 = { points: 19, short: '같은 오행 — 친구 같은 커플', text: `두 사람 모두 ${ELEMENT_KO[eA]}(${ELEMENT_INFO[eA].name}) 기운이에요. 말하지 않아도 통하는 친구 같은 커플이지만, 고집도 닮아서 양보가 필요해요.`, key: 'same' };
  } else if (controls(eA, eB)) {
    p1 = { points: 14, short: `${a.name}님이 리드하는 긴장감 커플`, text: `${a.name}님의 ${ELEMENT_KO[eA]} 기운이 ${b.name}님의 ${ELEMENT_KO[eB]} 기운을 다스리는 상극 관계예요. 적당한 긴장감과 자극이 있는 대신, ${a.name}님의 말투가 강해지면 ${b.name}님이 위축될 수 있어요.`, key: 'leadA' };
  } else {
    p1 = { points: 14, short: `${b.name}님이 리드하는 긴장감 커플`, text: `${b.name}님의 ${ELEMENT_KO[eB]} 기운이 ${a.name}님의 ${ELEMENT_KO[eA]} 기운을 다스리는 상극 관계예요. 서로에게 자극이 되지만, ${b.name}님이 너무 몰아붙이면 ${a.name}님이 지칠 수 있어요.`, key: 'leadB' };
  }
  parts.push({ id: 'dm', label: '성격 궁합', icon: '🧲', max: 30, ...p1 });

  // 2) 일지끼리 (25)
  const r2 = branchRelation(a.dayBranch, b.dayBranch);
  const t2 = BRANCH_REL_TEXT[r2];
  parts.push({ id: 'palace', label: '생활 궁합', icon: '🏠', max: 25, points: t2.pts, short: t2.short, text: t2.text, key: r2 });

  // 3) 오행 보완 (20)
  const comp = (x, y) => {
    const weak = ELEMENTS.filter((e) => x.counts[e] <= 1);
    if (!weak.length) return 0.6;
    return weak.reduce((s, e) => s + Math.min(y.counts[e], 2) / 2, 0) / weak.length;
  };
  const cAB = comp(a, b), cBA = comp(b, a);
  const p3 = Math.round(20 * (cAB + cBA) / 2);
  const fills = (x, y) => ELEMENTS.filter((e) => x.counts[e] <= 1 && y.counts[e] >= 2).map((e) => ELEMENT_KO[e]);
  const fAB = fills(a, b), fBA = fills(b, a);
  let t3;
  if (fAB.length && fBA.length) t3 = `${b.name}님은 ${a.name}님에게 부족한 ${fAB.join('·')} 기운을, ${a.name}님은 ${b.name}님에게 부족한 ${fBA.join('·')} 기운을 채워 줘요. 서로의 빈칸을 메워 주는 퍼즐 커플!`;
  else if (fAB.length) t3 = `${b.name}님이 ${a.name}님에게 부족한 ${fAB.join('·')} 기운을 채워 줘요. ${a.name}님은 ${b.name}님 곁에서 안정감을 느껴요.`;
  else if (fBA.length) t3 = `${a.name}님이 ${b.name}님에게 부족한 ${fBA.join('·')} 기운을 채워 줘요. ${b.name}님에게 ${a.name}님은 꼭 필요한 사람이에요.`;
  else t3 = '서로 부족한 기운을 직접 채워 주진 않아요. 대신 함께 새로운 경험을 쌓으면서 균형을 만들어 가는 관계예요.';
  parts.push({ id: 'elements', label: '기운 보완', icon: '🧩', max: 20, points: p3, short: fAB.length || fBA.length ? '서로의 빈칸을 채워 주는 사이' : '함께 균형을 만들어 가는 사이', text: t3 });

  // 4) 인연의 별 (15)
  let p4 = 0;
  const starNotes = [];
  if (b.dmEl === a.partner.el) { p4 += 5.5; starNotes.push(`${a.name}님 사주에서 ${b.name}님은 "인연의 별"에 해당하는 사람이에요.`); }
  if (a.dmEl === b.partner.el) { p4 += 5.5; starNotes.push(`${b.name}님 사주에서도 ${a.name}님이 "인연의 별"이에요.`); }
  if (b.dmEl === a.lucky) { p4 += 2; starNotes.push(`${b.name}님은 ${a.name}님의 행운 오행(${ELEMENT_KO[a.lucky]})을 가진 복덩이!`); }
  if (a.dmEl === b.lucky) { p4 += 2; starNotes.push(`${a.name}님은 ${b.name}님의 행운 오행(${ELEMENT_KO[b.lucky]})을 가진 복덩이!`); }
  if (!starNotes.length) starNotes.push('사주 속 "운명의 별" 표시는 약하지만, 그래서 더 자유롭게 서로를 알아 가는 관계예요. 인연은 만들어 가는 것!');
  p4 = Math.min(15, Math.round(p4));
  parts.push({ id: 'star', label: '운명 지수', icon: '⭐', max: 15, points: p4 || 4, short: p4 >= 9 ? '서로가 서로의 인연의 별' : p4 >= 4 ? '한쪽에게 특별한 인연' : '만들어 가는 인연', text: starNotes.join(' ') });

  // 5) 띠 궁합 (10)
  const r5 = branchRelation(a.yearBranch, b.yearBranch);
  parts.push({ id: 'zodiac', label: '띠 궁합', icon: '🐾', max: 10, points: ZODIAC_REL[r5], short: `${ANIMALS[a.yearBranch]}띠 × ${ANIMALS[b.yearBranch]}띠`, text: ZODIAC_TEXT[r5], key: r5 });

  const raw = parts.reduce((s, p) => s + p.points, 0);
  const score = Math.min(99, Math.round(40 + raw * 0.58));
  const g = compatGrade(score);

  // 강점·주의점·해결책
  const strengths = [], cautions = [], tips = [];
  if (p1.key === 'combo') strengths.push('만나면 자석처럼 끌리는 강한 케미');
  if (p1.key === 'giveA' || p1.key === 'giveB') strengths.push('한쪽이 다른 쪽을 키워 주는 따뜻한 관계');
  if (p1.key === 'same') { strengths.push('말 안 해도 통하는 친구 같은 편안함'); cautions.push('닮은 고집 때문에 같은 문제로 반복해서 다툴 수 있어요'); tips.push('다툼 주제를 메모해 두고, 같은 주제는 "합의된 규칙"으로 정리하기'); }
  if (p1.key === 'leadA' || p1.key === 'leadB') {
    const leader = p1.key === 'leadA' ? a.name : b.name;
    cautions.push(`${leader}님의 강한 표현이 상대를 위축시킬 수 있어요`);
    tips.push(`${leader}님은 "~해"보다 "~하면 어때?" 제안형 말투 쓰기`);
  }
  if (['harmony', 'trine'].includes(r2)) strengths.push('생활 리듬과 정서가 잘 맞는 편안함');
  if (r2 === 'clash') { cautions.push('생활 방식·가치관 차이로 충돌하기 쉬워요'); tips.push('데이트 빈도, 연락 횟수 같은 "생활 규칙"을 초반에 정해 두기'); }
  if (r2 === 'wonjin') { cautions.push('이유 없이 서운한 감정이 쌓이기 쉬워요'); tips.push('일주일에 한 번 "서운했던 것 1개, 고마웠던 것 1개" 나누기'); }
  if (r2 === 'punish') { cautions.push('서로를 바꾸려다 잔소리가 늘 수 있어요'); tips.push('고쳐 줬으면 하는 건 한 번에 하나만 부탁하기'); }
  if (fAB.length || fBA.length) strengths.push('서로에게 부족한 기운을 채워 주는 보완 관계');
  if (p4 >= 9) strengths.push('사주 속 인연의 별이 서로를 가리키는 운명 커플');
  if (!cautions.length) cautions.push('큰 충돌 요소는 적어요. 다만 익숙함에 표현을 줄이는 건 금물!');
  if (!strengths.length) strengths.push('노력할수록 단단해지는 성장형 관계');

  // 함께 채우면 좋은 오행 → 데이트 추천
  const combined = Object.fromEntries(ELEMENTS.map((e) => [e, a.counts[e] + b.counts[e]]));
  const coupleEl = ELEMENTS.reduce((m, e) => (combined[e] < combined[m] ? e : m), ELEMENTS[0]);
  const coupleLuck = LUCK[coupleEl];
  tips.push(`두 사람에게 함께 부족한 ${ELEMENT_KO[coupleEl]}(${ELEMENT_INFO[coupleEl].name}) 기운을 데이트로 채워 보세요: ${coupleLuck.places.slice(0, 3).join(', ')}`);
  tips.push(`커플 아이템은 ${coupleLuck.color} 계열이 행운을 불러요.`);
  tips.push(...DAY_MASTERS[a.dm].tips.slice(0, 1).map((t) => `${a.name}님께: ${t}`));
  tips.push(...DAY_MASTERS[b.dm].tips.slice(0, 1).map((t) => `${b.name}님께: ${t}`));

  // 함께 좋은 달
  const months = [];
  const now = new Date(Date.now() + 9 * 3600000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    const ym = yearMonthPillarsAt(seoulWallToUtc(y, m, 15, 12, 0));
    const sa = periodLove(a, ym.month.stem, ym.month.branch).score;
    const sb = periodLove(b, ym.month.stem, ym.month.branch).score;
    months.push({ year: y, month: m, score: Math.round((sa + sb) / 2) });
    m++; if (m > 12) { m = 1; y++; }
  }
  const bestMonths = [...months].sort((p, q) => q.score - p.score).slice(0, 2);

  return {
    a, b, catA, catB, parts, raw, score, grade: g,
    strengths, cautions, tips, coupleEl, coupleLuck, months, bestMonths,
  };
}

export function compatGrade(score) {
  if (score >= 92) return { title: '천생연분', emoji: '💞', line: '하늘이 맺어 준 인연이다냥!' };
  if (score >= 84) return { title: '찰떡궁합', emoji: '💘', line: '함께라서 더 빛나는 커플!' };
  if (score >= 76) return { title: '설렘 가득 궁합', emoji: '💗', line: '서로에게 좋은 영향을 주는 사이!' };
  if (score >= 68) return { title: '노력형 궁합', emoji: '🌱', line: '맞춰 갈수록 단단해지는 사이!' };
  return { title: '티격태격 성장형', emoji: '🔥', line: '부딪히며 함께 크는 사이!' };
}

export { STEMS, BRANCHES };
