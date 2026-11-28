// 앱 상태 — 저장소(localStorage), 화면 상태, 계산 결과 캐시와 그 getter들
import { analyzePerson, buildForecast } from './reading.js';
import { analyzeCompat } from './compat.js';
import { analyzeBreakup } from './breakup.js';
import { analyzeReunion } from './reunion.js';
import { analyzeIntimacy } from './intimacy.js';
import { personKey, loadPresets, sanitizePerson } from './presets.js';

/* ───────────── 상태 ───────────── */

export const KEY = 'myoyeon:';
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
  del(k) { try { localStorage.removeItem(KEY + k); } catch { /* noop */ } },
};

export const state = {
  me: store.get('me'),
  partner: store.get('partner'),
  chat: store.get('chat') || [],
  presets: loadPresets(store.get('presets')), // 프리셋(인연 수첩): 저장해 둔 사람들
  pair: loadPair(store.get('pair')),          // 이별수: 두 사람 A·B, 결과 보기를 눌렀는지
  pairEdit: null,                             // 'a' | 'b' — 직접 입력 신청서가 열린 칸
  dayOffset: 0,                               // 오늘의 운세: 오늘로부터 며칠 뒤(음수면 전)
  futureWant: store.get('futureWant'),        // 미래의 연인: 보고 싶은 성별 'M' | 'F'
  monthOffset: 0,                             // 이달의 연애 리포트: 이번 달로부터 몇 달 뒤
  anniv: store.get('anniv'),                  // 기념일: 사귄 날 {y,m,d}
  catcard: store.get('catcard'),              // 오늘의 고양이 카드 {date, seed}
  affinity: store.get('affinity'),            // 묘연·코코 호감도
  diaryMood: null,                            // 연애 일기: 오늘 고른 기분(저장 전)
  bondId: store.get('bondId'),                // 우정·가족 궁합: 고른 프리셋
  bondKind: store.get('bondKind') || 'friend',
  counselor: store.get('counselor') === 'coco' ? 'coco' : 'myo', // 상담사
  ai: null, // null | 'server'(Node + API 키) | 'artifact'(Claude 아티팩트의 sample)
  sample: null,
  busy: false,
};
export const memo = {};

export function loadPair(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { a: sanitizePerson(r.a), b: sanitizePerson(r.b), done: r.done === true };
}
export function savePair() { store.set('pair', state.pair); }

export function me() {
  if (!state.me) return null;
  if (!memo.me) {
    memo.me = analyzeCached(state.me);
    memo.fc = memo.me ? buildForecast(memo.me) : null;
  }
  return memo.me;
}
export function forecast() { me(); return memo.fc; }
export function partner() {
  if (!state.partner) return null;
  if (!memo.partner) memo.partner = analyzeCached(state.partner);
  return memo.partner;
}
export function compat() {
  const a = me(), b = partner();
  if (!a || !b) return null;
  if (!memo.compat) memo.compat = analyzeCompat(a, b);
  return memo.compat;
}
export function resetMemo(which) {
  if (which === 'me') { delete memo.me; delete memo.fc; }
  if (which === 'partner') delete memo.partner;
  delete memo.compat;
  delete memo.intimacy;
  delete memo.ssum;
  delete memo.anniv;
}
// 속궁합 (나 × 궁합 상대, 두 사람 모두 만 19세 이상일 때만 결과)
export function intimacy() {
  const a = me(), b = partner();
  if (!a || !b) return null;
  if (!memo.intimacy) memo.intimacy = analyzeIntimacy(a, b);
  return memo.intimacy;
}
export const compatResultId = () => {
  const route = (location.hash || '').slice(1);
  return ['intimacy', 'ssum', 'anniv'].includes(route) ? `${route}-result` : 'compat-result';
};

// 지금 보는 사람을 바꾼다 (다른 사람이면 상담 기록은 새로 시작)
export function setMe(person) {
  if (!analyzeCached(person)) return false;
  const prev = state.me;
  const changed = !prev || personKey(prev) !== personKey(person);
  state.me = person;
  resetMemo('me');
  if (changed) { state.chat = []; store.del('chat'); }
  store.set('me', state.me);
  return true;
}

export const presetMemo = new Map();
export function analyzeCached(person) {
  const k = personKey(person);
  if (!presetMemo.has(k)) {
    let a = null;
    try { a = analyzePerson(person); } catch { a = null; }
    presetMemo.set(k, a);
  }
  return presetMemo.get(k);
}

export function savePresets() { store.set('presets', state.presets); }

// 재회운 결과 (이별수와 같은 두 사람·같은 "결과 보기" 상태를 쓴다)
export function reunion() {
  const { a: pa, b: pb, done } = state.pair;
  if (!done || !pa || !pb || personKey(pa) === personKey(pb)) return null;
  const key = `${personKey(pa)}#${personKey(pb)}`;
  if (memo.reunionKey !== key) {
    const A = analyzeCached(pa), B = analyzeCached(pb);
    memo.reunion = A && B ? analyzeReunion(A, B) : null;
    memo.reunionKey = key;
  }
  return memo.reunion;
}

// 이별수 결과 (두 사람이 정해지고 "결과 보기"를 눌렀을 때만)
export function breakup() {
  const { a: pa, b: pb, done } = state.pair;
  if (!done || !pa || !pb || personKey(pa) === personKey(pb)) return null;
  const key = `${personKey(pa)}#${personKey(pb)}`;
  if (memo.breakupKey !== key) {
    const A = analyzeCached(pa), B = analyzeCached(pb);
    memo.breakup = A && B ? analyzeBreakup(A, B) : null;
    memo.breakupKey = key;
  }
  return memo.breakup;
}

