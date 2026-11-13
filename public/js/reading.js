// 연애 중심 사주 풀이
import {
  computeSaju, tenGod, TEN_GOD_GROUP, STEM_ELEMENT, BRANCH_ELEMENT, BRANCH_MAIN_STEM,
  ELEMENTS, ELEMENT_KO, ELEMENT_HANJA, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, ANIMALS,
  elementThatGenerates, elementGeneratedBy, elementThatControls, elementControlledBy,
  branchRelation, stemsCombine, peachBlossomBranch, RED_FLAME, trineGroup,
  yearMonthPillarsAt, yearPillarOf, seoulWallToUtc, mod,
  ganzhi, solarLongitude, findSolarTermTime, dayPillarOf,
} from './saju.js';
import { lunarToSolar, solarToLunar } from './lunar.js';

/* ───────────── 일간: 나는 어떤 고양이? ───────────── */

export const DAY_MASTERS = [
  {
    nature: '하늘로 쭉 뻗은 큰 나무', cat: '대장 고양이', emoji: '🌳',
    keywords: ['든든함', '직진', '책임감'],
    love: '좋아하면 돌려 말하지 않고 직진하는 타입이에요. 연인을 지켜 주고 이끌어 주고 싶어 하고, 한 번 마음을 정하면 쉽게 흔들리지 않는 순정파예요.',
    charm: '말보다 행동으로 챙겨 주는 든든함. 같이 있으면 "이 사람이면 믿을 수 있겠다"는 안정감을 줘요.',
    weak: '자존심이 강해서 다툰 뒤 먼저 숙이기가 어려워요. 내 계획대로 데이트를 끌고 가다 상대가 서운해할 때도 있어요.',
    ideal: '나를 존중해 주면서 부드럽게 맞춰 주는 사람, 내 꿈을 응원해 주는 사람',
    tips: ['다툰 날 "미안해" 한마디가 어렵다면 좋아하는 간식이라도 먼저 건네세요.', '데이트 코스 중 하나는 꼭 상대가 고르게 해 주세요.'],
  },
  {
    nature: '바람에 살랑이는 꽃과 덩굴', cat: '애교 만점 개냥이', emoji: '🌷',
    keywords: ['다정함', '유연함', '애교'],
    love: '상대에게 자연스럽게 스며드는 연애를 해요. 분위기를 잘 읽고 맞춰 주는 센스가 좋아서, 같이 있으면 편하다는 말을 자주 들어요.',
    charm: '부드러운 말투와 은근한 애교. 상대의 작은 변화도 알아채는 섬세함이 있어요.',
    weak: '상대에게 맞추다 보면 정작 내 마음을 숨기게 돼요. 서운함을 혼자 쌓아 두다 한 번에 지칠 수 있어요.',
    ideal: '흔들릴 때 기댈 수 있는 듬직한 사람, 나를 이끌어 주는 리더형',
    tips: ['서운한 건 그날 안에 귀엽게라도 말하기 — "나 이거 조금 서운했어!"', '연애 중에도 나만의 취미 시간을 꼭 지키세요.'],
  },
  {
    nature: '온 세상을 비추는 태양', cat: '햇살 일광욕 냥이', emoji: '☀️',
    keywords: ['열정', '솔직함', '밝음'],
    love: '좋으면 좋다고 확실하게 표현하는 열정파예요. 첫눈에 반하는 일이 많고, 연애를 시작하면 상대를 주인공처럼 빛나게 해 줘요.',
    charm: '숨김없는 솔직함과 에너지. 같이 있으면 덩달아 기분이 밝아져요.',
    weak: '금방 뜨거워진 만큼 빨리 식는다는 오해를 받기 쉬워요. 감정 표현이 커서 다툴 때도 불꽃이 튀어요.',
    ideal: '내 열정을 받아 주는 차분하고 깊이 있는 사람',
    tips: ['설렘이 줄어드는 시기엔 "처음 해 보는 데이트"로 불씨를 다시 붙이세요.', '화가 났을 땐 10분 쉬었다 말하기 규칙을 정해 두세요.'],
  },
  {
    nature: '어둠을 밝히는 촛불', cat: '밤마다 눈이 반짝이는 집사바라기', emoji: '🕯️',
    keywords: ['섬세함', '헌신', '따뜻함'],
    love: '한 사람만 바라보며 조용히, 깊게 사랑하는 타입이에요. 기념일과 작은 이벤트를 잘 챙기고, 상대의 마음을 따뜻하게 녹여요.',
    charm: '디테일한 배려와 은은한 분위기. 알면 알수록 빠져드는 매력이에요.',
    weak: '속마음을 다 말하지 않고 상대가 눈치채 주길 기다리다 서운해져요. 생각이 많아 혼자 걱정을 키우기도 해요.',
    ideal: '표현을 아끼지 않는 다정한 사람, 나를 편하게 해 주는 사람',
    tips: ['"말 안 해도 알겠지"는 금지! 원하는 건 구체적으로 말하기.', '불안할 땐 상상 대신 질문하기 — 확인하면 마음이 편해져요.'],
  },
  {
    nature: '묵직하게 자리를 지키는 큰 산', cat: '듬직한 뚱냥이', emoji: '⛰️',
    keywords: ['신뢰', '포용력', '한결같음'],
    love: '쉽게 마음을 열지 않지만 한 번 열면 끝까지 가는 타입이에요. 화려한 말보다 묵묵한 의리로 사랑을 증명해요.',
    charm: '무슨 일이 있어도 내 편일 것 같은 안정감. 넓은 마음으로 상대를 품어 줘요.',
    weak: '표현이 서툴러서 "나 좋아하긴 해?"라는 말을 듣기 쉬워요. 익숙함을 좋아해 연애가 단조로워질 수 있어요.',
    ideal: '밝고 귀여운 에너지로 나를 웃게 해 주는 사람',
    tips: ['하루 한 번은 "좋아해" 같은 말로 된 표현을 해 보세요.', '한 달에 한 번은 안 가 본 곳으로 데이트!'],
  },
  {
    nature: '모든 것을 길러 내는 논밭', cat: '집사 챙기는 엄마냥이', emoji: '🌾',
    keywords: ['배려', '현실 감각', '살림꾼'],
    love: '상대를 세심하게 챙기고 돌봐 주는 연애를 해요. 밥은 먹었는지, 오늘 힘들진 않았는지 묻는 다정한 현실 연애파예요.',
    charm: '편안하고 믿음직한 생활력. 오래 만날수록 진가가 드러나요.',
    weak: '걱정과 계산이 많아서 시작을 망설이다 타이밍을 놓쳐요. 챙겨 준 만큼 돌아오지 않으면 속으로 서운해해요.',
    ideal: '나를 믿고 따라와 주는 따뜻하고 표현 잘하는 사람',
    tips: ['"완벽한 타이밍"은 없어요. 70% 확신이면 먼저 연락하세요.', '챙겨 주는 만큼 "나도 챙겨 줘"라고 말하는 연습을 해 보세요.'],
  },
  {
    nature: '단단한 바위와 무쇠', cat: '시크한 츤데레 길냥이 대장', emoji: '⚔️',
    keywords: ['의리', '결단력', '츤데레'],
    love: '겉으론 쿨해 보여도 내 사람에겐 의리 넘치는 츤데레예요. 좋고 싫음이 분명해서 아닌 건 빨리 정리하고, 맞는 사람에겐 화끈하게 올인해요.',
    charm: '흔들림 없는 결단력과 반전 다정함. 무심한 듯 챙겨 주는 모습에 심쿵!',
    weak: '말이 직설적이라 의도와 다르게 상처를 줄 수 있어요. 감정 표현을 약한 것으로 여겨 숨기는 편이에요.',
    ideal: '내 날카로움을 부드럽게 다듬어 주는 따뜻한 사람',
    tips: ['팩트를 말하기 전에 "네 마음은 이해해"를 먼저 붙여 보세요.', '고마운 일엔 그 자리에서 바로 고맙다고 말하기.'],
  },
  {
    nature: '반짝이는 보석', cat: '도도한 공주냥', emoji: '💎',
    keywords: ['세련됨', '섬세함', '로맨티스트'],
    love: '분위기와 디테일을 중요하게 여기는 로맨티스트예요. 취향이 확실하고 눈이 높지만, 마음에 드는 사람에겐 누구보다 사랑스러워요.',
    charm: '세련된 감각과 깔끔한 이미지. 첫인상에서 "뭔가 다르다"는 느낌을 줘요.',
    weak: '예민하고 자존심이 강해 작은 말에도 상처받기 쉬워요. 기대치가 높아 상대가 지칠 수 있어요.',
    ideal: '나를 소중하게 다뤄 주는 다정하고 여유 있는 사람',
    tips: ['상대의 노력엔 점수 대신 칭찬부터 해 주세요.', '서운함은 "~해서 속상했어" 문장으로 부드럽게 전하기.'],
  },
  {
    nature: '끝없이 넓은 바다', cat: '세상 구경 좋아하는 모험냥', emoji: '🌊',
    keywords: ['포용력', '자유로움', '지혜'],
    love: '스케일 크고 자유로운 연애를 좋아해요. 상대를 구속하지 않는 대신 나도 구속받기 싫어하고, 대화가 잘 통하는 사람에게 깊이 빠져요.',
    charm: '어떤 이야기든 받아 주는 넓은 마음과 지적인 대화. 알 수 없는 신비로움이 있어요.',
    weak: '속마음을 잘 드러내지 않아 상대가 불안해할 수 있어요. 관심사가 많아 연애가 뒷전이 될 때가 있어요.',
    ideal: '나만의 시간을 존중해 주고, 함께 새로운 곳을 탐험할 사람',
    tips: ['바쁠 땐 "지금 바빠, 이따 연락할게" 한 줄로 상대의 불안을 지워 주세요.', '중요한 결정은 연인과 먼저 나누는 습관을 들이세요.'],
  },
  {
    nature: '촉촉하게 스며드는 비와 이슬', cat: '감성 충만 새침냥', emoji: '🌧️',
    keywords: ['감성', '공감력', '직관'],
    love: '상대의 감정을 누구보다 잘 알아채는 공감 요정이에요. 사랑에 빠지면 깊이 몰입하고, 지친 상대를 위로하는 데 탁월해요.',
    charm: '말하지 않아도 알아주는 센스와 촉촉한 눈빛. 대화할수록 끌리는 매력이에요.',
    weak: '걱정과 상상이 많아 혼자 불안해지기 쉬워요. 상처받으면 조용히 마음을 닫아 버려요.',
    ideal: '밝고 확신을 주는 사람, 나를 웃게 해 주는 사람',
    tips: ['불안할 땐 메모장에 "사실"과 "상상"을 나눠 적어 보세요.', '혼자 삭이지 말고 "나 지금 위로가 필요해"라고 말해도 괜찮아요.'],
  },
];

/* ───────────── 일지: 배우자 자리 ───────────── */

export const SPOUSE_PALACE = [
  '지혜롭고 감성적인 사람이 짝으로 어울려요. 둘만의 이야기를 나누는 밤 데이트에서 사랑이 깊어져요.',
  '성실하고 묵묵히 곁을 지키는 사람이 인연이에요. 시간이 갈수록 단단해지는 "적금 같은 사랑"이에요.',
  '활동적이고 리더십 있는 사람과 잘 맞아요. 함께 운동하거나 여행하며 가까워지는 커플이에요.',
  '다정하고 섬세한, 감각 있는 사람이 인연이에요. 예쁜 카페와 꽃 선물 같은 감성 데이트가 잘 어울려요.',
  '스케일 크고 포용력 있는 사람이 짝이에요. 함께 큰 꿈을 꾸는 연애지만, 고집이 부딪힐 땐 한 발씩 양보하기!',
  '열정적이고 매력적인 사람에게 끌려요. 연애할 때 질투심이 살짝 올라올 수 있으니 솔직하게 대화해요.',
  '밝고 솔직한 사람과 뜨거운 연애를 해요. 감정 표현이 확실한 커플이에요.',
  '온화하고 다정한 사람이 짝이에요. 집에서 함께 요리하고 쉬는 "집 데이트"가 행복 포인트예요.',
  '재치 있고 능력 있는 사람이 인연이에요. 함께 있으면 웃음이 끊이지 않는 커플이에요.',
  '깔끔하고 세련된 사람에게 끌려요. 서로 기준이 확실하니 사소한 일로 다투지 않게 미리 조율해요.',
  '의리 있고 책임감 강한 사람이 짝이에요. 한 번 맺은 인연을 끝까지 지키는 커플이에요.',
  '순수하고 마음 넓은 사람이 인연이에요. 함께 여행하고 맛있는 걸 먹으며 행복해지는 커플이에요.',
];

/* ───────────── 십신 그룹별 연애 스타일 ───────────── */

export const GROUP_STYLE = {
  비겁: {
    title: '친구 같은 연인', emoji: '🤜🤛',
    desc: '연인과 친구처럼 편하게 지내는 걸 좋아해요. 주관이 뚜렷하고 독립적이라, 서로의 영역을 존중하는 연애가 잘 맞아요.',
    caution: { F: '자존심 대결은 금물! 친구 모임 속에서 인연이 생기기 쉬워요.', M: '연애에서 주도권 싸움이 생기기 쉬워요. 이기는 것보다 맞춰 주는 게 이득인 순간도 있어요.' },
  },
  식상: {
    title: '표현력 만렙 애정표현러', emoji: '💬',
    desc: '좋아하는 마음을 말과 행동으로 아낌없이 표현해요. 재치 있는 말솜씨로 분위기를 띄우는 연애 분위기 메이커예요.',
    caution: { F: '상대의 부족한 점이 잘 보여서 잔소리가 늘 수 있어요. 눈이 높아 연애 시작이 늦어지기도 해요.', M: '말이 앞서지 않도록, 약속한 건 꼭 지키기!' },
  },
  재성: {
    title: '현실 데이트 플래너', emoji: '🗓️',
    desc: '데이트 코스부터 기념일까지 똑 부러지게 챙기는 현실 연애파예요. 상대에게 실질적인 도움을 주며 사랑을 표현해요.',
    caution: { F: '계산적으로 보이지 않게, 감성 표현도 함께 해 주세요.', M: '이성에게 인기가 많아 오해를 살 수 있어요. 애매한 친절은 줄이기!' },
  },
  관성: {
    title: '진지한 책임감 연애', emoji: '🛡️',
    desc: '가볍게 만나기보다 진지하고 책임감 있는 연애를 원해요. 약속과 신뢰를 무엇보다 중요하게 여겨요.',
    caution: { F: '이성 인연은 많은 편이지만, 끌리는 사람과 잘 맞는 사람이 다를 수 있어요.', M: '책임감이 부담으로 바뀌지 않게, 연애는 즐겁게!' },
  },
  인성: {
    title: '사랑받고 싶은 힐링 연애', emoji: '🧸',
    desc: '상대에게 이해받고 보살핌 받을 때 행복을 느껴요. 생각이 깊고 배려심이 많아 안정적인 연애를 해요.',
    caution: { F: '생각만 하다 타이밍을 놓치기 쉬워요. 먼저 한 걸음 다가가 보세요!', M: '생각만 하다 타이밍을 놓치기 쉬워요. 먼저 한 걸음 다가가 보세요!' },
  },
};

/* ───────────── 오행 ───────────── */

export const ELEMENT_INFO = {
  wood: { name: '나무', emoji: '🌳', theme: '시작·성장', many: '새로운 사람에게 금방 마음을 열고 관계를 키워 가는 힘이 있어요.', few: '연애를 시작하는 추진력이 약할 수 있어요.', person: '곧고 성장 욕구가 있는 사람' },
  fire: { name: '불', emoji: '🔥', theme: '열정·표현', many: '감정 표현이 화끈하고 연애에 열정적이에요.', few: '마음을 표현하는 게 쑥스러울 수 있어요.', person: '밝고 열정적인 사람' },
  earth: { name: '흙', emoji: '⛰️', theme: '안정·신뢰', many: '한 사람에게 정착하는 힘이 크고 믿음직해요.', few: '관계의 중심을 잡는 데 노력이 필요해요.', person: '듬직하고 믿음직한 사람' },
  metal: { name: '쇠', emoji: '💎', theme: '결단·기준', many: '기준이 확실해서 아닌 사람은 바로 정리해요.', few: '맺고 끊기가 어려워 애매한 관계를 오래 끌 수 있어요.', person: '깔끔하고 결단력 있는 사람' },
  water: { name: '물', emoji: '🌊', theme: '감성·지혜', many: '감수성이 풍부하고 상대 마음을 잘 읽어요.', few: '상대의 감정을 읽고 공감하는 연습이 필요해요.', person: '지혜롭고 감성적인 사람' },
};

// 개운법 — 부족하거나 필요한 오행 채우기
export const LUCK = {
  wood: {
    color: '그린·민트', swatch: ['#3FAE72', '#9BE3C3'], numbers: '3, 8', direction: '동쪽',
    places: ['숲길·공원 산책', '식물원', '꽃집 데이트', '아침 브런치 카페'],
    items: ['작은 화분', '원목 소품', '초록색 액세서리'], food: '샐러드·새콤한 과일',
    action: '새로운 모임이나 클래스에 등록하기',
  },
  fire: {
    color: '레드·코랄·핑크', swatch: ['#F0524F', '#FF8FA8'], numbers: '2, 7', direction: '남쪽',
    places: ['햇살 좋은 루프탑', '전시회·공연장', '불꽃놀이·야시장', '노을 맛집'],
    items: ['향초', '코랄 립·블러셔', '빨간색 포인트 소품'], food: '따뜻한 커피·매콤한 음식',
    action: '사진 찍고 SNS에 나를 드러내기',
  },
  earth: {
    color: '베이지·옐로·브라운', swatch: ['#E9B530', '#D9B98C'], numbers: '5, 10', direction: '중앙(집 근처)',
    places: ['도자기·베이킹 공방', '캠핑장', '동네 맛집 투어', '분위기 좋은 한옥 카페'],
    items: ['도자기 머그', '가죽 소품', '따뜻한 향의 향수'], food: '달콤한 디저트·고구마',
    action: '집을 정리하고 사람을 초대하기',
  },
  metal: {
    color: '화이트·실버·골드', swatch: ['#F3F1FA', '#C9C3D9'], numbers: '4, 9', direction: '서쪽',
    places: ['미술관', '호텔 라운지', '서점', '깔끔한 쇼핑몰'],
    items: ['실버 액세서리', '손목시계', '시트러스 향수'], food: '매운 음식·배·무',
    action: '방과 휴대폰 사진첩을 정리하고 끝낼 관계 정리하기',
  },
  water: {
    color: '블루·네이비·블랙', swatch: ['#3C6FD8', '#2A1B3D'], numbers: '1, 6', direction: '북쪽',
    places: ['바다', '아쿠아리움', '호숫가', '야경 좋은 카페', '온천'],
    items: ['진주 액세서리', '유리 소품', '텀블러'], food: '해산물·국물 요리',
    action: '밤 산책하며 깊은 대화 나누기',
  },
};

/* ───────────── 신살 ───────────── */

export const CHARMS = {
  dohwa: { name: '도화살', emoji: '🌸', desc: '사람을 끌어당기는 매력 살! 웃을 때 특히 예뻐 보이고, 이성의 시선을 자연스럽게 모아요.', tip: '매력이 넘치는 만큼 애매한 친절은 오해를 부를 수 있어요.' },
  hongyeom: { name: '홍염살', emoji: '💋', desc: '눈빛과 분위기에서 나오는 은근한 치명미! 한번 빠지면 헤어나기 어려운 매력이에요.', tip: '분위기에 휩쓸리기보다 상대가 진심인지 시간을 두고 보세요.' },
  hwagae: { name: '화개살', emoji: '🎨', desc: '나만의 세계가 있는 예술가 매력. 신비로운 분위기에 끌리는 사람이 많아요.', tip: '혼자만의 시간도 연애만큼 소중하다고 연인에게 미리 말해 두세요.' },
  yeokma: { name: '역마살', emoji: '✈️', desc: '이동과 변화의 기운. 여행지나 새로운 환경에서 인연을 만나기 쉬워요. 장거리 연애도 OK!', tip: '활동 반경을 넓힐수록 인연운이 커져요.' },
  gwiin: { name: '천을귀인', emoji: '👼', desc: '귀인의 도움을 받는 복. 주변 소개로 좋은 인연을 만날 확률이 높아요.', tip: '지인 소개팅은 웬만하면 나가 보세요!' },
};
const HWAGAE = [10, 1, 4, 7]; // 삼합 그룹별
const YEOKMA = [8, 11, 2, 5];
const GWIIN = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [5, 3], [5, 3]];

/* ───────────── 분석 ───────────── */

export function resolveSolarBirth(person) {
  if (person.calendar === 'lunar') return lunarToSolar(person.year, person.month, person.day, !!person.leap);
  return { year: person.year, month: person.month, day: person.day };
}

const POSITION_LABEL = { hour: '시주', day: '일주', month: '월주', year: '연주' };
const POSITION_MEANING = { hour: '미래·자녀', day: '나·배우자', month: '사회·부모', year: '조상·어린 시절' };

export function analyzePerson(person) {
  const solar = resolveSolarBirth(person);
  if (!solar) return null;
  const saju = computeSaju({ ...solar, hour: person.timeKnown ? person.hour : null, minute: person.minute });
  const lunar = solarToLunar(solar.year, solar.month, solar.day);
  const P = saju.pillars;
  const dm = P.day.stem;
  const dmEl = STEM_ELEMENT[dm];
  const gender = person.gender === 'M' ? 'M' : 'F';

  // 기둥별 정보 (표시 순서: 시 일 월 연)
  const keys = ['hour', 'day', 'month', 'year'];
  const positions = keys.map((k) => {
    const p = P[k];
    if (!p) return { key: k, label: POSITION_LABEL[k], meaning: POSITION_MEANING[k], empty: true };
    return {
      key: k, label: POSITION_LABEL[k], meaning: POSITION_MEANING[k],
      stem: p.stem, branch: p.branch,
      stemEl: STEM_ELEMENT[p.stem], branchEl: BRANCH_ELEMENT[p.branch],
      stemGod: k === 'day' ? '나' : tenGod(dm, p.stem),
      branchGod: tenGod(dm, BRANCH_MAIN_STEM[p.branch]),
    };
  });

  // 오행 개수
  const counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
  for (const pos of positions) if (!pos.empty) { counts[pos.stemEl]++; counts[pos.branchEl]++; }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sorted = [...ELEMENTS].sort((a, b) => counts[b] - counts[a]);
  const strongest = sorted[0];
  const missing = ELEMENTS.filter((e) => counts[e] === 0);
  const minCount = Math.min(...ELEMENTS.map((e) => counts[e]));
  const weakest = ELEMENTS.filter((e) => counts[e] === minCount);

  // 십신 그룹 개수 (일간 제외)
  const groupCounts = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  const godCounts = {};
  for (const pos of positions) {
    if (pos.empty) continue;
    for (const g of [pos.stemGod, pos.branchGod]) {
      if (g === '나') continue;
      groupCounts[TEN_GOD_GROUP[g]]++;
      godCounts[g] = (godCounts[g] || 0) + 1;
    }
  }
  const dominantGroup = Object.keys(groupCounts).sort((a, b) => groupCounts[b] - groupCounts[a])[0];

  // 신강/신약
  const W = { year: [1, 1], month: [1, 3], day: [0, 1.5], hour: [1, 1] };
  const supportEls = [dmEl, elementThatGenerates(dmEl)];
  let support = 0, weightTotal = 0;
  for (const pos of positions) {
    if (pos.empty) continue;
    const [ws, wb] = W[pos.key];
    weightTotal += ws + wb;
    if (pos.key !== 'day' && supportEls.includes(pos.stemEl)) support += ws;
    if (supportEls.includes(pos.branchEl)) support += wb;
  }
  const ratio = support / weightTotal;
  const strength = ratio >= 0.55
    ? { key: 'strong', label: '신강', desc: '내 기운이 강한 편이에요. 주관이 뚜렷하고 연애에서도 주도권을 쥐는 경우가 많아요.' }
    : ratio <= 0.4
      ? { key: 'weak', label: '신약', desc: '내 기운이 섬세한 편이에요. 상대에게 맞춰 주고 배려하는 연애를 해요. 나를 아껴 주는 사람이 중요해요.' }
      : { key: 'balanced', label: '중화', desc: '기운이 비교적 균형 잡혀 있어요. 상황에 맞게 리드하기도, 맞춰 주기도 하는 유연한 연애를 해요.' };
  strength.ratio = ratio;

  // 용신(행운의 오행) 간이 판별
  const rel = {
    same: dmEl, resource: elementThatGenerates(dmEl), output: elementGeneratedBy(dmEl),
    wealth: elementControlledBy(dmEl), officer: elementThatControls(dmEl),
  };
  let candidates;
  if (strength.key === 'strong') candidates = [rel.output, rel.wealth, rel.officer];
  else if (strength.key === 'weak') candidates = [rel.resource, rel.same];
  else candidates = [rel.output, rel.wealth, rel.officer, rel.resource, rel.same];
  const lucky = candidates.reduce((best, el) => (counts[el] < counts[best] ? el : best), candidates[0]);

  // 배우자성
  const partnerGroup = gender === 'F' ? '관성' : '재성';
  const partnerEl = gender === 'F' ? rel.officer : rel.wealth;
  const jeongName = gender === 'F' ? '정관' : '정재';
  const pyeonName = gender === 'F' ? '편관' : '편재';
  const partnerCount = groupCounts[partnerGroup];
  const dayPos = positions.find((p) => p.key === 'day');
  const inSpousePalace = TEN_GOD_GROUP[dayPos.branchGod] === partnerGroup;
  const partner = {
    group: partnerGroup, el: partnerEl, count: partnerCount,
    hasJeong: !!godCounts[jeongName], hasPyeon: !!godCounts[pyeonName],
    jeongName, pyeonName, inSpousePalace,
    text: partnerText(partnerCount, !!godCounts[jeongName] && !!godCounts[pyeonName], gender),
  };

  // 신살
  const branches = positions.filter((p) => !p.empty).map((p) => p.branch);
  const yearB = P.year.branch, dayB = P.day.branch;
  const peachBranches = [...new Set([peachBlossomBranch(yearB), peachBlossomBranch(dayB)])];
  const charms = [];
  const others = (refKey) => positions.filter((p) => !p.empty && p.key !== refKey).map((p) => p.branch);
  if (others('year').includes(peachBlossomBranch(yearB)) || others('day').includes(peachBlossomBranch(dayB))) charms.push('dohwa');
  if (branches.includes(RED_FLAME[dm])) charms.push('hongyeom');
  if (others('year').includes(HWAGAE[trineGroup(yearB)]) || others('day').includes(HWAGAE[trineGroup(dayB)])) charms.push('hwagae');
  if (others('year').includes(YEOKMA[trineGroup(yearB)]) || others('day').includes(YEOKMA[trineGroup(dayB)])) charms.push('yeokma');
  if (branches.some((b) => GWIIN[dm].includes(b))) charms.push('gwiin');
  const peachCount = branches.filter((b) => [0, 3, 6, 9].includes(b)).length;

  return {
    person: { ...person, gender }, name: person.name, gender, solar, lunar, saju,
    dm, dmEl, dayBranch: dayB, yearBranch: yearB,
    profile: DAY_MASTERS[dm], spouse: SPOUSE_PALACE[dayB],
    positions, counts, total, strongest, weakest, missing,
    groupCounts, godCounts, dominantGroup, style: GROUP_STYLE[dominantGroup],
    strength, lucky, luck: LUCK[lucky], rel,
    partner, charms, peachBranches, peachCount,
    bestMatchStem: (dm + 5) % 10,
    animal: ANIMALS[yearB],
  };
}

function partnerText(count, mixed, gender) {
  const who = gender === 'F' ? '남자' : '여자';
  if (count === 0) return `사주에 이성 인연을 뜻하는 별이 드러나 있지 않아요. 인연이 없다는 뜻이 아니라, 운에서 그 별이 들어올 때 한 번에 확 들어오는 타입이에요. 그 시기를 놓치지 않는 게 핵심!`;
  if (count === 1) return `이성 인연의 별이 딱 하나! 여러 사람보다 한 사람에게 집중하는 일편단심 타입이에요.`;
  if (count === 2) return mixed
    ? `끌리는 ${who} 타입이 두 갈래예요. 안정적인 사람과 자극적인 사람 사이에서 고민할 수 있어요.`
    : `이성 인연이 꾸준히 들어오는 인기형이에요. 소개나 모임에서 호감을 사기 쉬워요.`;
  return `이성의 별이 ${count}개나! 인기가 많은 대신 선택이 어려울 수 있어요. ${mixed ? '안정형과 자극형 사이에서 흔들리지 않는 기준이 필요해요.' : '"누구를" 보다 "어떤 관계를" 원하는지 먼저 정하세요.'}`;
}

/* ───────────── 시기별 연애운 ───────────── */

export const REASONS = {
  jeong: { label: '진지한 인연운', emoji: '💍', solo: '가볍지 않은, 오래 갈 수 있는 인연이 다가와요.', couple: '미래 이야기를 꺼내기 좋은 시기예요.', tip: '조건보다 "편안함"을 기준으로 사람을 보세요.' },
  partner: { label: '인연의 별 등장', emoji: '💘', solo: '이성 인연을 뜻하는 별이 들어와요. 새로운 만남이 생기기 쉬운 시기예요.', couple: '연인에게 더 끌리고 관계가 깊어져요.', tip: '소개팅·모임 초대는 일단 수락하기!' },
  stemCombo: { label: '운명적 끌림', emoji: '🧲', solo: '강하게 끌리는 사람이 나타날 수 있어요.', couple: '서로에게 더 단단히 묶이는 시기예요.', tip: '끌림이 오면 망설이지 말고 대화를 시작하세요.' },
  harmony: { label: '마음이 통하는 합', emoji: '🤝', solo: '나와 결이 맞는 사람과 자연스럽게 연결돼요.', couple: '서로 맞춰 가기 쉬운 평화로운 시기예요.', tip: '평소 하고 싶던 말을 꺼내기 좋은 타이밍이에요.' },
  peach: { label: '도화운', emoji: '🌸', solo: '매력 지수 폭발! 고백을 받거나 시선을 끌기 쉬워요.', couple: '연인이 다시 반하는 시기. 주변의 관심도 늘어나니 처신은 깔끔하게!', tip: '헤어·옷차림에 포인트를 주면 효과 두 배.' },
  trine: { label: '자연스러운 흐름', emoji: '🌈', solo: '지인을 통해 자연스럽게 가까워지는 인연이 있어요.', couple: '함께하는 일이 술술 풀려요.', tip: '친구 모임, 동호회 활동을 늘려 보세요.' },
  output: { label: '표현력 상승', emoji: '💬', solo: '먼저 다가가면 통하는 시기! 말과 센스가 빛나요.', couple: '애정 표현이 잘 전달돼요. 말실수만 조심!', tip: '먼저 연락하고, 먼저 칭찬하기.' },
  wealthF: { label: '데이트 기회 증가', emoji: '🎟️', solo: '만남의 기회가 늘고 실속 있는 인연이 들어와요.', couple: '함께 계획을 세우고 실천하기 좋아요.', tip: '데이트 계획은 구체적으로 세워 보세요.' },
  redflame: { label: '분위기 미인 모드', emoji: '💋', solo: '은근한 분위기로 사람을 끌어당겨요.', couple: '애정 표현이 늘어나는 달콤한 시기예요.', tip: '향수나 립 컬러로 나만의 분위기를 만들어 보세요.' },
  lucky: { label: '행운 기운 UP', emoji: '🍀', solo: '컨디션이 좋아져 매력이 자연스럽게 살아나요.', couple: '관계에 좋은 에너지가 흘러요.', tip: '행운 컬러를 활용해 보세요.' },
  peachMild: { label: '살랑살랑 설렘', emoji: '🎀', solo: '설레는 일이 생기기 쉬운 분위기예요.', couple: '데이트 분위기가 좋아요.', tip: '평소보다 한 번 더 웃어 주세요.' },
  officerM: { label: '책임감 모드', emoji: '🛡️', solo: '관계를 진지하게 생각하게 돼요.', couple: '든든한 모습으로 신뢰가 쌓여요.', tip: '약속 시간은 칼같이!' },
  same: { label: '익숙한 인연', emoji: '🔁', solo: '아는 사람 중에서 인연이 다시 보여요.', couple: '익숙함 속의 안정감이 커져요.', tip: '오래된 연락처를 한 번 훑어보세요.' },
  resource: { label: '내면 충전기', emoji: '🛋️', solo: '연애보다 나를 돌보는 데 마음이 가는 시기예요.', couple: '조용히 함께 쉬는 데이트가 좋아요.', tip: '자기관리에 투자하면 다음 인연운이 커져요.' },
  rival: { label: '라이벌 주의', emoji: '⚔️', solo: '경쟁자가 생기거나 친구와 같은 사람을 좋아하게 될 수 있어요.', couple: '자존심 싸움이 생기기 쉬워요.', tip: '이기려 하지 말고 내 편으로 만들기.' },
  punish: { label: '마찰 주의', emoji: '⚡', solo: '관계에서 피로감을 느끼기 쉬워요.', couple: '잔소리·간섭이 늘 수 있어요.', tip: '서로의 개인 시간을 지켜 주세요.' },
  wonjin: { label: '사소한 오해 주의', emoji: '🌀', solo: '괜히 엇갈리는 타이밍이 생길 수 있어요.', couple: '말투 하나로 서운해지기 쉬워요.', tip: '카톡보다 전화나 만나서 이야기하기.' },
  clash: { label: '변화의 바람', emoji: '🌪️', solo: '예상 못 한 만남이나 갑작스러운 변화가 생겨요.', couple: '의견 충돌이 생기기 쉬워요. 큰 결정은 잠시 미루기.', tip: '감정이 올라오면 하루 자고 말하기.' },
  none: { label: '잔잔한 흐름', emoji: '🍃', solo: '큰 변화 없이 잔잔해요. 꾸준히 사람을 만나 보세요.', couple: '평온한 시기. 소소한 이벤트가 활력을 줘요.', tip: '작은 루틴 데이트를 만들어 보세요.' },
};

export function periodLove(a, stem, branch) {
  let score = 52;
  const acc = {};
  const add = (key, pts) => { score += pts; acc[key] = (acc[key] || 0) + pts; };
  const godS = tenGod(a.dm, stem);
  const godB = tenGod(a.dm, BRANCH_MAIN_STEM[branch]);
  const gS = TEN_GOD_GROUP[godS], gB = TEN_GOD_GROUP[godB];
  const pg = a.partner.group;
  if (gS === pg) add(godS === a.partner.jeongName ? 'jeong' : 'partner', godS === a.partner.jeongName ? 15 : 13);
  if (gB === pg) add(godB === a.partner.jeongName ? 'jeong' : 'partner', godB === a.partner.jeongName ? 15 : 13);
  if (gS === '식상' || gB === '식상') add('output', a.gender === 'M' ? 7 : 5);
  if (a.gender === 'F' && (gS === '재성' || gB === '재성')) add('wealthF', 6);
  if (a.gender === 'M' && (gS === '관성' || gB === '관성')) add('officerM', 3);
  if (gS === '비겁' || gB === '비겁') add('rival', a.gender === 'M' ? -9 : -4);
  if (gS === '인성' && gB === '인성') add('resource', -5);
  else if (gS === '인성' || gB === '인성') add('resource', -2);
  const relation = branchRelation(branch, a.dayBranch);
  const relPts = { harmony: 12, trine: 8, same: 2, clash: -7, wonjin: -6, punish: -4 };
  if (relPts[relation] !== undefined) add(relation, relPts[relation]);
  if (a.peachBranches.includes(branch)) add('peach', 10);
  else if ([0, 3, 6, 9].includes(branch)) add('peachMild', 3);
  if (branch === RED_FLAME[a.dm]) add('redflame', 4);
  if (STEM_ELEMENT[stem] === a.lucky) add('lucky', 5);
  if (BRANCH_ELEMENT[branch] === a.lucky) add('lucky', 4);
  if (stemsCombine(stem, a.dm)) add('stemCombo', 8);

  score = Math.max(12, Math.min(98, Math.round(score)));
  const entries = Object.entries(acc).filter(([, v]) => v !== 0);
  const positives = entries.filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const negatives = entries.filter(([, v]) => v < 0).sort((x, y) => x[1] - y[1]);
  let main;
  if (score >= 60 && positives.length) main = positives[0][0];
  else if (score < 48 && negatives.length) main = negatives[0][0];
  else main = (positives[0] || negatives[0] || ['none'])[0];
  return {
    score, grade: grade(score), main, reason: REASONS[main],
    good: positives.map(([k]) => k), bad: negatives.map(([k]) => k),
    pillar: { stem, branch, hanja: STEMS[stem] + BRANCHES[branch], hangul: STEMS_KO[stem] + BRANCHES_KO[branch] },
  };
}

export function grade(score) {
  if (score >= 85) return { label: '최고', emoji: '🔥', key: 'best' };
  if (score >= 72) return { label: '좋음', emoji: '💖', key: 'good' };
  if (score >= 58) return { label: '보통', emoji: '🙂', key: 'okay' };
  if (score >= 45) return { label: '조심', emoji: '🌧️', key: 'care' };
  return { label: '쉼표', emoji: '🛌', key: 'rest' };
}

export function buildForecast(a, nowMs = Date.now()) {
  const cur = yearMonthPillarsAt(nowMs);
  const years = [];
  for (let k = 0; k < 5; k++) {
    const y = cur.sajuYear + k;
    const p = yearPillarOf(y);
    years.push({ year: y, animal: ANIMALS[p.branch], ...periodLove(a, p.stem, p.branch) });
  }
  const months = [];
  const now = new Date(nowMs + 9 * 3600000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    const at = seoulWallToUtc(y, m, 15, 12, 0);
    const ym = yearMonthPillarsAt(at);
    const ml = periodLove(a, ym.month.stem, ym.month.branch);
    const yl = periodLove(a, ym.year.stem, ym.year.branch);
    const score = Math.round(ml.score * 0.75 + yl.score * 0.25);
    months.push({ year: y, month: m, ...ml, score, grade: grade(score) });
    m++; if (m > 12) { m = 1; y++; }
  }
  const best = [...months].sort((p, q) => q.score - p.score).slice(0, 3);
  const worst = [...months].sort((p, q) => p.score - q.score)[0];
  return { years, months, best, worst, current: cur };
}

/* ───────────── 대운: 10년 단위 인생 연애 흐름 ───────────── */

const DAY_MS = 86400000;

// 대운 방향: 양년생 남자·음년생 여자는 순행, 나머지는 역행
// 대운수: 출생부터 다음(순행)·이전(역행) 절입까지의 날 수 ÷ 3
export function computeDaewoon(a, nowMs = Date.now(), count = 8) {
  const { saju } = a;
  const yearYang = saju.pillars.year.stem % 2 === 0;
  const forward = (yearYang && a.gender === 'M') || (!yearYang && a.gender === 'F');
  const birth = saju.utcMs;
  const lam = solarLongitude(birth);
  const boundary = mod(315 + 30 * (saju.monthIdx + (forward ? 1 : 0)), 360);
  const span = forward ? mod(boundary - lam, 360) : -mod(lam - boundary, 360);
  const term = findSolarTermTime(boundary, birth + (span / 360) * 365.2422 * DAY_MS);
  const days = Math.abs(term - birth) / DAY_MS;
  const startAge = Math.max(1, Math.round(days / 3));
  const ageNow = (nowMs - birth) / (365.2425 * DAY_MS);
  const monthIndex60 = saju.pillars.month.index;
  const periods = [];
  for (let k = 0; k < count; k++) {
    const p = ganzhi(monthIndex60 + (forward ? k + 1 : -(k + 1)));
    const from = startAge + 10 * k;
    const love = periodLove(a, p.stem, p.branch);
    periods.push({
      from, to: from + 9, startYear: a.solar.year + from,
      isNow: ageNow >= from && ageNow < from + 10,
      ...love,
    });
  }
  const upcoming = periods.filter((x) => x.from + 9 >= ageNow);
  const prime = upcoming.filter((x) => x.from < 60);
  const golden = [...(prime.length ? prime : upcoming)].sort((x, y) => y.score - x.score)[0];
  if (golden) golden.isGolden = true;
  return { forward, startAge, days, periods, ageNow, golden, current: periods.find((x) => x.isNow) || null };
}

/* ───────────── 오늘의 연애운 ───────────── */

export function dailyLove(a, nowMs = Date.now()) {
  const d = new Date(nowMs + 9 * 3600000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const p = dayPillarOf(y, m, day);
  const love = periodLove(a, p.stem, p.branch);
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  return { y, m, day, weekday: WD[d.getUTCDay()], ...love };
}

/* ───────────── 요약 (상담·AI용) ───────────── */

export function hanjaPillars(a) {
  return a.positions.map((p) => (p.empty ? `${p.label}: 모름` : `${p.label} ${STEMS[p.stem]}${BRANCHES[p.branch]}(${STEMS_KO[p.stem]}${BRANCHES_KO[p.branch]})`)).join(', ');
}

export function elementLine(a) {
  return ELEMENTS.map((e) => `${ELEMENT_KO[e]}${ELEMENT_HANJA[e]} ${a.counts[e]}`).join(' / ');
}

export const STATUS_LABEL = { solo: '솔로', some: '썸 타는 중', couple: '연애 중', after: '이별 후' };

export function summaryForAI(a, fc, compat) {
  const lines = [
    `이름: ${a.name} / 성별: ${a.gender === 'F' ? '여성' : '남성'} / 현재 연애 상태: ${STATUS_LABEL[a.person.status] || '솔로'}`,
    `양력 생일: ${a.solar.year}-${a.solar.month}-${a.solar.day}${a.saju.timeKnown ? ` ${a.saju.birth.hour}:${String(a.saju.birth.minute).padStart(2, '0')}` : ' (태어난 시간 모름)'}`,
    `사주 원국: ${hanjaPillars(a)}`,
    `일간(본인): ${STEMS[a.dm]}(${STEMS_KO[a.dm]}) ${ELEMENT_KO[a.dmEl]} — 비유: ${a.profile.nature}, 연애 캐릭터: ${a.profile.cat}`,
    `오행 분포: ${elementLine(a)} (가장 강함: ${ELEMENT_KO[a.strongest]}, 없음: ${a.missing.map((e) => ELEMENT_KO[e]).join(',') || '없음'})`,
    `신강/신약: ${a.strength.label} / 행운의 오행(용신 간이 판별): ${ELEMENT_KO[a.lucky]}`,
    `십신 그룹 분포: ${Object.entries(a.groupCounts).map(([k, v]) => `${k} ${v}`).join(', ')} → 연애 스타일: ${a.style.title}`,
    `배우자성(${a.partner.group}, ${ELEMENT_KO[a.partner.el]}): ${a.partner.count}개${a.partner.inSpousePalace ? ', 배우자 자리(일지)에 위치' : ''}`,
    `일지(배우자 자리): ${BRANCHES[a.dayBranch]}(${BRANCHES_KO[a.dayBranch]}) — ${a.spouse}`,
    `신살: ${a.charms.map((c) => CHARMS[c].name).join(', ') || '특별한 연애 신살 없음'}`,
    `행운 아이템: 컬러 ${a.luck.color}, 숫자 ${a.luck.numbers}, 방향 ${a.luck.direction}, 장소 ${a.luck.places.join('·')}`,
  ];
  if (fc) {
    lines.push(`연도별 연애운: ${fc.years.map((y) => `${y.year}년(${y.pillar.hanja}) ${y.score}점 ${y.reason.label}`).join(' / ')}`);
    lines.push(`앞으로 12개월 연애운: ${fc.months.map((m) => `${m.year}.${m.month} ${m.score}점(${m.reason.label})`).join(', ')}`);
  }
  const dw = computeDaewoon(a);
  lines.push(`10년 대운(${dw.forward ? '순행' : '역행'}, 대운수 ${dw.startAge}): ${dw.periods.map((d) => `만${d.from}~${d.to}세(${d.startYear}~) ${d.pillar.hanja} ${d.score}점 ${d.reason.label}${d.isNow ? ' ←현재' : ''}`).join(' / ')}`);
  const today = dailyLove(a);
  lines.push(`오늘(${today.y}-${today.m}-${today.day}, ${today.pillar.hanja}일) 연애운: ${today.score}점 ${today.reason.label}`);
  if (compat) {
    lines.push(`궁합 상대: ${compat.b.name} (${compat.b.gender === 'F' ? '여성' : '남성'}), 일간 ${STEMS[compat.b.dm]} ${ELEMENT_KO[compat.b.dmEl]}, 사주 ${hanjaPillars(compat.b)}`);
    lines.push(`궁합 점수: ${compat.score}점 (${compat.grade.title}) — ${compat.parts.map((p) => `${p.label} ${p.points}/${p.max}: ${p.short}`).join(' / ')}`);
  }
  return lines.join('\n');
}

export function formatBirth(a) {
  const s = a.solar;
  const time = a.saju.timeKnown ? ` ${String(a.saju.birth.hour).padStart(2, '0')}:${String(a.saju.birth.minute).padStart(2, '0')}` : ' (시간 모름)';
  const lunar = a.lunar ? ` · 음력 ${a.lunar.month}월 ${a.lunar.day}일${a.lunar.isLeap ? '(윤)' : ''}` : '';
  return `양력 ${s.year}년 ${s.month}월 ${s.day}일${time}${lunar}`;
}

export { ELEMENTS, ELEMENT_KO, ELEMENT_HANJA, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, ANIMALS, mod };
