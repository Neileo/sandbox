const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const Parser = require('rss-parser');

const parser = new Parser();

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB 上限
const HARD_TIMEOUT_MS = 45000; // 硬性墙钟超时：超过即强制断连

const SOURCES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf-8')
);

function getBatchNumber() {
  for (const arg of process.argv) {
    if (arg.startsWith('--batch=')) return parseInt(arg.split('=')[1]);
  }
  const batchIdx = process.argv.indexOf('--batch');
  if (batchIdx !== -1) return parseInt(process.argv[batchIdx + 1]);
  throw new Error('--batch=N required');
}

function computeId(url) {
  return crypto.createHash('sha256').update(url).digest('hex').substring(0, 16);
}

function normalizeArticle(raw, source) {
  return {
    id: computeId(raw.link || raw.guid || ''),
    title: (raw.title || '').trim(),
    url: raw.link || raw.guid || '',
    source: {
      name: source.name,
      region: source.region,
      type: source.type
    },
    category: '综合',
    summary: (raw.contentSnippet || raw.content || '').trim().substring(0, 200),
    publishedAt: raw.isoDate || raw.pubDate || new Date().toISOString(),
    tags: [],
    fetchedAt: new Date().toISOString(),
    duplicateOf: null,
    sources: [{ name: source.name, url: raw.link || '' }],
    originalLanguage: source.region === 'zh' ? 'zh' : source.region === 'jp' ? 'ja' : 'en'
  };
}

// 单跳 HTTP GET：带硬性墙钟超时，超时/超大小即 destroy 连接
function httpGetOnce(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    let settled = false;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'GameWatch/1.0 RSS Aggregator',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Encoding': 'gzip'
      }
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          req.destroy(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve({ redirect: new URL(res.headers.location, url).toString() });
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`status ${res.statusCode}`));
          return;
        }
        let buf = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
          else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
        } catch (e) {
          reject(new Error('decompress failed: ' + e.message));
          return;
        }
        resolve({ body: buf });
      });
      res.on('error', (e) => { if (!settled) { settled = true; clearTimeout(hardTimer); reject(e); } });
    });
    const hardTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      req.destroy(new Error(`wall-clock timeout after ${HARD_TIMEOUT_MS}ms`));
    }, HARD_TIMEOUT_MS);
    req.on('error', (e) => { if (!settled) { settled = true; clearTimeout(hardTimer); reject(e); } });
  });
}

async function fetchXml(url) {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await httpGetOnce(current);
    if (r.body) return r.body;
    current = r.redirect;
  }
  throw new Error('too many redirects');
}

function bufferToXml(buf) {
  let charset = 'utf-8';
  const head = buf.slice(0, 512).toString('ascii');
  const m = head.match(/encoding\s*=\s*["']?([a-zA-Z0-9._-]+)/i);
  if (m) charset = m[1].toLowerCase();
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString('utf-8');
  }
}

async function fetchSource(source) {
  try {
    const buf = await fetchXml(source.feedUrl);
    const xml = bufferToXml(buf);
    const feed = await parser.parseString(xml);
    return feed.items.map(item => normalizeArticle(item, source));
  } catch (err) {
    console.error(`[ERROR] ${source.name} (${source.id}): ${err.message}`);
    return [];
  }
}

async function main() {
  const batchNum = getBatchNumber();
  const batchSources = SOURCES.filter(s => s.batch === batchNum && s.enabled !== false);
  console.log(`Batch ${batchNum}: fetching ${batchSources.length} sources`);

  const results = await Promise.all(batchSources.map(fetchSource));
  const articles = results.flat();

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, `batch-${batchNum}.json`);
  fs.writeFileSync(outPath, JSON.stringify(articles, null, 2));
  console.log(`Batch ${batchNum}: wrote ${articles.length} articles to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal fetch error:', err);
  process.exit(1);
});
