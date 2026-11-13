// 묘연의 연애사주 — 정적 파일 서버 + Claude 연애 상담 API
//   npm start                      → 규칙형 상담만 (API 키 없이)
//   ANTHROPIC_API_KEY=... npm start → 상담실이 Claude로 답변
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, contextBlock, todayKST } from './public/js/persona.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// 대화형 상담은 짧고 빠른 응답이 중요해 effort 를 낮게 둔다 (low | medium | high)
const EFFORT = process.env.CLAUDE_EFFORT || 'low';
const AI_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.MYOYEON_AI === 'on');
const client = AI_ENABLED ? new Anthropic() : null;



const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
};

/* ───────── 간단한 IP별 속도 제한 ───────── */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 15;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(obj));
}

async function readBody(req, limit = 64_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validateChat(body) {
  if (!body || !Array.isArray(body.messages)) return null;
  const messages = body.messages.slice(-20)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  const context = typeof body.context === 'string' ? body.context.slice(0, 8000) : '';
  return { messages, context };
}

async function handleChat(req, res) {
  if (!client) return sendJson(res, 503, { error: 'AI 상담이 꺼져 있어요.' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
  if (rateLimited(ip)) return sendJson(res, 429, { error: '잠시 후 다시 물어봐 주세요.' });

  let input;
  try {
    input = validateChat(await readBody(req));
  } catch (err) {
    return sendJson(res, err.status || 400, { error: '요청 형식이 올바르지 않아요.' });
  }
  if (!input) return sendJson(res, 400, { error: '요청 형식이 올바르지 않아요.' });

  const today = todayKST();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // 정책상 거절되면 서버가 정해 둔 대체 모델로 이어서 답변
    output_config: { effort: EFFORT },
    cache_control: { type: 'ephemeral' },
    system: [
      { type: 'text', text: SYSTEM_PROMPT },
      { type: 'text', text: contextBlock(input.context, today) },
    ],
    messages: input.messages,
  });

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...SECURITY_HEADERS });
  };
  req.on('close', () => { if (!res.writableEnded) stream.abort(); });

  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        start();
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      start();
      res.write('\n\n이 고민은 여기서 답하기 어렵다냥. 다른 연애 고민을 들려줄래?');
    }
    start();
    res.end();
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return;
    if (err instanceof Anthropic.RateLimitError) console.warn('[chat] rate limited by API');
    else if (err instanceof Anthropic.AuthenticationError) console.error('[chat] API 키를 확인하세요');
    else if (err instanceof Anthropic.APIError) console.error(`[chat] API error ${err.status}: ${err.message}`);
    else console.error('[chat]', err);
    if (!started) return sendJson(res, 502, { error: '상담 서버가 잠시 바빠요.' });
    res.end('\n\n(연결이 잠깐 끊겼다냥. 다시 물어봐 줄래?)');
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      ...SECURITY_HEADERS,
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/api/health') return sendJson(res, 200, { ok: true, ai: AI_ENABLED });
  if (pathname === '/api/chat') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
    return handleChat(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`묘연의 연애사주 → http://localhost:${PORT}  (AI 상담: ${AI_ENABLED ? `켜짐, ${MODEL}` : '꺼짐 — 규칙형 상담 사용'})`);
});
