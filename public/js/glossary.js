// 📖 사주 용어 사전 — 풀이 속 용어를 누르면 코코가 짧게 풀어 준다
export const GLOSSARY = {
  사주팔자: '태어난 해·달·날·시의 네 기둥(사주)에 적힌 여덟 글자(팔자)예요.',
  일간: '태어난 날의 윗글자예요. 사주에서 "나 자신"을 뜻해요.',
  일주: '태어난 날의 기둥(윗글자+아랫글자)이에요. 나와 배우자 자리를 함께 봐요.',
  일지: '태어난 날의 아랫글자예요. "배우자 자리"라고도 해서 연애·결혼을 볼 때 중요해요.',
  '배우자 자리': '태어난 날의 아랫글자(일지)예요. 어떤 사람과 어떤 생활을 할지 보여 줘요.',
  오행: '세상을 이루는 다섯 기운, 목(나무)·화(불)·토(흙)·금(쇠)·수(물)예요.',
  상생: '한 기운이 다른 기운을 살려 주는 관계예요. 나무→불→흙→쇠→물→나무 순서예요.',
  상극: '한 기운이 다른 기운을 누르는 관계예요. 긴장감이 있지만 자극도 돼요.',
  십신: '나(일간)와 다른 글자의 관계를 열 가지로 나눈 이름이에요. 비견·식신·정관 같은 것들이에요.',
  비겁: '나와 같은 기운(비견·겁재)이에요. 자존심·의리·경쟁심을 뜻해요.',
  식상: '내가 만들어 내는 기운(식신·상관)이에요. 표현력·재능·말솜씨를 뜻해요.',
  재성: '내가 다스리는 기운(정재·편재)이에요. 현실 감각·돈, 남자에겐 연인의 별이에요.',
  관성: '나를 다스리는 기운(정관·편관)이에요. 책임감·명예, 여자에겐 연인의 별이에요.',
  인성: '나를 살려 주는 기운(정인·편인)이에요. 배움·보살핌·생각을 뜻해요.',
  비견: '나와 똑같은 기운이에요. 친구 같은 대등함과 고집을 뜻해요.',
  겁재: '나와 비슷하지만 다른 기운이에요. 승부욕·경쟁을 뜻해요.',
  식신: '여유롭게 표현하는 기운이에요. 즐거움·먹을 복·재능을 뜻해요.',
  상관: '날카롭게 표현하는 기운이에요. 말솜씨·반항심·창의력을 뜻해요.',
  정재: '꾸준하고 성실한 재물의 기운이에요. 남자에겐 안정적인 연인의 별이에요.',
  편재: '활발하고 큰 재물의 기운이에요. 남자에겐 자유로운 연인의 별이에요.',
  정관: '반듯하고 책임감 있는 기운이에요. 여자에겐 안정적인 연인의 별이에요.',
  편관: '강하고 도전적인 기운이에요. 여자에겐 강렬한 연인의 별이에요.',
  정인: '따뜻한 보살핌과 배움의 기운이에요.',
  편인: '독특한 생각과 직감의 기운이에요.',
  도화살: '사람을 끌어당기는 매력의 별이에요. 인기가 많다는 뜻이에요.',
  도화: '사람을 끌어당기는 매력의 별(도화살)이에요.',
  홍염살: '은근한 분위기와 색기로 사람을 끄는 별이에요.',
  홍염: '은근한 분위기로 사람을 끄는 별(홍염살)이에요.',
  화개: '예술·종교·학문처럼 깊이 있는 것에 끌리는 별이에요.',
  역마: '이동·여행·변화가 많은 별이에요.',
  귀인: '어려울 때 도와주는 사람이 나타나는 별이에요.',
  천간합: '윗글자끼리 짝을 이루는 관계예요. 자석처럼 끌린다는 뜻이에요.',
  육합: '아랫글자끼리 짝을 이루는 관계예요. 생활이 잘 맞물린다는 뜻이에요.',
  삼합: '세 글자가 한 방향으로 모이는 관계예요. 가치관이 비슷하다는 뜻이에요.',
  원진: '이유 없이 서운한 관계예요. 미운 정 고운 정이 쌓이는 사이예요.',
  대운: '10년마다 바뀌는 큰 운의 흐름이에요.',
  신강: '내 기운이 강한 사주예요. 주관이 뚜렷하고 이끄는 편이에요.',
  신약: '내 기운이 약한 사주예요. 맞춰 주고 배려하는 편이에요.',
  절기: '해의 위치로 나눈 24개의 계절 마디예요. 사주의 달은 절기로 바뀌어요.',
  시진: '하루를 2시간씩 12개로 나눈 옛 시간 단위예요. 자시·축시처럼 불러요.',
  일진: '그날의 간지(날 기둥)예요. 오늘의 운세는 일진을 내 사주에 비춰 봐요.',
};

// 긴 말부터 찾고, "상관없다"처럼 다른 뜻으로 쓰인 말은 건너뛴다
const TERMS = Object.keys(GLOSSARY).sort((x, y) => y.length - x.length);
const PATTERN = new RegExp(TERMS.map((t) => (t === '상관' ? '상관(?!없|있|하)' : t === '인성' ? '인성(?!이 좋|교육)' : t)).join('|'), 'g');
const SKIP = 'a, button, input, textarea, select, svg, label, .term, .tile, .hanja, h1, h2, .who, .caption, .chip, .tag, .mini, .sfx';

/**
 * root 안의 글 속 용어를 눌러 볼 수 있는 버튼으로 바꾼다 (용어마다 화면에서 처음 나온 곳만)
 * DOM 노드를 직접 만들어 넣어서 HTML을 해석하지 않는다.
 */
export function markTerms(root, scope = '.bubble, .info, .msg--bot .msg__bubble') {
  if (!root) return 0;
  const seen = new Set();
  let count = 0;
  root.querySelectorAll(scope).forEach((box) => {
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      PATTERN.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m, changed = false;
      while ((m = PATTERN.exec(text))) {
        const term = m[0];
        if (seen.has(term)) continue;
        seen.add(term);
        frag.append(text.slice(last, m.index));
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'term'; btn.dataset.term = term; btn.textContent = term;
        btn.setAttribute('aria-label', `${term} 뜻 보기`);
        frag.append(btn);
        last = m.index + term.length; changed = true; count++;
      }
      if (changed) { frag.append(text.slice(last)); node.replaceWith(frag); }
    }
  });
  return count;
}
