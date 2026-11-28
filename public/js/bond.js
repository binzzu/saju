// 🤝 우정·가족 궁합 — 연애가 아닌 친구·형제자매·부모와 자녀·동료 사이를 사주로 본다
import { ELEMENTS, ELEMENT_KO, STEMS, branchRelation, stemsCombine, generates, controls } from './saju.js';
import { ELEMENT_INFO, LUCK } from './reading.js';

export const BOND_KINDS = {
  friend: { label: '친구', emoji: '🤝', noun: '친구' },
  sibling: { label: '형제자매', emoji: '👫', noun: '형제자매' },
  family: { label: '부모·자녀', emoji: '👨‍👩‍👧', noun: '가족' },
  work: { label: '동료', emoji: '💼', noun: '동료' },
};

const GRADE = {
  friend: ['평생 단짝', '찐친', '좋은 친구', '티격태격 친구'],
  sibling: ['세상 둘도 없는 남매·자매', '든든한 형제자매', '무난한 형제자매', '투닥투닥 형제자매'],
  family: ['서로가 자랑인 가족', '따뜻한 가족', '무난한 가족', '서로 배워 가는 가족'],
  work: ['환상의 콤비', '손발이 맞는 동료', '무난한 동료', '긴장감 있는 라이벌'],
};
const TOGETHER = {
  friend: { wood: '산책·등산, 같이 배우는 원데이 클래스', fire: '콘서트·축제, 사진 찍으러 가기', earth: '맛집 탐방, 집에서 영화 보기', metal: '전시회·쇼핑, 깔끔한 카페 투어', water: '밤 산책과 긴 수다, 바다 여행' },
  sibling: { wood: '같이 운동 루틴 만들기', fire: '가족 행사 같이 준비하기', earth: '같이 요리해서 부모님 대접하기', metal: '같이 집 정리·쇼핑하기', water: '어릴 적 사진 꺼내 보며 수다' },
  family: { wood: '주말 공원 나들이', fire: '외식과 기념일 이벤트', earth: '함께 밥 짓고 먹는 저녁', metal: '함께 계획 세우는 여행', water: '자기 전 짧은 대화 시간' },
  work: { wood: '새 프로젝트 아이디어 회의', fire: '발표·행사 같이 준비하기', earth: '점심 루틴 만들기', metal: '역할을 분명히 나눈 업무 분담', water: '조용히 몰입하는 협업 시간' },
};
const TALK_TO = {
  wood: '꿈과 계획을 응원해 주는 말이 잘 통해요.', fire: '반응을 크게, 칭찬을 바로 해 주면 좋아해요.',
  earth: '천천히 들어 주고 약속을 지키면 마음을 열어요.', metal: '돌려 말하지 말고 깔끔하게 말하는 걸 좋아해요.',
  water: '결론보다 감정을 먼저 들어 주면 좋아해요.',
};
const REL_LINE = {
  harmony: { pts: 8, good: '생활 리듬이 잘 맞아 같이 있으면 편해요' },
  trine: { pts: 6, good: '가치관이 비슷해서 대화가 잘 통해요' },
  same: { pts: 2, good: '서로를 거울처럼 잘 이해해요' },
  neutral: { pts: 0 },
  punish: { pts: -4, bad: '서로 고쳐 주려다 잔소리가 늘기 쉬워요' },
  wonjin: { pts: -6, bad: '사소한 말에 서운함이 쌓이기 쉬워요' },
  clash: { pts: -8, bad: '생활 방식이 달라 부딪히기 쉬워요' },
};

export function analyzeBond(a, b, kind = 'friend') {
  const K = BOND_KINDS[kind] ? kind : 'friend';
  const good = [], bad = [];
  let base, line;
  if (stemsCombine(a.dm, b.dm)) { base = 90; line = `${STEMS[a.dm]}·${STEMS[b.dm]} 천간합! 처음부터 묘하게 잘 통하는 사이예요.`; good.push('만나면 금방 하나의 팀이 돼요'); }
  else if (generates(a.dmEl, b.dmEl)) { base = 84; line = `${a.name}님의 ${ELEMENT_KO[a.dmEl]} 기운이 ${b.name}님의 ${ELEMENT_KO[b.dmEl]} 기운을 살려 줘요. ${a.name}님이 챙겨 주는 쪽이에요.`; good.push(`${a.name}님이 든든한 버팀목이 돼 줘요`); }
  else if (generates(b.dmEl, a.dmEl)) { base = 84; line = `${b.name}님의 ${ELEMENT_KO[b.dmEl]} 기운이 ${a.name}님의 ${ELEMENT_KO[a.dmEl]} 기운을 살려 줘요. ${b.name}님이 챙겨 주는 쪽이에요.`; good.push(`${b.name}님 곁에 있으면 힘이 나요`); }
  else if (a.dmEl === b.dmEl) { base = 78; line = `두 사람 모두 ${ELEMENT_KO[a.dmEl]}(${ELEMENT_INFO[a.dmEl].name}) 기운이에요. 말 안 해도 통하지만 고집도 닮았어요.`; good.push('취향과 속도가 비슷해요'); bad.push('둘 다 양보를 안 해서 같은 문제로 다투기 쉬워요'); }
  else if (controls(a.dmEl, b.dmEl)) { base = 66; line = `${a.name}님의 기운이 ${b.name}님을 다스리는 관계예요. ${a.name}님 말이 세게 들릴 수 있어요.`; bad.push(`${a.name}님의 조언이 ${b.name}님에게 잔소리로 들릴 수 있어요`); }
  else { base = 66; line = `${b.name}님의 기운이 ${a.name}님을 다스리는 관계예요. ${b.name}님 말이 세게 들릴 수 있어요.`; bad.push(`${b.name}님의 조언이 ${a.name}님에게 잔소리로 들릴 수 있어요`); }

  const r1 = branchRelation(a.dayBranch, b.dayBranch), r2 = branchRelation(a.yearBranch, b.yearBranch);
  const R1 = REL_LINE[r1], R2 = REL_LINE[r2];
  if (R1.good) good.push(R1.good);
  if (R1.bad) bad.push(R1.bad);
  if (R2.good && R2.good !== R1.good) good.push(`띠끼리도 잘 맞아요 — ${R2.good}`);
  const g = (x, k) => x.groupCounts[k] || 0;
  if (g(a, '식상') >= 2 && g(b, '식상') >= 2) good.push('둘 다 표현력이 좋아 수다가 끊이지 않아요');
  if (g(a, '비겁') >= 2 && g(b, '비겁') >= 2) { good.push('의리가 강한 사이예요'); bad.push('둘 다 자존심이 세서 먼저 사과하기 어려워요'); }
  if (K === 'work' && (g(a, '관성') >= 2 || g(b, '관성') >= 2)) good.push('책임감 있게 일을 끝까지 해내요');
  if (!good.length) good.push('맞춰 갈수록 편해지는 사이예요');
  if (!bad.length) bad.push('큰 충돌은 적어요. 다만 익숙함에 고마움 표현이 줄지 않게!');

  const score = Math.max(40, Math.min(98, Math.round(base + R1.pts + R2.pts * 0.5)));
  const gi = score >= 86 ? 0 : score >= 76 ? 1 : score >= 64 ? 2 : 3;
  const combined = Object.fromEntries(ELEMENTS.map((e) => [e, a.counts[e] + b.counts[e]]));
  const lack = ELEMENTS.reduce((m, e) => (combined[e] < combined[m] ? e : m), ELEMENTS[0]);
  return {
    a, b, kind: K, kindInfo: BOND_KINDS[K], score, grade: GRADE[K][gi], line, good: good.slice(0, 3), bad: bad.slice(0, 2),
    together: TOGETHER[K][lack], lackEl: lack, place: LUCK[lack].places[0],
    talkA: `${b.name}님에게 말할 때: ${TALK_TO[b.dmEl]}`, talkB: `${a.name}님에게 말할 때: ${TALK_TO[a.dmEl]}`,
  };
}
