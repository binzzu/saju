// 🔮 미래의 연인 — 내 사주의 "인연의 별"(남자는 재성, 여자는 관성)과 배우자 자리(일지), 신살·십신으로
// 앞으로 만날 연인의 대략적인 생김새·체형·키·MBTI·나이 차이·만나는 때와 장소를 그려 본다.
// 재미로 보는 "가능성 높은 그림"이고, 결과는 같은 사주면 언제나 같다.
import { BRANCH_ELEMENT, TEN_GOD_GROUP, tenGod, BRANCH_MAIN_STEM, yearMonthPillarsAt, seoulWallToUtc, mod } from './saju.js';
import { periodLove, LUCK, ELEMENT_INFO, DAY_MASTERS } from './reading.js';

const EL_KO = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };

// 오행별 인상 (얼굴형·눈·분위기·스타일), 성별에 따라 머리 모양
const LOOK = {
  wood: { face: '갸름하고 긴 얼굴', eyes: '맑고 또렷한 눈', vibe: '청량하고 싱그러운 분위기', style: '셔츠·니트 같은 깔끔한 캐주얼', hair: { M: '앞머리를 내린 부드러운 댄디컷', F: '높게 묶은 포니테일' }, color: '#3FAE72', hairColor: '#4A3426', skin: '#FBE3D2' },
  fire: { face: '이마가 시원한 하트형 얼굴', eyes: '눈꼬리가 살짝 올라간 반짝이는 눈', vibe: '밝고 화사해서 눈에 띄는 분위기', style: '컬러 포인트가 있는 트렌디한 옷', hair: { M: '이마를 드러낸 애즈펌', F: '굵은 웨이브의 긴 머리' }, color: '#F0524F', hairColor: '#6B3424', skin: '#FCE1CF' },
  earth: { face: '동글동글 부드러운 얼굴', eyes: '웃으면 반달이 되는 순한 눈', vibe: '편안하고 다정한 곰돌이 분위기', style: '후드·맨투맨 같은 편한 옷', hair: { M: '단정하게 내린 짧은 머리', F: '어깨에 닿는 단발 레이어드' }, color: '#E9B530', hairColor: '#3A2A20', skin: '#F8DCC4' },
  metal: { face: '턱선이 또렷한 계란형 얼굴', eyes: '가늘고 시크한 눈', vibe: '도도하고 세련된 도시 분위기', style: '셋업·코트 같은 미니멀룩', hair: { M: '옆으로 넘긴 깔끔한 가르마펌', F: '턱선 길이의 단정한 보브' }, color: '#8E88A6', hairColor: '#1F1A24', skin: '#FDEBDD' },
  water: { face: '선이 고운 달걀형 얼굴', eyes: '살짝 처진 촉촉한 눈', vibe: '조용하고 신비로운 감성 분위기', style: '부드러운 소재의 차분한 톤 옷', hair: { M: '눈썹을 덮는 내린 머리', F: '찰랑이는 긴 생머리' }, color: '#3C6FD8', hairColor: '#241C2E', skin: '#FBE6DA' },
};
// 체형 (남녀 공통, 분위기로만)
const BODY = {
  wood: '키가 커 보이는 늘씬하고 길쭉한 체형', fire: '활동적이고 탄탄한 건강미 체형', earth: '포근하고 볼륨감 있는 글래머러스한 체형',
  metal: '군더더기 없이 균형 잡힌 슬림 체형', water: '선이 부드럽고 유연한 체형',
};
// 체형 자세히 — 배우자 자리 오행 × 성별. 실루엣·어깨·몸의 선·팔다리·느낌·자세·잘 어울리는 옷
const BODY_ROWS = [['silhouette', '실루엣'], ['shoulder', '어깨'], ['line', '몸의 선'], ['limbs', '팔다리'], ['tone', '느낌'], ['posture', '자세·걸음'], ['fit', '어울리는 옷']];
const BODY_DETAIL = {
  wood: {
    M: { silhouette: '키에 비해 마른 듯 길쭉한 일자형', shoulder: '넓지는 않지만 곧게 펴진 직각 어깨', line: '군살 없이 곧은 허리선이라 셔츠가 툭 떨어지는 핏', limbs: '팔다리가 길고 손가락이 가늘어요', tone: '잔근육이 살짝 있는 슬림 탄탄형', posture: '등이 곧고 성큼성큼 걸어요', fit: '롱코트·와이드 슬랙스' },
    F: { silhouette: '가늘고 길쭉한 일자형', shoulder: '가녀린 직각 어깨와 긴 목선', line: '허리가 가늘고 전체적으로 슬림한 라인', limbs: '다리가 길어서 비율이 좋아 보여요', tone: '가볍고 산뜻한 슬림형', posture: '목과 등이 곧아 실제 키보다 커 보여요', fit: '롱스커트·와이드 팬츠' },
  },
  fire: {
    M: { silhouette: '어깨가 발달한 역삼각형', shoulder: '넓고 다부진 어깨', line: '가슴과 등이 탄탄하고 허리가 잘록해요', limbs: '팔뚝과 종아리에 운동한 티가 나요', tone: '활동적인 운동형 근육질', posture: '가슴을 펴고 활기차게 걸어요', fit: '반팔 티·트레이닝 셋업' },
    F: { silhouette: '탄탄하고 건강미 있는 균형형', shoulder: '작지만 반듯한 어깨', line: '복부가 탄탄하고 허리선이 또렷해요', limbs: '매끈하고 탄력 있는 팔다리', tone: '필라테스·러닝이 어울리는 건강미', posture: '발걸음이 가볍고 생기 있어요', fit: '크롭 니트·애슬레저룩' },
  },
  earth: {
    M: { silhouette: '듬직하고 포근한 곰돌이형', shoulder: '두툼하고 넓은 어깨', line: '몸통이 두툼해서 안기면 푸근해요', limbs: '굵고 힘 있는 팔', tone: '살짝 통통하지만 힘이 센 체형', posture: '느긋하고 안정감 있게 걸어요', fit: '오버핏 후드·두꺼운 니트' },
    F: { silhouette: '부드럽고 볼륨감 있는 글래머러스형', shoulder: '둥글고 부드러운 어깨선', line: '허리는 잘록하고 골반 라인이 또렷한 곡선 실루엣', limbs: '말랑하고 부드러운 팔', tone: '포근하고 여성스러운 볼륨감', posture: '차분하고 여유롭게 걸어요', fit: '허리 라인이 드러나는 원피스·니트' },
  },
  metal: {
    M: { silhouette: '군더더기 없는 슬림 탄탄형', shoulder: '각진 직각 어깨', line: '허리가 가늘고 몸의 선이 깔끔해요', limbs: '마디가 또렷한 손과 곧은 다리', tone: '마른 근육형', posture: '자세가 반듯하고 절도 있어요', fit: '셋업 수트·슬림 코트' },
    F: { silhouette: '균형 잡힌 슬림형', shoulder: '반듯한 어깨와 또렷한 쇄골 라인', line: '허리가 가늘고 몸의 선이 정돈된 느낌', limbs: '곧고 가는 팔다리', tone: '단단하고 깔끔한 슬림', posture: '꼿꼿한 자세로 또각또각 걸어요', fit: '셔츠·H라인 스커트' },
  },
  water: {
    M: { silhouette: '선이 부드러운 슬림형', shoulder: '살짝 둥근 어깨', line: '마른 듯 부드러운 몸의 선', limbs: '길고 섬세한 손', tone: '근육보다 유연함이 돋보이는 체형', posture: '천천히 조용조용 걸어요', fit: '루즈핏 셔츠·가디건' },
    F: { silhouette: '부드러운 곡선의 유연한 체형', shoulder: '가녀리고 둥근 어깨', line: '허리에서 골반으로 이어지는 부드러운 곡선', limbs: '하얗고 가는 손목', tone: '말랑하고 여리여리한 느낌', posture: '물 흐르듯 사뿐사뿐 걸어요', fit: '플리츠 스커트·실크 블라우스' },
  },
};
// 키 (cm 범위의 가운데) — 인연의 별 오행 + 배우자 자리 기운
const HEIGHT = { M: { wood: 181, fire: 178, earth: 175, metal: 177, water: 174 }, F: { wood: 167, fire: 164, earth: 161, metal: 164, water: 160 } };

// MBTI — 오행이 각 축에 주는 점수 (+면 앞 글자)
const AXIS = {
  EI: { wood: 1, fire: 2, earth: 0, metal: -1, water: -2 },
  SN: { wood: -1, fire: -1, earth: 2, metal: 1, water: -2 },
  TF: { wood: -1, fire: -1, earth: -1, metal: 2, water: 0 },
  JP: { wood: 1, fire: -2, earth: 2, metal: 1, water: -1 },
};
const MBTI_LINE = {
  E: '먼저 말을 걸어 주는 사교적인', I: '조용히 곁을 지켜 주는', S: '현실 감각이 좋은', N: '상상력이 풍부한',
  T: '이성적으로 문제를 푸는', F: '마음을 먼저 헤아리는', J: '계획을 세워 챙겨 주는', P: '즉흥 데이트를 즐기는',
};

// 만나는 곳 — 사주의 기운별 만남 경로
const MEET = {
  yeokma: { where: '여행이나 이동 중', detail: '여행지, 공항·기차, 출장지에서 우연히 마주쳐요' },
  hwagae: { where: '배움과 취향의 모임', detail: '독서·전시·클래스처럼 취향이 같은 모임에서 만나요' },
  dohwa: { where: '설레는 자리', detail: '소개팅이나 파티처럼 사람이 많은 자리에서 눈에 띄어요' },
  hongyeom: { where: '분위기 좋은 곳', detail: '음악이 흐르는 바·공연장처럼 분위기 있는 곳에서 만나요' },
  식상: { where: '취미와 SNS', detail: '취미 동호회나 SNS·커뮤니티에서 대화를 나누다 가까워져요' },
  관성: { where: '학교나 직장', detail: '같은 회사·학교·프로젝트에서 자연스럽게 엮여요' },
  인성: { where: '어른의 소개나 공부', detail: '선배·가족 소개, 스터디·학원에서 인연이 닿아요' },
  비겁: { where: '친구의 소개', detail: '친한 친구의 친구, 지인 모임에서 만나요' },
  재성: { where: '일과 일상 동선', detail: '아르바이트·거래처·단골 가게처럼 일상 동선에서 만나요' },
};
const SEASON = (m) => (m <= 2 || m === 12 ? '겨울' : m <= 5 ? '봄' : m <= 8 ? '여름' : '가을');

const topGroup = (x) => Object.keys(x.groupCounts).sort((p, q) => x.groupCounts[q] - x.groupCounts[p])[0];

/**
 * @param a 내 사주 분석 결과
 * @param want 'M' | 'F' — 보고 싶은 연인의 성별 (기본: 나와 다른 성별)
 */
export function futurePartner(a, want, nowMs = Date.now()) {
  const g = want === 'M' || want === 'F' ? want : (a.gender === 'F' ? 'M' : 'F');
  const el = a.partner.el;                      // 인연의 별 오행 → 생김새의 중심
  const palaceEl = BRANCH_ELEMENT[a.dayBranch];  // 배우자 자리 오행 → 분위기·체형
  const L = LOOK[el], P = LOOK[palaceEl];
  const look = {
    face: L.face, eyes: L.eyes, hair: L.hair[g], vibe: P.vibe, style: P.style,
    body: BODY[palaceEl], el, palaceEl,
    bodyDetail: BODY_ROWS.map(([k, label]) => ({ key: k, label, text: BODY_DETAIL[palaceEl][g][k] })),
  };

  // 키
  let h = (HEIGHT[g][el] * 2 + HEIGHT[g][palaceEl]) / 3;
  if (a.strength.key === 'weak') h += 1.5;   // 기댈 수 있는 사람
  if (a.strength.key === 'strong') h -= 1;
  h = Math.round(h);
  const height = { min: h - 2, max: h + 2, mid: h };

  // MBTI
  const score = (axis) => AXIS[axis][el] * 2 + AXIS[axis][palaceEl] + (axis === 'EI' && a.charms.includes('dohwa') ? 1 : 0) + (axis === 'JP' && a.charms.includes('yeokma') ? -1 : 0);
  const pick = (axis, pos, neg) => { const v = score(axis); return { letter: v >= 0 ? pos : neg, v }; };
  const axes = [pick('EI', 'E', 'I'), pick('SN', 'S', 'N'), pick('TF', 'T', 'F'), pick('JP', 'J', 'P')];
  const type = axes.map((x) => x.letter).join('');
  // 가장 애매한 축을 뒤집은 것이 두 번째 후보
  const weakest = axes.reduce((m, x, i) => (Math.abs(x.v) < Math.abs(axes[m].v) ? i : m), 0);
  const FLIP = { E: 'I', I: 'E', S: 'N', N: 'S', T: 'F', F: 'T', J: 'P', P: 'J' };
  const alt = axes.map((x, i) => (i === weakest ? FLIP[x.letter] : x.letter)).join('');
  const mbti = { type, alt, line: `${MBTI_LINE[type[0]]}, ${MBTI_LINE[type[1]]}, ${MBTI_LINE[type[2]]}, ${MBTI_LINE[type[3]]} 사람` };

  // 연상·동갑·연하
  // 기본값에 일지로 아주 작은 차이를 줘서 동점이 없게 한다
  let older = 20 + (a.dayBranch % 3 === 0 ? 1 : 0), same = 20 + (a.dayBranch % 3 === 1 ? 1 : 0), younger = 20 + (a.dayBranch % 3 === 2 ? 1 : 0);
  const godNames = Object.keys(a.godCounts || {});
  if (a.partner.hasJeong) { if (a.gender === 'F') older += 12; else younger += 8; }
  if (a.partner.hasPyeon) { if (a.gender === 'F') younger += 6; else older += 6; }
  if (a.strength.key === 'weak' || a.groupCounts.인성 >= 2) older += 10;
  if (a.strength.key === 'strong') younger += 10;
  if (a.groupCounts.비겁 >= 2) same += 12;
  if (godNames.includes('식신') || godNames.includes('상관')) younger += 4;
  const tot = older + same + younger;
  const ages = [
    { key: 'older', label: '연상', pct: Math.round((older / tot) * 100) },
    { key: 'same', label: '동갑', pct: Math.round((same / tot) * 100) },
    { key: 'younger', label: '연하', pct: Math.round((younger / tot) * 100) },
  ];
  ages[2].pct = 100 - ages[0].pct - ages[1].pct;
  const topAge = [...ages].sort((p, q) => q.pct - p.pct)[0];
  const gap = topAge.key === 'same' ? '동갑 또는 학번·입사 동기' : `${a.partner.hasPyeon && !a.partner.hasJeong ? '3~6' : '1~3'}살 ${topAge.label}`;
  const age = { list: ages, top: topAge, gap };

  // 만나는 때 — 앞으로 36개월 중 인연의 별이 들어오는 달
  const months = [];
  const now = new Date(nowMs + 9 * 3600000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  for (let i = 0; i < 36; i++) {
    const ym = yearMonthPillarsAt(seoulWallToUtc(y, m, 15, 12, 0));
    const ml = periodLove(a, ym.month.stem, ym.month.branch);
    const yl = periodLove(a, ym.year.stem, ym.year.branch);
    const meet = ml.good.some((k) => ['partner', 'jeong', 'stemCombo', 'peach'].includes(k));
    months.push({ year: y, month: m, score: Math.round(ml.score * 0.7 + yl.score * 0.3) + (meet ? 6 : 0) - Math.floor(i / 6), meet, reason: ml.reason });
    m++; if (m > 12) { m = 1; y++; }
  }
  const ranked = [...months].sort((p, q) => q.score - p.score);
  const best = ranked[0];
  const second = ranked.find((x) => Math.abs((x.year * 12 + x.month) - (best.year * 12 + best.month)) >= 3) || ranked[1];
  const when = {
    year: best.year, month: best.month, season: SEASON(best.month), reason: best.reason,
    second: { year: second.year, month: second.month },
    soon: (best.year * 12 + best.month) - (now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) <= 3,
  };

  // 만나는 곳
  const meetKeys = [];
  for (const c of ['yeokma', 'hwagae', 'dohwa', 'hongyeom']) if (a.charms.includes(c)) meetKeys.push(c);
  const tg = topGroup(a);
  meetKeys.push(tg);
  const palaceGod = TEN_GOD_GROUP[tenGod(a.dm, BRANCH_MAIN_STEM[a.dayBranch])];
  if (!meetKeys.includes(palaceGod)) meetKeys.push(palaceGod);
  for (const k of [a.partner.group, '비겁', '식상']) if (!meetKeys.includes(k)) meetKeys.push(k);
  const meets = [...new Set(meetKeys)].slice(0, 2).map((k) => MEET[k]);
  const places = LUCK[el].places.slice(0, 3);

  // 첫인상 한 줄과 연인의 연애 캐릭터
  const stem = mod(a.bestMatchStem, 10);
  const charStem = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((s) => ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'][s] === el && s % 2 === (stem % 2)) ?? stem;
  const cat = DAY_MASTERS[charStem];

  return {
    a, gender: g, word: g === 'M' ? '남자친구' : '여자친구', look, height, mbti, age, when, meets, places,
    cat: { name: cat.cat, emoji: cat.emoji, keywords: cat.keywords },
    elName: ELEMENT_INFO[el].name, palaceName: ELEMENT_INFO[palaceEl].name, elKo: EL_KO[el],
  };
}

/** 대략적인 생김새 그림 (SVG 문자열) — 오행에 따라 얼굴형·눈·머리·옷 색이 바뀐다 */
export function futureAvatar(r) {
  const L = LOOK[r.look.el], P = LOOK[r.look.palaceEl];
  const g = r.gender, el = r.look.el;
  const ink = '#2A1B3D';
  const face = { wood: [44, 58], fire: [48, 54], earth: [52, 52], metal: [46, 56], water: [46, 55] }[el];
  const cx = 100, cy = 98;
  const hc = L.hairColor;
  // 뒷머리
  const back = g === 'F' ? {
    wood: `<path d="M150 70 q30 10 22 70 q-8 -30 -22 -40 z" fill="${hc}"/>`,
    fire: `<path d="M50 80 q-22 60 -4 110 q10 6 20 -2 q-14 -40 -2 -90 z M150 80 q22 60 4 110 q-10 6 -20 -2 q14 -40 2 -90 z" fill="${hc}"/>`,
    earth: `<path d="M52 82 q-10 50 6 74 l18 -6 q-12 -30 -6 -60 z M148 82 q10 50 -6 74 l-18 -6 q12 -30 6 -60 z" fill="${hc}"/>`,
    metal: `<path d="M54 84 q-6 40 6 60 l16 -2 q-8 -26 -4 -52 z M146 84 q6 40 -6 60 l-16 -2 q8 -26 4 -52 z" fill="${hc}"/>`,
    water: `<path d="M52 80 q-12 70 0 120 l22 0 q-10 -50 -4 -110 z M148 80 q12 70 0 120 l-22 0 q10 -50 4 -110 z" fill="${hc}"/>`,
  }[el] : '';
  // 앞머리
  const front = g === 'F'
    ? `<path d="M${cx - face[0] - 6} ${cy - 6} q2 -${face[1] + 4} ${face[0] + 6} -${face[1] + 2} q${face[0] + 8} 0 ${face[0] + 8} ${face[1] - 2} q-14 -26 -40 -30 q-6 14 -30 22 q-14 4 -24 16 z" fill="${hc}"/>`
    : {
      wood: `<path d="M${cx - face[0] - 4} ${cy - 4} q0 -${face[1] + 8} ${face[0] + 4} -${face[1] + 6} q${face[0] + 6} 0 ${face[0] + 6} ${face[1] + 4} q-18 -18 -30 -16 q-10 8 -26 10 q-14 2 -20 6 z" fill="${hc}"/>`,
      fire: `<path d="M${cx - face[0] - 4} ${cy - 2} q-4 -${face[1] + 14} ${face[0] + 10} -${face[1] + 12} q${face[0]} 2 ${face[0] - 2} ${face[1] + 10} q-6 -18 -24 -22 q-24 0 -36 16 z" fill="${hc}"/>`,
      earth: `<path d="M${cx - face[0] - 4} ${cy - 2} q0 -${face[1] + 6} ${face[0] + 4} -${face[1] + 6} q${face[0] + 4} 0 ${face[0] + 4} ${face[1] + 6} q-10 -14 -50 -14 q-36 0 -50 14 z" fill="${hc}"/>`,
      metal: `<path d="M${cx - face[0] - 4} ${cy} q-2 -${face[1] + 10} ${face[0] + 8} -${face[1] + 8} q${face[0] + 2} 2 ${face[0] - 2} ${face[1] + 6} q-30 -26 -60 -6 q-8 6 -12 10 z" fill="${hc}"/>`,
      water: `<path d="M${cx - face[0] - 4} ${cy} q0 -${face[1] + 8} ${face[0] + 4} -${face[1] + 8} q${face[0] + 4} 0 ${face[0] + 4} ${face[1] + 8} q-8 -6 -18 -4 q-8 10 -16 4 q-8 8 -18 2 q-10 8 -18 0 q-8 4 -14 2 z" fill="${hc}"/>`,
    }[el];
  const pony = g === 'F' && el === 'wood' ? `<circle cx="150" cy="56" r="10" fill="${hc}"/>` : '';
  // 눈
  const ey = cy + 4, ex = 20;
  const eye = (x) => ({
    wood: `<circle cx="${x}" cy="${ey}" r="6.5" fill="${ink}"/><circle cx="${x + 2}" cy="${ey - 2}" r="2" fill="#fff"/>`,
    fire: `<path d="M${x - 8} ${ey + 2} q8 -10 16 -4 q-8 8 -16 4 z" fill="${ink}"/><circle cx="${x + 2}" cy="${ey - 1}" r="1.6" fill="#fff"/>`,
    earth: `<path d="M${x - 7} ${ey + 1} q7 -8 14 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    metal: `<path d="M${x - 9} ${ey} q9 -6 18 -1 q-9 5 -18 1 z" fill="${ink}"/><path d="M${x - 9} ${ey - 3} l18 -3" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    water: `<ellipse cx="${x}" cy="${ey}" rx="6" ry="5.5" fill="${ink}"/><circle cx="${x + 2}" cy="${ey - 1.5}" r="1.8" fill="#fff"/><path d="M${x - 8} ${ey - 6} q8 -3 16 2" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
  }[el]);
  const brow = g === 'M' ? `<path d="M${cx - ex - 9} ${ey - 13} l16 -2 M${cx + ex - 7} ${ey - 15} l16 2" stroke="${hc}" stroke-width="3.5" stroke-linecap="round"/>` : '';
  const chin = cy + face[1];
  return `<svg class="futureface" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" role="img" aria-label="미래의 ${r.word} 대략적인 생김새">
    <defs><radialGradient id="ffbg-${el}-${g}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${L.color}" stop-opacity=".35"/></radialGradient></defs>
    <rect width="200" height="220" rx="24" fill="url(#ffbg-${el}-${g})"/>
    ${back}
    <path d="M40 220 q8 -48 60 -50 q52 2 60 50 z" fill="${P.color}" stroke="${ink}" stroke-width="3"/>
    <path d="M86 ${chin - 6} h28 v20 q-14 8 -28 0 z" fill="${L.skin}" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${face[0]}" ry="${face[1]}" fill="${L.skin}" stroke="${ink}" stroke-width="3"/>
    ${front}${pony}
    ${brow}${eye(cx - ex)}${eye(cx + ex)}
    <ellipse cx="${cx - 30}" cy="${ey + 16}" rx="8" ry="4" fill="#FF8FB4" opacity=".55"/><ellipse cx="${cx + 30}" cy="${ey + 16}" rx="8" ry="4" fill="#FF8FB4" opacity=".55"/>
    <path d="M${cx - 9} ${ey + 24} q9 ${g === 'F' ? 8 : 6} 18 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <g fill="#F7D54A" stroke="${ink}" stroke-width="2"><path d="M168 30 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z"/><path d="M30 150 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"/></g>
    <text x="172" y="200" text-anchor="middle" font-size="30" font-family="Black Han Sans, sans-serif" fill="${ink}" opacity=".85">?</text>
  </svg>`;
}
