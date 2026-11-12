// 한국어 조사·표시 도우미

export function hasBatchim(word) {
  const s = String(word);
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}

// josa('목', '이', '가') → '목이'
export function josa(word, withFinal, withoutFinal) {
  return word + (hasBatchim(word) ? withFinal : withoutFinal);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// 상담 메시지용 아주 작은 마크업: **굵게**, • 목록, 줄바꿈
export function renderRich(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .split('\n')
    .map((line) => (/^\s*[•\-]\s+/.test(line) ? `<span class="li">${line.replace(/^\s*[•\-]\s+/, '')}</span>` : line))
    .join('<br>')
    .replace(/<\/span><br>/g, '</span>');
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
