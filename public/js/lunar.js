// 한국 음력 ↔ 양력 변환
// 삭(朔, 신월) 시각을 천문 계산(Meeus 49장)으로 구하고, 한국 표준시 날짜 기준으로
// 음력 달의 시작일을 정한 뒤, 중기(中氣)가 없는 달을 윤달로 두는 규칙을 적용한다.

import { solarLongitude, findSolarTermTime, seoulOffsetAt, deltaT, mod } from './saju.js';

const DEG = Math.PI / 180;
const DAY_MS = 86400000;

// k번째 삭의 순간 (UTC ms). k=0 은 2000-01-06 무렵의 삭.
export function newMoonUtc(k) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3) * DEG;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * DEG;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * DEG;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3) * DEG;
  const s = Math.sin;
  jde +=
    -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F)
    + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M)
    - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
    - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
    - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M)
    + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F)
    + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
    - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T * T, 0.000325], [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164], [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.00011], [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.00006], [154.84 + 7.30686 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047], [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.00004], [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035], [331.55 + 3.592518 * k, 0.000023],
  ];
  for (const [arg, coef] of A) jde += coef * s(arg * DEG);
  const approxYear = 2000 + k / 12.3685;
  const jdUT = jde - deltaT(approxYear) / 86400;
  return (jdUT - 2440587.5) * DAY_MS;
}

// UTC 순간 → 서울 날짜의 "일 번호"(UTC 자정 기준 epoch day)
function seoulDayNumber(utcMs, tzOffsetFn) {
  const local = utcMs + tzOffsetFn(utcMs);
  return Math.floor(local / DAY_MS);
}

const defaultTz = (utcMs) => seoulOffsetAt(utcMs);

// 해당 날짜(일 번호) 이하에서 가장 가까운 삭의 k와 시작일
function monthStartOnOrBefore(dayNum, tz) {
  let k = Math.floor((dayNum - 10962) / 29.530588861); // 10962 = 2000-01-06
  for (;;) {
    const start = seoulDayNumber(newMoonUtc(k), tz);
    if (start > dayNum) { k--; continue; }
    const next = seoulDayNumber(newMoonUtc(k + 1), tz);
    if (next <= dayNum) { k++; continue; }
    return k;
  }
}

function winterSolsticeDay(year, tz) {
  const approx = Date.UTC(year, 11, 21);
  return seoulDayNumber(findSolarTermTime(270, approx), tz);
}

// 달 [start, end) 안에 중기(황경 30° 배수)가 들어 있는가
function hasPrincipalTerm(startDay, endDay, tz) {
  const startUtc = startDay * DAY_MS - tz(startDay * DAY_MS);
  const lamStart = solarLongitude(startUtc);
  const target = mod(Math.ceil(lamStart / 30) * 30, 360);
  const t = findSolarTermTime(target, startUtc + (mod(target - lamStart, 360) / 360) * 365.2422 * DAY_MS);
  const d = seoulDayNumber(t, tz);
  return d >= startDay && d < endDay;
}

const suiCache = new Map(); // tz 함수 → (n → 달 목록)

// 세(歲) n: 전년 동지 달(11월)부터 올해 동지 달 직전까지의 달 목록
function suiMonths(n, tz) {
  if (!suiCache.has(tz)) suiCache.set(tz, new Map());
  const cache = suiCache.get(tz);
  if (cache.has(n)) return cache.get(n);
  const k11a = monthStartOnOrBefore(winterSolsticeDay(n - 1, tz), tz);
  const k11b = monthStartOnOrBefore(winterSolsticeDay(n, tz), tz);
  const count = k11b - k11a; // 12 또는 13
  const starts = [];
  for (let k = k11a; k <= k11b; k++) starts.push(seoulDayNumber(newMoonUtc(k), tz));
  let leapFound = count === 13 ? false : true;
  const months = [];
  let num = 11, year = n - 1;
  for (let i = 0; i < count; i++) {
    let isLeap = false;
    if (i > 0 && !leapFound && !hasPrincipalTerm(starts[i], starts[i + 1], tz)) {
      isLeap = true;
      leapFound = true;
    } else if (i > 0) {
      num += 1;
      if (num === 13) { num = 1; year = n; }
    }
    months.push({ year, month: num, isLeap, start: starts[i], days: starts[i + 1] - starts[i] });
  }
  cache.set(n, months);
  return months;
}

function monthsAround(year, tz) {
  return [...suiMonths(year, tz), ...suiMonths(year + 1, tz), ...suiMonths(year + 2, tz)];
}

/** 음력 → 양력. 존재하지 않는 날짜면 null */
export function lunarToSolar(year, month, day, isLeap = false, tz = defaultTz) {
  const m = monthsAround(year, tz).find((x) => x.year === year && x.month === month && x.isLeap === !!isLeap);
  if (!m || day < 1 || day > m.days) return null;
  const d = new Date((m.start + day - 1) * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 양력 → 음력 */
export function solarToLunar(year, month, day, tz = defaultTz) {
  const dayNum = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  for (const m of monthsAround(year - 1, tz)) {
    if (dayNum >= m.start && dayNum < m.start + m.days) {
      return { year: m.year, month: m.month, day: dayNum - m.start + 1, isLeap: m.isLeap, monthDays: m.days };
    }
  }
  return null;
}

/** 해당 음력 연·월에 윤달이 있는지 / 달의 일수 */
export function lunarMonthInfo(year, month, tz = defaultTz) {
  const all = monthsAround(year, tz).filter((x) => x.year === year && x.month === month);
  const normal = all.find((x) => !x.isLeap);
  const leap = all.find((x) => x.isLeap);
  return { days: normal ? normal.days : 30, hasLeap: !!leap, leapDays: leap ? leap.days : 0 };
}
