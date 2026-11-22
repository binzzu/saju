// 💍 결혼운 — 앞으로 10년 중 결혼·약속 기운이 강한 해, 결혼 상대 유형, 결혼 후 생활, (상대가 있으면) 결혼 궁합
import { BRANCH_ELEMENT, ANIMALS, yearPillarOf, yearMonthPillarsAt, branchRelation } from './saju.js';
import { periodLove, ELEMENT_INFO } from './reading.js';
import { analyzeCompat } from './compat.js';

const BONUS = { jeong: 9, harmony: 6, stemCombo: 6, partner: 4, trine: 3 };

const LIFE = {
  wood: { title: '함께 자라는 성장형 부부', text: '서로의 꿈을 응원하며 같이 크는 부부예요. 공부·이직·창업 같은 도전을 함께 계획할 때 사이가 더 좋아져요.', house: '햇빛 잘 드는 집, 화분이 많은 거실' },
  fire: { title: '웃음이 끊이지 않는 열정형 부부', text: '집에 늘 음악과 수다가 흐르는 활기찬 부부예요. 다툼도 빠르지만 화해도 빨라요. 기념일 이벤트가 큰 힘이 돼요.', house: '친구를 자주 초대하는 밝은 집' },
  earth: { title: '든든한 둥지형 부부', text: '안정과 신뢰가 가장 큰 무기인 부부예요. 저축·집 마련처럼 함께 쌓아 가는 목표가 있을 때 행복이 커요.', house: '정리 잘 된 아늑한 집, 큰 식탁' },
  metal: { title: '규칙이 분명한 파트너형 부부', text: '역할과 약속이 분명한 깔끔한 부부예요. 집안일·경제 규칙을 처음에 정해 두면 다툼이 거의 없어요.', house: '미니멀하고 깔끔한 집' },
  water: { title: '대화가 깊은 감성형 부부', text: '밤늦게까지 이야기 나누는 친구 같은 부부예요. 서로의 혼자 있는 시간을 존중해 주면 오래 깊어져요.', house: '조용한 동네, 물가 산책길 가까운 집' },
};
const ROLE = {
  재성: '💰 살림과 가계부를 꼼꼼히 챙기는 "경제 장관"',
  식상: '🍳 요리와 분위기를 책임지는 "집안 분위기 메이커"',
  인성: '🫶 가족을 돌보고 마음을 살피는 "돌봄 담당"',
  관성: '📋 일정과 약속을 챙기는 "살림 매니저"',
  비겁: '🤝 집안일도 반반, 친구 같은 "공동 대표"',
};

export function analyzeMarriage(a, b = null, nowMs = Date.now()) {
  const cur = yearMonthPillarsAt(nowMs).sajuYear;
  const birthYear = a.solar ? a.solar.year : a.person.year;
  const years = [];
  for (let k = 0; k < 10; k++) {
    const y = cur + k;
    const p = yearPillarOf(y);
    const love = periodLove(a, p.stem, p.branch);
    let score = love.score + love.good.reduce((t, key) => t + (BONUS[key] || 0), 0);
    if (a.partner.inSpousePalace && love.good.includes('jeong')) score += 3;
    score = Math.max(10, Math.min(99, Math.round(score)));
    years.push({ year: y, age: y - birthYear, animal: ANIMALS[p.branch], score, reason: love.reason, good: love.good });
  }
  const adult = years.filter((x) => x.age >= 20);
  const pool = adult.length ? adult : years;
  const top = [...pool].sort((p, q) => q.score - p.score)[0];
  const best = [...pool].sort((p, q) => q.score - p.score).slice(0, 3).sort((p, q) => p.year - q.year);
  const avoid = [...pool].sort((p, q) => p.score - q.score)[0];

  const palaceEl = BRANCH_ELEMENT[a.dayBranch];
  const life = LIFE[palaceEl];
  const topGroup = Object.keys(a.groupCounts).sort((p, q) => a.groupCounts[q] - a.groupCounts[p])[0];
  const notes = [];
  if (a.charms.includes('yeokma')) notes.push('역마의 기운이 있어 이사·출장이 잦을 수 있어요. 함께 여행하는 루틴이 부부 사이를 지켜 줘요.');
  if (a.charms.includes('dohwa')) notes.push('결혼 후에도 인기가 많은 사주예요. 배우자를 안심시키는 작은 표현을 자주 해 주세요.');
  if (a.partner.inSpousePalace) notes.push('배우자 자리에 배우자의 별이 앉아 있어, 결혼 인연이 탄탄한 사주예요.');
  if (a.partner.count === 0) notes.push('사주에 배우자 별이 숨어 있어, 운에서 그 별이 들어오는 해에 결혼 이야기가 빠르게 진행될 수 있어요.');
  if (a.strength.key === 'strong') notes.push('주관이 뚜렷한 편이라 큰 결정은 "같이 정하기" 규칙을 만들어 두면 좋아요.');
  if (a.strength.key === 'weak') notes.push('배우자에게 기대고 싶은 마음이 큰 편이에요. 서운함은 쌓아 두지 말고 그날그날 말해 주세요.');

  let withPartner = null;
  if (b) {
    const c = analyzeCompat(a, b);
    const rel = branchRelation(a.dayBranch, b.dayBranch);
    const REL = {
      harmony: '배우자 자리끼리 합! 생활 리듬이 잘 맞는 결혼 궁합이에요.', trine: '배우자 자리가 같은 방향을 봐요. 함께 목표를 세우면 잘 사는 부부예요.',
      same: '배우자 자리가 같아 서로를 잘 이해해요. 고집이 겹치는 부분만 조율하면 돼요.', neutral: '무난한 생활 궁합이에요. 맞춰 갈수록 편해져요.',
      punish: '생활 습관에서 잔소리가 생기기 쉬워요. 집안 규칙을 미리 정해 두세요.', wonjin: '사소한 서운함이 쌓이기 쉬워요. 주 1회 대화 시간을 꼭 만드세요.',
      clash: '생활 방식이 달라 부딪히기 쉬워요. 대신 서로의 빈 곳을 채워 주는 부부가 될 수 있어요.',
    };
    const score = Math.round(c.score * 0.7 + ({ harmony: 95, trine: 88, same: 75, neutral: 72, punish: 60, wonjin: 58, clash: 55 }[rel]) * 0.3);
    withPartner = { name: b.name, score, compat: c.score, rel, line: REL[rel], grade: score >= 85 ? '💞 결혼 찰떡' : score >= 75 ? '💗 결혼 순항' : score >= 65 ? '🌱 맞춰 가는 부부' : '🔥 성장형 부부' };
  }
  const tips = [
    '결혼 이야기는 돈·집·가족 세 가지부터 가볍게 나눠 보세요.',
    `${life.title}에게는 "${life.house}"이 잘 어울려요.`,
    `좋은 해 중에서도 ${top.year}년이 가장 기운이 좋아요. 상견례·프러포즈 같은 큰 약속은 이때 잡아 보세요.`,
  ];
  return {
    a, years, best, top, avoid, life, role: ROLE[topGroup], notes, withPartner, tips,
    spouse: a.spouse, partnerPerson: ELEMENT_INFO[a.partner.el].person,
  };
}

export function summaryMarriageForAI(r) {
  if (!r) return '';
  return `결혼운: 좋은 해 ${r.best.map((y) => `${y.year}년(${y.score}점, ${y.reason.label})`).join(', ')} / 조심할 해 ${r.avoid.year}년 / 결혼 생활 "${r.life.title}"${r.withPartner ? ` / ${r.withPartner.name}님과 결혼 궁합 ${r.withPartner.score}점` : ''}`;
}
