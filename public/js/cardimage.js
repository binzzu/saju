// 📸 결과 카드 이미지 — 묘연·코코가 들어간 세로형(1080×1350) 카드를 캔버스로 그린다
// spec: { tag, title, score?, unit?, svg?, grade, line, bullets[] }
import { loadImg } from './dom.js';

function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch.trim() ? ch : ''; } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

/** 결과 카드(1080×1350) 캔버스를 그린다 */
export async function drawCard(spec) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const D = '"Black Han Sans", "Apple SD Gothic Neo", sans-serif', B = '"Gowun Dodum", "Apple SD Gothic Neo", sans-serif';
  try { await Promise.race([Promise.all([document.fonts.load(`60px ${D}`), document.fonts.load(`30px ${B}`)]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* 기본 글꼴 */ }
  const [myo, coco] = await Promise.all([loadImg('img/myo-full.webp'), loadImg('img/coco-full.webp')]);
  // 배경
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2A1B3D'); g.addColorStop(1, '#4B3470');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff88';
  for (let i = 0; i < 70; i++) { const x = (i * 197) % W, y = (i * 331) % 300 + (i % 3) * 10; ctx.beginPath(); ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2); ctx.fill(); }
  // 머리
  ctx.fillStyle = '#D7263D'; ctx.beginPath(); ctx.arc(110, 100, 44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `48px ${D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('緣', 110, 102);
  ctx.textAlign = 'left'; ctx.font = `46px ${D}`; ctx.fillText('묘연의 연애사주', 172, 102);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F7D54A'; ctx.font = `52px ${D}`; ctx.fillText(spec.tag, W / 2, 200);
  ctx.fillStyle = '#fff'; ctx.font = `64px ${D}`;
  ctx.fillText(wrapText(ctx, spec.title, 940)[0], W / 2, 278);
  // 판
  const px = 60, py = 330, pw = 960, ph = 700;
  ctx.fillStyle = '#2A1B3D'; roundRect(ctx, px + 10, py + 14, pw, ph, 40); ctx.fill();
  ctx.fillStyle = '#FFF8FB'; roundRect(ctx, px, py, pw, ph, 40); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#2A1B3D'; ctx.stroke();
  let y = py + 70;
  if (spec.score != null) {
    ctx.fillStyle = '#FF6FA8'; ctx.font = `200px ${D}`; ctx.textBaseline = 'alphabetic';
    const num = String(spec.score);
    const nw = ctx.measureText(num).width;
    ctx.font = `60px ${D}`; const uw = ctx.measureText(spec.unit || '').width;
    ctx.font = `200px ${D}`; ctx.textAlign = 'left';
    const sx = W / 2 - (nw + uw + 10) / 2;
    ctx.fillText(num, sx, py + 230);
    ctx.fillStyle = '#2A1B3D'; ctx.font = `60px ${D}`; ctx.fillText(spec.unit || '', sx + nw + 10, py + 230);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    y = py + 300;
  } else if (spec.svg) {
    const im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(spec.svg));
    if (im) ctx.drawImage(im, W / 2 - 125, py + 34, 250, 275);
    y = py + 350;
  } else y = py + 110;
  ctx.fillStyle = '#C2185B'; ctx.font = `56px ${D}`;
  for (const l of wrapText(ctx, spec.grade, 880).slice(0, 2)) { ctx.fillText(l, W / 2, y); y += 66; }
  ctx.fillStyle = '#2A1B3D'; ctx.font = `36px ${B}`;
  for (const l of wrapText(ctx, spec.line || '', 860).slice(0, 2)) { ctx.fillText(l, W / 2, y); y += 50; }
  y += 18;
  ctx.strokeStyle = '#E7E0F2'; ctx.lineWidth = 4; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(px + 60, y); ctx.lineTo(px + pw - 60, y); ctx.stroke(); ctx.setLineDash([]);
  y += 50;
  ctx.textAlign = 'left'; ctx.font = `34px ${B}`; ctx.fillStyle = '#3D2A5C';
  for (const bl of (spec.bullets || []).slice(0, 3)) {
    const ls = wrapText(ctx, `• ${bl}`, 840).slice(0, 2);
    for (const l of ls) { if (y > py + ph - 30) break; ctx.fillText(l, px + 60, y); y += 46; }
    y += 6;
  }
  // 캐릭터 (아래에서 빼꼼)
  const peek = (im, x, w) => { if (!im) return; const h = (im.height / im.width) * w; ctx.drawImage(im, x, 1050, w, h); };
  peek(myo, 20, 300); peek(coco, 760, 300);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `40px ${D}`; ctx.fillText('나도 사주 보러 가기 🐾', W / 2, 1200);
  ctx.fillStyle = '#CBBCEB'; ctx.font = `28px ${B}`; ctx.fillText('고양이 점술사의 웹툰 연애사주', W / 2, 1252);
  return cv;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

