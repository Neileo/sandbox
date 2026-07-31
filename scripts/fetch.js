const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'GameWatch/1.0 RSS Aggregator' }
});

const SOURCES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf-8')
);

function getBatchNumber() {
  const batchIdx = process.argv.indexOf('--batch');
  if (batchIdx === -1) throw new Error('--batch=N required');
  return parseInt(process.argv[batchIdx + 1]);
}

function computeId(url) {
  const crypto = require('crypto');
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

async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.feedUrl);
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
