// 📝 연애 일기 — 그날의 기분과 한 줄을 남기고, 사주로 본 그날의 연애운과 비교한다
import { dayScoresAt } from './daily.js';

export const MOODS = [
  { v: 1, emoji: '😢', label: '속상' },
  { v: 2, emoji: '😕', label: '별로' },
  { v: 3, emoji: '😐', label: '보통' },
  { v: 4, emoji: '🙂', label: '좋음' },
  { v: 5, emoji: '🥰', label: '최고' },
];
export const DIARY_LIMIT = 400; // 저장하는 일기 수(가장 오래된 것부터 지운다)

/** 저장된 일기 묶음에서 이상한 값을 걸러낸다 {'YYYY-MM-DD': {mood, text}} */
export function cleanDiary(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
    const mood = Number.isInteger(v.mood) && v.mood >= 1 && v.mood <= 5 ? v.mood : null;
    if (!mood) continue;
    out[k] = { mood, text: typeof v.text === 'string' ? v.text.slice(0, 200) : '' };
  }
  const keys = Object.keys(out).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - DIARY_LIMIT))) delete out[k];
  return out;
}

const level = (love) => (love >= 65 ? 'good' : love < 55 ? 'low' : 'mid');
const moodLevel = (m) => (m >= 4 ? 'good' : m <= 2 ? 'low' : 'mid');

/** 한 달 일기 통계 — 운세와 기분이 얼마나 맞았는지 */
export function diaryMonth(a, diary, y, m) {
  const prefix = `${y}-${String(m).padStart(2, '0')}-`;
  const entries = Object.entries(diary).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => {
    const d = Number(k.slice(8));
    const love = dayScoresAt(a, y, m, d).love;
    return { key: k, d, mood: v.mood, text: v.text, love, match: level(love) === moodLevel(v.mood) };
  }).sort((p, q) => q.d - p.d);
  const n = entries.length;
  const avg = (list) => (list.length ? Math.round((list.reduce((t, x) => t + x.mood, 0) / list.length) * 10) / 10 : null);
  const goodDays = entries.filter((x) => x.love >= 65), lowDays = entries.filter((x) => x.love < 55);
  const rate = n >= 3 ? Math.round((entries.filter((x) => x.match).length / n) * 100) : null;
  let verdict = null;
  if (rate !== null) {
    verdict = rate >= 70 ? '🔮 이번 달은 사주 흐름과 기분이 꽤 잘 맞았어요!'
      : rate >= 45 ? '🌗 반쯤 맞았어요. 운세는 참고, 하루는 내가 만드는 거예요.'
        : '🌱 운세보다 내 노력이 더 큰 달이었어요. 멋져요!';
  }
  return { entries, count: n, moodAvg: avg(entries), goodAvg: avg(goodDays), lowAvg: avg(lowDays), rate, verdict };
}
