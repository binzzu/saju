// 화면과 분리된 도구 모음 — 궁합 초대 링크 · 캘린더(.ics) · 데이터 백업 · 오늘의 고양이 카드
import { sanitizePerson, loadPresets } from './presets.js';
import { cleanDiary } from './diary.js';

/* ───────────── 💌 궁합 초대 링크 ───────────── */

const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** 초대하는 사람의 출생 정보를 링크용 문자열로 (연애 상태 등 다른 정보는 넣지 않는다) */
export function encodeInvite(person) {
  const p = sanitizePerson(person);
  if (!p) return '';
  const short = { v: 1, n: p.name, g: p.gender, c: p.calendar === 'lunar' ? 'l' : 's', y: p.year, m: p.month, d: p.day };
  if (p.leap) short.lp = 1;
  if (p.timeKnown) { short.h = p.hour; short.mi = p.minute || 0; }
  return b64url(JSON.stringify(short));
}

export function decodeInvite(code) {
  try {
    const x = JSON.parse(unb64url(String(code).slice(0, 400)));
    if (!x || x.v !== 1) return null;
    return sanitizePerson({
      name: x.n, gender: x.g, calendar: x.c === 'l' ? 'lunar' : 'solar', leap: x.lp === 1, year: x.y, month: x.m, day: x.d,
      hour: Number.isInteger(x.h) ? x.h : null, minute: Number.isInteger(x.mi) ? x.mi : null, timeKnown: Number.isInteger(x.h),
    });
  } catch { return null; }
}

/* ───────────── 📅 캘린더 (.ics) ───────────── */

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (y, m, d) => `${y}${pad(m)}${pad(d)}`;
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/**
 * 종일 일정 목록을 iCalendar 문서로
 * @param {{title:string, y:number, m:number, d:number, desc?:string}[]} events
 */
export function makeIcs(events, nowMs = Date.now()) {
  const stamp = new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//myoyeon//saju//KO', 'CALSCALE:GREGORIAN'];
  events.forEach((e, i) => {
    const next = new Date(Date.UTC(e.y, e.m - 1, e.d + 1));
    lines.push('BEGIN:VEVENT',
      `UID:myoyeon-${icsDate(e.y, e.m, e.d)}-${i}-${nowMs}@saju`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.y, e.m, e.d)}`,
      `DTEND;VALUE=DATE:${icsDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())}`,
      `SUMMARY:${icsText(e.title)}`);
    if (e.desc) lines.push(`DESCRIPTION:${icsText(e.desc)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/* ───────────── 💾 데이터 백업·복원 ───────────── */

export const BACKUP_KEYS = ['me', 'partner', 'presets', 'pair', 'anniv', 'affinity', 'catcard', 'theme', 'futureWant', 'chat', 'diary', 'chatArchive', 'counselor', 'bondId', 'bondKind', 'guideSeen'];

export function makeBackup(get, nowMs = Date.now()) {
  const data = {};
  for (const k of BACKUP_KEYS) { const v = get(k); if (v !== null && v !== undefined) data[k] = v; }
  return { app: 'myoyeon-saju', v: 1, savedAt: new Date(nowMs).toISOString(), data };
}

/** 백업 파일을 읽어 안전한 값만 돌려준다. 형식이 틀리면 null */
export function parseBackup(text) {
  let x;
  try { x = JSON.parse(text); } catch { return null; }
  if (!x || x.app !== 'myoyeon-saju' || x.v !== 1 || !x.data || typeof x.data !== 'object') return null;
  const d = x.data, out = {};
  const me = sanitizePerson(d.me); if (me) out.me = me;
  const partner = sanitizePerson(d.partner); if (partner) out.partner = partner;
  if (Array.isArray(d.presets)) out.presets = loadPresets(d.presets);
  if (d.pair && typeof d.pair === 'object') out.pair = { a: sanitizePerson(d.pair.a), b: sanitizePerson(d.pair.b), done: d.pair.done === true };
  if (d.anniv && [d.anniv.y, d.anniv.m, d.anniv.d].every(Number.isInteger)) out.anniv = { y: d.anniv.y, m: d.anniv.m, d: d.anniv.d };
  if (d.affinity && typeof d.affinity === 'object') {
    const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 9999) : 0);
    out.affinity = { myo: n(d.affinity.myo), coco: n(d.affinity.coco), day: '', today: { myo: 0, coco: 0 }, visit: String(d.affinity.visit || '').slice(0, 10) };
  }
  if (['light', 'dark'].includes(d.theme)) out.theme = d.theme;
  if (['M', 'F'].includes(d.futureWant)) out.futureWant = d.futureWant;
  const cleanMsgs = (list) => list.filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-60).map((m) => ({ role: m.role, content: m.content.slice(0, 4000), ...(typeof m.expr === 'string' ? { expr: m.expr.slice(0, 12) } : {}), ...(m.who === 'coco' ? { who: 'coco' } : {}) }));
  if (Array.isArray(d.chat)) out.chat = cleanMsgs(d.chat);
  if (d.diary) out.diary = cleanDiary(d.diary);
  if (Array.isArray(d.chatArchive)) {
    out.chatArchive = d.chatArchive.filter((x) => x && typeof x.id === 'string' && Array.isArray(x.msgs)).slice(0, 20)
      .map((x) => ({ id: x.id.slice(0, 30), title: String(x.title || '').slice(0, 40), at: String(x.at || '').slice(0, 10), who: x.who === 'coco' ? 'coco' : 'myo', msgs: cleanMsgs(x.msgs) }));
  }
  if (['myo', 'coco'].includes(d.counselor)) out.counselor = d.counselor;
  if (typeof d.bondId === 'string') out.bondId = d.bondId.slice(0, 40);
  if (['friend', 'sibling', 'family', 'work'].includes(d.bondKind)) out.bondKind = d.bondKind;
  if (d.guideSeen === true) out.guideSeen = true;
  return out;
}

/* ───────────── 🐱 오늘의 고양이 카드 ───────────── */

export const CAT_CARDS = [
  { name: '달빛 고양이', emoji: '🌙', who: 'myo', word: '조용히 기다리면 먼저 다가오는 마음이 있어요.', action: '오늘은 먼저 묻기보다 들어 주기', lucky: '밤 산책' },
  { name: '방울 고양이', emoji: '🔔', who: 'coco', word: '반가운 소식이 딸랑, 하고 찾아올 거예요!', action: '오랜만인 사람에게 안부 한 줄', lucky: '알림 소리' },
  { name: '꽃잎 고양이', emoji: '🌸', who: 'coco', word: '오늘의 당신, 평소보다 한 뼘 더 사랑스러워요.', action: '거울 보고 웃는 연습 한 번', lucky: '핑크 소품' },
  { name: '별똥별 고양이', emoji: '🌠', who: 'myo', word: '바라던 일이 생각보다 빨리 움직인다냥.', action: '미뤄 둔 연락 오늘 보내기', lucky: '소원 메모' },
  { name: '털실 고양이', emoji: '🧶', who: 'myo', word: '엉킨 실도 천천히 풀면 다시 이어진다냥.', action: '오해가 있었다면 짧게 사과하기', lucky: '따뜻한 차' },
  { name: '우산 고양이', emoji: '☂️', who: 'coco', word: '작은 배려가 큰 설렘이 되는 날이에요.', action: '상대의 짐을 하나 들어 주기', lucky: '투명 우산' },
  { name: '편지 고양이', emoji: '💌', who: 'coco', word: '말로 못 한 마음, 글로는 전해져요!', action: '짧은 손편지나 긴 메시지 쓰기', lucky: '예쁜 펜' },
  { name: '거울 고양이', emoji: '🪞', who: 'myo', word: '남보다 나를 먼저 들여다보는 날이다냥.', action: '나를 위한 작은 선물 사기', lucky: '향수' },
  { name: '생선 고양이', emoji: '🐟', who: 'coco', word: '맛있는 걸 함께 먹으면 마음도 가까워져요!', action: '좋아하는 사람과 밥 약속 잡기', lucky: '초밥' },
  { name: '창가 고양이', emoji: '🪟', who: 'myo', word: '서두르지 말고 햇볕 쬐듯 여유를 가져라냥.', action: '답장은 천천히, 진심은 또렷하게', lucky: '창가 자리' },
  { name: '왕관 고양이', emoji: '👑', who: 'myo', word: '오늘은 당당함이 최고의 매력이다냥.', action: '하고 싶은 말을 미루지 않기', lucky: '골드 액세서리' },
  { name: '리본 고양이', emoji: '🎀', who: 'coco', word: '사소한 칭찬 하나가 오늘의 리본이 돼요.', action: '칭찬 세 번 하기', lucky: '리본 머리끈' },
  { name: '나침반 고양이', emoji: '🧭', who: 'myo', word: '새로운 길에서 새로운 인연을 만난다냥.', action: '평소와 다른 길로 가 보기', lucky: '처음 가는 카페' },
  { name: '케이크 고양이', emoji: '🍰', who: 'coco', word: '달콤한 일이 생길 예감이에요!', action: '디저트 하나 나눠 먹기', lucky: '딸기' },
  { name: '열쇠 고양이', emoji: '🗝️', who: 'myo', word: '닫혀 있던 마음의 문이 살짝 열린다냥.', action: '진짜 속마음 한 가지 털어놓기', lucky: '작은 열쇠고리' },
  { name: '구름 고양이', emoji: '☁️', who: 'coco', word: '조금 흐려도 괜찮아요. 금방 갤 거예요.', action: '오늘은 푹 쉬고 일찍 자기', lucky: '포근한 담요' },
  { name: '촛불 고양이', emoji: '🕯️', who: 'myo', word: '은은한 분위기가 마음을 움직인다냥.', action: '조명 낮추고 좋아하는 음악 틀기', lucky: '캔들' },
  { name: '네잎클로버 고양이', emoji: '🍀', who: 'coco', word: '오늘은 우연이 행운으로 바뀌는 날!', action: '들어오는 약속은 일단 YES', lucky: '초록색' },
  { name: '종이비행기 고양이', emoji: '✈️', who: 'myo', word: '가벼운 마음으로 던진 한마디가 멀리 간다냥.', action: '부담 없는 첫 연락 보내기', lucky: '하늘색' },
  { name: '하트 고양이', emoji: '💗', who: 'coco', word: '받은 마음을 크게 돌려주는 날이에요!', action: '"고마워"를 꼭 말로 하기', lucky: '하트 이모티콘' },
  { name: '수정 구슬 고양이', emoji: '🔮', who: 'myo', word: '직감을 믿어라냥. 이미 답을 알고 있잖아.', action: '마음이 가는 쪽으로 하나 선택하기', lucky: '보라색' },
];

/** 사람·날짜마다 정해지는 오늘의 카드 번호 (같은 날 다시 뽑아도 같은 카드) */
export function dailyCardIndex(seed, dateKey) {
  let h = 2166136261;
  for (const ch of `${seed}#${dateKey}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % CAT_CARDS.length;
}
