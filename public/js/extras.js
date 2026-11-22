// 부가 기능 계산 — 궁합 랭킹 · 썸 성공 확률 · 기념일 운세 · 이달의 연애 리포트 · 이상형 찾기 · 캐릭터 호감도
// 화면(DOM)과 상관없는 순수 계산만 둔다.
import {
  STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, ANIMALS, ELEMENT_KO, STEM_ELEMENT, TEN_GOD_GROUP,
  branchRelation, stemsCombine, dayPillarOf, tenGod, yearMonthPillarsAt, seoulWallToUtc,
} from './saju.js';
import { DAY_MASTERS, ELEMENT_INFO, LUCK, periodLove, grade as loveGrade } from './reading.js';
import { analyzeCompat } from './compat.js';
import { dayScoresAt } from './daily.js';
import { WEEKDAYS } from './text.js';

const DAY = 86400000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const kstToday = (nowMs) => { const d = new Date(nowMs + 9 * 3600000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const dayNum = ({ y, m, d }) => Math.floor(Date.UTC(y, m - 1, d) / DAY);
const fromNum = (n) => { const t = new Date(n * DAY); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: WEEKDAYS[t.getUTCDay()] }; };
const topGroup = (x) => Object.keys(x.groupCounts).sort((p, q) => x.groupCounts[q] - x.groupCounts[p])[0];
const coupleLove = (a, b, t) => Math.round((dayScoresAt(a, t.y, t.m, t.d).love + dayScoresAt(b, t.y, t.m, t.d).love) / 2);

/* ───────────── 💯 궁합 랭킹 ───────────── */

/** @param people [{id, x(분석 결과)}] → 궁합 점수 높은 순 */
export function rankCompat(me, people) {
  return people.map(({ id, x }) => {
    const c = analyzeCompat(me, x);
    const best = c.parts.filter((pt) => pt.id !== 'zodiac').sort((p, q) => q.points / q.max - p.points / p.max)[0];
    return { id, name: x.name, emoji: x.profile.emoji, score: c.score, grade: c.grade, best: `${best.icon} ${best.short}`, x };
  }).sort((p, q) => q.score - p.score || p.name.localeCompare(q.name, 'ko'));
}

/* ───────────── 💭 썸 성공 확률 ───────────── */

const SIGNALS = {
  wood: ['내 계획이나 꿈 이야기를 자꾸 물어봐요', '다음 약속을 먼저 잡으려 해요', '작은 일에도 칭찬을 아끼지 않아요'],
  fire: ['답장이 빠르고 이모티콘이 많아요', '나를 웃기려고 애써요', '사람들 앞에서도 나에게 자주 말을 걸어요'],
  earth: ['내 컨디션과 끼니를 챙겨요', '조용히 곁에 오래 머물러요', '부탁하면 거절하지 않고 들어줘요'],
  metal: ['약속 시간을 칼같이 지켜요', '나에게만 말투가 살짝 부드러워져요', '내가 한 말을 정확히 기억해요'],
  water: ['밤늦게 긴 대화를 이어 가요', '내 기분 변화를 먼저 알아채요', '속마음이나 고민을 털어놓아요'],
};
const DONT = {
  wood: '상대의 계획을 가볍게 넘기거나 놀리는 말', fire: '답장을 너무 오래 미루는 차가운 반응',
  earth: '갑자기 확 다가갔다가 갑자기 식는 온도 차', metal: '약속을 어기거나 말을 바꾸는 것', water: '속마음을 캐묻거나 대화를 서둘러 끝내는 것',
};
const PUSH = [
  { label: '밀당 없이 직진', text: '재는 순간 멀어지는 타입이에요. 연락도 마음도 솔직하고 꾸준하게 보여 주세요.' },
  { label: '거의 직진', text: '안정감이 먼저인 사람이에요. 답장은 빠르게, 표현은 따뜻하게 하되 부담은 주지 마세요.' },
  { label: '살짝 여유 있게', text: '다정하게 다가가되 내 일상도 바쁘게 보여 주면 더 궁금해해요.' },
  { label: '적당한 밀당', text: '쉽게 얻은 건 쉽게 여기는 편이에요. 답장 속도를 상대에 맞추고, 내 기준도 분명히 보여 주세요.' },
  { label: '밀당 고수', text: '도전을 즐기는 사람이에요. 매번 맞춰 주기보다 가끔 "나도 선택하는 사람"이라는 걸 보여 주세요.' },
];

export function analyzeSsum(a, b, nowMs = Date.now()) {
  const c = analyzeCompat(a, b);
  const ym = yearMonthPillarsAt(nowMs);
  const la = periodLove(a, ym.month.stem, ym.month.branch).score, lb = periodLove(b, ym.month.stem, ym.month.branch).score;
  const monthAvg = (la + lb) / 2;
  const plus = [], minus = [];
  let bonus = 0;
  if (b.dmEl === a.partner.el) { bonus += 6; plus.push(`${a.name}님 사주에서 ${b.name}님은 "인연의 별"이에요`); }
  if (a.dmEl === b.partner.el) { bonus += 7; plus.push(`${b.name}님 사주에서도 ${a.name}님이 "인연의 별"이에요`); }
  if (stemsCombine(a.dm, b.dm)) { bonus += 6; plus.push('두 사람 일간이 천간합 — 자석처럼 끌리는 사이'); }
  if (b.peachBranches.includes(a.dayBranch) || b.peachBranches.includes(a.yearBranch)) { bonus += 5; plus.push(`${a.name}님이 ${b.name}님의 도화(설렘) 자리에 있어요`); }
  const rel = branchRelation(a.dayBranch, b.dayBranch);
  if (rel === 'harmony' || rel === 'trine') { bonus += 4; plus.push('함께 있을 때 편안한 생활 궁합'); }
  if (rel === 'clash') { bonus -= 5; minus.push('생활 리듬이 달라 오해가 생기기 쉬워요'); }
  if (rel === 'wonjin') { bonus -= 3; minus.push('사소한 말투에 서운해지기 쉬운 사이예요'); }
  if (lb >= 70) { bonus += 4; plus.push(`이번 달 ${b.name}님의 연애운이 열려 있어요`); }
  if (lb < 48) { bonus -= 4; minus.push(`이번 달 ${b.name}님은 연애보다 다른 일에 마음이 가 있어요`); }
  if (b.strength.key === 'weak' && b.groupCounts.인성 >= 2) minus.push(`${b.name}님은 마음을 여는 데 시간이 필요한 타입이에요`);
  if (!plus.length) plus.push('사주 속 특별한 표시는 약하지만, 그만큼 노력이 그대로 통하는 사이예요');
  const prob = clamp(38 + (c.score - 72) * 1.15 + (monthAvg - 55) * 0.6 + bonus, 12, 96);
  const stage = prob >= 75 ? { emoji: '💘', title: '고백 각!', line: '이미 마음이 꽤 기울어 있어요. 타이밍만 잡으면 돼요.' }
    : prob >= 60 ? { emoji: '💗', title: '조금만 더!', line: '호감은 충분해요. 둘만의 추억 몇 개만 더 쌓아 보세요.' }
      : prob >= 45 ? { emoji: '🌱', title: '천천히 데우는 중', line: '아직은 서로 알아 가는 단계예요. 서두르지 말고 자주 보는 게 먼저예요.' }
        : { emoji: '🫖', title: '친구부터 탄탄히', line: '지금은 편한 친구 같은 사이를 다지는 게 오히려 지름길이에요.' };

  // 고백하기 좋은 날 (앞으로 45일)
  const t0 = dayNum(kstToday(nowMs));
  const days = [];
  for (let i = 1; i <= 45; i++) {
    const t = fromNum(t0 + i);
    const sa = dayScoresAt(a, t.y, t.m, t.d), sb = dayScoresAt(b, t.y, t.m, t.d);
    let v = (sa.love + sb.love) / 2;
    if (['harmony', 'trine'].includes(branchRelation(sb.pillar.branch, b.dayBranch))) v += 4;
    if (['금', '토'].includes(t.wd)) v += 2; // 주말 앞뒤는 만나기 쉬워서
    days.push({ ...t, v });
  }
  const confess = [...days].sort((p, q) => q.v - p.v).slice(0, 3).sort((p, q) => dayNum(p) - dayNum(q));

  // 밀당 강도 (상대 성향으로)
  let lv = 2;
  if (b.strength.key === 'strong') lv++;
  if (topGroup(b) === '비겁' || topGroup(b) === '관성') lv++;
  if (b.strength.key === 'weak') lv--;
  if (topGroup(b) === '인성' || b.dmEl === 'earth' || b.dmEl === 'water') lv--;
  lv = Math.max(0, Math.min(4, lv));

  const steps = prob >= 75
    ? [`${confess[0].m}월 ${confess[0].d}일처럼 기운 좋은 날, 분위기 좋은 곳에서 마음을 전해 보세요.`, '고백은 길게 말하기보다 "너랑 있으면 좋아" 한 문장이 가장 강해요.', '대답을 재촉하지 말고 하루 정도 여유를 주세요.']
    : prob >= 60
      ? ['둘만 아는 농담이나 장소를 하나 만들어 보세요.', `${b.name}님이 좋아하는 것에 관심을 보이고 다음 약속을 자연스럽게 잡으세요.`, '고백 전에 "요즘 나 어때?"처럼 가볍게 마음을 떠보는 것도 좋아요.']
      : prob >= 45
        ? ['일주일에 한 번은 얼굴 보는 사이를 만들어 보세요.', '연락은 짧고 자주, 질문 하나를 붙여서요.', '고백은 확실한 신호가 두세 개 보일 때까지 아껴 두세요.']
        : ['친구들과 함께 만나는 자리부터 늘려 보세요.', `${b.name}님의 고민을 들어 주는 편한 사람이 되는 게 먼저예요.`, '나를 가꾸는 시간도 놓치지 마세요. 매력은 여유에서 나와요.'];
  return {
    a, b, prob, stage, compat: c.score, monthA: la, monthB: lb, plus, minus, confess,
    push: { level: lv + 1, ...PUSH[lv] }, signals: SIGNALS[b.dmEl], dont: DONT[b.dmEl], steps,
  };
}

/* ───────────── 💍 우리 기념일 운세 ───────────── */

const START_EL = {
  wood: { title: '함께 자라는 새싹 커플', text: '나무 기운의 날에 시작했어요. 서로를 키워 주며 함께 성장하는 관계예요. 새로운 도전을 같이 할수록 단단해져요.' },
  fire: { title: '불꽃처럼 뜨거운 커플', text: '불 기운의 날에 시작했어요. 설렘이 크고 표현이 풍부한 관계예요. 뜨거운 만큼 다툼도 빠르니, 식기 전에 먼저 화해하는 게 비결이에요.' },
  earth: { title: '든든한 둥지 커플', text: '흙 기운의 날에 시작했어요. 편안함과 믿음이 쌓이는 관계예요. 익숙함 속에 작은 이벤트를 섞어 주면 오래 설레요.' },
  metal: { title: '약속을 지키는 보석 커플', text: '쇠 기운의 날에 시작했어요. 서로의 기준과 약속을 소중히 여기는 관계예요. 규칙을 함께 정하면 더 빛나요.' },
  water: { title: '깊이 흐르는 물결 커플', text: '물 기운의 날에 시작했어요. 대화가 깊고 감성이 통하는 관계예요. 속마음을 자주 나눌수록 깊어져요.' },
};
const DATE_IDEA = {
  wood: ['꽃다발과 함께 공원 피크닉', '함께 화분 하나 키우기 시작하기', '아침 브런치 데이트'],
  fire: ['야경 명소에서 사진 찍기', '공연·콘서트 데이트', '서로에게 손편지 낭독하기'],
  earth: ['둘만의 홈파티와 직접 만든 요리', '첫 데이트 장소 다시 가 보기', '커플 앨범 만들기'],
  metal: ['커플 반지·액세서리 맞추기', '깔끔한 레스토랑 코스 디너', '다음 1년의 약속 리스트 쓰기'],
  water: ['바다나 강가 산책', '분위기 좋은 바에서 긴 대화', '서로에게 영상 편지 남기기'],
};

/** start: {y,m,d} 사귄 날 (1일째) */
export function analyzeAnniv(a, b, start, nowMs = Date.now()) {
  const today = kstToday(nowMs);
  const s = dayNum(start), t = dayNum(today);
  if (s > t) return { error: '사귄 날은 오늘이거나 오늘 이전이어야 해요.' };
  const daysTogether = t - s + 1;
  const p = dayPillarOf(start.y, start.m, start.d);
  const el = STEM_ELEMENT[p.stem];
  const godA = TEN_GOD_GROUP[tenGod(a.dm, p.stem)], godB = TEN_GOD_GROUP[tenGod(b.dm, p.stem)];
  const GOD_MEAN = { 비겁: '친구처럼 편한', 식상: '표현과 즐거움이 넘치는', 재성: '현실적으로 챙겨 주는', 관성: '책임감 있는', 인성: '보살펴 주는' };
  const relA = branchRelation(p.branch, a.dayBranch), relB = branchRelation(p.branch, b.dayBranch);
  const goodRel = (r) => r === 'harmony' || r === 'trine';
  const startNotes = [
    `${a.name}님에게 이 날은 "${GOD_MEAN[godA]}" 기운이었어요.`,
    `${b.name}님에게 이 날은 "${GOD_MEAN[godB]}" 기운이었어요.`,
  ];
  if (goodRel(relA) && goodRel(relB)) startNotes.push('사귄 날이 두 사람 모두의 배우자 자리와 합을 이뤄요. 시작부터 잘 맞물린 인연이에요!');
  else if (goodRel(relA) || goodRel(relB)) startNotes.push(`사귄 날이 ${goodRel(relA) ? a.name : b.name}님의 배우자 자리와 합을 이뤄요. 시작이 좋은 인연이에요.`);
  else if (relA === 'clash' || relB === 'clash') startNotes.push('사귄 날에 "충"의 기운이 있어요. 강렬하게 시작한 만큼, 서로의 다름을 인정하면 오히려 오래가요.');

  const marks = [];
  for (let n = 100; n <= 3000; n += 100) marks.push({ label: `${n}일`, num: s + n - 1, kind: 'day' });
  for (let k = 1; k <= 10; k++) {
    const yd = { y: start.y + k, m: start.m, d: start.m === 2 && start.d === 29 ? 28 : start.d };
    marks.push({ label: `${k}주년`, num: dayNum(yd), kind: 'year' });
  }
  const upcoming = marks.filter((x) => x.num >= t).sort((x, y) => x.num - y.num).slice(0, 5).map((x) => {
    const d = fromNum(x.num);
    const pd = dayPillarOf(d.y, d.m, d.d);
    const score = coupleLove(a, b, d);
    const dEl = STEM_ELEMENT[pd.stem];
    return { ...x, ...d, dday: x.num - t, score, grade: loveGrade(score), el: dEl, idea: DATE_IDEA[dEl][(d.d + d.m) % 3], hanja: STEMS[pd.stem] + BRANCHES[pd.branch] };
  });
  const passed = marks.filter((x) => x.num < t).length;
  return { a, b, start: { ...start, wd: fromNum(s).wd }, daysTogether, pillar: { hanja: STEMS[p.stem] + BRANCHES[p.branch], hangul: STEMS_KO[p.stem] + BRANCHES_KO[p.branch], animal: ANIMALS[p.branch] }, el, theme: START_EL[el], startNotes, upcoming, passed };
}

/* ───────────── 🗓️ 이달의 연애 리포트 ───────────── */

export function monthReport(a, y, m, nowMs = Date.now()) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = kstToday(nowMs);
  const days = Array.from({ length: last }, (_, i) => {
    const d = i + 1;
    const s = dayScoresAt(a, y, m, d);
    return { d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), love: s.love, overall: s.overall, grade: loveGrade(s.love), isToday: today.y === y && today.m === m && today.d === d };
  });
  const firstWd = days[0].wd;
  const weeks = [];
  days.forEach((x) => { const w = Math.floor((x.d - 1 + firstWd) / 7); (weeks[w] ||= []).push(x); });
  const mAvg = days.reduce((s, x) => s + x.love, 0) / days.length;
  // 이번 달 평균과 비교해 주마다 흐름을 나눈다
  const WEEK_LINE = (v) => (v >= mAvg + 4 || v >= 75 ? '이달의 설렘 주간! 약속과 고백은 이때 잡아 보세요.' : v >= mAvg - 1 ? '기분 좋은 흐름이에요. 먼저 연락해 보세요.' : v >= mAvg - 5 ? '잔잔한 주예요. 나를 가꾸는 데 써 보세요.' : '조금 쉬어 가는 주예요. 예민한 대화는 미뤄요.');
  const weekly = weeks.map((w, i) => {
    const avg = Math.round(w.reduce((s, x) => s + x.love, 0) / w.length);
    const best = [...w].sort((p, q) => q.love - p.love)[0];
    return { no: i + 1, from: w[0].d, to: w[w.length - 1].d, avg, grade: loveGrade(avg), best: best.d, line: WEEK_LINE(avg) };
  });
  const best = [...days].sort((p, q) => q.love - p.love).slice(0, 3).sort((p, q) => p.d - q.d);
  const care = [...days].sort((p, q) => p.love - q.love).slice(0, 3).sort((p, q) => p.d - q.d);
  const ym = yearMonthPillarsAt(seoulWallToUtc(y, m, 15, 12, 0));
  const month = periodLove(a, ym.month.stem, ym.month.branch);
  const avg = Math.round(mAvg);
  return { y, m, days, firstWd, weekly, best, care, month, avg, goodCount: days.filter((x) => x.love >= 72).length };
}

/* ───────────── 🔍 사주로 보는 이상형 ───────────── */

const IDEAL_TRAITS = {
  wood: ['꿈과 목표가 분명한 사람', '나를 응원하고 함께 성장하려는 사람', '자연과 산책을 좋아하는 사람'],
  fire: ['밝게 웃고 리액션이 큰 사람', '표현을 아끼지 않는 솔직한 사람', '새로운 경험을 함께 즐기는 사람'],
  earth: ['한결같고 믿음직한 사람', '약속과 생활이 성실한 사람', '편안하게 기댈 수 있는 사람'],
  metal: ['자기 기준이 분명한 깔끔한 사람', '말한 것은 꼭 지키는 사람', '센스 있고 매너가 좋은 사람'],
  water: ['이야기를 잘 들어 주는 사람', '감수성이 풍부하고 깊이 있는 사람', '조용한 시간을 함께 즐기는 사람'],
};

export function findIdeal(a, people = []) {
  const stems = [];
  const push = (stem, why) => { if (!stems.some((s) => s.stem === stem)) stems.push({ stem, why }); };
  push(a.bestMatchStem, '천간합 — 만나면 자석처럼 끌리는 운명형');
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((s) => STEM_ELEMENT[s] === a.partner.el).forEach((s) => push(s, '내 사주의 "인연의 별" 기운을 가진 사람'));
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((s) => STEM_ELEMENT[s] === a.lucky).forEach((s) => push(s, `내 행운 오행(${ELEMENT_KO[a.lucky]})을 채워 주는 복덩이`));
  const types = stems.slice(0, 3).map((x) => ({ ...x, emoji: DAY_MASTERS[x.stem].emoji, cat: DAY_MASTERS[x.stem].cat, nature: DAY_MASTERS[x.stem].nature, keywords: DAY_MASTERS[x.stem].keywords, hanja: STEMS[x.stem], ko: STEMS_KO[x.stem], el: STEM_ELEMENT[x.stem] }));
  const zod = (rels) => [...Array(12).keys()].filter((br) => rels.includes(branchRelation(a.yearBranch, br)) && br !== a.yearBranch).map((br) => ANIMALS[br]);
  const goodZodiac = zod(['harmony', 'trine']), cautionZodiac = zod(['clash', 'wonjin']);
  const traits = [...new Set([...IDEAL_TRAITS[a.partner.el].slice(0, 2), IDEAL_TRAITS[a.lucky][0]])];
  const meet = LUCK[a.partner.el].places.slice(0, 3);

  const check = (x) => {
    const hits = [];
    if (x.dm === a.bestMatchStem) hits.push('천간합');
    if (x.dmEl === a.partner.el) hits.push('인연의 별');
    if (x.dmEl === a.lucky) hits.push('행운 오행');
    if (goodZodiac.includes(x.animal)) hits.push(`${x.animal}띠`);
    if (['harmony', 'trine'].includes(branchRelation(a.dayBranch, x.dayBranch))) hits.push('생활 궁합');
    return hits;
  };
  const weight = (h) => (h === '천간합' ? 3 : h === '인연의 별' ? 2 : 1);
  const matches = people.map(({ id, x }) => { const hits = check(x); return { id, name: x.name, emoji: x.profile.emoji, hits, w: hits.reduce((t, h) => t + weight(h), 0) }; })
    .filter((m) => m.hits.length).sort((p, q) => q.w - p.w).slice(0, 3);
  return { a, types, goodZodiac, cautionZodiac, traits, meet, matches, partnerEl: a.partner.el, partnerElName: ELEMENT_INFO[a.partner.el].person, ideal: DAY_MASTERS[a.dm].ideal };
}

/* ───────────── 🐱 캐릭터 호감도 ───────────── */

export const AFFINITY_LEVELS = [
  { at: 0, name: '낯가림', emoji: '🙀' },
  { at: 10, name: '아는 손님', emoji: '😺' },
  { at: 30, name: '단골손님', emoji: '😸' },
  { at: 60, name: '친구', emoji: '😻' },
  { at: 100, name: '절친', emoji: '💞' },
  { at: 160, name: '운명의 인연', emoji: '🌙' },
];
// 레벨마다 열리는 표정 (10종)
export const EXPR_UNLOCK = [['smile', 'happy'], ['wink', 'think'], ['surprise', 'pout'], ['sparkle', 'smug'], ['love'], ['worry']];
export const AFFINITY_LINES = {
  myo: ['…처음 보는 얼굴이네냥. 사주부터 보여 줘.', '또 왔냥? 뭐, 반갑지 않은 건 아니야.', '네 사주는 이제 외울 지경이다냥. 단골 인정!', '고민 있으면 제일 먼저 나한테 와라냥. 친구잖아.', '너한텐 비밀 하나 알려 줄게. 나도 사실 연애 고민 많다냥…', '우리 인연, 사주에도 적혀 있었을 거다냥. 앞으로도 잘 부탁해.'],
  coco: ['아, 안녕하세요…! (꾸벅)', '또 와 주셨네요! 기억하고 있었어요.', '오늘은 무슨 이야기 들려주실 거예요? 기대돼요!', '저, 손님이랑 이야기하는 시간이 제일 좋아요!', '헤헤, 이제 언니(오빠)라고 불러도 돼요?', '어떤 운이 와도 제가 옆에서 응원할게요. 약속이에요!'],
};

export function affinityLevel(points = 0) {
  let i = 0;
  AFFINITY_LEVELS.forEach((l, k) => { if (points >= l.at) i = k; });
  const cur = AFFINITY_LEVELS[i], next = AFFINITY_LEVELS[i + 1];
  const pct = next ? Math.round(((points - cur.at) / (next.at - cur.at)) * 100) : 100;
  return { lv: i, ...cur, next: next ? next.at : null, toNext: next ? next.at - points : 0, pct };
}

export function unlockedExpr(lv) {
  return EXPR_UNLOCK.slice(0, lv + 1).flat();
}

const DAILY_CAP = 12;
/**
 * 호감도 올리기 — 하루 한도가 있어 몰아서 올릴 수 없다.
 * @returns {{state, gained, levelUp: null|{who, level}}}
 */
export function gainAffinity(state, who, pts, todayKey) {
  const s = { myo: 0, coco: 0, day: '', today: { myo: 0, coco: 0 }, ...(state || {}) };
  if (s.day !== todayKey) { s.day = todayKey; s.today = { myo: 0, coco: 0 }; }
  const room = Math.max(0, DAILY_CAP - (s.today[who] || 0));
  const gained = Math.min(room, pts);
  const before = affinityLevel(s[who]).lv;
  s[who] = (s[who] || 0) + gained;
  s.today = { ...s.today, [who]: (s.today[who] || 0) + gained };
  const after = affinityLevel(s[who]).lv;
  return { state: s, gained, levelUp: after > before ? { who, level: affinityLevel(s[who]) } : null };
}


/* ───────────── 상담실용 요약 ───────────── */
export function summaryExtrasForAI({ ssum, anniv, month, ideal, rank } = {}) {
  const out = [];
  if (ssum) out.push(`썸 성공 확률: ${ssum.a.name} → ${ssum.b.name} ${ssum.prob}% (${ssum.stage.title}) / 고백 추천일 ${ssum.confess.map((d) => `${d.m}/${d.d}`).join(', ')} / 밀당 ${ssum.push.level}단계 "${ssum.push.label}"`);
  if (anniv && !anniv.error) out.push(`기념일: ${anniv.start.y}.${anniv.start.m}.${anniv.start.d} 시작, ${anniv.daysTogether}일째, "${anniv.theme.title}" / 다가오는 기념일 ${anniv.upcoming.slice(0, 3).map((u) => `${u.label}(${u.m}/${u.d}, 연애운 ${u.score})`).join(', ')}`);
  if (month) out.push(`${month.m}월 연애 리포트: 평균 ${month.avg}, 좋은 날 ${month.best.map((d) => `${month.m}/${d.d}`).join(', ')}, 조심할 날 ${month.care.map((d) => `${month.m}/${d.d}`).join(', ')}`);
  if (ideal) out.push(`사주 이상형: ${ideal.types.map((t) => `${t.cat}(${t.hanja})`).join(', ')} / 잘 맞는 띠 ${ideal.goodZodiac.join('·')}`);
  if (rank && rank.length) out.push(`프리셋 궁합 랭킹: ${rank.slice(0, 5).map((r, i) => `${i + 1}위 ${r.name} ${r.score}점`).join(', ')}`);
  return out.join('\n');
}
