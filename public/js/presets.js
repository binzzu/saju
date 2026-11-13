// 프리셋(인연 수첩) — 저장해 둔 사람들의 출생 정보. 화면 코드와 분리된 순수 함수만 둔다.

export const PRESET_LIMIT = 30;

const int = (v) => (Number.isInteger(v) ? v : null);

/** 같은 사람인지 가리는 열쇠 (이름 + 출생 정보, 연애 상태는 제외) */
export function personKey(p) {
  if (!p) return '';
  return [
    String(p.name || '').trim(), p.gender, p.calendar === 'lunar' ? 'L' : 'S', p.calendar === 'lunar' && p.leap ? 1 : 0,
    p.year, p.month, p.day, p.timeKnown ? `${p.hour}:${p.minute || 0}` : '-',
  ].join('|');
}

/** localStorage에서 읽은 값이 깨졌거나 조작돼도 화면이 망가지지 않게 걸러낸다 */
export function sanitizePerson(x) {
  if (!x || typeof x !== 'object') return null;
  const name = typeof x.name === 'string' ? x.name.trim().slice(0, 12) : '';
  const year = int(x.year), month = int(x.month), day = int(x.day);
  if (!name || !['F', 'M'].includes(x.gender) || !year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const timeKnown = x.timeKnown === true && int(x.hour) !== null && x.hour >= 0 && x.hour <= 23;
  const minute = timeKnown && int(x.minute) !== null && x.minute >= 0 && x.minute <= 59 ? x.minute : 0;
  const calendar = x.calendar === 'lunar' ? 'lunar' : 'solar';
  const person = {
    name, gender: x.gender, calendar, leap: calendar === 'lunar' && x.leap === true, year, month, day,
    hour: timeKnown ? x.hour : null, minute: timeKnown ? minute : null, timeKnown,
  };
  if (typeof x.status === 'string') person.status = x.status;
  return person;
}

export function loadPresets(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const person = sanitizePerson(item && item.person);
    if (!person || typeof item.id !== 'string') continue;
    const key = personKey(person);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: item.id.slice(0, 40), person, savedAt: Number(item.savedAt) || 0 });
    if (out.length >= PRESET_LIMIT) break;
  }
  return out;
}

export function findPreset(list, person) {
  const key = personKey(person);
  return key ? list.find((x) => personKey(x.person) === key) || null : null;
}

const newId = (now) => `p${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * 저장하거나(새 사람) 갱신한다(같은 사람이면 연애 상태 등 최신 값으로).
 * @returns {{list: Array, result: 'added'|'updated'|'full', preset: object|null}}
 */
export function upsertPreset(list, person, now = Date.now()) {
  const hit = findPreset(list, person);
  if (hit) {
    // 궁합 신청서처럼 연애 상태가 없는 정보로 저장하면 기존 상태를 유지한다
    const preset = { ...hit, person: { ...hit.person, ...person }, savedAt: now };
    return { list: list.map((x) => (x.id === hit.id ? preset : x)), result: 'updated', preset };
  }
  if (list.length >= PRESET_LIMIT) return { list, result: 'full', preset: null };
  const preset = { id: newId(now), person: { ...person }, savedAt: now };
  return { list: [preset, ...list], result: 'added', preset };
}

/** @returns {{list: Array, removed: object|null, index: number}} */
export function removePreset(list, id) {
  const index = list.findIndex((x) => x.id === id);
  if (index < 0) return { list, removed: null, index };
  return { list: list.filter((x) => x.id !== id), removed: list[index], index };
}

/** 지운 걸 되돌릴 때 원래 자리에 다시 넣는다 */
export function restorePreset(list, preset, index) {
  if (!preset || findPreset(list, preset.person)) return list;
  const next = list.slice();
  next.splice(Math.min(Math.max(index, 0), next.length), 0, preset);
  return next.slice(0, PRESET_LIMIT);
}

/** 수첩에 적는 짧은 출생 정보: "1997.03.14 09:20" / "음 1995.08.15 · 시간 모름" */
export function shortBirth(p) {
  const pad = (n) => String(n).padStart(2, '0');
  const cal = p.calendar === 'lunar' ? `음${p.leap ? '(윤)' : ''} ` : '';
  const time = p.timeKnown ? ` ${pad(p.hour)}:${pad(p.minute || 0)}` : ' · 시간 모름';
  return `${cal}${p.year}.${pad(p.month)}.${pad(p.day)}${time}`;
}
