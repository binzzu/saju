// 묘연의 연애 상담 — 사주 데이터 기반 규칙형 상담 엔진 (서버 없이 동작)
import { dayPillarOf, ELEMENT_KO, STEMS, BRANCHES, branchRelation } from './saju.js';
import { DAY_MASTERS, ELEMENT_INFO, CHARMS, periodLove, STATUS_LABEL } from './reading.js';
import { WEEKDAYS, josa } from './text.js';
import { dailyFortune } from './daily.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const TOPICS = [
  { id: 'safety', words: ['죽고 싶', '자살', '자해', '때려', '때렸', '폭력', '맞았', '스토킹', '스토커', '협박', '감금'] },
  { id: 'comfort', words: ['힘들', '우울', '외로', '슬퍼', '슬프', '눈물', '지쳐', '지친다', '괴로'] },
  { id: 'moveon', words: ['마음 정리', '잊는 법', '잊고 싶', '못 잊', '잊혀지', '정리하는 법'] },
  { id: 'lines', words: ['멘트', '뭐라고 말', '뭐라고 하', '대사', '첫마디', '할 말'] },
  { id: 'reunion', words: ['재회', '다시 만', '전남친', '전여친', '전 남친', '전 여친', '전애인', '전 애인', '헤어진', '돌아올', '돌아와', '연락 올까', '연락올까', '미련'] },
  { id: 'breakup', words: ['이별', '헤어질', '헤어져야', '그만 만나', '끝내야', '정리해야', '권태기'] },
  { id: 'conflict', words: ['싸움', '싸웠', '싸워', '싸우', '다퉜', '다툼', '갈등', '서운', '화해', '삐졌', '지루', '식었', '잔소리'] },
  { id: 'trust', words: ['바람', '외도', '의심', '질투', '집착', '불안', '양다리'] },
  { id: 'confession', words: ['고백', '썸', '짝사랑', '좋아하는 사람', '호감', '관심 있는', '관심있는', '플러팅', '마음을 전', '좋아하는데'] },
  { id: 'marriage', words: ['결혼', '배우자', '청혼', '프로포즈', '프러포즈', '신혼', '웨딩', '상견례'] },
  { id: 'contact', words: ['연락', '카톡', '답장', '문자', '밀당', '읽씹', '안읽씹', 'dm', '디엠'] },
  { id: 'date', words: ['소개팅', '데이트', '첫만남', '첫 만남', '미팅', '장소', '어디서', '어디 가', '선 보'] },
  { id: 'intimacy', words: ['속궁합', '스킨십', '잠자리', '19금', '첫날밤'] },
  { id: 'compat', words: ['궁합', '그 사람', '그사람', '우리 커플', '우리 둘', '상대방', '잘 맞을', '잘 될까', '잘될까'] },
  { id: 'age', words: ['연상', '연하', '나이 차', '나이차', '동갑'] },
  { id: 'distance', words: ['장거리', '롱디', '해외', '군대', '유학'] },
  { id: 'ideal', words: ['이상형', '어떤 사람', '어떤 스타일', '어떤 타입', '잘 맞는 사람', '맞는 사람'] },
  { id: 'charm', words: ['매력', '인기', '어필', '외모', '스타일링', '패션', '첫인상', '꾸미'] },
  { id: 'lucky', words: ['행운', '개운', '컬러', '색깔', '아이템', '숫자', '방향', '부적', '향수'] },
  { id: 'today', words: ['오늘', '내일', '하루', '일진'] },
  { id: 'period', words: ['올해', '내년', '이번 달', '이번달', '다음 달', '다음달', '연애운', '운세', '월별'] },
  { id: 'self', words: ['문제점', '단점', '연애 스타일', '왜 연애', '왜 안', '모솔', '연애를 못', '연애 못', '나는 어떤', '내 성격'] },
  { id: 'timing', words: ['언제', '시기', '생길', '만날', '인연', '솔로 탈출', '애인', '남친', '여친', '남자친구', '여자친구'] },
  { id: 'greeting', words: ['안녕', '하이', '반가', '처음'] },
  { id: 'thanks', words: ['고마', '감사', '덕분', '땡큐'] },
];
const FOLLOWUP_WORDS = ['어떻게', '방법', '해결', '조언', '팁', '그럼', '그러면', '더 알려', '자세히', '뭘 하', '뭐 하', '무엇을'];

export function detectTopic(text) {
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  let best = null, bestHits = 0;
  for (const topic of TOPICS) {
    const hits = topic.words.filter((w) => t.includes(w)).length;
    if (hits > bestHits) { best = topic.id; bestHits = hits; }
  }
  if (best === 'safety') return 'safety';
  if (!best && FOLLOWUP_WORDS.some((w) => t.includes(w))) return 'followup';
  return best || 'fallback';
}

const monthName = (m, cur) => (m.year !== cur ? `${m.year}년 ${m.month}월` : `${m.month}월`);

// 앞으로 n일 중 연애 길일
export function luckyDays(a, n = 30, from = Date.now()) {
  const days = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(from + 9 * 3600000 + i * 86400000);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    const p = dayPillarOf(y, m, day);
    const love = periodLove(a, p.stem, p.branch);
    days.push({ y, m, day, wd: WEEKDAYS[d.getUTCDay()], ...love });
  }
  return days.sort((x, y) => y.score - x.score).slice(0, 3).sort((x, y) => (x.y - y.y) || (x.m - y.m) || (x.day - y.day));
}

const dayLabel = (d) => `${d.m}월 ${d.day}일(${d.wd})`;

// 일간(10)별 고백법 + 오행별 장소
const CONFESS_HOW = [
  '돌려 말하지 말고 담백하게 직진하세요. 다만 "나랑 사귀자!" 대신 "나 너 좋아해. 천천히 생각해 줘"처럼 상대에게 선택할 여유를 주면 성공률이 올라가요.',
  '갑작스러운 고백보다 함께하는 시간을 늘리며 "나 너랑 있는 게 제일 좋아" 같은 다정한 한마디로 마음을 보여 주세요. 상대가 다가올 틈을 만들어 주는 게 포인트예요.',
  '분위기가 무르익었을 때 솔직한 한마디가 최고의 무기예요. 장문의 편지보다 눈을 보고 하는 짧은 고백이 잘 통해요.',
  '조용한 곳에서 진심을 담은 편지나 메시지로 전해 보세요. 정성 들인 작은 선물과 함께라면 효과 만점이에요.',
  '꾸준히 쌓은 신뢰가 무기예요. 거창한 이벤트보다 "요즘 너랑 있는 게 제일 편해"처럼 일상 속에서 마음을 전하세요.',
  '상대를 챙겨 온 시간이 이미 고백의 절반이에요. "너 챙기는 게 좋아"라는 말로 마음을 살짝 열어 보세요.',
  '깔끔하고 명확하게! 애매한 플러팅을 오래 끌기보다 정해 둔 날 정확한 말로 마음을 전하세요.',
  '예쁜 장소와 깔끔한 한마디를 준비하세요. 대신 완벽한 순간을 기다리다 타이밍을 놓치지 않기!',
  '함께 새로운 경험을 한 날, 자연스럽게 마음을 꺼내 보세요. 깊은 대화 끝의 고백이 잘 통해요.',
  '깊은 대화로 마음을 연 뒤 감성적인 메시지로 전하는 게 잘 맞아요. 밤 산책 중 진솔한 고백도 좋아요.',
];
const CONFESS_PLACE = {
  wood: '산책로나 공원처럼 탁 트인 곳', fire: '노을이 예쁜 루프탑이나 공연이 끝난 직후',
  earth: '단골 맛집이나 조용한 카페', metal: '분위기 좋은 레스토랑이나 미술관 데이트 후',
  water: '야경이 보이는 곳이나 바닷가',
};

const LINES = {
  wood: { why: '솔직하고 담백한 말이 가장 멋있어 보여요.', lines: ['너랑 있으면 내가 더 좋은 사람이 되는 것 같아.', '다음 주에도, 다음 달에도 너랑 같이 걷고 싶어.'] },
  fire: { why: '밝고 확신 있는 말이 상대 마음에 불을 붙여요.', lines: ['오늘 너 진짜 빛나 보여. 나 너 좋아해!', '너랑 있는 시간이 제일 신나. 우리 계속 같이 놀자.'] },
  earth: { why: '든든하고 편안한 말이 믿음을 줘요.', lines: ['너 힘들 때 제일 먼저 생각나는 사람이 되고 싶어.', '요즘 하루 중에 너랑 얘기하는 시간이 제일 편해.'] },
  metal: { why: '짧고 분명한 말이 진심으로 들려요.', lines: ['돌려 말 안 할게. 나 너 좋아해.', '너라서 좋아. 다른 이유는 없어.'] },
  water: { why: '감성이 담긴 말이 오래 남아요.', lines: ['밤에 예쁜 걸 보면 네 생각이 나.', '너랑 이야기하면 마음이 조용해져. 그게 좋아.'] },
};

const CONTACT_STYLE = {
  wood: '용건 위주로 짧게 보내는 편이라 차가워 보일 수 있어요. 이모티콘 하나, 질문 하나를 붙여 보세요.',
  fire: '답장이 빠르고 감정이 바로 드러나요. 상대 답장이 느릴 때 조급해하지 않는 게 포인트예요.',
  earth: '꾸준하지만 내용이 무난해지기 쉬워요. "오늘 뭐 했어?" 대신 상대 관심사를 콕 집어 물어보세요.',
  metal: '단답이 많아 오해를 사기 쉬워요. "ㅇㅇ" 대신 리액션 한 줄을 더해 주세요.',
  water: '생각이 많아 장문이 되거나 답장을 고민하다 늦어져요. 마음이 담긴 짧은 문장이 더 잘 통해요.',
};

const EXTRA = {
  timing: ['인연운이 좋은 달엔 약속을 거절하지 않는 "YES 주간"을 만들어 보세요.', '프로필 사진과 SNS를 정리해 두면 들어온 인연을 놓치지 않아요.', '평소 동선에서 한 곳만 바꿔 보세요. 새로운 카페, 새로운 운동 수업!'],
  reunion: ['연락 전 "헤어진 이유가 지금은 해결됐나?"를 종이에 적어 보세요.', '첫 연락은 부담 없는 안부 한 줄로. 답이 없으면 그것도 존중하기.', '재회보다 "더 좋은 나"를 목표로 삼으면 어느 쪽이든 이득이에요.'],
  confession: ['고백 전 2주 동안 연락 빈도를 자연스럽게 늘려 보세요.', '거절당해도 관계가 망가지지 않도록 "부담 갖지 마"를 꼭 덧붙이기.', '단둘이 만나는 약속을 먼저 성사시키는 게 1단계예요.'],
  conflict: ['싸움 중엔 "너는 항상" 대신 "나는 ~해서 속상했어"로 말하기.', '화해 신호를 정해 두세요. 예: 좋아하는 간식 보내기 = 휴전!', '같은 문제로 세 번 이상 싸웠다면 둘만의 규칙으로 정리하기.'],
  trust: ['불안할 때 떠오르는 생각을 "사실 / 추측"으로 나눠 적어 보세요.', '확인하고 싶은 건 감시 대신 질문으로. "요즘 나 좀 불안해, 얘기해도 돼?"', '나 자신에게 집중할 취미가 있으면 불안이 줄어요.'],
  marriage: ['결혼 이야기는 돈·집·가족 세 가지 주제부터 가볍게 나눠 보세요.', '서로의 생활 습관(청소, 수면, 소비)을 미리 맞춰 보는 여행을 추천해요.'],
  contact: ['답장 속도를 상대에게 맞추는 "미러링"이 가장 편안함을 줘요.', '중요한 이야기는 카톡 말고 통화나 만나서!'],
  date: ['첫 데이트는 2시간 안팎으로 짧고 굵게. 아쉬움이 다음 약속을 부릅니다.', '대화가 끊기면 "요즘 빠져 있는 거 있어요?" 질문 카드 꺼내기!'],
  self: ['연애 일기를 써 보세요. 반복되는 패턴이 보이면 절반은 해결된 거예요.', '연애 밖의 나(일·취미·친구)가 단단할수록 연애도 건강해져요.'],
  default: ['오늘 할 수 있는 작은 행동 하나만 정해 보세요.', '행운 컬러 소품 하나로 기분을 바꿔 보세요.'],
};

export function createCounselor(getCtx) {
  let lastTopic = null;

  function respond(text) {
    const ctx = getCtx();
    const { a, fc, compat } = ctx;
    if (!a) {
      return { text: '아직 사주 정보가 없다냥! 먼저 "내 사주" 탭에서 생년월일시를 알려 줘야 상담할 수 있어요.', expr: 'worry', chips: [] };
    }
    let topic = detectTopic(text);
    if (topic === 'followup' && lastTopic) topic = `more:${lastTopic}`;
    const handler = HANDLERS[topic.startsWith('more:') ? 'more' : topic] || HANDLERS.fallback;
    const out = handler({ ...ctx, a, fc, compat, text, topic, status: a.person.status || 'solo' });
    if (!['greeting', 'thanks', 'fallback'].includes(topic) && !topic.startsWith('more:')) lastTopic = topic;
    out.text = out.text.replace(/\n{3,}/g, '\n\n').trim();
    return out;
  }

  function greet() {
    const { a } = getCtx();
    if (!a) return { text: '어서 와라냥! 상담을 하려면 먼저 "내 사주" 탭에서 정보를 입력해 줘요.', expr: 'smile', chips: [] };
    return {
      text: `${a.name}님, 묘연 상담소에 온 걸 환영한다냥 🐾\n\n${a.profile.emoji} **${a.profile.cat}** 타입인 ${a.name}님의 사주를 옆에 펼쳐 두었어요. 연애 고민이라면 뭐든 물어봐요. 사주로 흐름을 읽고, 꼭 **해결책**까지 같이 찾아 줄게요.`,
      expr: 'happy',
      chips: starterChips(a.person.status),
    };
  }

  return { respond, greet };
}

export function starterChips(status) {
  if (status === 'couple') return ['우리 커플 궁합은?', '요즘 자주 싸워요', '결혼은 언제쯤?', '이번 달 연애운은?'];
  if (status === 'some') return ['썸에서 연애로 갈 수 있을까?', '고백하기 좋은 날은?', '연락은 어떻게 해야 해?', '그 사람과 궁합은?'];
  if (status === 'after') return ['재회할 수 있을까?', '새 인연은 언제 와?', '내 연애의 문제점은?', '마음 정리하는 법'];
  return ['애인은 언제 생길까?', '내 이상형은?', '내 연애 문제점은?', '소개팅 잘 되는 법'];
}

/* ───────────── 주제별 답변 ───────────── */

const HANDLERS = {
  safety() {
    return {
      text: '그 이야기를 꺼내 줘서 고마워요. 이건 사주보다 **지금 당신의 안전**이 훨씬 중요한 문제다냥.\n\n• 위험한 상황이라면 바로 **112**에 신고하세요.\n• 데이트 폭력·스토킹 상담: **여성긴급전화 1366** (24시간)\n• 마음이 너무 힘들 땐: **자살예방상담전화 109** (24시간)\n\n혼자 견디지 않아도 돼요. 믿을 수 있는 사람에게도 꼭 알려 주세요. 여기서 이야기를 더 나누고 싶다면 언제든 들을게요.',
      expr: 'worry', chips: ['마음이 너무 힘들어', '이별하고 싶어'],
    };
  },

  comfort({ a }) {
    return {
      text: `많이 힘들었구나냥… 여기까지 와서 이야기해 줘서 고마워요. 🫂\n\n🔮 **사주로 보면**\n${a.name}님은 ${a.profile.cat} 타입이라, ${a.profile.weak}\n지금 지친 건 ${a.name}님이 약해서가 아니라, 그만큼 마음을 많이 썼다는 뜻이에요.\n\n💡 **해결책**\n• 오늘은 연애 고민을 잠시 내려놓고 잠·식사부터 챙기기\n• 믿을 수 있는 사람 한 명에게 지금 마음을 털어놓기\n• ${a.luck.places[0]}처럼 ${ELEMENT_KO[a.lucky]} 기운이 있는 곳에서 30분 쉬기\n• 마음이 너무 무거워 위험하다고 느껴지면 **자살예방상담전화 109**(24시간)에 꼭 연락하기\n\n무슨 일이 있었는지 조금 더 들려줄래요? 천천히 들을게요.`,
      expr: 'worry', chips: ['이별했어', '요즘 자주 싸워요', '내 연애 문제점은?'],
    };
  },

  moveon({ a, fc }) {
    const cur = fc.current.sajuYear;
    const next = fc.best[0];
    return {
      text: `마음 정리, 쉽지 않지냥. 천천히 해도 괜찮아요. 🌙\n\n🔮 **사주로 보면**\n${a.groupCounts.인성 >= 2 ? '인성 기운이 있어 추억을 오래 곱씹는 편이에요. 그래서 "잊으려" 하기보다 "정리하는" 방식이 잘 맞아요.' : `${josa(a.profile.keywords[0], '이', '가')} 강점인 타입이라, 몸을 움직이고 새 경험을 채울수록 회복이 빨라요.`}\n다음으로 인연운이 밝아지는 때는 **${monthName(next, cur)}**이에요. 그때까지는 나를 채우는 시간!\n\n💡 **해결책**\n• 사진·대화방은 지우지 말고 "보관 폴더"로 옮겨 시야에서만 치우기\n• 하루 10분, 하고 싶은 말을 보내지 않는 편지로 적기\n• ${a.luck.action}\n• 새 루틴 하나 시작하기 — 운동, 클래스, 여행 계획`,
      expr: 'think', chips: ['새 인연은 언제 와?', '재회할 수 있을까?', '내 매력 포인트는?'],
    };
  },

  lines({ a }) {
    const L = LINES[a.dmEl];
    return {
      text: `${a.profile.emoji} ${a.profile.cat} 타입에게 어울리는 멘트를 골라 왔다냥! 💌\n\n🔮 **사주로 보면**\n${ELEMENT_KO[a.dmEl]} 기운 일간은 ${L.why}\n\n💬 **추천 멘트**\n${L.lines.map((x) => `• "${x}"`).join('\n')}\n\n💡 **해결책**\n• 멘트보다 중요한 건 눈 맞춤과 웃는 얼굴!\n• 답을 재촉하지 말고 "천천히 생각해도 돼"로 마무리하기`,
      expr: 'love', chips: ['고백하기 좋은 날은?', '연락은 어떻게 해야 해?'],
    };
  },

  timing({ a, fc, status }) {
    const cur = fc.current.sajuYear;
    const [b1, b2] = fc.best;
    const couple = status === 'couple';
    const head = couple
      ? `${a.name}님 커플의 관계가 한 단계 깊어질 타이밍을 찾아봤다냥!`
      : pick([`${a.name}님의 연애 레이더를 돌려 봤다냥! 📡`, `인연의 실이 어디쯤 와 있는지 볼까냥? 🧶`]);
    const partnerLine = a.partner.count === 0
      ? `${a.name}님은 원래 사주에 인연의 별이 숨어 있는 타입이라, 운에서 그 별이 들어오는 달에 인연이 확 들어와요.`
      : a.partner.text;
    return {
      text: `${head}\n\n🔮 **사주로 보면**\n앞으로 12개월 중 ${couple ? '관계운' : '인연운'}이 가장 반짝이는 때는 **${monthName(b1, cur)}**(${b1.score}점 · ${b1.reason.label}), 그다음은 **${monthName(b2, cur)}**(${b2.score}점 · ${b2.reason.label})이에요. ${couple ? b1.reason.couple : b1.reason.solo}\n${partnerLine}\n\n💡 **해결책**\n• ${monthName(b1, cur)} 전에 미리 판을 깔아 두세요: ${couple ? '여행이나 기념일 계획 세우기' : '모임 참석, 지인에게 소개 부탁하기'}\n• 인연을 부르는 장소: ${a.luck.places.slice(0, 2).join(', ')}\n• ${b1.reason.tip}\n• 행운 컬러 **${a.luck.color}** 소품으로 기운 끌어올리기`,
      expr: 'smug', chips: ['그 달에 뭘 하면 좋아?', '내 이상형은?', '고백하기 좋은 날은?'],
    };
  },

  reunion({ a, fc, reunion: ru }) {
    if (ru) {
      const thisYear = new Date().getFullYear();
      const mn = (m) => (m.year !== thisYear ? `${m.year}년 ${m.month}월` : `${m.month}월`);
      const d = ru.contactDays[0];
      return {
        text: `${ru.b.name}님과의 재회 이야기구나냥... 🧶\n\n🔮 **사주로 보면**\n재회운은 **${ru.score}점 (${ru.grade.title})**이에요. ${ru.pulls.length ? `다시 당기는 가장 큰 힘은 "${ru.pulls[0].short}"${josa(ru.pulls[0].short, '이고', '고').slice(ru.pulls[0].short.length)}` : '사주로 당기는 힘은 약한 편이고'}, ${ru.blocks.length ? `"${ru.blocks[0].short}" 부분은 조심해야 해요.` : '막는 힘은 크지 않아요.'}\n${ru.b.name}님은 **${ru.mind.type}**이라, ${ru.mind.how}\n다시 닿기 좋은 때는 **${ru.best.map(mn).join('**, **')}**이에요.\n\n💡 **해결책**\n• 첫 연락은 ${mn(ru.best[0])}, 특히 ${d.month}월 ${d.day}일(${d.wd})쯤 짧은 안부 한 줄로\n• 예시: "${ru.mind.msgs[0]}"\n• 다시 만나기 전에 꼭 해결할 것: ${ru.breakup.rules[0]}\n• 답이 없거나 거절하면 그 뜻을 존중하기 — 그게 나를 지키는 길이기도 해요`,
        expr: 'think', chips: ['먼저 연락해도 될까?', '새 인연은 언제 와?', '마음 정리하는 법'],
      };
    }
    const cur = fc.current.sajuYear;
    const back = fc.months.filter((m) => m.good.some((k) => ['harmony', 'same', 'stemCombo', 'trine'].includes(k))).slice(0, 2);
    const windows = back.length ? back : fc.best.slice(0, 2);
    const g = a.groupCounts;
    const tendency = g.인성 >= 3
      ? '인성 기운이 강해서 지난 추억을 오래 곱씹는 편이에요. 미련이 오래가는 만큼, 마음 정리도 의식적으로 해야 해요.'
      : g.비겁 >= 3
        ? '자존심을 지키는 비겁 기운이 강해서, 마음은 있어도 먼저 연락하기 어려워하는 타입이에요.'
        : g.식상 >= 3
          ? '표현력이 좋은 식상 기운 덕분에, 진심을 전하면 상대 마음을 움직일 힘이 있어요.'
          : '감정이 정리되는 속도가 평균적인 편이에요. 재회든 새 출발이든 스스로 선택할 수 있는 상태예요.';
    return {
      text: `재회 이야기구나냥... 🧶 마음이 많이 쓰였겠다.\n\n🔮 **사주로 보면**\n${tendency}\n지난 인연과 다시 연결되기 쉬운 흐름은 **${windows.map((w) => monthName(w, cur)).join('**, **')}**에 보여요. 이때는 배우자 자리와 합이 들거나 익숙한 기운이 돌아오는 시기라, 연락이 닿거나 우연히 마주칠 가능성이 커요.\n\n💡 **해결책**\n• 먼저 "왜 헤어졌는지"를 적어 보고, 그 이유가 지금은 달라졌는지 확인하기\n• 연락은 그 시기에 부담 없는 안부 한 줄로 — 답이 없다면 그것도 존중하기\n• 그 전까지는 ${a.luck.action}로 나를 먼저 채우기\n• 재회가 아니어도, 이 시기에 들어오는 새 인연을 막지 말기`,
      expr: 'think', chips: ['먼저 연락해도 될까?', '새 인연은 언제 와?', '마음 정리하는 법'],
    };
  },

  breakup({ a, breakup: br }) {
    const p = a.profile;
    const thisYear = new Date().getFullYear();
    const near = br ? br.danger.map((d) => (d.year !== thisYear ? `${d.year}년 ${d.month}월` : `${d.month}월`)).join('·') : '';
    const extra = br
      ? `\n\n💔 **${br.a.name}님 × ${br.b.name}님 이별수: ${br.risk}점 (${br.grade.title})**\n이별이 온다면 "${br.pattern.title}"일 가능성이 커요. ${near ? `특히 **${near}**에는 큰 결정을 미루세요.` : '두드러지게 위험한 달은 없어요.'}\n→ **${br.rules[0]}**`
      : '';
    return {
      text: `헤어짐을 고민할 만큼 지쳤구나냥. 🫂\n\n🔮 **사주로 보면**\n${a.name}님은 ${p.cat} 타입이라, ${p.weak}\n그래서 지금의 피로감이 "관계의 문제"인지 "내 패턴"인지 구분해 보는 게 중요해요.${extra}\n\n💡 **해결책 — 이 질문에 답해 보세요**\n• 이 사람과 있을 때 나는 존중받고 있나요?\n• 같은 문제로 세 번 이상 싸웠고, 상대가 바뀔 의지가 없나요?\n• 1년 뒤에도 지금 같다면, 나는 괜찮을까요?\n두 개 이상 "아니요"라면 거리를 두고 생각할 때예요. 결정은 사주가 아니라 ${a.name}님이 하는 거다냥. 어느 쪽이든 응원할게요.`,
      expr: 'worry', chips: br ? ['요즘 자주 싸워요', '어떻게 먼저 사과하지?', '재회할 수 있을까?'] : ['요즘 자주 싸워요', '재회할 수 있을까?', '새 인연은 언제 와?'],
    };
  },

  intimacy({ intimacy: it }) {
    if (!it) {
      return {
        text: '속궁합이 궁금하구나냥. 😼\n\n🔮 **사주로 보면**\n속궁합은 두 사람의 사주를 함께 봐야 해서, 상대 정보가 필요해요. "궁합" 탭에서 상대를 정한 뒤 위의 **🔥 속궁합** 스위치를 눌러 보세요.\n\n💡 **해결책**\n• 궁합 탭 → 상대 정보 입력 또는 프리셋 선택\n• 🔥 속궁합으로 바꿔 보기 (두 사람 모두 만 19세 이상)',
        expr: 'smug', chips: ['우리 커플 궁합은?', '이번 달 연애운은?'], action: 'compat',
      };
    }
    if (it.blocked) {
      return {
        text: '속궁합 이야기는 두 사람 모두 **만 19세 이상**일 때만 할 수 있어요. 대신 마음이 얼마나 잘 맞는지는 **궁합**에서 함께 볼 수 있다냥!\n\n💡 **해결책**\n• 궁합 탭에서 두 사람의 성격·생활 궁합 보기\n• 좋아하는 마음은 대화와 함께하는 시간으로 천천히 키우기',
        expr: 'smile', chips: ['우리 커플 궁합은?', '데이트 어디 갈까?'],
      };
    }
    const thisYear = new Date().getFullYear();
    const mn = (m) => (m.year !== thisYear ? `${m.year}년 ${m.month}월` : `${m.month}월`);
    return {
      text: `${it.b.name}님과의 속궁합이구나냥. 😼\n\n🔮 **사주로 보면**\n속궁합은 **${it.score}점 (${it.grade.title})**이에요. ${it.parts[1].short}, 그리고 ${it.parts[2].short}.\n${it.a.name}님은 **${it.styleA.type}**(${it.styleA.lead.label}), ${it.b.name}님은 **${it.styleB.type}**(${it.styleB.lead.label})이에요. ${it.styleA.type === it.styleB.type ? `둘 다 "${it.styleA.like}"를 좋아하는 닮은꼴이에요.` : `좋아하는 방식이 "${it.styleA.like}" / "${it.styleB.like}"로 조금 달라요.`}\n설렘 지수가 높은 달은 **${it.hot.map(mn).join('**, **')}**이에요.\n\n💡 **해결책**\n• ${it.tips[0]}\n• ${it.tips[it.tips.length - 1]}\n• 분위기는 ${it.mood.light}, ${josa(it.mood.scent, '으로', '로')}\n• 무엇보다 서로의 속도와 "싫어"를 존중하기`,
      expr: 'smug', chips: ['우리 커플 궁합은?', '요즘 자주 싸워요', '이번 달 연애운은?'],
    };
  },

  conflict({ a, compat }) {
    const p = a.profile;
    const extra = compat
      ? `\n${compat.b.name}님과의 궁합에서 짚이는 부분: ${compat.cautions[0]}. → **${compat.tips[0]}**`
      : '';
    return {
      text: `다퉜구나냥... 😿 괜찮아, 싸운다는 건 아직 서로 기대하고 있다는 뜻이기도 해요.\n\n🔮 **사주로 보면**\n${a.name}님은 ${p.weak}\n${a.style.caution[a.gender]}${extra}\n\n💡 **해결책**\n• ${p.tips[0]}\n• 감정이 올라오면 "10분만 쉬었다 이야기하자"고 말하기\n• "너는 항상~" 대신 "나는 ~해서 속상했어"로 바꿔 말하기\n• 화해 데이트 추천: ${a.luck.places[0]} — ${a.name}님의 행운 기운이 마음을 풀어 줘요`,
      expr: 'worry', chips: ['어떻게 먼저 사과하지?', '우리 커플 궁합은?', '헤어져야 할까?'],
    };
  },

  trust({ a }) {
    const many = a.partner.count >= 3 || (a.partner.hasJeong && a.partner.hasPyeon);
    const dohwa = a.charms.includes('dohwa');
    const lines = [];
    if (dohwa) lines.push(`${a.name}님은 도화살이 있어 주변의 관심을 많이 받아요. 그래서 연인이 불안해하거나, 반대로 ${a.name}님이 오해를 받을 수 있어요.`);
    if (many) lines.push('끌리는 타입이 여러 갈래라 마음이 흔들리는 순간이 올 수 있어요. 그럴수록 "나는 어떤 관계를 원하는가"를 기준으로 삼으세요.');
    if (a.dmEl === 'water' || a.dmEl === 'fire') lines.push(`${ELEMENT_KO[a.dmEl]} 기운의 일간이라 감정의 파도가 큰 편이에요. 불안은 사실보다 상상에서 커지기 쉬워요.`);
    if (!lines.length) lines.push(`${a.name}님은 ${josa(a.profile.keywords.join('·'), '이', '가')} 강한 타입이라, 불안할 땐 혼자 판단하기보다 대화로 확인하는 게 훨씬 잘 맞아요.`);
    return {
      text: `마음이 불안하구나냥. 그 마음부터 꼭 안아 줄게요. 🐾\n\n🔮 **사주로 보면**\n${lines.join('\n')}\n\n💡 **해결책**\n• 불안한 생각을 "확인된 사실 / 나의 추측"으로 나눠 적기\n• 감시 대신 질문하기: "요즘 내가 좀 불안해. 이야기해도 돼?"\n• 연인과 "오해 금지 규칙" 만들기 (예: 이성 친구와 약속은 미리 공유)\n• 반복되는 거짓말이나 통제는 사랑이 아니에요 — 그땐 관계를 다시 생각해 보기`,
      expr: 'think', chips: ['헤어져야 할까?', '우리 커플 궁합은?', '내 연애 문제점은?'],
    };
  },

  confession({ a, fc }) {
    const how = CONFESS_HOW[a.dm];
    const days = luckyDays(a, 30);
    const cur = fc.current.sajuYear;
    const goodMonth = fc.months.find((m) => m.good.some((k) => ['output', 'peach', 'partner', 'jeong', 'stemCombo'].includes(k))) || fc.best[0];
    return {
      text: `두근두근, 고백 작전이다냥! 💌\n\n🔮 **사주로 보면**\n${a.profile.emoji} ${a.profile.cat} 타입인 ${a.name}님은 — ${how}\n흐름상 마음을 전하기 좋은 달은 **${monthName(goodMonth, cur)}**이에요. (${goodMonth.reason.emoji} ${goodMonth.reason.label})\n\n📅 **앞으로 30일 중 고백 길일**\n${days.map((d) => `• ${dayLabel(d)} — ${d.reason.emoji} ${d.reason.label}`).join('\n')}\n\n💡 **해결책**\n• 장소: ${CONFESS_PLACE[a.dmEl]}\n• 고백 전 2주는 단둘이 만나는 횟수를 자연스럽게 늘리기\n• 행운 컬러 **${a.luck.color}** 아이템을 하나 착용하기\n• 거절이 두렵다면 "부담 갖지 말고 생각해 줘"를 꼭 덧붙이기`,
      expr: 'love', chips: ['연락은 어떻게 해야 해?', '그 사람과 궁합은?', '고백 멘트 추천해 줘'],
    };
  },

  marriage({ a, fc }) {
    const years = [...fc.years].sort((x, y) => y.score - x.score);
    const marry = fc.years.filter((y) => y.good.includes('jeong') || y.good.includes('harmony'));
    const pickYears = (marry.length ? marry : years).slice(0, 2);
    const palace = a.partner.inSpousePalace
      ? '배우자 자리(일지)에 배우자의 별이 앉아 있어서, 결혼 인연이 탄탄한 사주예요.'
      : a.partner.hasJeong
        ? `사주에 안정적인 배우자 별(${a.partner.jeongName})이 있어, 진지한 관계로 이어지는 힘이 있어요.`
        : '배우자 별이 원국에 뚜렷하지 않아, 운에서 그 별이 들어오는 해에 결혼 이야기가 빠르게 진행될 수 있어요.';
    return {
      text: `결혼 이야기라니, 설렌다냥! 💍\n\n🔮 **사주로 보면**\n${palace}\n앞으로 5년 중 결혼·약속 기운이 강한 해는 **${pickYears.map((y) => `${y.year}년(${y.pillar.hangul}년, ${y.reason.label})`).join('**, **')}**이에요.\n배우자 자리로 보면, ${a.spouse}\n\n💡 **해결책**\n• 결혼 이야기는 돈·집·가족 세 가지 주제부터 가볍게 꺼내 보기\n• 1박 2일 여행으로 생활 습관 맞춰 보기\n• ${a.profile.tips[1]}`,
      expr: 'sparkle', chips: ['우리 커플 궁합은?', '올해 연애운은?', '내 이상형은?'],
    };
  },

  contact({ a }) {
    return {
      text: `연락 고민이구나냥. 📱\n\n🔮 **사주로 보면**\n${ELEMENT_KO[a.dmEl]} 기운 일간인 ${a.name}님은 — ${CONTACT_STYLE[a.dmEl]}\n${a.groupCounts.식상 >= 2 ? '식상 기운이 있어서 말솜씨는 충분해요. 타이밍만 잡으면 돼요!' : '표현을 아끼는 편이라, 생각보다 한 번 더 표현해야 마음이 전해져요.'}\n\n💡 **해결책**\n• 답장 속도는 상대에게 맞추는 "미러링"이 가장 편안함을 줘요\n• "읽씹 = 거절" 공식은 금지! 하루는 기다려 보기\n• 대화가 이어지는 마법의 질문: "요즘 빠져 있는 거 있어?"\n• 중요한 이야기는 카톡 말고 통화나 만나서`,
      expr: 'smile', chips: ['고백하기 좋은 날은?', '밀당 해도 될까?', '데이트 장소 추천'],
    };
  },

  date({ a }) {
    const days = luckyDays(a, 21);
    const info = ELEMENT_INFO[a.lucky];
    return {
      text: `데이트 작전 회의 시작이다냥! 🎀\n\n🔮 **사주로 보면**\n${a.name}님에게 행운을 주는 기운은 **${ELEMENT_KO[a.lucky]}(${info.name})** — ${info.theme}의 기운이에요. 이 기운이 있는 곳에서 만나면 ${a.name}님의 매력이 자연스럽게 살아나요.\n\n📍 **추천 데이트 장소**\n${a.luck.places.map((p) => `• ${p}`).join('\n')}\n\n📅 **앞으로 3주 중 데이트 길일**\n${days.map((d) => `• ${dayLabel(d)} — ${d.reason.label}`).join('\n')}\n\n💡 **해결책**\n• 옷차림 포인트 컬러: **${a.luck.color}**\n• 첫 만남은 2시간 안팎으로 짧고 굵게\n• ${a.profile.charm.split('.')[0]} — 이 매력을 숨기지 말기!`,
      expr: 'wink', chips: ['소개팅에서 할 말 추천', '내 매력 포인트는?', '고백하기 좋은 날은?'],
    };
  },

  compat({ a, compat }) {
    if (!compat) {
      return {
        text: '궁금한 그 사람이 있구나냥? 👀\n\n위쪽 **궁합** 탭에서 상대의 이름과 생년월일을 알려 주면, 두 사람의 사주를 겹쳐서 점수와 해결책까지 자세히 봐 줄게요. (시간을 몰라도 괜찮아요!)',
        expr: 'smug', chips: ['내 이상형은?', '애인은 언제 생길까?'], action: 'compat',
      };
    }
    const c = compat;
    const top = [...c.parts].sort((x, y) => y.points / y.max - x.points / x.max);
    return {
      text: `${a.name}님과 ${c.b.name}님의 궁합을 다시 펼쳐 볼게냥! 💞\n\n🔮 **궁합 요약: ${c.score}점 · ${c.grade.title}**\n• 가장 좋은 점: ${top[0].icon} ${top[0].label} — ${top[0].short}\n• 신경 쓸 점: ${top[top.length - 1].icon} ${top[top.length - 1].label} — ${top[top.length - 1].short}\n• ${c.strengths[0]}\n\n💡 **해결책**\n${c.tips.slice(0, 3).map((t) => `• ${t}`).join('\n')}\n• 두 사람이 함께 좋은 달: **${c.bestMonths.map((m) => `${m.month}월`).join(', ')}**`,
      expr: 'love', chips: ['우리 자주 싸우는 이유는?', '결혼까지 갈 수 있을까?', '데이트 장소 추천'],
    };
  },

  age({ a }) {
    const g = a.groupCounts;
    let line;
    if (g.인성 >= g.식상 && g.인성 >= 2) line = '인성 기운이 강해서, 나를 이끌어 주고 보살펴 주는 **연상**과 잘 맞는 편이에요.';
    else if (g.식상 > g.인성 && g.식상 >= 2) line = '식상 기운이 강해서, 내가 챙겨 주고 귀여워할 수 있는 **연하**와 케미가 좋아요.';
    else if (g.비겁 >= 2) line = '비겁 기운이 있어 친구처럼 편한 **동갑이나 나이 차 적은 사람**과 잘 맞아요.';
    else line = '나이보다는 성향이 중요한 타입이에요. 나를 존중해 주는 사람이라면 연상·연하 모두 괜찮아요.';
    return {
      text: `나이 차 궁합이 궁금하구나냥! 🎂\n\n🔮 **사주로 보면**\n${line}\n${a.name}님의 이상형 포인트는 "${a.profile.ideal}"이에요.\n\n💡 **해결책**\n• 나이보다 "대화 속도"가 맞는지를 먼저 보세요\n• 연상이라면 기대기만 하지 말고 나도 챙겨 주는 순간 만들기\n• 연하라면 가르치려 하지 말고 칭찬을 두 배로!`,
      expr: 'think', chips: ['내 이상형은?', '애인은 언제 생길까?'],
    };
  },

  distance({ a }) {
    const yeokma = a.charms.includes('yeokma');
    return {
      text: `떨어져 있어도 마음은 가까이! ✈️\n\n🔮 **사주로 보면**\n${yeokma ? `${a.name}님은 역마살이 있어서 이동과 변화에 강해요. 장거리 연애도 오히려 설렘으로 바꿀 수 있는 타입이에요.` : `${a.name}님은 ${josa(a.profile.keywords[0], '이', '가')} 강한 타입이라, 자주 못 보는 만큼 "예측 가능한 연락"이 안정감을 줘요.`}\n\n💡 **해결책**\n• 매일 같은 시간의 짧은 통화 루틴 만들기\n• 다음 만남 날짜를 항상 정해 두기 — 기다림이 기대가 돼요\n• 같은 영화·같은 음식을 동시에 즐기는 "원격 데이트"\n• 행운 컬러 **${a.luck.color}** 커플 아이템 나눠 갖기`,
      expr: 'smile', chips: ['요즘 자주 싸워요', '우리 커플 궁합은?'],
    };
  },

  ideal({ a }) {
    const match = DAY_MASTERS[a.bestMatchStem];
    return {
      text: `${a.name}님의 이상형 분석 들어간다냥! 💘\n\n🔮 **사주로 보면**\n• 마음이 끌리는 사람: ${a.profile.ideal}\n• 인연의 별(${ELEMENT_KO[a.partner.el]} 기운): ${ELEMENT_INFO[a.partner.el].person}에게 운명적인 끌림을 느껴요\n• 배우자 자리: ${a.spouse}\n• 찰떡 궁합 냥이: ${match.emoji} **${match.cat}** (${STEMS[a.bestMatchStem]} 일간)\n\n💡 **해결책**\n• 이상형 조건은 3개만 남기고 나머지는 지워 보세요\n• "${ELEMENT_INFO[a.partner.el].person}"이 많은 곳: ${pickPlaceFor(a.partner.el)}\n• 끌림과 편안함이 다를 땐 편안함 쪽에 한 표!`,
      expr: 'sparkle', chips: ['그런 사람 어디서 만나?', '애인은 언제 생길까?', '내 매력 포인트는?'],
    };
  },

  charm({ a }) {
    const list = a.charms.map((c) => `• ${CHARMS[c].emoji} **${CHARMS[c].name}** — ${CHARMS[c].desc}`).join('\n');
    return {
      text: `${a.name}님의 매력 포인트를 찾아봤다냥! ✨\n\n🔮 **사주로 보면**\n${a.profile.charm}\n${list || '특별한 연애 신살은 없지만, 그만큼 꾸밈없는 진정성으로 사람을 끄는 타입이에요.'}\n\n💡 **해결책**\n• 행운 컬러 **${a.luck.color}**를 옷이나 소품에 포인트로\n• 행운 아이템: ${a.luck.items.join(', ')}\n• ${josa(a.profile.keywords[0], '이', '가')} 드러나는 순간을 상대에게 자주 보여 주기`,
      expr: 'wink', chips: ['소개팅 잘 되는 법', '애인은 언제 생길까?'],
    };
  },

  lucky({ a }) {
    const l = a.luck;
    return {
      text: `${a.name}님 맞춤 개운법이다냥! 🍀\n\n🔮 **사주로 보면**\n${a.name}님에게 필요한 기운은 **${ELEMENT_KO[a.lucky]}(${ELEMENT_INFO[a.lucky].name})**${josa(ELEMENT_INFO[a.lucky].name, '이에요', '예요').slice(ELEMENT_INFO[a.lucky].name.length)}. ${ELEMENT_INFO[a.lucky].theme}의 기운을 채우면 연애운이 부드럽게 열려요.\n\n💡 **해결책**\n• 컬러: **${l.color}**\n• 숫자: ${l.numbers} / 방향: ${l.direction}\n• 아이템: ${l.items.join(', ')}\n• 음식: ${l.food}\n• 행동: ${l.action}`,
      expr: 'smug', chips: ['데이트 장소 추천', '이번 달 연애운은?'],
    };
  },

  today({ a, text }) {
    const tomorrow = text.includes('내일');
    const f = dailyFortune(a, Date.now(), tomorrow ? 1 : 0);
    const when = tomorrow ? '내일' : '오늘';
    const top = [...f.cats].sort((x, y) => y.score - x.score)[0];
    const low = [...f.cats].sort((x, y) => x.score - y.score)[0];
    return {
      text: `${when}(${f.date.m}월 ${f.date.d}일, ${f.pillar.hanja}일) 운세를 펼쳐 볼게냥! ☀️\n\n🔮 **사주로 보면**\n총운 **${f.overall}점 · ${f.grade.emoji} ${f.grade.label}** — ${f.theme.emoji} ${f.theme.word}의 날, ${f.theme.line}.\n${top.icon} ${top.label}이 ${top.score}점으로 가장 좋고, ${low.icon} ${low.label}(${low.score}점)은 살짝 조심해요. ${low.line}\n💗 연애운 ${f.cats[0].score}점: ${f.cats[0].line}\n\n💡 **해결책**\n• ${f.todo[0]}\n• ${f.todo[f.todo.length - 1]}\n• 피할 일: ${f.avoid[0]}\n• 행운 컬러 **${f.lucky.color}**, 좋은 시간 **${f.bestBlock.label}(${f.bestBlock.range})**`,
      expr: f.overall >= 72 ? 'sparkle' : f.overall >= 58 ? 'smile' : 'think',
      chips: [tomorrow ? '오늘 운세는?' : '내일 운세는?', '이번 달 연애운은?', '행운 아이템 알려 줘'],
    };
  },

  period({ a, fc, text, status }) {
    const couple = status === 'couple';
    const cur = fc.current.sajuYear;
    let item, title;
    if (text.includes('다음 달') || text.includes('다음달')) { item = fc.months[1]; title = `${monthName(item, cur)} 연애운`; }
    else if (text.includes('이번 달') || text.includes('이번달')) { item = fc.months[0]; title = `${monthName(item, cur)} 연애운`; }
    else if (text.includes('내년')) { item = fc.years[1]; title = `${item.year}년 연애운`; }
    else { item = fc.years[0]; title = `${item.year}년 연애운`; }
    return {
      text: `${title}을 펼쳐 볼게냥! 🔮\n\n**${item.score}점 · ${item.grade.emoji} ${item.grade.label}** — ${item.reason.emoji} ${item.reason.label}\n${couple ? item.reason.couple : item.reason.solo}\n${item.bad.length && item.main !== item.bad[0] ? `다만 ${REASON_LABEL(item.bad[0])} 기운도 함께 있으니 살짝 조심!` : ''}\n\n💡 **해결책**\n• ${item.reason.tip}\n• 이 시기의 행운 장소: ${a.luck.places[1] || a.luck.places[0]}\n• 행운 컬러 **${a.luck.color}**`,
      expr: item.score >= 70 ? 'sparkle' : item.score >= 55 ? 'smile' : 'think', chips: ['다음 달 연애운은?', '내년 연애운은?', '애인은 언제 생길까?'],
    };
  },

  self({ a }) {
    const few = a.weakest.map((e) => `${ELEMENT_KO[e]}(${ELEMENT_INFO[e].name})`).join('·');
    return {
      text: `${a.name}님의 연애 패턴을 솔직하게 짚어 볼게냥. 🔍\n\n🔮 **사주로 보면**\n• 연애 스타일: **${a.style.title}** — ${a.style.desc}\n• 조심할 점: ${a.profile.weak}\n• 부족한 기운 ${few}: ${ELEMENT_INFO[a.weakest[0]].few}\n• ${a.partner.text}\n\n💡 **해결책**\n${a.profile.tips.map((t) => `• ${t}`).join('\n')}\n• ${a.style.caution[a.gender]}\n• 개운 행동: ${a.luck.action}`,
      expr: 'think', chips: ['어떻게 고쳐야 해?', '내 매력 포인트는?', '애인은 언제 생길까?'],
    };
  },

  more({ a, topic }) {
    const t = topic.slice(5);
    const list = EXTRA[t] || EXTRA.default;
    return {
      text: `좋아, 조금 더 구체적으로 알려 줄게냥! 📝\n\n💡 **추가 해결책**\n${list.map((x) => `• ${x}`).join('\n')}\n• ${a.name}님 맞춤 개운 행동: ${a.luck.action}`,
      expr: 'wink', chips: starterChips(a.person.status),
    };
  },

  greeting({ a }) {
    return { text: `${pick(['안녕안녕', '반가워요', '어서 와요'])}, ${a.name}님! 🐾 오늘은 어떤 연애 고민을 들고 왔어요?`, expr: 'happy', chips: starterChips(a.person.status) };
  },

  thanks({ a }) {
    return { text: pick([`도움이 됐다니 꼬리가 절로 흔들린다냥! 🐈 ${a.name}님의 연애를 응원할게요.`, `천만에요! 운은 흐름이고, 선택은 ${a.name}님 몫이에요. 좋은 소식 들고 다시 와요냥 💕`]), expr: 'happy', chips: starterChips(a.person.status) };
  },

  fallback({ a, fc }) {
    const m = fc.months[0];
    return {
      text: `음... 질문을 조금 더 구체적으로 말해 주면 사주랑 딱 맞춰서 볼 수 있다냥! 🙀\n\n예를 들어 "언제", "고백", "재회", "궁합", "싸움", "결혼" 같은 단어를 넣어 물어봐 줘요.\n\n참고로 이번 달 ${a.name}님의 연애운은 **${m.score}점(${m.reason.label})**이에요. ${m.reason.tip}`,
      expr: 'think', chips: starterChips(a.person.status),
    };
  },
};

const REASON_LABEL = (key) => ({
  rival: '경쟁자', clash: '변화', wonjin: '오해', punish: '마찰', resource: '휴식',
}[key] || '변화');

function pickPlaceFor(el) {
  return {
    wood: '독서 모임, 등산·러닝 크루, 플리마켓',
    fire: '공연·페스티벌, 운동 동호회, 핫플레이스',
    earth: '동네 커뮤니티, 쿠킹 클래스, 봉사활동',
    metal: '전시회, 스터디, 자기계발 모임',
    water: '여행 모임, 와인 클래스, 심야 북카페',
  }[el];
}

export { STATUS_LABEL, BRANCHES, branchRelation };
