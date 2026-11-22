// 브라우저 화면 도우미 (파일 저장 · 이미지 불러오기)

/** 텍스트를 파일로 내려받게 한다 */
export function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 이미지를 불러온다 (실패하면 null) */
export const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
