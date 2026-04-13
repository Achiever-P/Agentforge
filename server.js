const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Load .env only in local dev (Railway injects env vars directly)
if (fs.existsSync(path.join(__dirname, '.env'))) {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = process.env[key.trim()] || rest.join('=').trim();
  });
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === 'your-google-ai-studio-key-here') {
  console.error('\n  ✗  GEMINI_API_KEY not set!');
  console.error('  → On Railway: go to Variables tab and add GEMINI_API_KEY');
  console.error('  → Locally: add it to .env\n');
  process.exit(1);
}

// Railway sets PORT automatically; fallback to 3000 locally
const PORT = process.env.PORT || 3000;

const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
];

const MIME = {
  '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
  '.json':'application/json', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.png':'image/png'
};

function tryModel(model, geminiBody) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(geminiBody) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            const msg = parsed.error.message || '';
            if (parsed.error.code === 429 || parsed.error.code === 404 || msg.includes('quota') || msg.includes('not found')) {
              console.log(`  ⚠  ${model} unavailable, trying next...`);
              return reject({ retry: true, message: msg });
            }
            return reject({ retry: false, message: msg });
          }
          resolve(parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '');
        } catch (e) { reject({ retry: false, message: e.message }); }
      });
    });
    req.on('error', err => reject({ retry: true, message: err.message }));
    req.write(geminiBody);
    req.end();
  });
}

async function callGemini(payload, res) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: payload.system || '' }] },
    contents: payload.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    generationConfig: { maxOutputTokens: payload.max_tokens || 1500, temperature: 0.7 }
  });

  let lastError = '';
  for (const model of MODELS) {
    try {
      console.log(`  → Trying: ${model}`);
      const text = await tryModel(model, body);
      console.log(`  ✓  Success: ${model}`);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ content: [{ text }] }));
    } catch (err) {
      lastError = err.message;
      if (!err.retry) break;
    }
  }
  res.writeHead(429, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Quota exceeded. Wait 60s and retry. ' + lastError } }));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/agent') {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try { callGemini(JSON.parse(raw).payload, res); }
      catch { res.writeHead(400); res.end(JSON.stringify({ error: { message: 'Bad request' } })); }
    });
    return;
  }

  const blocked = ['.env', 'server.js', 'package'];
  if (blocked.some(b => req.url.includes(b))) { res.writeHead(403); return res.end('Forbidden'); }

  const filePath = path.join(__dirname, req.url === '/' ? '/index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🎮 AgentForge running on port ${PORT}\n`);
});
