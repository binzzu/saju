// 이별수 분석 — 두 사람(A, B)의 사주로 이별 위험 요인·위험 시기·이별 패턴·막는 법을 계산한다.
// 사주의 "이별수"는 정해진 결말이 아니라 부딪히기 쉬운 지점과 시기를 알려 주는 신호로 다룬다.
import {
  ELEMENTS, ELEMENT_KO, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, ANIMALS, BRANCH_MAIN_STEM,
  branchRelation, stemsCombine, generates, controls, tenGod, yearPillarOf, yearMonthPillarsAt, seoulWallToUtc,
} from './saju.js';
import { DAY_MASTERS, LUCK, ELEMENT_INFO } from './reading.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nim = (p) => `${p.name}님`;

// 고신살(남)·과숙살(여): 연지의 계절 묶음 기준
const SEASON = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3]; // 0 봄(寅卯辰) 1 여름 2 가을 3 겨울
const GOSHIN = [5, 8, 11, 2];
const GWASUK = [1, 4, 7, 10];

/* ───────────── 각자의 사주에 있는 이별 신호 ───────────── */

export function personalSignals(p) {
  const out = [];
  const n = nim(p);
  const g = p.godCounts, gc = p.groupCounts;
  const others = p.positions.filter((x) => !x.empty && x.key !== 'day').map((x) => x.branch);
  const rels = others.map((b) => branchRelation(p.dayBranch, b));
  const palace = `${BRANCHES[p.dayBranch]}(${BRANCHES_KO[p.dayBranch]})`;

  if (rels.includes('clash')) {
    out.push({
      id: 'palaceClash', who: p, pts: 7, icon: '🌪️', label: '배우자 자리가 흔들리는 사주',
      text: `${n} 사주에서 배우자 자리(일지 ${palace})가 다른 글자와 "충"을 이뤄요. 연애에 변화가 잦고, 마음이 한곳에 머무르기까지 시간이 걸리는 편이에요.`,
      fix: `${n}은 관계에 "새로움"을 일부러 넣어 주세요. 처음 가 보는 동네, 같이 배우는 취미처럼 변화를 둘이 함께 겪으면 흔들림이 설렘으로 바뀌어요.`,
    });
  } else if (rels.includes('wonjin') || rels.includes('punish')) {
    out.push({
      id: 'palaceRub', who: p, pts: 4, icon: '🌀', label: '배우자 자리의 잔마찰',
      text: `${n} 배우자 자리(일지 ${palace})가 사주 안의 다른 글자와 원진·형으로 긁혀 있어요. 큰 싸움보다 사소한 서운함이 생기기 쉬워요.`,
      fix: `${n}은 서운한 일이 생기면 그날 안에 한 줄로 말해 주세요. "아까 그 말은 좀 서운했어" 정도면 충분해요.`,
    });
  }

  if (p.gender === 'F') {
    const sg = g['상관'] || 0;
    if (sg >= 2 || (sg >= 1 && gc['식상'] >= 3)) {
      out.push({
        id: 'sanggwan', who: p, pts: 8, icon: '🗡️', label: '말이 칼이 되는 상관',
        text: `${n} 사주엔 표현력의 별 "상관"이 강해요. 말솜씨가 매력이지만, 감정이 격해지면 연인(관성)을 찌르는 말이 나오기 쉬워서 사주에서 대표적인 이별 신호로 봐요.`,
        fix: `${n}은 화났을 때 "지금 말하면 후회할 것 같아, 30분 뒤에 얘기하자"를 먼저 꺼내세요. 상처 주는 말은 한 번 나가면 주워 담기 어려워요.`,
      });
    }
  } else if (gc['비겁'] >= 3) {
    out.push({
      id: 'rivals', who: p, pts: 8, icon: '⚔️', label: '친구·돈이 끼어드는 비겁',
      text: `${n} 사주엔 나와 같은 기운(비견·겁재)이 많아요. 친구·동료·돈 문제가 연애 사이에 끼어들거나, 연인보다 내 사람들을 먼저 챙기다 서운함을 사기 쉬워요.`,
      fix: `${n}은 "연인과의 선약이 친구 약속보다 먼저"라는 원칙을 정하고, 돈 문제(빌려주기·보증)는 연인과 먼저 상의하세요.`,
    });
  }
  if (p.partner.hasJeong && p.partner.hasPyeon) {
    out.push({
      id: 'mixed', who: p, pts: 4, icon: '⚖️', label: '인연의 별이 둘',
      text: `${n} 사주엔 안정적인 인연(${p.partner.jeongName})과 자극적인 인연(${p.partner.pyeonName})이 함께 있어요. 편안함과 설렘 사이에서 마음이 흔들리거나, 다른 사람과 비교하기 쉬워요.`,
      fix: `${n}은 비교하는 마음이 들 때 지금 연인이 해 준 고마운 일 3가지를 적어 보세요. 흔들림은 "부족함"이 아니라 "익숙함"에서 와요.`,
    });
  }
  if (p.partner.count === 0) {
    out.push({
      id: 'noStar', who: p, pts: 3, icon: '🫥', label: '숨어 있는 인연의 별',
      text: `${n} 사주엔 연인을 뜻하는 별(${p.partner.group})이 겉으로 드러나 있지 않아요. 일이나 내 생활에 몰두하다 보면 연인이 "관심이 없다"고 느끼기 쉬워요.`,
      fix: `${n}은 연락·데이트를 달력에 "고정 일정"으로 넣어 두세요. 마음이 없어서가 아니라 잊어버리는 거라는 걸 행동으로 보여 주는 게 중요해요.`,
    });
  }
  const loneBranch = p.gender === 'M' ? GOSHIN[SEASON[p.yearBranch]] : GWASUK[SEASON[p.yearBranch]];
  const notYear = p.positions.filter((x) => !x.empty && x.key !== 'year').map((x) => x.branch);
  if (notYear.includes(loneBranch)) {
    const nm = p.gender === 'M' ? '고신살' : '과숙살';
    out.push({
      id: 'lonely', who: p, pts: 4, icon: '🌙', label: `혼자만의 시간이 필요한 ${nm}`,
      text: `${n} 사주에 ${nm}이 있어요. 혼자 있는 시간이 꼭 필요한 기운이라, 그 거리감을 연인이 "마음이 식었다"로 오해하기 쉬워요.`,
      fix: `${n}은 "오늘은 혼자 충전하는 날"이라고 미리 알려 주는 신호를 정해 두세요. 이유를 알면 상대도 불안해하지 않아요.`,
    });
  }
  if (p.peachCount >= 3 || (p.charms.includes('dohwa') && p.charms.includes('hongyeom'))) {
    out.push({
      id: 'temptation', who: p, pts: 4, icon: '🌸', label: '관심이 몰리는 도화',
      text: `${n} 사주엔 매력의 별(도화·홍염)이 강해 주변의 관심이 많아요. 매력 자체는 장점이지만, 연인이 불안해하거나 오해가 생기기 쉬워요.`,
      fix: `${n}은 이성 친구와의 약속을 먼저 공유하고, 애매한 연락은 선을 분명히 그어 주세요. "투명함"이 가장 강한 안심 장치예요.`,
    });
  }
  return out;
}

/* ───────────── 두 사람 사이의 요인 ───────────── */

const PALACE = {
  clash: { pts: 22, short: '배우자 자리끼리 충 — 강하게 끌리지만 크게 부딪힘', text: (a, b) => `두 사람의 배우자 자리(일지)가 정면으로 부딪히는 "충"이에요. 처음엔 서로 다른 점에 끌리지만, 생활 방식(연락·시간·돈)이 달라서 같은 문제로 반복해서 다투기 쉬워요. 사주에서 가장 대표적인 이별수예요.`, fix: ['연락 빈도·데이트 횟수·비용 분담 같은 "생활 규칙"을 말로 정해 두기', '같은 주제로 세 번 싸웠다면 감정 말고 규칙으로 정리하기'] },
  wonjin: { pts: 16, short: '원진 — 이유 없는 서운함이 쌓이는 사이', text: () => '배우자 자리가 "원진"이에요. 크게 싸우지 않아도 말투·표정 하나에 서운함이 생기고, 그게 말없이 쌓이다 한 번에 터지기 쉬워요. 미운 정 고운 정이 깊은 만큼 서운함 관리가 핵심이에요.', fix: ['일주일에 한 번 "서운했던 것 1개 + 고마웠던 것 1개" 나누기', '중요한 이야기는 카톡 말고 얼굴 보고 하기'] },
  punish: { pts: 12, short: '형 — 고쳐 주려다 잔소리가 되는 사이', text: () => '배우자 자리가 "형"의 관계예요. 서로를 더 낫게 만들고 싶은 마음이 잔소리와 간섭으로 바뀌기 쉬워요. 상대가 "나를 있는 그대로 안 봐 준다"고 느끼는 순간이 위험해요.', fix: ['고쳐 줬으면 하는 건 한 번에 하나만, 부탁형으로 말하기', '각자의 개인 시간과 영역을 정해서 지켜 주기'] },
  same: { pts: 7, short: '같은 글자 — 닮아서 부딪히는 사이', text: () => '배우자 자리 글자가 같아요. 서로를 잘 이해하지만 단점도 닮아서, 같은 지점에서 동시에 예민해지기 쉬워요.', fix: ['둘 다 예민한 날을 서로 알려 주는 신호 정하기(예: "오늘 방전 🔋")'] },
  neutral: { pts: 3, short: '무난 — 특별한 충돌은 없는 사이', text: () => '배우자 자리끼리 특별한 충돌도 끌림도 없어요. 큰 위기는 적지만, 노력이 줄면 관계도 그만큼 옅어지는 사이예요.', fix: ['한 달에 한 번은 처음 해 보는 데이트로 "새로움" 채우기'] },
  trine: { pts: -6, short: '삼합 — 같은 방향을 보는 사이', text: () => '배우자 자리가 같은 삼합 그룹이에요. 추구하는 방향이 비슷해서, 위기가 와도 "우리 목표"를 떠올리면 다시 뭉치는 힘이 있어요.', fix: [] },
  harmony: { pts: -12, short: '육합 — 찰떡같이 맞물리는 사이', text: () => '배우자 자리가 "육합"을 이뤄요. 생활 리듬과 정서가 자연스럽게 맞물려, 다퉈도 금방 원래 자리로 돌아오는 복원력이 강해요.', fix: [] },
};

const ZODIAC = { clash: 7, wonjin: 6, punish: 4, same: 1, neutral: 0, trine: -3, harmony: -4 };

function coupleFactors(a, b) {
  const F = [];
  const A = nim(a), B = nim(b);

  // 1) 배우자 자리(일지)끼리
  const r = branchRelation(a.dayBranch, b.dayBranch);
  const pz = PALACE[r];
  F.push({ id: `palace_${r}`, icon: '🏠', label: '배우자 자리 궁합', pts: pz.pts, short: pz.short, text: pz.text(a, b), fixes: pz.fix,
    detail: `${A} ${BRANCHES[a.dayBranch]}(${BRANCHES_KO[a.dayBranch]}) × ${B} ${BRANCHES[b.dayBranch]}(${BRANCHES_KO[b.dayBranch]})` });

  // 2) 일간끼리 — 마음의 주도권
  const eA = a.dmEl, eB = b.dmEl;
  const starAB = b.dmEl === a.partner.el; // B가 A의 인연의 별
  const starBA = a.dmEl === b.partner.el;
  let dm;
  if (stemsCombine(a.dm, b.dm)) {
    dm = { id: 'dm_combo', pts: -10, short: '천간합 — 떨어져도 다시 끌어당기는 자석', text: `${A}과 ${B}의 일간이 "천간합"을 이뤄요. 다퉈서 멀어져도 다시 서로를 찾게 되는, 이별을 막아 주는 가장 강한 끈이에요.`, fixes: [] };
  } else if (generates(eA, eB) || generates(eB, eA)) {
    const giver = generates(eA, eB) ? a : b, taker = giver === a ? b : a;
    dm = { id: 'dm_give', pts: -4, giverId: giver === a ? 'a' : 'b', short: `${nim(giver)}이 ${nim(taker)}을 키워 주는 상생`, text: `${nim(giver)}의 ${ELEMENT_KO[giver.dmEl]} 기운이 ${nim(taker)}의 ${ELEMENT_KO[taker.dmEl]} 기운을 살려 줘요. 따뜻한 관계지만, 주는 쪽이 지쳐서 "나만 노력한다"고 느끼는 순간이 이별의 씨앗이 돼요.`, fixes: [`${nim(taker)}은 받은 마음을 말로 돌려주기 — "고마워"를 하루 한 번`, `${nim(giver)}은 힘들 땐 참지 말고 "나도 챙김이 필요해"라고 말하기`] };
  } else if (eA === eB) {
    dm = { id: 'dm_same', pts: a.dm === b.dm ? 8 : 6, short: '같은 오행 — 자존심이 평행선을 그리는 사이', text: `두 사람 모두 ${ELEMENT_KO[eA]}(${ELEMENT_INFO[eA].name}) 기운이에요. 말 안 해도 통하지만, 고집도 닮아서 다투면 둘 다 먼저 숙이지 않는 평행선이 되기 쉬워요.`, fixes: ['싸운 뒤 먼저 연락하는 순서를 번갈아 하기로 미리 정하기', '이기고 지는 대화 대신 "우리 둘 다 맞을 수 있어"로 시작하기'] };
  } else {
    const ctrl = controls(eA, eB) ? a : b, under = ctrl === a ? b : a;
    const star = ctrl === a ? starBA : starAB; // 다스리는 쪽이 상대의 인연의 별이면 긴장감이 설렘으로
    const harsh = tenGod(under.dm, ctrl.dm) === '편관';
    const pts = star ? 4 : harsh ? 13 : 9;
    dm = { id: 'dm_control', pts, ctrlId: ctrl === a ? 'a' : 'b', short: `${nim(ctrl)}이 주도권을 쥐는 상극`, text: `${nim(ctrl)}의 ${ELEMENT_KO[ctrl.dmEl]} 기운이 ${nim(under)}의 ${ELEMENT_KO[under.dmEl]} 기운을 누르는 상극 관계예요.${star ? ` 다만 ${nim(under)} 사주에서 ${nim(ctrl)}은 인연의 별이라, 이 긴장감이 끌림으로도 작용해요.` : ''} ${nim(ctrl)}의 말투가 강해질수록 ${nim(under)}이 조용히 지쳐 가는 게 이 관계의 위험 신호예요.`, fixes: [`${nim(ctrl)}은 "~해" 대신 "~하면 어때?" 제안형으로 말하기`, `${nim(under)}은 참다가 터뜨리지 말고 불편한 건 그때그때 말하기`] };
  }
  F.push({ icon: '🧲', label: '마음의 주도권', ...dm, detail: `${A} ${STEMS[a.dm]}(${STEMS_KO[a.dm]}) × ${B} ${STEMS[b.dm]}(${STEMS_KO[b.dm]})` });

  // 3) 서로 인연의 별인가
  const starPts = (starAB ? -5 : 0) + (starBA ? -5 : 0);
  if (starPts) {
    F.push({ id: 'stars', icon: '⭐', label: '인연의 별', pts: starPts, short: starAB && starBA ? '서로가 서로의 인연의 별' : `${starAB ? A : B} 사주에서 상대가 인연의 별`, text: `${starAB && starBA ? '두 사람이 서로의 사주에서 연인을 뜻하는 별에 해당해요.' : `${starAB ? A : B} 사주에서 ${starAB ? B : A}은 연인을 뜻하는 별에 해당해요.`} 위기가 와도 "그래도 이 사람"이라는 마음이 남기 쉬운, 이별을 막아 주는 힘이에요.`, fixes: [] });
  }

  // 4) 오행 — 같은 기운이 넘치는가, 서로 채워 주는가
  const fills = (x, y) => ELEMENTS.filter((e) => x.counts[e] <= 1 && y.counts[e] >= 2);
  const fAB = fills(a, b), fBA = fills(b, a);
  if (a.strongest === b.strongest && a.counts[a.strongest] >= 3 && b.counts[b.strongest] >= 3) {
    const e = a.strongest;
    F.push({ id: 'elements_same', icon: '🔥', label: '넘치는 같은 기운', pts: 6, short: `둘 다 ${ELEMENT_KO[e]} 기운이 넘침`, text: `두 사람 모두 ${ELEMENT_KO[e]}(${ELEMENT_INFO[e].name}) 기운이 강해요. 같은 상황에서 같은 방식으로 예민해져서, 한 번 불붙으면 서로 식혀 주지 못하고 같이 타오르기 쉬워요.`, fixes: [`다툼이 커지면 한 명이 "타임아웃"을 외치고 20분 떨어져 있기`] });
  } else if (fAB.length || fBA.length) {
    const list = [...new Set([...fAB, ...fBA])].map((e) => ELEMENT_KO[e]).join('·');
    F.push({ id: 'elements_fill', icon: '🧩', label: '서로 채워 주는 기운', pts: -5, short: `${list} 기운을 서로 채워 줌`, text: `한 사람에게 부족한 ${list} 기운을 다른 사람이 갖고 있어요. 함께 있을수록 균형이 잡혀서, 떨어지면 서로의 빈자리가 크게 느껴지는 관계예요.`, fixes: [] });
  }

  // 5) 띠
  const rz = branchRelation(a.yearBranch, b.yearBranch);
  if (ZODIAC[rz]) {
    const zText = {
      clash: '띠끼리 "충"이라 가치관·생활 습관 차이를 크게 느끼기 쉬워요.',
      wonjin: '띠끼리 "원진"이라 이유 없이 미운 순간이 생길 수 있어요.',
      punish: '띠끼리 "형"이라 고집이 부딪히기 쉬워요.',
      same: '같은 띠라 이해는 빠르지만 단점도 닮았어요.',
      trine: '띠끼리 삼합이라 가치관이 잘 맞아요.',
      harmony: '띠끼리 육합이라 기본 호감이 오래가요.',
    }[rz];
    F.push({ id: `zodiac_${rz}`, icon: '🐾', label: '띠 궁합', pts: ZODIAC[rz], short: `${ANIMALS[a.yearBranch]}띠 × ${ANIMALS[b.yearBranch]}띠`, text: zText, fixes: ZODIAC[rz] > 0 ? ['서로의 집안·친구 문화 차이를 "틀림"이 아니라 "다름"으로 이야기하기'] : [] });
  }
  return F;
}

/* ───────────── 이별이 온다면: 패턴 ───────────── */

const PATTERNS = {
  palace_clash: { title: '생활 충돌형', emoji: '🌪️', text: '연락 빈도, 약속 시간, 돈 쓰는 법처럼 생활의 작은 차이가 쌓이다가 어느 날 "우린 너무 달라"로 한 번에 터지는 이별이에요.', signs: ['같은 문제로 세 번 이상 다툼', '"원래 그래"라는 말이 늘어남', '데이트 계획 짜는 게 피곤해짐'] },
  palace_wonjin: { title: '서운함 누적형', emoji: '🌀', text: '말하지 못한 서운함이 조용히 쌓이다가, 어느 날 한쪽 마음이 먼저 식어 버리는 이별이에요. 겉으로는 잘 지내 보여서 더 알아차리기 어려워요.', signs: ['"괜찮아"가 입버릇이 됨', '대화가 일정 공유로만 끝남', '혼자 서운함을 곱씹는 시간이 늘어남'] },
  palace_punish: { title: '잔소리 피로형', emoji: '⚡', text: '서로를 고쳐 주려는 말이 쌓여 "이 사람 앞에선 내가 늘 부족하다"는 피로로 바뀌는 이별이에요.', signs: ['칭찬보다 지적이 많아짐', '상대 앞에서 눈치를 보게 됨', '혼자 있을 때 더 편하다고 느낌'] },
  palace_same: { title: '자존심 평행선형', emoji: '🪞', text: '닮은 두 사람이 같은 지점에서 동시에 예민해지고, 누구도 먼저 숙이지 않다가 연락이 끊기는 이별이에요.', signs: ['싸운 뒤 연락 없는 시간이 길어짐', '"네가 먼저 해"가 마음속 대사', '사과가 "근데"로 끝남'] },
  dm_same: { title: '자존심 평행선형', emoji: '🪞', text: '고집이 닮은 두 사람이 먼저 숙이지 않다가 냉전이 길어지고, 그대로 멀어지는 이별이에요.', signs: ['냉전이 하루를 넘김', '사과가 "근데"로 끝남', '이기는 게 화해보다 중요해짐'] },
  dm_control: { title: '주도권 갈등형', emoji: '🎢', text: '한 사람이 이끌고 한 사람이 맞추는 구조가 굳어지다가, 맞추던 쪽이 조용히 지쳐서 떠나는 이별이에요. 이끄는 쪽은 이별 직전까지 눈치채지 못하는 경우가 많아요.', signs: ['한쪽만 의견을 내고 한쪽은 "아무거나"', '맞추는 쪽의 말수가 줄어듦', '결정을 늘 한 사람이 내림'] },
  dm_give: { title: '한쪽만 노력형', emoji: '🎁', text: '주는 쪽이 계속 주다가 "나만 노력한다"는 생각에 지쳐서 끝나는 이별이에요.', signs: ['연락·데이트 제안이 늘 한 사람에게서 나옴', '고마움 표현이 줄어듦', '주는 쪽이 "나도 지친다"는 말을 함'] },
  elements_same: { title: '고집 대결형', emoji: '🔥', text: '같은 기운이 넘치는 두 사람이 다툴 때 서로 식혀 주지 못하고 함께 타올라, 홧김에 이별을 말하게 되는 패턴이에요.', signs: ['싸움이 점점 커짐', '"헤어지자"가 홧김에 나옴', '화해 후에도 앙금이 남음'] },
  zodiac_clash: { title: '가치관 충돌형', emoji: '🧭', text: '집안 분위기, 친구 문화, 미래 계획 같은 큰 그림이 엇갈려서 "우린 가는 길이 다르다"고 느끼는 이별이에요.', signs: ['미래 이야기를 피하게 됨', '서로의 친구·가족 이야기가 불편해짐', '결혼·진로 이야기에서 침묵'] },
  zodiac_wonjin: { title: '서운함 누적형', emoji: '🌀', text: '사소한 서운함이 쌓여 어느 날 마음이 식는 이별이에요.', signs: ['"괜찮아"가 입버릇이 됨', '대화가 짧아짐', '서운함을 혼자 곱씹게 됨'] },
  sanggwan: { title: '말실수형', emoji: '🗡️', text: '다툼 중에 홧김에 한 날카로운 말이 상대 마음에 깊이 박혀서, 그 한마디가 끝내 이별의 이유가 되는 패턴이에요.', signs: ['싸울 때 상대의 약점을 건드림', '"농담이었어"로 넘어가는 일이 잦음', '상대가 내 말에 상처받았다고 말함'] },
  rivals: { title: '제3자 개입형', emoji: '⚔️', text: '친구·동료·돈 문제가 둘 사이에 끼어들고, 연인이 "나는 우선순위가 아니다"라고 느껴서 멀어지는 이별이에요.', signs: ['연인보다 친구 약속이 먼저', '돈 문제를 숨기게 됨', '연인이 내 주변 사람을 불편해함'] },
  mixed: { title: '비교·흔들림형', emoji: '⚖️', text: '지금 연인과 다른 사람을 비교하는 마음이 커지면서 관계에 집중하지 못하는 이별이에요.', signs: ['다른 사람이 자꾸 눈에 들어옴', '"이 사람이 맞나?" 생각이 잦아짐', '연인의 단점만 크게 보임'] },
  noStar: { title: '무관심 오해형', emoji: '🫥', text: '마음은 있는데 표현과 시간이 부족해서, 상대가 "나한테 관심이 없다"고 느끼고 떠나는 이별이에요.', signs: ['연락이 하루 넘게 끊김', '기념일·약속을 깜빡함', '연인이 "나 사랑해?"라고 자주 물음'] },
  lonely: { title: '거리감형', emoji: '🌙', text: '각자의 시간이 길어지면서 자연스럽게 멀어지고, 어느새 남처럼 느껴지는 이별이에요.', signs: ['주말을 따로 보내는 일이 늘어남', '근황을 SNS로 알게 됨', '만나도 각자 휴대폰만 봄'] },
  temptation: { title: '외부 유혹형', emoji: '🌸', text: '주변의 관심과 오해가 쌓여 신뢰가 흔들리는 이별이에요. 실제 사건보다 "불안"이 관계를 무너뜨리는 경우가 많아요.', signs: ['이성 친구 문제로 다툼', '휴대폰을 신경 쓰게 됨', '연인이 불안을 자주 표현함'] },
  palaceClash: { title: '변화 갈망형', emoji: '🌪️', text: '관계가 익숙해지면 새로운 자극을 찾고 싶은 마음이 커지면서 흔들리는 이별이에요.', signs: ['데이트가 늘 똑같다고 느낌', '혼자 새로운 걸 찾기 시작함', '관계가 답답하다고 느낌'] },
  palaceRub: { title: '서운함 누적형', emoji: '🌀', text: '사소한 서운함이 말없이 쌓여 어느 날 마음이 식는 이별이에요.', signs: ['"괜찮아"가 입버릇이 됨', '대화가 짧아짐', '서운함을 혼자 곱씹게 됨'] },
  none: { title: '권태형', emoji: '🍃', text: '큰 충돌 요인은 적어요. 이 커플의 유일한 적은 익숙함 — 표현이 줄고 설렘이 일상에 묻히면서 서서히 멀어지는 거예요.', signs: ['데이트가 늘 같은 코스', '"사랑해"를 말한 지 오래됨', '서로의 요즘 관심사를 모름'] },
};

const STOP = {
  '생활 충돌형': '이 신호가 보이면 감정 대신 "규칙 회의"를 여세요. 연락·약속·돈 중 가장 자주 싸우는 주제 하나를 골라 둘만의 규칙으로 정리하면 같은 싸움이 반복되지 않아요.',
  '서운함 누적형': '이 신호가 보이면 "괜찮아" 대신 "사실 조금 서운했어"를 말하는 연습부터 해요. 쌓인 걸 한 번에 털기보다, 작게 자주 말하는 게 이 패턴의 해독제예요.',
  '잔소리 피로형': '이 신호가 보이면 2주 동안 "지적 금지, 칭찬 하루 한 번" 챌린지를 해 보세요. 상대가 다시 편안해지는 게 눈에 보일 거예요.',
  '자존심 평행선형': '이 신호가 보이면 "먼저 연락하는 사람이 이기는 거야"라는 규칙을 떠올려요. 사과는 "근데" 없이 끝내는 것만으로도 냉전이 반으로 줄어요.',
  '주도권 갈등형': '이 신호가 보이면 이끄는 쪽이 한 달 동안 결정권을 넘겨 보세요. 데이트 코스, 메뉴, 주말 계획을 상대가 고르게 하면 균형이 돌아와요.',
  '한쪽만 노력형': '이 신호가 보이면 받는 쪽이 먼저 움직일 차례예요. 이번 주 데이트 계획과 연락을 받는 쪽이 먼저 해 보세요.',
  '고집 대결형': '이 신호가 보이면 "타임아웃" 규칙을 꺼내요. 목소리가 커지면 20분 떨어져 있다가, 진정되면 다시 이야기하기.',
  '가치관 충돌형': '이 신호가 보이면 미래 이야기를 피하지 말고 "꼭 지켜야 할 것 3개 / 양보할 수 있는 것 3개"를 서로 적어 교환해 보세요.',
  '말실수형': '이 신호가 보이면 싸울 때 카톡을 금지하고 만나서 이야기하세요. 그리고 상처 준 말은 "농담이었어"가 아니라 "그 말은 미안해"로 사과하기.',
  '제3자 개입형': '이 신호가 보이면 연인을 우선순위 1번으로 다시 올려 두세요. 친구·돈 문제는 숨기지 말고 연인에게 먼저 상의하기.',
  '비교·흔들림형': '이 신호가 보이면 다른 사람과의 연락을 줄이고, 지금 연인과 처음 설렜던 장소에 다시 가 보세요.',
  '무관심 오해형': '이 신호가 보이면 하루 한 번 "생각나서 연락했어"를 보내세요. 표현의 양이 마음의 크기로 읽히는 시기예요.',
  '거리감형': '이 신호가 보이면 일주일에 한 번 "둘만의 고정 데이트"를 만드세요. 짧아도 꾸준한 게 거리감을 이겨요.',
  '외부 유혹형': '이 신호가 보이면 먼저 투명해지세요. 묻기 전에 말해 주는 것만으로 불안의 대부분이 사라져요.',
  '변화 갈망형': '이 신호가 보이면 관계 밖이 아니라 관계 안에 새로움을 넣어요. 같이 처음 해 보는 일 하나를 이번 달 안에 계획하기.',
  '권태형': '이 신호가 보이면 "첫 데이트 다시 하기"를 해 보세요. 처음 만난 장소, 처음 했던 대화를 다시 꺼내는 것만으로 설렘이 돌아와요.',
};

/* ───────────── 시기별 이별 위험 ───────────── */

const WHY = {
  clash: { label: '배우자 자리 충', bad: true, text: (w) => `${w}의 배우자 자리가 흔들리는 시기 — 이사·이직 같은 변화가 관계까지 흔들 수 있어요` },
  wonjin: { label: '오해 주의', bad: true, text: (w) => `${w}이 말투 하나에 서운해지기 쉬운 시기` },
  punish: { label: '마찰 주의', bad: true, text: (w) => `${w}과 잔소리·간섭으로 부딪히기 쉬운 시기` },
  sanggwan: { label: '말실수 주의', bad: true, text: (w) => `${w}의 말이 날카로워지는 상관운` },
  rival: { label: '제3자 주의', bad: true, text: (w) => `${w} 주변에 경쟁자·돈 문제가 끼어드는 겁재운` },
  peach: { label: '유혹 주의', bad: true, text: (w) => `${w}에게 이성의 관심이 몰리는 도화운` },
  harmony: { label: '마음이 맞물림', bad: false, text: (w) => `${w}의 배우자 자리와 합이 드는 시기` },
  jeong: { label: '인연의 별', bad: false, text: (w) => `${w}에게 연인을 뜻하는 별이 뜨는 시기` },
  combo: { label: '끌어당김', bad: false, text: (w) => `${w}의 일간과 합이 드는 시기` },
};

export function periodRisk(a, b, stem, branch) {
  let risk = 32;
  const why = [];
  for (const p of [a, b]) {
    const rel = branchRelation(branch, p.dayBranch);
    const add = (k, pts) => { risk += pts; why.push({ k, who: p, pts }); };
    if (rel === 'clash') add('clash', 13);
    else if (rel === 'wonjin') add('wonjin', 7);
    else if (rel === 'punish') add('punish', 6);
    else if (rel === 'harmony') add('harmony', -8);
    const gS = tenGod(p.dm, stem), gB = tenGod(p.dm, BRANCH_MAIN_STEM[branch]);
    if (p.gender === 'F' && (gS === '상관' || gB === '상관')) add('sanggwan', 7);
    if (p.gender === 'M' && (gS === '겁재' || gB === '겁재')) add('rival', 7);
    if (gS === p.partner.jeongName || gB === p.partner.jeongName) add('jeong', -5);
    if (p.peachBranches.includes(branch)) add('peach', 4);
    if (stemsCombine(stem, p.dm)) add('combo', -4);
  }
  risk = clamp(Math.round(risk), 5, 95);
  const bad = why.filter((w) => w.pts > 0).sort((x, y) => y.pts - x.pts);
  const good = why.filter((w) => w.pts < 0).sort((x, y) => x.pts - y.pts);
  const main = risk >= 45 ? bad[0] : risk <= 26 ? good[0] : bad[0] || good[0];
  return {
    risk, level: riskLevel(risk),
    bad: bad.map((w) => ({ ...WHY[w.k], key: w.k, who: w.who.name, line: WHY[w.k].text(nim(w.who)) })),
    good: good.map((w) => ({ ...WHY[w.k], key: w.k, who: w.who.name, line: WHY[w.k].text(nim(w.who)) })),
    main: main ? { key: main.k, label: WHY[main.k].label, line: WHY[main.k].text(nim(main.who)), bad: WHY[main.k].bad } : { key: 'none', label: '잔잔함', line: '큰 변수 없이 잔잔한 시기', bad: false },
    pillar: { stem, branch, hanja: STEMS[stem] + BRANCHES[branch], hangul: STEMS_KO[stem] + BRANCHES_KO[branch] },
  };
}

export function riskLevel(r) {
  if (r >= 60) return { key: 'high', label: '위험', emoji: '🚨' };
  if (r >= 45) return { key: 'care', label: '주의', emoji: '⚠️' };
  if (r >= 30) return { key: 'mild', label: '보통', emoji: '🙂' };
  return { key: 'safe', label: '안정', emoji: '🛡️' };
}

export function breakupGrade(risk) {
  if (risk >= 62) return { key: 'high', title: '이별수 높음', emoji: '🔥', line: '부딪히는 지점이 많은 사이. 대신 넘기면 누구보다 단단해진다냥.' };
  if (risk >= 47) return { key: 'care', title: '이별수 주의', emoji: '⚠️', line: '위험한 시기와 패턴만 알면 충분히 지킬 수 있는 사이!' };
  if (risk >= 32) return { key: 'mild', title: '이별수 약간', emoji: '🌱', line: '작은 고비는 있지만 잘 넘길 수 있는 사이!' };
  return { key: 'low', title: '이별수 낮음', emoji: '🛡️', line: '웬만한 바람엔 끄떡없는 단단한 인연이다냥!' };
}

/* ───────────── 전체 분석 ───────────── */

export function analyzeBreakup(a, b, nowMs = Date.now()) {
  const couple = coupleFactors(a, b);
  const sigA = personalSignals(a), sigB = personalSignals(b);
  const capped = (s) => Math.min(16, s.reduce((t, x) => t + x.pts, 0));
  const sum = couple.reduce((t, f) => t + f.pts, 0) + capped(sigA) + capped(sigB);
  const risk = clamp(Math.round(30 + sum), 5, 95);
  const grade = breakupGrade(risk);

  const dangers = couple.filter((f) => f.pts > 0).sort((x, y) => y.pts - x.pts);
  const protects = couple.filter((f) => f.pts < 0).sort((x, y) => x.pts - y.pts);
  const signals = [...sigA, ...sigB].sort((x, y) => y.pts - x.pts);

  // 이별이 온다면 — 가장 큰 위험 요인으로 패턴 결정
  const top = [...dangers.map((f) => ({ id: f.id, pts: f.pts })), ...signals.map((s) => ({ id: s.id, pts: s.pts + 1 }))]
    .filter((x) => PATTERNS[x.id] && x.pts >= 6).sort((x, y) => y.pts - x.pts)[0];
  const pattern = { ...(PATTERNS[top ? top.id : 'none']) };
  pattern.stop = STOP[pattern.title];

  // 시기: 앞으로 5년, 12개월
  const cur = yearMonthPillarsAt(nowMs);
  const years = [];
  for (let k = 0; k < 5; k++) {
    const y = cur.sajuYear + k;
    const p = yearPillarOf(y);
    years.push({ year: y, animal: ANIMALS[p.branch], ...periodRisk(a, b, p.stem, p.branch) });
  }
  const months = [];
  const now = new Date(nowMs + 9 * 3600000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    const ym = yearMonthPillarsAt(seoulWallToUtc(y, m, 15, 12, 0));
    const mr = periodRisk(a, b, ym.month.stem, ym.month.branch);
    const yr = periodRisk(a, b, ym.year.stem, ym.year.branch);
    const r = clamp(Math.round(mr.risk * 0.75 + yr.risk * 0.25), 5, 95);
    months.push({ year: y, month: m, ...mr, risk: r, level: riskLevel(r) });
    m++; if (m > 12) { m = 1; y++; }
  }
  const byDate = (p, q) => months.indexOf(p) - months.indexOf(q);
  const danger = [...months].sort((p, q) => q.risk - p.risk).slice(0, 2).filter((x) => x.risk >= 40).sort(byDate);
  const repair = [...months].sort((p, q) => p.risk - q.risk).slice(0, 2).sort(byDate);

  // 이별을 막는 법
  const rules = [...new Set(dangers.flatMap((f) => f.fixes))];
  if (rules.length < 3) rules.push('한 달에 한 번 "우리 관계 점검 데이트" — 좋았던 것·아쉬운 것·바라는 것 하나씩 말하기');
  if (rules.length < 4) rules.push('싸움은 그날 결론 내지 않기. 24시간 뒤에 다시 이야기하면 말실수가 반으로 줄어요');

  const forPerson = (p, other, sig, side) => {
    const out = sig.map((s) => s.fix);
    const dm = couple.find((f) => f.id.startsWith('dm_'));
    if (dm.id === 'dm_control') out.push(dm.ctrlId === side ? `상대가 조용해지면 "괜찮아?"보다 "내가 너무 몰아붙였나?"라고 먼저 물어봐 주세요.` : `맞춰 주는 게 습관이 되지 않게, 일주일에 한 번은 데이트 결정을 ${nim(p)}이 해 보세요.`);
    if (dm.id === 'dm_give') out.push(dm.giverId === side ? '주는 만큼 받고 싶은 걸 구체적으로 말해 주세요. 상대는 몰라서 못 하는 경우가 많아요.' : '상대가 해 준 일에 바로 반응해 주세요. "고마워"는 많을수록 좋아요.');
    out.push(`조심할 점: ${DAY_MASTERS[p.dm].weak}`);
    out.push(DAY_MASTERS[p.dm].tips[0]);
    return [...new Set(out)].slice(0, 5);
  };

  const dangerNames = danger.map((d) => `${d.year !== now.getUTCFullYear() ? `${d.year}년 ` : ''}${d.month}월`);
  const crisis = [];
  if (dangerNames.length) crisis.push(`${dangerNames.join('·')}에는 동거·이별 통보 같은 큰 결정을 미루세요. 이 시기의 감정은 평소보다 크게 느껴져요.`);
  crisis.push('다툼이 생기면 카톡으로 싸우지 말고, 전화나 만나서 이야기하기.');
  const dangerKeys = new Set(danger.flatMap((d) => d.bad.map((x) => x.key)));
  if (dangerKeys.has('sanggwan')) crisis.push('말이 날카로워지는 시기예요. "헤어지자"는 말은 홧김에 절대 꺼내지 않기로 미리 약속하세요.');
  if (dangerKeys.has('peach')) crisis.push('주변의 관심이 많아지는 시기예요. 이성과의 약속·연락은 먼저 공유해서 불안의 싹을 잘라 두세요.');
  if (dangerKeys.has('rival')) crisis.push('친구·돈 문제가 끼어들기 쉬워요. 큰돈이 오가는 약속은 이 시기를 피하세요.');
  if (dangerKeys.has('clash')) crisis.push('이사·이직 같은 변화가 겹치면 둘만의 시간을 일부러 더 확보하세요.');
  crisis.push('위기라고 느껴지면 "무엇이 바뀌면 계속할 수 있을까?"를 각자 종이에 적어 교환해 보세요.');

  const combined = Object.fromEntries(ELEMENTS.map((e) => [e, a.counts[e] + b.counts[e]]));
  const coupleEl = ELEMENTS.reduce((mm, e) => (combined[e] < combined[mm] ? e : mm), ELEMENTS[0]);
  const luck = LUCK[coupleEl];

  return {
    a, b, risk, grade, couple, dangers, protects, signalsA: sigA, signalsB: sigB, signals,
    pattern, years, months, danger, repair, rules: rules.slice(0, 6),
    forA: forPerson(a, b, sigA, 'a'), forB: forPerson(b, a, sigB, 'b'), crisis,
    coupleEl, luck,
  };
}

export function summaryBreakupForAI(r) {
  const n = (x) => `${x.year}.${x.month}`;
  return [
    `이별수 분석: ${r.a.name} × ${r.b.name} (${r.b.gender === 'F' ? '여성' : '남성'}, 사주 ${['year', 'month', 'day', 'hour'].map((k) => r.b.saju.pillars[k]).filter(Boolean).map((p) => STEMS[p.stem] + BRANCHES[p.branch]).join(' ')})`,
    `이별수 지수 ${r.risk}/100 (${r.grade.title}) — 위험 요인: ${r.dangers.map((f) => `${f.label}(${f.short})`).join(', ') || '없음'} / 지켜 주는 힘: ${r.protects.map((f) => f.short).join(', ') || '없음'}`,
    `각자의 이별 신호: ${r.signals.map((s) => `${s.who.name}-${s.label}`).join(', ') || '없음'} / 예상 이별 패턴: ${r.pattern.title}`,
    `이별 위험 시기(12개월): ${r.danger.map((d) => `${n(d)} ${d.risk}(${d.main.label})`).join(', ') || '두드러진 위험 달 없음'} / 화해·관계 회복에 좋은 달: ${r.repair.map(n).join(', ')}`,
  ].join('\n');
}

