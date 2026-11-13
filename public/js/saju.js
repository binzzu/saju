// 사주(四柱) 계산 엔진
// - 연주/월주: 태양 황경(절기) 기준 (입춘 = 315°, 매 30°마다 절입)
// - 일주: 율리우스일 기준 60갑자 (자시 시작 23:00 지방평균시에 날짜 변경)
// - 시주: 지방평균시(동경 127.5° 기준) 기준, 오서둔법으로 시간 천간 계산
// - 한국 표준시 변천(UTC+8:30 시기)과 서머타임은 Intl 'Asia/Seoul' 시간대 데이터로 보정

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

export const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'];
export const ELEMENT_KO = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
export const ELEMENT_HANJA = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

export const STEM_ELEMENT = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
export const BRANCH_ELEMENT = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
// 지지의 정기(본기) 천간 — 십신 계산에 사용
export const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

export const HOUR_LABELS = [
  '자시 (23:30~01:29)', '축시 (01:30~03:29)', '인시 (03:30~05:29)', '묘시 (05:30~07:29)',
  '진시 (07:30~09:29)', '사시 (09:30~11:29)', '오시 (11:30~13:29)', '미시 (13:30~15:29)',
  '신시 (15:30~17:29)', '유시 (17:30~19:29)', '술시 (19:30~21:29)', '해시 (21:30~23:29)',
];

const LOCAL_LONGITUDE = 127.5; // 한반도 중심 경도 → 지방평균시 = UTC+8:30
const DEG = Math.PI / 180;
const DAY_MS = 86400000;

export const mod = (n, m) => ((n % m) + m) % m;

export function elementIndex(el) {
  return ELEMENTS.indexOf(el);
}

/* ───────────── 시간대 ───────────── */

let seoulFormatter = null;
function getSeoulFormatter() {
  if (seoulFormatter === null) {
    try {
      seoulFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul', hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
    } catch {
      seoulFormatter = false;
    }
  }
  return seoulFormatter;
}

// 해당 UTC 순간의 서울 UTC 오프셋(ms)
export function seoulOffsetAt(utcMs) {
  const f = getSeoulFormatter();
  if (!f) return fallbackOffset(utcMs);
  const p = {};
  for (const part of f.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Intl 시간대 데이터가 없는 환경용 (서머타임 미반영)
function fallbackOffset(utcMs) {
  const y = new Date(utcMs).getUTCFullYear();
  const t = utcMs;
  const in830 = (t >= Date.UTC(1954, 2, 20, 15) && t < Date.UTC(1961, 7, 9, 15)) || y < 1912;
  return (in830 ? 8.5 : 9) * 3600000;
}

// 서울 벽시계 시각 → UTC(ms)
export function seoulWallToUtc(y, m, d, h = 12, mi = 0) {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let utc = wall - 9 * 3600000;
  for (let i = 0; i < 3; i++) utc = wall - seoulOffsetAt(utc);
  return utc;
}

/* ───────────── 천문 계산: 태양 황경 ───────────── */

function julianDay(utcMs) {
  return utcMs / DAY_MS + 2440587.5;
}

// ΔT(초) 근사 — Espenak & Meeus 다항식 (1900~2150)
export function deltaT(year) {
  const y = year;
  if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3; }
  if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - (t ** 2) / 233 + (t ** 3) / 2547; }
  if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - (t ** 2) / 260 - (t ** 3) / 718; }
  if (y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t ** 2; }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - y);
}

// 태양의 겉보기 황경(도) — VSOP87 축약 + 장동/광행차 보정
export function solarLongitude(utcMs) {
  const year = new Date(utcMs).getUTCFullYear();
  const jde = julianDay(utcMs) + deltaT(year) / 86400;
  const T = (jde - 2451545.0) / 36525;
  const tau = T / 10;

  // 지구 일심황경 L (라디안) — VSOP87D 주요 항
  const sum = (terms) => terms.reduce((s, [a, b, c]) => s + a * Math.cos(b + c * tau), 0);
  const L0 = sum(VSOP_L0), L1 = sum(VSOP_L1), L2 = sum(VSOP_L2), L3 = sum(VSOP_L3), L4 = sum(VSOP_L4);
  const L = (L0 + L1 * tau + L2 * tau ** 2 + L3 * tau ** 3 + L4 * tau ** 4) / 1e8;

  let theta = L / DEG + 180; // 지심황경
  // FK5 보정
  theta += -0.09033 / 3600;
  // 장동
  const omega = (125.04452 - 1934.136261 * T) * DEG;
  const Ls = (280.4665 + 36000.7698 * T) * DEG;
  const Lm = (218.3165 + 481267.8813 * T) * DEG;
  const dPsi = (-17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * omega)) / 3600;
  // 광행차
  const aberration = -20.4898 / 3600;
  return mod(theta + dPsi + aberration, 360);
}

// VSOP87D 지구 L 계수 (Meeus, Astronomical Algorithms 부록 III 주요 항)
const VSOP_L0 = [
  [175347046, 0, 0], [3341656, 4.6692568, 6283.0758500], [34894, 4.62610, 12566.15170],
  [3497, 2.7441, 5753.3849], [3418, 2.8289, 3.5231], [3136, 3.6277, 77713.7715],
  [2676, 4.4181, 7860.4194], [2343, 6.1352, 3930.2097], [1324, 0.7425, 11506.7698],
  [1273, 2.0371, 529.6910], [1199, 1.1096, 1577.3435], [990, 5.233, 5884.927],
  [902, 2.045, 26.298], [857, 3.508, 398.149], [780, 1.179, 5223.694],
  [753, 2.533, 5507.553], [505, 4.583, 18849.228], [492, 4.205, 775.523],
  [357, 2.920, 0.067], [317, 5.849, 11790.629], [284, 1.899, 796.298],
  [271, 0.315, 10977.079], [243, 0.345, 5486.778], [206, 4.806, 2544.314],
  [205, 1.869, 5573.143], [202, 2.458, 6069.777], [156, 0.833, 213.299],
  [132, 3.411, 2942.463], [126, 1.083, 20.775], [115, 0.645, 0.980],
  [103, 0.636, 4694.003], [102, 0.976, 15720.839], [102, 4.267, 7.114],
  [99, 6.21, 2146.17], [98, 0.68, 155.42], [86, 5.98, 161000.69],
  [85, 1.30, 6275.96], [85, 3.67, 71430.70], [80, 1.81, 17260.15],
  [79, 3.04, 12036.46], [75, 1.76, 5088.63], [74, 3.50, 3154.69],
  [74, 4.68, 801.82], [70, 0.83, 9437.76], [62, 3.98, 8827.39],
  [61, 1.82, 7084.90], [57, 2.78, 6286.60], [56, 4.39, 14143.50],
  [56, 3.47, 6279.55], [52, 0.19, 12139.55], [52, 1.33, 1748.02],
  [51, 0.28, 5856.48], [49, 0.49, 1194.45], [41, 5.37, 8429.24],
  [41, 2.40, 19651.05], [39, 6.17, 10447.39], [37, 6.04, 10213.29],
  [37, 2.57, 1059.38], [36, 1.71, 2352.87], [36, 1.78, 6812.77],
  [33, 0.59, 17789.85], [30, 0.44, 83996.85], [30, 2.74, 1349.87],
  [25, 3.16, 4690.48],
];
const VSOP_L1 = [
  [628331966747, 0, 0], [206059, 2.678235, 6283.075850], [4303, 2.6351, 12566.1517],
  [425, 1.590, 3.523], [119, 5.796, 26.298], [109, 2.966, 1577.344],
  [93, 2.59, 18849.23], [72, 1.14, 529.69], [68, 1.87, 398.15],
  [67, 4.41, 5507.55], [59, 2.89, 5223.69], [56, 2.17, 155.42],
  [45, 0.40, 796.30], [36, 0.47, 775.52], [29, 2.65, 7.11],
  [21, 5.34, 0.98], [19, 1.85, 5486.78], [19, 4.97, 213.30],
  [17, 2.99, 6275.96], [16, 0.03, 2544.31], [16, 1.43, 2146.17],
  [15, 1.21, 10977.08], [12, 2.83, 1748.02], [12, 3.26, 5088.63],
  [12, 5.27, 1194.45], [12, 2.08, 4694.00], [11, 0.77, 553.57],
  [10, 1.30, 6286.60], [10, 4.24, 1349.87], [9, 2.70, 242.73],
  [9, 5.64, 951.72], [8, 5.30, 2352.87], [6, 2.65, 9437.76],
  [6, 4.67, 4690.48],
];
const VSOP_L2 = [
  [52919, 0, 0], [8720, 1.0721, 6283.0758], [309, 0.867, 12566.152],
  [27, 0.05, 3.52], [16, 5.19, 26.30], [16, 3.68, 155.42],
  [10, 0.76, 18849.23], [9, 2.06, 77713.77], [7, 0.83, 775.52],
  [5, 4.66, 1577.34], [4, 1.03, 7.11], [4, 3.44, 5573.14],
  [3, 5.14, 796.30], [3, 6.05, 5507.55], [3, 1.19, 242.73],
  [3, 6.12, 529.69], [3, 0.31, 398.15], [3, 2.28, 553.57],
  [2, 4.38, 5223.69], [2, 3.75, 0.98],
];
const VSOP_L3 = [
  [289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15],
  [3, 5.20, 155.42], [1, 4.72, 3.52], [1, 5.30, 18849.23], [1, 5.97, 242.73],
];
const VSOP_L4 = [[114, 3.142, 0], [8, 4.13, 6283.08], [1, 3.84, 12566.15]];

// 특정 황경에 도달하는 순간(UTC ms)을 찾는다 (start 근처에서 탐색)
export function findSolarTermTime(targetLongitude, approxUtcMs) {
  let t = approxUtcMs;
  for (let i = 0; i < 50; i++) {
    const diff = mod(targetLongitude - solarLongitude(t) + 180, 360) - 180;
    if (Math.abs(diff) < 1e-6) break;
    t += (diff / 360) * 365.2422 * DAY_MS;
  }
  return t;
}

/* ───────────── 간지 계산 ───────────── */

export function ganzhi(index60) {
  const i = mod(index60, 60);
  return { index: i, stem: i % 10, branch: i % 12 };
}

function indexFromStemBranch(stem, branch) {
  for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
  return -1;
}

// 절기 기준 월 순번: 0=寅월(입춘~) … 11=丑월(소한~)
export function solarMonthIndex(utcMs) {
  return Math.floor(mod(solarLongitude(utcMs) - 315, 360) / 30);
}

export function yearPillarOf(sajuYear) {
  return ganzhi(sajuYear - 4);
}

export function monthPillarOf(yearStem, monthIdx) {
  const startStem = mod((yearStem % 5) * 2 + 2, 10);
  return ganzhi(indexFromStemBranch(mod(startStem + monthIdx, 10), mod(monthIdx + 2, 12)));
}

// 해당 순간의 연주·월주 (운세 달력용)
export function yearMonthPillarsAt(utcMs) {
  const local = new Date(utcMs + 9 * 3600000);
  const gYear = local.getUTCFullYear();
  const gMonth = local.getUTCMonth() + 1;
  const monthIdx = solarMonthIndex(utcMs);
  const sajuYear = gMonth <= 2 && monthIdx >= 10 ? gYear - 1 : gYear;
  const year = yearPillarOf(sajuYear);
  return { sajuYear, year, month: monthPillarOf(year.stem, monthIdx), monthIdx };
}

export function dayPillarOf(y, m, d) {
  return dayPillarFromLocalDate(y, m, d);
}

function dayPillarFromLocalDate(y, m, d) {
  const days = Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  const jdn = days + 2440588;
  return ganzhi(jdn + 49);
}

export function hourPillarOf(dayStem, hourBranch) {
  const start = (dayStem % 5) * 2;
  return ganzhi(indexFromStemBranch(mod(start + hourBranch, 10), hourBranch));
}

/**
 * 사주 원국 계산
 * @param {{year:number, month:number, day:number, hour?:number|null, minute?:number|null}} birth 서울 기준 양력 생년월일시
 */
export function computeSaju(birth) {
  const { year, month, day } = birth;
  const timeKnown = Number.isInteger(birth.hour);
  const hour = timeKnown ? birth.hour : 12;
  const minute = timeKnown ? (birth.minute || 0) : 0;

  const utcMs = seoulWallToUtc(year, month, day, hour, minute);
  const monthIdx = solarMonthIndex(utcMs);
  const sajuYear = month <= 2 && monthIdx >= 10 ? year - 1 : year;
  const yearP = yearPillarOf(sajuYear);
  const monthP = monthPillarOf(yearP.stem, monthIdx);

  // 지방평균시
  const lmt = new Date(utcMs + (LOCAL_LONGITUDE / 15) * 3600000);
  let dayDate = Date.UTC(lmt.getUTCFullYear(), lmt.getUTCMonth(), lmt.getUTCDate());
  if (timeKnown && lmt.getUTCHours() >= 23) dayDate += DAY_MS; // 자시부터 다음 날
  if (!timeKnown) dayDate = Date.UTC(year, month - 1, day);
  const dd = new Date(dayDate);
  const dayP = dayPillarFromLocalDate(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate());

  let hourP = null;
  if (timeKnown) {
    const hourBranch = Math.floor((lmt.getUTCHours() + 1) / 2) % 12;
    hourP = hourPillarOf(dayP.stem, hourBranch);
  }

  // 시간을 모를 때 그날 절입이 있으면 월주가 바뀔 수 있음
  let monthAmbiguous = false;
  if (!timeKnown) {
    const a = solarMonthIndex(seoulWallToUtc(year, month, day, 0, 0));
    const b = solarMonthIndex(seoulWallToUtc(year, month, day, 23, 59));
    monthAmbiguous = a !== b;
  }

  const pillars = { year: yearP, month: monthP, day: dayP, hour: hourP };
  return { birth: { year, month, day, hour: timeKnown ? hour : null, minute: timeKnown ? minute : null }, timeKnown, pillars, sajuYear, monthAmbiguous, utcMs, monthIdx };
}

/* ───────────── 십신 ───────────── */

export const TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];

export function tenGod(dayStem, otherStem) {
  const rel = mod(elementIndex(STEM_ELEMENT[otherStem]) - elementIndex(STEM_ELEMENT[dayStem]), 5);
  const same = dayStem % 2 === otherStem % 2;
  // rel 0: 같은 오행, 1: 내가 생함, 2: 내가 극함, 3: 나를 극함, 4: 나를 생함
  return TEN_GODS[rel * 2 + (same ? 0 : 1)];
}

export const TEN_GOD_GROUP = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성', 정재: '재성',
  편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};

// 오행 관계 헬퍼
export const generates = (a, b) => mod(elementIndex(b) - elementIndex(a), 5) === 1; // a가 b를 생함
export const controls = (a, b) => mod(elementIndex(b) - elementIndex(a), 5) === 2; // a가 b를 극함
export const elementThatGenerates = (el) => ELEMENTS[mod(elementIndex(el) - 1, 5)];
export const elementGeneratedBy = (el) => ELEMENTS[mod(elementIndex(el) + 1, 5)];
export const elementThatControls = (el) => ELEMENTS[mod(elementIndex(el) - 2, 5)];
export const elementControlledBy = (el) => ELEMENTS[mod(elementIndex(el) + 2, 5)];

/* ───────────── 지지 관계 ───────────── */

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const SIX_HARMONY = new Set([[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]].map(([a, b]) => pairKey(a, b)));
const CLASH = new Set([[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]].map(([a, b]) => pairKey(a, b)));
const WONJIN = new Set([[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]].map(([a, b]) => pairKey(a, b)));
const PUNISH = new Set([[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3]].map(([a, b]) => pairKey(a, b)));
// 삼합 그룹 — 0:寅午戌(화) 1:巳酉丑(금) 2:申子辰(수) 3:亥卯未(목)
const TRINE_GROUP = [2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3];

export const trineGroup = (branch) => TRINE_GROUP[branch];

export function branchRelation(a, b) {
  if (a === b) return 'same';
  const k = pairKey(a, b);
  if (SIX_HARMONY.has(k)) return 'harmony';
  if (CLASH.has(k)) return 'clash';
  if (TRINE_GROUP[a] === TRINE_GROUP[b]) return 'trine';
  if (WONJIN.has(k)) return 'wonjin';
  if (PUNISH.has(k)) return 'punish';
  return 'neutral';
}

const STEM_COMBO = new Set([[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]].map(([a, b]) => pairKey(a, b)));
export function stemsCombine(a, b) {
  return STEM_COMBO.has(pairKey(a, b));
}

// 도화살: 연지·일지 기준 삼합의 '목욕' 지지
export function peachBlossomBranch(branch) {
  return [3, 6, 9, 0][TRINE_GROUP[branch]]; // 寅午戌→卯, 巳酉丑→午, 申子辰→酉, 亥卯未→子
}

// 홍염살: 일간 기준
export const RED_FLAME = [6, 6, 2, 7, 4, 4, 10, 9, 0, 8];

/* ───────────── 표시용 ───────────── */

export function pillarLabel(p) {
  if (!p) return null;
  return {
    hanja: STEMS[p.stem] + BRANCHES[p.branch],
    hangul: STEMS_KO[p.stem] + BRANCHES_KO[p.branch],
    stemEl: STEM_ELEMENT[p.stem],
    branchEl: BRANCH_ELEMENT[p.branch],
  };
}
