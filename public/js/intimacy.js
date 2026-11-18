// 속궁합 — 두 사람의 끌림·스킨십 리듬·온도·분위기 매력·표현 균형을 사주로 본다.
// 노골적인 묘사 없이 애정 표현 방식·속도·분위기·소통을 다루고, 동의와 존중을 기본으로 둔다.
// 두 사람 모두 만 19세 이상일 때만 결과를 만든다.
import {
  ELEMENTS, ELEMENT_KO, STEMS, BRANCHES, BRANCHES_KO, RED_FLAME,
  branchRelation, stemsCombine, generates, peachBlossomBranch, yearMonthPillarsAt, seoulWallToUtc, dayPillarOf, hourPillarOf,
} from './saju.js';
import { WEEKDAYS, josa } from './text.js';
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
// 일간 오행별로 상대에게 잘 전해지는 다정한 스킨십 (손잡기·포옹·키스 수준)
export const TOUCH_LIKES = {
  wood: ['길에서 자연스럽게 손깍지 끼기', '헤어질 때 꼭 안아 주기', '살짝 이마에 뽀뽀'],
  fire: ['만나자마자 반갑게 와락 포옹', '사람 없는 곳에서 짧은 기습 뽀뽀', '팔짱 끼고 신나게 걷기'],
  earth: ['소파에서 어깨에 기대기', '담요 덮고 꼭 붙어 영화 보기', '천천히 오래 안아 주기'],
  metal: ['손등에 다정한 입맞춤', '옷깃이나 머리를 정돈해 주기', '헤어질 때 확실하게 한 번 포옹'],
  water: ['귓가에 다정하게 속삭이기', '밤 산책하며 손잡기', '눈 마주치고 천천히 키스'],
};

// 일간 오행별 귀여운 약점 (간지럼·약한 말·마음이 녹는 순간)
export const SOFT_SPOTS = {
  wood: { tickle: '옆구리', words: '"너 덕분에 힘이 나"', melt: '말해 둔 계획을 기억해 줄 때' },
  fire: { tickle: '발바닥', words: '"오늘 진짜 멋있다(예쁘다)"', melt: '사람들 앞에서 내 편을 들어줄 때' },
  earth: { tickle: '무릎 뒤', words: '"너랑 있으면 마음이 편해"', melt: '아플 때 따뜻한 죽을 챙겨 줄 때' },
  metal: { tickle: '손바닥', words: '"역시 너밖에 없어"', melt: '약속을 1분도 안 늦고 지켜 줄 때' },
  water: { tickle: '귀', words: '"네 얘기 더 듣고 싶어"', melt: '비 오는 날 우산 들고 데리러 와 줄 때' },
};

// 서로 원하는 것·싫은 것을 편하게 꺼내는 질문 카드
export const TALK_CARDS = [
  '요즘 나랑 있을 때 제일 좋은 순간은 언제야?',
  '내가 해 주는 스킨십 중에 제일 좋은 건 뭐야?',
  '오늘은 꼭 안겨 있고 싶은 날이야, 그냥 옆에 있고 싶은 날이야?',
  '우리 속도가 빠르다거나 느리다고 느낀 적 있어?',
  '불편했거나 싫었던 적 있으면 지금 편하게 말해 줘.',
  '"오늘은 쉬고 싶어"를 말하는 우리만의 신호를 정해 볼까?',
  '다음에 둘이 꼭 가 보고 싶은 분위기 좋은 곳은?',
  '내가 어떤 말을 해 줄 때 제일 설레?',
];

// 상대의 마음을 여는 행동 후보 — 상대의 오행·십신 성향·리드 성향·온도에 맞는 태그로 점수를 매겨 상위 3개만 보여 준다
const OPEN_ACTS = [
  { act: '진심을 담은 칭찬 한마디 먼저 건네기', tags: ['fire', '식상', 'weak'] },
  { act: '이야기를 끝까지 들어 주고 "그랬구나"로 공감하기', tags: ['water', '인성', 'cool'] },
  { act: '함께한 좋은 추억을 사진 한 장과 함께 꺼내기', tags: ['인성', 'wood'] },
  { act: '작은 약속도 시간 맞춰 정확히 지키기', tags: ['metal', '관성', '재성'] },
  { act: '집 데이트나 느긋한 산책처럼 편안한 시간 만들기', tags: ['earth', 'cool', '인성'] },
  { act: '상대가 좋아한다고 했던 것을 기억했다가 깜짝 준비하기', tags: ['wood', '재성', '식상'] },
  { act: '데이트 결정을 상대에게 맡기고 기분 좋게 따라가 주기', tags: ['strong', '비겁'] },
  { act: '"이번엔 내가 준비할게" 하고 먼저 계획 세워 주기', tags: ['weak', 'earth'] },
  { act: '서툴러도 손편지나 긴 메시지로 마음 전하기', tags: ['water', '관성', 'metal'] },
  { act: '처음 가 보는 곳에서 새로운 경험 함께하기', tags: ['fire', 'wood', '식상', 'hot'] },
  { act: '다른 사람 앞에서 상대를 자랑하고 편들어 주기', tags: ['비겁', 'fire', '관성'] },
  { act: '서두르지 않고 상대의 속도에 맞춰 기다려 주기', tags: ['cool', 'water', 'metal', 'weak'] },
];
const OPEN_WHY = {
  wood: '새싹형이라 설렘과 성장을 함께 느낄 때', fire: '불꽃형이라 솔직하고 활기찬 표현에', earth: '포근형이라 편안함과 안정감에',
  metal: '보석형이라 믿음과 정돈된 태도에', water: '물결형이라 감성과 깊은 대화에',
  인성: '지난 일을 오래 기억하는 사주', 비겁: '자존심을 중요하게 여기는 사주', 식상: '표현에 반응이 빠른 사주',
  재성: '현실적인 마음을 가진 사주', 관성: '책임과 약속을 중시하는 사주',
  strong: '먼저 이끌고 싶어 하는 리드형', weak: '상대에게 맞춰 주는 맞춤형', hot: '뜨거운 기운이 강한 커플', cool: '차분한 기운이 강한 커플',
};

/** to(상대)의 마음을 여는 법 — 사주로 가능성이 높은 3가지 */
export function openHeart(to, tempKey) {
  const group = Object.keys(to.groupCounts).sort((x, y) => to.groupCounts[y] - to.groupCounts[x])[0];
  const mine = new Set([to.dmEl, group, to.strength.key, tempKey]);
  const W = { [to.dmEl]: 3, [group]: 3, [to.strength.key]: 2, [tempKey]: 1 };
  const ranked = OPEN_ACTS.map((o) => {
    const hit = o.tags.filter((t) => mine.has(t));
    return { act: o.act, score: hit.reduce((t, h) => t + (W[h] || 0), 0), hit };
  }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score || OPEN_ACTS.findIndex((o) => o.act === x.act) - OPEN_ACTS.findIndex((o) => o.act === y.act));
  return ranked.slice(0, 3).map((x) => {
    const main = [...x.hit].sort((p, q) => (W[q] || 0) - (W[p] || 0))[0];
    const phrase = OPEN_WHY[main];
    return {
      act: x.act,
      stars: x.score >= 5 ? 3 : x.score >= 3 ? 2 : 1,
      why: main === to.dmEl ? `${to.name}님은 ${phrase} 마음이 열리는 사람이에요.` : `${to.name}님은 ${josa(phrase, '이라', '라')} 이 방법이 잘 통해요.`,
    };
  });
}

// 나만의 연애 무기 — 내 사주의 강한 매력(own)과, 그 매력이 특히 잘 통하는 상대 성향(fits)
const WEAPONS = [
  { name: '다정한 말과 진심 어린 칭찬', own: ['fire', '식상', 'wood'], fits: ['weak', 'wood', '식상'], use: '헤어질 때나 답장 끝에 한마디 더 붙여 보세요.' },
  { name: '한결같은 믿음직함', own: ['metal', 'earth', '관성'], fits: ['재성', '관성', 'metal', 'earth'], use: '약속 시간·연락 시간을 꾸준히 지키는 것만으로 빛나요.' },
  { name: '따뜻하게 챙겨 주는 마음', own: ['earth', '인성'], fits: ['wood', '인성', 'water'], use: '피곤해 보이는 날 따뜻한 음료 하나 건네 보세요.' },
  { name: '깊은 대화와 공감력', own: ['water', '인성'], fits: ['water', '인성', 'metal'], use: '조용한 카페나 밤 산책에서 진가가 나와요.' },
  { name: '함께 있으면 웃게 되는 밝은 에너지', own: ['fire', '식상', '비겁'], fits: ['earth', 'metal', 'water'], use: '차분한 날일수록 장난 한 번, 웃음 한 번이 통해요.' },
  { name: '센스 있는 데이트 기획력', own: ['재성', 'wood', 'strong'], fits: ['weak', 'earth', '재성'], use: '다음 데이트 코스를 먼저 제안해 보세요.' },
  { name: '자연스럽게 눈길을 끄는 매력(도화)', own: ['dohwa'], fits: ['fire', '식상', 'water'], use: '꾸민 날 사진 한 장, 눈 마주치며 웃는 순간이 무기예요.' },
  { name: '말없이도 흐르는 분위기(홍염)', own: ['hongyeom'], fits: ['water', 'fire'], use: '조명 좋은 곳, 음악 있는 곳에서 더 빛나요.' },
  { name: '알수록 궁금해지는 깊이(화개)', own: ['hwagae'], fits: ['water', '인성', 'metal'], use: '좋아하는 책·음악·영화 이야기를 꺼내 보세요.' },
  { name: '어디든 함께 떠나는 행동력(역마)', own: ['yeokma', 'fire'], fits: ['wood', 'fire', '식상'], use: '즉흥 여행이나 처음 가 보는 동네 데이트를 제안해 보세요.' },
  { name: '기댈 수 있는 듬직함', own: ['strong', '비겁', 'gwiin'], fits: ['weak', '인성'], use: '상대가 고민할 때 "내가 같이 해 볼게"라고 말해 주세요.' },
  { name: '상대를 편하게 해 주는 섬세한 배려', own: ['weak', 'water', 'balanced'], fits: ['strong', '비겁'], use: '상대가 하고 싶은 걸 먼저 물어봐 주세요.' },
];
const WEAPON_WHY = {
  wood: '새싹형 일간이라 마음을 아끼지 않고 표현해요', fire: '불꽃형 일간이라 표현이 시원시원해요', earth: '포근형 일간이라 곁에 있으면 마음이 편해져요',
  metal: '보석형 일간이라 말과 행동이 한결같아요', water: '물결형 일간이라 감성이 깊고 잘 들어 줘요',
  인성: '사람을 품는 별(인성)이 강해요', 비겁: '당당한 자신감의 별(비겁)이 강해요', 식상: '표현의 별(식상)이 강해요',
  재성: '현실 감각의 별(재성)이 강해요', 관성: '책임감의 별(관성)이 강해요',
  strong: '기운이 강한 리드형이에요', weak: '상대에게 맞춰 주는 맞춤형이에요', balanced: '상황에 따라 유연한 유연형이에요',
  dohwa: '매력의 별 도화가 있어요', hongyeom: '분위기 미인의 별 홍염이 있어요', hwagae: '예술과 깊이의 별 화개가 있어요',
  yeokma: '움직임의 별 역마가 있어요', gwiin: '도움을 주는 별 귀인이 있어요',
};
const topGroup = (x) => Object.keys(x.groupCounts).sort((p, q) => x.groupCounts[q] - x.groupCounts[p])[0];

/** me의 연애 무기 3가지 — 내 사주의 강점 + to(상대)에게 특히 통하는지 */
export function loveWeapons(me, to) {
  const W = { [me.dmEl]: 3, [topGroup(me)]: 3, [me.strength.key]: 2 };
  for (const c of me.charms) W[c] = 3;
  const F = { [to.dmEl]: 2, [topGroup(to)]: 2, [to.strength.key]: 1 };
  const ranked = WEAPONS.map((w, i) => {
    const hit = w.own.filter((t) => W[t]);
    const fit = w.fits.filter((t) => F[t]);
    const score = hit.reduce((s, t) => s + W[t], 0) + fit.reduce((s, t) => s + F[t], 0);
    return { ...w, i, hit, fit, score, own: hit.reduce((s, t) => s + W[t], 0) };
  }).filter((x) => x.own > 0).sort((x, y) => y.score - x.score || x.i - y.i);
  const used = new Set();
  return ranked.slice(0, 3).map((x) => {
    const order = [...x.hit].sort((p, q) => W[q] - W[p]);
    const main = order.find((t) => !used.has(t)) || order[0];
    used.add(main);
    const fitMain = [...x.fit].sort((p, q) => F[q] - F[p])[0];
    let fit = '';
    if (fitMain === to.dmEl) fit = `${to.name}님은 ${OPEN_WHY[fitMain]} 마음이 열려서 특히 잘 통해요.`;
    else if (fitMain) fit = `${to.name}님은 ${josa(OPEN_WHY[fitMain], '이라', '라')} 특히 잘 통해요.`;
    return { name: x.name, use: x.use, stars: x.score >= 7 ? 3 : x.score >= 4 ? 2 : 1, why: `${me.name}님은 ${WEAPON_WHY[main]}.`, fit };
  });
}

// 주도권 밸런스 — 영역별로 누가 이끌면 자연스러운지
const LEAD_AREAS = [
  { id: 'date', icon: '🗺️', label: '데이트 계획', score: (x) => x.groupCounts.재성 + (x.strength.key === 'strong' ? 2 : x.strength.key === 'balanced' ? 1 : 0) + (['wood', 'fire'].includes(x.dmEl) ? 1 : 0),
    lead: '코스와 장소를 정하고', follow: '"좋다!" 하고 즐겁게 따라가며 다음엔 가고 싶은 곳을 하나씩 말해 주세요.' },
  { id: 'contact', icon: '💬', label: '연락', score: (x) => x.groupCounts.식상 + (['water', 'fire'].includes(x.dmEl) ? 1.5 : 0) + (x.charms.includes('dohwa') ? 1 : 0),
    lead: '먼저 안부를 묻고 대화를 열고', follow: '답장에 질문 하나를 붙여 대화가 이어지게 해 주세요.' },
  { id: 'express', icon: '💌', label: '마음 표현·고백', score: (x) => x.groupCounts.식상 + x.groupCounts.비겁 * 0.5 + (x.dmEl === 'fire' ? 2 : x.dmEl === 'wood' ? 1 : 0) + (x.strength.key === 'strong' ? 1 : 0),
    lead: '"좋아해"를 먼저 꺼내고', follow: '표현을 받으면 꼭 같은 크기로 돌려주세요. 그래야 리드하는 쪽이 지치지 않아요.' },
  { id: 'repair', icon: '🕊️', label: '다툰 뒤 화해', score: (x) => x.groupCounts.인성 + (['earth', 'water'].includes(x.dmEl) ? 1.5 : 0) + (x.strength.key === 'strong' ? 0 : 1),
    lead: '먼저 손을 내밀어 분위기를 풀고', follow: '내민 손을 바로 잡아 주고 "먼저 말해 줘서 고마워"라고 해 주세요.' },
];

export function leadBalance(a, b) {
  let la = 0, lb = 0;
  const areas = LEAD_AREAS.map((ar) => {
    const sa = ar.score(a), sb = ar.score(b);
    const diff = sa - sb;
    let who = null;
    if (diff >= 1) { who = a; la++; } else if (diff <= -1) { who = b; lb++; }
    const other = who === a ? b : a;
    return {
      id: ar.id, icon: ar.icon, label: ar.label, who: who ? who.name : null,
      text: who ? `${who.name}님이 ${ar.lead} ${other.name}님은 ${ar.follow}` : `두 사람 기운이 비슷해요. 이번엔 ${a.name}님, 다음엔 ${b.name}님처럼 번갈아 이끌면 공평하고 재밌어요.`,
    };
  });
  const tie = 4 - la - lb;
  const pctA = Math.round(((la + tie / 2) / 4) * 100);
  let type;
  if (Math.abs(la - lb) <= 1) type = { title: '시소형 커플', emoji: '⚖️', text: '주도권이 고르게 나뉘어 있어요. 영역마다 잘하는 사람이 이끄는 "분업"이 가장 잘 맞아요.' };
  else {
    const L = la > lb ? a : b, F = la > lb ? b : a;
    type = { title: `${L.name}님 리드형 커플`, emoji: '🧭', text: `${L.name}님이 이끄는 영역이 많아요. ${F.name}님의 의견을 먼저 물어봐 주면 끌려가는 느낌 대신 "함께 간다"는 느낌이 들어요.` };
  }
  const tips = [];
  if (Math.abs(la - lb) <= 1 && a.strength.key === 'strong' && b.strength.key === 'strong') tips.push('둘 다 이끌고 싶은 사이예요. 정하기 전에 "너는 어때?" 한 번만 물어도 부딪힘이 확 줄어요.');
  if (Math.abs(la - lb) <= 1 && a.strength.key === 'weak' && b.strength.key === 'weak') tips.push('둘 다 상대가 먼저 해 주길 기다리는 사이예요. 사소한 것부터 먼저 제안하는 쪽이 관계를 데워요.');
  tips.push('주도권은 이기는 게 아니라 나눠 드는 짐이에요. 이끈 사람에겐 고마움을, 따라 준 사람에겐 배려를 말로 전해 주세요.');
  return { areas, pctA, type, tips, leadA: la, leadB: lb };
}

export const CONSENT = [
  '둘 다 원할 때만 — 한 사람이라도 망설이면 멈추기',
  '"싫어", "잠깐만"은 언제든 말할 수 있고, 들은 쪽은 바로 멈추기',
  '술에 많이 취했거나 판단이 흐릴 때는 미루기',
  '마음은 중간에 바뀌어도 괜찮다는 걸 서로 기억하기',
  '피임과 건강은 둘이 함께 챙기기',
  '사진·영상은 상대 동의 없이 찍거나 보내지 않기',
];

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

  // 둘만의 시간을 보내기 좋은 날 (앞으로 30일) · 시간대 (저녁~밤)
  const dayScore = (st, br) => {
    let v = 0;
    const why = [];
    for (const x of [a, b]) {
      if (x.peachBranches.includes(br)) { v += 3; why.push(`${nim(x)}의 도화가 피는 날`); }
      if (br === RED_FLAME[x.dm]) { v += 2; why.push(`${nim(x)}의 홍염이 뜨는 날`); }
      const rel = branchRelation(br, x.dayBranch);
      if (rel === 'harmony') { v += 3; why.push(`${nim(x)}의 배우자 자리와 합`); }
      if (rel === 'trine') v += 1;
      if (rel === 'clash') v -= 3;
      if (stemsCombine(st, x.dm)) { v += 2; why.push(`${nim(x)}의 일간과 합`); }
    }
    return { v, why };
  };
  const dates = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(nowMs + 9 * 3600000 + i * 86400000);
    const yy = d.getUTCFullYear(), mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
    const pz = dayPillarOf(yy, mm, dd);
    dates.push({ y: yy, m: mm, d: dd, wd: WEEKDAYS[d.getUTCDay()], ...dayScore(pz.stem, pz.branch) });
  }
  const goodDates = [...dates].sort((p, q) => q.v - p.v).slice(0, 3).sort((p, q) => dates.indexOf(p) - dates.indexOf(q));
  const wdCount = {};
  for (const x of [...dates].sort((p, q) => q.v - p.v).slice(0, 8)) wdCount[x.wd] = (wdCount[x.wd] || 0) + 1;
  const goodWeekday = Object.keys(wdCount).sort((p, q) => wdCount[q] - wdCount[p])[0];
  const NIGHT = [[9, '유시', '17:30~19:29'], [10, '술시', '19:30~21:29'], [11, '해시', '21:30~23:29'], [0, '자시', '23:30~01:29']];
  const refStem = dayPillarOf(dates[0].y, dates[0].m, dates[0].d).stem;
  const goodHour = NIGHT.map(([hb, name, range]) => ({ name, range, v: dayScore(hourPillarOf(refStem, hb).stem, hb).v }))
    .sort((p, q) => q.v - p.v)[0];

  const touch = (x) => ({ likes: TOUCH_LIKES[x.dmEl], soft: SOFT_SPOTS[x.dmEl] });
  const tempKey = p3.key === 'hot' || p3.key === 'cool' ? p3.key : '';

  return {
    blocked: false, a, b, parts, raw, score, grade, styleA, styleB, strengths, cautions, tips, moodEl, mood, months, hot, rest,
    goodDates, goodWeekday, goodHour, touchA: touch(a), touchB: touch(b), cards: TALK_CARDS, consent: CONSENT,
    openB: openHeart(b, tempKey), openA: openHeart(a, tempKey),
    weaponsA: loveWeapons(a, b), weaponsB: loveWeapons(b, a), lead: leadBalance(a, b),
  };
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
    `연애 무기: ${r.a.name} ${r.weaponsA.map((w) => w.name).join(', ')} / ${r.b.name} ${r.weaponsB.map((w) => w.name).join(', ')}`,
    `주도권 밸런스: ${r.lead.type.title} — ${r.lead.areas.map((x) => `${x.label} ${x.who ? `${x.who} 리드` : '번갈아'}`).join(', ')}`,
  ].join('\n');
}
