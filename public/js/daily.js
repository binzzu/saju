// 오늘의 운세 — 그날의 일진(日辰)을 내 사주에 비춰 총운·연애·금전·직장/학업·건강·대인운과 행운 정보를 계산한다.
import {
  STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, ANIMALS, ELEMENT_KO, STEM_ELEMENT, BRANCH_ELEMENT, BRANCH_MAIN_STEM, TEN_GOD_GROUP,
  tenGod, branchRelation, stemsCombine, dayPillarOf, hourPillarOf,
} from './saju.js';
import { periodLove, LUCK, STATUS_LABEL } from './reading.js';
import { WEEKDAYS } from './text.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

// 그날 일간이 내게 무엇인지(십신)에 따른 하루의 테마
export const GOD_DAY = {
  비견: { emoji: '🪞', word: '나다움', line: '내 페이스대로 밀고 나가면 잘 풀리는 날', good: ['혼자 집중해야 하는 일 끝내기', '친구와 가볍게 만나 에너지 충전'], bad: '고집 부리다 남의 의견을 놓치기' },
  겁재: { emoji: '⚔️', word: '경쟁', line: '지기 싫은 마음이 올라오는 날 — 승부욕을 좋은 데 쓰세요', good: ['운동처럼 승부욕을 쓸 곳 찾기', '함께하는 일에서 내 몫을 확실히 하기'], bad: '충동구매, 돈 빌려주기' },
  식신: { emoji: '🍰', word: '즐거움', line: '여유와 즐거움이 찾아오는 날', good: ['맛있는 것 먹고 좋아하는 취미 즐기기', '주변에 먼저 웃으며 말 걸기'], bad: '과식·과음, 할 일 미루기' },
  상관: { emoji: '🎤', word: '표현', line: '말과 아이디어가 반짝이는 날 — 단, 말조심', good: ['기획·글쓰기·발표처럼 표현하는 일', '늘 하던 일을 새로운 방식으로 해 보기'], bad: '윗사람에게 날 선 말, 홧김에 보내는 메시지' },
  편재: { emoji: '🎰', word: '기회', line: '뜻밖의 기회와 바쁜 일정이 많은 날', good: ['새로운 사람과 제안에 마음 열기', '미뤄 둔 정산이나 중고 거래'], bad: '큰돈이 걸린 즉흥적인 결정' },
  정재: { emoji: '🪙', word: '성실', line: '꼼꼼함이 보상받는 날 — 차곡차곡 쌓여요', good: ['가계부·정리·마감 처리', '약속 시간 칼같이 지키기'], bad: '계획에 없던 지출' },
  편관: { emoji: '🏋️', word: '도전', line: '압박이 있지만 해내면 크게 성장하는 날', good: ['미뤄 둔 어려운 일 정면 돌파', '운동으로 스트레스 풀기'], bad: '무리한 일정, 감정적인 맞대응' },
  정관: { emoji: '🎖️', word: '인정', line: '책임감이 빛나고 인정받기 좋은 날', good: ['보고·면접·중요한 약속 잡기', '단정한 옷차림으로 신뢰 얻기'], bad: '규칙이나 약속을 가볍게 넘기기' },
  편인: { emoji: '🔮', word: '직감', line: '감이 좋고 아이디어가 떠오르는 날', good: ['혼자 생각을 정리하고 메모하기', '새로운 공부나 콘텐츠 찾아보기'], bad: '혼자 앞서 걱정하고 단정 짓기' },
  정인: { emoji: '📚', word: '배움', line: '배우고 도움받기 좋은 날', good: ['공부·자격증·독서에 집중하기', '선배나 어른에게 조언 구하기'], bad: '받기만 하고 움직이지 않기' },
};

const REL_DAY = {
  harmony: { pts: 10, text: '오늘의 기운이 내 배우자 자리(일지)와 합을 이뤄요. 마음 맞는 사람을 만나고 일이 매끄럽게 풀리기 쉬워요.' },
  trine: { pts: 7, text: '오늘의 기운이 내 일지와 같은 삼합 그룹이에요. 흐름을 타면 일이 술술 풀려요.' },
  same: { pts: 2, text: '오늘의 기운이 내 일지와 같은 글자예요. 익숙하고 편안한 하루예요.' },
  neutral: { pts: 0, text: '오늘의 기운과 내 일지 사이에 큰 변수가 없는 잔잔한 하루예요.' },
  punish: { pts: -6, text: '오늘의 기운이 내 일지와 "형"이에요. 잔소리나 사소한 마찰에 휘말리지 않게 조심하세요.' },
  wonjin: { pts: -7, text: '오늘의 기운이 내 일지와 "원진"이에요. 말투 하나로 오해가 생기기 쉬우니 한 번 더 부드럽게.' },
  clash: { pts: -11, text: '오늘의 기운이 내 일지와 "충"이에요. 변동과 이동이 많은 날이라 계획에 여유를 두세요.' },
};

// 오행별로 지치기 쉬운 곳 (전통 사주의 오행-몸 대응, 가볍게 참고)
const BODY = { wood: '눈과 어깨', fire: '수면과 심장 박동', earth: '소화', metal: '호흡기와 피부', water: '몸의 냉기와 붓기' };

export function fortuneGrade(s) {
  if (s >= 85) return { label: '대길', emoji: '🌞', key: 'best' };
  if (s >= 72) return { label: '길', emoji: '😊', key: 'good' };
  if (s >= 58) return { label: '평', emoji: '🌤️', key: 'okay' };
  if (s >= 45) return { label: '조심', emoji: '🌥️', key: 'care' };
  return { label: '쉼표', emoji: '🌧️', key: 'rest' };
}

// 시간대(시진 3개씩)
const BLOCKS = [
  { key: 'morning', label: '아침', range: '05:30~11:29', branches: [3, 4, 5] },
  { key: 'day', label: '낮', range: '11:30~17:29', branches: [6, 7, 8] },
  { key: 'evening', label: '저녁', range: '17:30~23:29', branches: [9, 10, 11] },
  { key: 'night', label: '밤', range: '23:30~05:29', branches: [0, 1, 2] },
];
const HOUR_NAME = ['자시', '축시', '인시', '묘시', '진시', '사시', '오시', '미시', '신시', '유시', '술시', '해시'];
const HOUR_RANGE = ['23:30~01:29', '01:30~03:29', '03:30~05:29', '05:30~07:29', '07:30~09:29', '09:30~11:29', '11:30~13:29', '13:30~15:29', '15:30~17:29', '17:30~19:29', '19:30~21:29', '21:30~23:29'];

function hourScore(a, dayStem, hb) {
  const hp = hourPillarOf(dayStem, hb);
  let s = 55;
  s += { harmony: 12, trine: 7, same: 2, neutral: 0, punish: -6, wonjin: -6, clash: -12 }[branchRelation(hb, a.dayBranch)];
  if (stemsCombine(hp.stem, a.dm)) s += 6;
  if (STEM_ELEMENT[hp.stem] === a.lucky) s += 5;
  if (BRANCH_ELEMENT[hb] === a.lucky) s += 4;
  return s;
}

// 그날의 기운까지 더했을 때 가장 부족한 "도움 되는" 오행 = 오늘의 행운 오행
function luckyOfDay(a, stem, branch) {
  const counts = { ...a.counts };
  counts[STEM_ELEMENT[stem]]++;
  counts[BRANCH_ELEMENT[branch]]++;
  const r = a.rel;
  const cands = a.strength.key === 'strong' ? [r.output, r.wealth, r.officer]
    : a.strength.key === 'weak' ? [r.resource, r.same] : [r.output, r.wealth, r.officer, r.resource, r.same];
  return cands.reduce((best, el) => (counts[el] < counts[best] ? el : best), cands[0]);
}

export function dateAt(nowMs, offset = 0) {
  const d = new Date(nowMs + 9 * 3600000 + offset * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: WEEKDAYS[d.getUTCDay()] };
}

function scoresFor(a, stem, branch) {
  const gS = tenGod(a.dm, stem), gB = tenGod(a.dm, BRANCH_MAIN_STEM[branch]);
  const has = (g) => gS === g || gB === g;
  const hasG = (grp) => TEN_GOD_GROUP[gS] === grp || TEN_GOD_GROUP[gB] === grp;
  const rel = branchRelation(branch, a.dayBranch);
  const relPts = REL_DAY[rel].pts;
  const weak = a.strength.key === 'weak', strong = a.strength.key === 'strong';
  const stemEl = STEM_ELEMENT[stem], brEl = BRANCH_ELEMENT[branch];
  const luckyPts = (stemEl === a.lucky ? 6 : 0) + (brEl === a.lucky ? 4 : 0);
  const combo = stemsCombine(stem, a.dm);

  let base = 56 + relPts + luckyPts + (combo ? 6 : 0);
  const support = hasG('인성') || hasG('비겁');
  if (weak && support) base += 5;
  if (strong && support) base -= 3;
  if (strong && (hasG('식상') || hasG('재성') || hasG('관성'))) base += 4;
  if (weak && gS === '편관') base -= 4;

  let money = 52 + relPts * 0.4 + luckyPts * 0.5;
  if (has('정재')) money += 14;
  if (has('편재')) money += 12;
  if (hasG('식상')) money += 5;
  if (has('겁재')) money -= 12; else if (has('비견')) money -= 5;
  if (weak && hasG('재성')) money -= 4;

  let work = 52 + relPts * 0.5 + luckyPts * 0.5;
  if (has('정관')) work += 14;
  if (has('편관')) work += 7;
  if (has('정인')) work += 10;
  if (has('편인')) work += 6;
  if (has('식신')) work += 3;
  if (has('상관')) work -= 7;

  let health = 58 + (rel === 'clash' ? -10 : rel === 'punish' ? -6 : rel === 'harmony' ? 4 : 0);
  const excess = a.counts[stemEl] >= 3 ? stemEl : a.counts[brEl] >= 3 ? brEl : null;
  if (excess) health -= 5;
  const fills = a.missing.includes(stemEl) || a.missing.includes(brEl);
  if (fills) health += 6;
  if (weak && support) health += 6;
  if (weak && has('편관')) health -= 6;
  if (strong && hasG('식상')) health += 4;

  let social = 54 + relPts * 0.8 + (combo ? 4 : 0);
  if (has('식신')) social += 9;
  if (has('비견')) social += 6;
  if (has('정관')) social += 3;
  if (has('겁재')) social -= 5;
  if (has('상관')) social -= 5;

  const love = periodLove(a, stem, branch);
  // 가운데를 기준으로 폭을 넓혀 좋은 날·조심할 날이 구분되게
  const S = (v, mid, k) => clamp(mid + (v - mid) * k, 12, 98);
  const sc = {
    love: love.score, money: S(money, 57, 1.5), work: S(work, 59, 1.6),
    health: S(health, 58, 1.6), social: S(social, 56, 1.6),
  };
  const avg = (sc.love + sc.money + sc.work + sc.health + sc.social) / 5;
  sc.overall = S(base * 0.6 + avg * 0.4, 59, 1.8);
  return { sc, gS, gB, has, hasG, rel, love, excess, fills, combo };
}

export function dailyFortune(a, nowMs = Date.now(), offset = 0) {
  const date = dateAt(nowMs, offset);
  const p = dayPillarOf(date.y, date.m, date.d);
  const { sc, gS, gB, has, hasG, rel, love, excess, fills, combo } = scoresFor(a, p.stem, p.branch);
  const couple = a.person.status === 'couple';

  // 분야별 한 줄
  const moneyLine = has('겁재') ? '돈이 새기 쉬운 날이에요. 지갑은 닫고, 돈 빌려주기는 다음으로 미루세요.'
    : has('정재') ? '꾸준히 들어오는 돈의 기운이에요. 아끼고 모으는 일이 잘 맞아요.'
      : has('편재') ? '뜻밖의 수입이나 기회가 보여요. 다만 크게 거는 결정은 하루 미루세요.'
        : hasG('식상') ? '내 재능이 돈이 되는 날이에요. 부업·판매·제안서에 힘을 실어 보세요.'
          : sc.money >= 60 ? '큰 변수 없이 무난하게 흘러가요.' : '들어오는 것보다 나가는 게 보이는 날이에요. 지출을 한 번 점검해 보세요.';
  const workLine = has('정관') ? '책임감이 인정받는 날이에요. 보고·면접·중요한 약속에 강해요.'
    : has('정인') ? '배움에 집중력이 붙는 날이에요. 공부·자격증 준비에 좋아요.'
      : has('편관') ? '압박이 느껴져도 정면 돌파하면 성과가 나요. 무리한 일정만 피하세요.'
        : has('편인') ? '기획과 아이디어에 강한 날이에요. 떠오르는 생각은 바로 메모!'
          : has('상관') ? '윗사람과 부딪히기 쉬워요. 맞는 말이라도 부드럽게 전하세요.'
            : sc.work >= 60 ? '평소 하던 일이 순조롭게 진행돼요.' : '집중력이 흩어지기 쉬워요. 할 일을 세 개만 정해 끝내 보세요.';
  const healthLine = rel === 'clash' ? '이동이 많고 몸이 들뜨기 쉬워요. 길 위에서 서두르지 말고, 무리한 운동은 쉬어 가세요.'
    : excess ? `${ELEMENT_KO[excess]} 기운이 겹쳐 ${BODY[excess]} 쪽이 피곤해지기 쉬워요. 틈틈이 쉬어 주세요.`
      : fills ? '사주에 부족하던 기운이 채워져 컨디션이 올라오는 날이에요.'
        : sc.health >= 60 ? '컨디션이 무난해요. 물 많이 마시고 가볍게 스트레칭!' : '피로가 쌓이기 쉬운 날이에요. 일찍 자는 게 최고의 보약이에요.';
  const socialLine = rel === 'harmony' ? '도움 주는 사람을 만나기 쉬운 날이에요. 약속을 피하지 마세요.'
    : has('식신') ? '분위기 메이커가 되는 날이에요. 먼저 웃으며 다가가 보세요.'
      : has('비견') ? '친구·동료와 손발이 잘 맞아요. 함께하는 일이 잘 풀려요.'
        : has('겁재') ? '비교와 경쟁심이 생기기 쉬워요. 남과 나를 견주지 마세요.'
          : has('상관') ? '말실수를 조심하세요. 농담도 한 번 더 생각하고!'
            : rel === 'clash' ? '의견 충돌이 생기기 쉬워요. 오늘은 듣는 쪽이 이겨요.' : '무난한 관계운이에요. 연락이 뜸했던 사람에게 안부 한 줄 어때요?';
  const loveLine = couple ? love.reason.couple : a.person.status === 'some' ? `${love.reason.solo} 썸 상대에게 먼저 연락해 봐도 좋아요.` : love.reason.solo;

  const cats = [
    { key: 'love', icon: '💗', label: '연애운', score: sc.love, line: loveLine, sub: `${love.reason.emoji} ${love.reason.label}` },
    { key: 'money', icon: '💰', label: '금전운', score: sc.money, line: moneyLine },
    { key: 'work', icon: '💼', label: '직장·학업운', score: sc.work, line: workLine },
    { key: 'health', icon: '🍀', label: '건강운', score: sc.health, line: healthLine },
    { key: 'social', icon: '🤝', label: '대인운', score: sc.social, line: socialLine },
  ].map((c) => ({ ...c, grade: fortuneGrade(c.score) }));

  // 시간대
  const hours = Array.from({ length: 12 }, (_, hb) => ({ branch: hb, name: HOUR_NAME[hb], range: HOUR_RANGE[hb], score: hourScore(a, p.stem, hb) }));
  const blocks = BLOCKS.map((b) => {
    const s = Math.round(b.branches.reduce((t, hb) => t + hours[hb].score, 0) / b.branches.length);
    return { ...b, score: clamp(60 + (s - 57) * 1.6, 12, 98) };
  });
  const bestHour = [...hours].sort((x, y) => y.score - x.score)[0];
  const worstHour = [...hours].sort((x, y) => x.score - y.score)[0];
  const bestBlock = [...blocks].sort((x, y) => y.score - x.score)[0];
  const careBlock = [...blocks].sort((x, y) => x.score - y.score)[0];

  // 행운 정보
  const luckyEl = luckyOfDay(a, p.stem, p.branch);
  const L = LUCK[luckyEl];
  const seed = date.y * 372 + date.m * 31 + date.d;
  const lucky = {
    el: luckyEl, color: L.color, swatch: L.swatch, number: L.numbers, direction: L.direction,
    food: L.food, item: L.items[seed % L.items.length], place: L.places[seed % L.places.length],
    time: `${bestHour.name} (${bestHour.range})`,
  };

  const theme = { god: gS, ...GOD_DAY[gS] };
  const sub = { god: gB, ...GOD_DAY[gB] };
  const todo = [...new Set([...theme.good, sub.good[0], `${bestBlock.label}(${bestBlock.range})에 중요한 일 몰아서 하기`])].slice(0, 4);
  const avoid = [theme.bad];
  if (sub.bad !== theme.bad) avoid.push(sub.bad);
  if (rel === 'clash') avoid.push('충동적인 이사·이직 같은 큰 결정');
  if (rel === 'wonjin' || rel === 'punish') avoid.push('카톡으로 예민한 이야기 꺼내기');
  avoid.push(`${worstHour.name}(${worstHour.range})에 중요한 약속 잡기`);

  return {
    date, offset, pillar: { ...p, hanja: STEMS[p.stem] + BRANCHES[p.branch], hangul: STEMS_KO[p.stem] + BRANCHES_KO[p.branch], animal: ANIMALS[p.branch] },
    overall: sc.overall, grade: fortuneGrade(sc.overall), theme, sub, rel, relText: REL_DAY[rel].text, combo,
    cats, love, blocks, bestBlock, careBlock, bestHour, worstHour, lucky, todo, avoid: avoid.slice(0, 4),
    status: STATUS_LABEL[a.person.status] || '솔로',
  };
}

export function weekFortune(a, nowMs = Date.now(), start = 0, days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const date = dateAt(nowMs, start + i);
    const p = dayPillarOf(date.y, date.m, date.d);
    const { sc } = scoresFor(a, p.stem, p.branch);
    return { offset: start + i, ...date, overall: sc.overall, grade: fortuneGrade(sc.overall), god: tenGod(a.dm, p.stem) };
  });
}

export function summaryDailyForAI(f) {
  return `오늘(${f.date.y}-${f.date.m}-${f.date.d}, ${f.pillar.hanja}일)의 운세: 총운 ${f.overall}점(${f.grade.label}, 테마 "${f.theme.word}" — ${f.theme.line}) / ${f.cats.map((c) => `${c.label} ${c.score}`).join(', ')} / 좋은 시간 ${f.bestBlock.label}(${f.bestBlock.range}) / 행운 컬러 ${f.lucky.color}`;
}

