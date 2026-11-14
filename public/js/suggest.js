// 상담실 추천 질문 — 방금 나눈 이야기(주제)·연애 상태·저장된 결과(궁합·이별수·재회운·속궁합)를 보고
// 대화를 한 걸음 더 깊게 이끌 질문과, 관련 화면으로 가는 링크 하나를 고른다.
import { detectTopic } from './counsel.js';

const MORE = '💡 해결책 더 알려 줘'; // 주제 단어가 없어 "더 알려 줘"(followup)로 인식된다

// 주제별 다음 질문 (앞쪽일수록 지금 이야기를 더 깊게, 뒤쪽은 옆 주제로)
const FLOW = {
  timing: ['내 이상형은?', '소개팅 잘 되는 법', '내 매력 포인트는?', '다음 달 연애운은?'],
  ideal: ['그런 사람은 언제 만날까?', '내 매력 포인트는?', '소개팅 잘 되는 법'],
  charm: ['행운 아이템 알려 줘', '애인은 언제 생길까?', '소개팅 잘 되는 법'],
  date: ['첫 데이트 멘트 추천해 줘', '연락은 어떻게 해야 해?', '고백하기 좋은 날은?'],
  confession: ['고백 멘트 추천해 줘', '썸에서 연애로 갈 수 있을까?', '연락은 어떻게 해야 해?'],
  lines: ['고백하기 좋은 날은?', '연락은 어떻게 해야 해?', '데이트 장소 추천해 줘'],
  contact: ['답장이 늦으면 어떡해?', '고백하기 좋은 날은?', '데이트 장소 추천해 줘'],
  conflict: ['화해는 어떻게 하지?', '헤어져야 할까?', '우리 커플 궁합은?'],
  trust: ['질투가 날 땐 어떻게 해?', '요즘 자주 싸워요', '우리 커플 궁합은?'],
  breakup: ['권태기 극복하는 법', '요즘 자주 싸워요', '마음이 너무 힘들어'],
  reunion: ['마음 정리하는 법', '새 인연은 언제 와?', '내 연애 문제점은?'],
  moveon: ['새 인연은 언제 와?', '내 매력 포인트는?', '재회할 수 있을까?'],
  comfort: ['마음 정리하는 법', '오늘 운세는?', '내 매력 포인트는?'],
  marriage: ['결혼 상대로 잘 맞는 사람은?', '우리 커플 궁합은?', '내년 연애운은?'],
  compat: ['요즘 자주 싸워요', '결혼은 언제쯤?', '연락은 어떻게 해야 해?'],
  intimacy: ['우리 커플 궁합은?', '데이트 장소 추천해 줘', '요즘 자주 싸워요'],
  age: ['내 이상형은?', '우리 커플 궁합은?', '애인은 언제 생길까?'],
  distance: ['연락은 어떻게 해야 해?', '요즘 자주 싸워요', '결혼은 언제쯤?'],
  lucky: ['오늘 운세는?', '이번 달 연애운은?', '내 매력 포인트는?'],
  today: ['내일 운세는?', '이번 달 연애운은?', '행운 아이템 알려 줘'],
  period: ['다음 달 연애운은?', '내년 연애운은?', '오늘 운세는?'],
  self: ['내 매력 포인트는?', '내 이상형은?', '애인은 언제 생길까?'],
  safety: ['마음이 너무 힘들어'],
};

// 연애 상태별 첫 질문
const START = {
  solo: ['애인은 언제 생길까?', '내 이상형은?', '내 연애 문제점은?', '오늘 운세는?'],
  some: ['썸에서 연애로 갈 수 있을까?', '고백하기 좋은 날은?', '연락은 어떻게 해야 해?', '오늘 운세는?'],
  couple: ['우리 커플 궁합은?', '요즘 자주 싸워요', '결혼은 언제쯤?', '오늘 운세는?'],
  after: ['재회할 수 있을까?', '마음 정리하는 법', '새 인연은 언제 와?', '오늘 운세는?'],
};

// 주제별로 함께 보면 좋은 화면
const LINK = {
  compat: ['#compat', '💞 궁합 자세히 보기'], conflict: ['#breakup', '💔 이별수로 위기 시기 보기'],
  trust: ['#compat', '💞 궁합 자세히 보기'], marriage: ['#compat', '💞 궁합 자세히 보기'],
  breakup: ['#breakup', '💔 이별수 자세히 보기'], reunion: ['#reunion', '💞 재회운 자세히 보기'],
  moveon: ['#reunion', '💞 재회운 보기'], intimacy: ['#intimacy', '🔥 속궁합 자세히 보기'],
  today: ['#today', '☀️ 오늘의 운세 전체 보기'], period: ['#today', '☀️ 오늘의 운세 보기'], lucky: ['#today', '☀️ 오늘의 행운 보기'],
  timing: ['#reading', '📖 내 연애운 달력 보기'], self: ['#reading', '📖 내 사주 풀이 보기'],
  ideal: ['#reading', '📖 배우자 자리 풀이 보기'], charm: ['#reading', '📖 매력 신살 보기'],
  confession: ['#reading', '📖 내 연애운 달력 보기'], age: ['#compat', '💞 궁합 보러 가기'],
};

const norm = (s) => String(s).replace(/[\s?!.~]+/g, '').replace(/^💡/, '');

/** 마지막 사용자 질문의 주제 ("더 알려 줘" 같은 꼬리 질문이면 그 앞 주제) */
export function lastTopicOf(userQuestions) {
  for (let i = userQuestions.length - 1; i >= 0; i--) {
    const t = detectTopic(userQuestions[i]);
    if (!['followup', 'fallback', 'greeting', 'thanks'].includes(t)) return t;
  }
  return null;
}

/**
 * @param {{status?: string, asked?: string[], topic?: string|null, handlerChips?: string[],
 *   partnerName?: string, hasCompat?: boolean, breakup?: object|null, reunion?: object|null,
 *   intimacy?: object|null, adult?: boolean}} ctx
 * @returns {{chips: string[], link: {href: string, label: string}|null, title: string}}
 */
export { MORE };

export function suggestQuestions(ctx) {
  const status = ctx.status || 'solo';
  const asked = new Set((ctx.asked || []).map(norm));
  const topic = ctx.topic || null;
  const out = [];
  const add = (q) => { if (q && !asked.has(norm(q)) && !out.some((x) => norm(x) === norm(q))) out.push(q); };

  if (!topic) {
    // 대화 시작: 상태별 첫 질문 + 저장된 결과가 있으면 그 이야기부터
    if (ctx.reunion && status === 'after') add(`${ctx.reunion.b.name}님과 재회할 수 있을까?`);
    if (ctx.breakup && status === 'couple') add(`${ctx.breakup.b.name}님과 이별수는 어때?`);
    START[status in START ? status : 'solo'].forEach(add);
    return { chips: out.slice(0, 4), link: null, title: '💬 이런 고민부터 시작해 볼까요?' };
  }

  const P = ctx.partnerName;
  const askedTopics = new Set((ctx.asked || []).map((q) => detectTopic(q)));
  const flow = FLOW[topic] || [];
  // 1) 저장된 결과로 맞춤 질문 — 이미 그 주제를 물어 답에서 결과를 봤다면 생략
  if (topic === 'conflict' && ctx.breakup && !askedTopics.has('breakup')) add('이별수 위험한 달은 언제야?');
  if ((topic === 'reunion' || topic === 'moveon') && ctx.reunion && !askedTopics.has('reunion')) add(`${ctx.reunion.b.name}님과 재회 타이밍은?`);
  if (['conflict', 'trust', 'marriage'].includes(topic) && P && ctx.hasCompat && !askedTopics.has('compat')) add(`${P}님과 궁합 더 자세히 알려 줘`);
  if (topic === 'compat' && ctx.intimacy && !ctx.intimacy.blocked && !askedTopics.has('intimacy')) add('우리 속궁합은 어때?');
  // 2) 지금 주제를 더 깊게
  flow.slice(0, 2).forEach(add);
  // 3) 같은 주제의 해결책 더 보기 (안전 문제·바로 앞이 "더 알려 줘"면 제외)
  const lastQ = (ctx.asked || []).slice(-1)[0] || '';
  if (topic !== 'safety' && norm(lastQ) !== norm(MORE)) add(MORE);
  // 4) 상담 답변이 붙여 준 질문, 남은 흐름, 상태별 질문
  (ctx.handlerChips || []).forEach(add);
  flow.slice(2).forEach(add);
  START[status in START ? status : 'solo'].forEach(add);

  // 연애 상태에 맞지 않는 질문은 뺀다
  const fits = (q) => {
    if (q === MORE) return true;
    const t = detectTopic(q);
    if (status === 'couple' || status === 'some') return !['reunion', 'moveon'].includes(t) && !q.includes('새 인연');
    if (!ctx.hasCompat) return !['conflict', 'trust', 'intimacy'].includes(t) && !q.includes('우리 커플');
    return true;
  };
  for (let i = out.length - 1; i >= 0; i--) if (!fits(out[i])) out.splice(i, 1);

  const dedup = [...new Set(out)].filter((q) => !asked.has(norm(q)) || q === MORE);
  const l = topic === 'safety' ? null : LINK[topic];
  // 속궁합 화면은 성인 둘일 때만 링크
  const link = l && !(topic === 'intimacy' && ctx.adult === false) ? { href: l[0], label: l[1] } : null;
  const title = topic === 'safety' ? '🫂 천천히 이야기해도 괜찮아요' : '💡 이어서 물어보기';
  return { chips: dedup.slice(0, 4), link, title };
}
