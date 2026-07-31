# GameWatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static web app that aggregates gaming industry news and investment info from 76 global RSS sources, deployed on GitHub Pages with daily auto-updates via GitHub Actions.

**Architecture:** Node.js scripts pull RSS feeds in 6 parallel batches, merge/deduplicate/categorize into a single JSON, which a vanilla HTML/JS page loads and renders with category tabs, source filters, and full-text search. All automated via GitHub Actions cron on a daily schedule.

**Tech Stack:** Node.js (rss-parser), vanilla HTML/CSS/JS, GitHub Actions, GitHub Pages

## Global Constraints

- 76 RSS sources in sources.json, split across 6 batches
- Single-source timeout 15s, fail gracefully
- Duplicate detection: URL exact match + title Levenshtein distance < 20%
- 10 categories via keyword rules
- 30-day rolling window for articles.json, full archives in archive/YYYY-MM.json
- Weekly keepalive touch to prevent 60-day inactivity timeout
- Monthly source health check with automated report
- No framework dependencies in the web app
- Dark mode by default, light mode toggle

---

### Task 1: Project Scaffolding & Source Configuration

**Files:**
- Create: `game-watch/data/.gitkeep`
- Create: `scripts/package.json`
- Create: `scripts/sources.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: `scripts/sources.json` — consumed by all scripts (Task 2, 3, 5)
- Produces: `scripts/package.json` — defines `rss-parser` dependency for Task 2

- [ ] **Step 1: Create directory structure**

```bash
New-Item -ItemType Directory -Force -Path "game-watch\data\archive"
New-Item -ItemType Directory -Force -Path "scripts"
New-Item -ItemType File -Path "game-watch\data\.gitkeep"
```

- [ ] **Step 2: Create scripts/package.json**

```json
{
  "name": "gamewatch-scripts",
  "private": true,
  "dependencies": {
    "rss-parser": "^3.13.0"
  }
}
```

- [ ] **Step 3: Create scripts/sources.json**

Define all 76 sources with their real RSS feed URLs. Each source has: `id`, `name`, `feedUrl`, `region` ("zh"/"en"/"jp"/"intl"), `type` ("gaming-media"/"investment"/"data-research"/"ai-tech"/"official"), `batch` (1-6), `enabled` (true/false).

```json
[
  { "id": "gamelook", "name": "GameLook", "feedUrl": "http://www.gamelook.com.cn/feed", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "youxiputao", "name": "游戏葡萄", "feedUrl": "https://youxiputao.com/feed", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "gameres", "name": "游资网", "feedUrl": "https://www.gameres.com/rss.xml", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "youxituoluo", "name": "游戏陀螺", "feedUrl": "https://www.youxituoluo.com/feed", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "36kr-game", "name": "36氪-游戏", "feedUrl": "https://36kr.com/feed?cid=3", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "jinghe", "name": "竞核", "feedUrl": "https://www.jinghegame.com/feed", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "shouyounadian", "name": "手游那点事", "feedUrl": "https://www.nadianshi.com/feed", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "chuapp", "name": "触乐", "feedUrl": "https://www.chuapp.com/feed", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "g-cores", "name": "机核", "feedUrl": "https://www.gcores.com/rss", "region": "zh", "type": "gaming-media", "batch": 1, "enabled": true },
  { "id": "youxiyanjiushe", "name": "游戏研究社", "feedUrl": "https://www.yystv.cn/rss/feed", "region": "zh", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "youyanshe", "name": "游研社", "feedUrl": "https://www.yystv.cn/rss/feed", "region": "zh", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "gwb-game", "name": "腾讯GWB游戏无界", "feedUrl": "https://gwb.tencent.com/feed", "region": "zh", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "bilibili-game", "name": "B站-游戏区", "feedUrl": "https://rsshub.app/bilibili/fav/928022", "region": "zh", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "xinhua-game", "name": "新华网-游戏", "feedUrl": "https://rsshub.app/xinhua/game", "region": "zh", "type": "gaming-media", "batch": 2, "enabled": false },
  { "id": "gamesindustry", "name": "GamesIndustry.biz", "feedUrl": "https://www.gamesindustry.biz/feed", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "ign", "name": "IGN", "feedUrl": "https://feeds.feedburner.com/ign/all", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "eurogamer", "name": "Eurogamer", "feedUrl": "https://www.eurogamer.net/feed", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "kotaku", "name": "Kotaku", "feedUrl": "https://kotaku.com/rss", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "polygon", "name": "Polygon", "feedUrl": "https://www.polygon.com/rss/index.xml", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "pcgamer", "name": "PC Gamer", "feedUrl": "https://www.pcgamer.com/rss/", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "rps", "name": "Rock Paper Shotgun", "feedUrl": "https://www.rockpapershotgun.com/feed", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "gamedeveloper", "name": "Game Developer", "feedUrl": "https://www.gamedeveloper.com/rss.xml", "region": "en", "type": "gaming-media", "batch": 2, "enabled": true },
  { "id": "gamespot", "name": "GameSpot", "feedUrl": "https://www.gamespot.com/feeds/mashup/", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "destructoid", "name": "Destructoid", "feedUrl": "https://www.destructoid.com/feed/", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "gematsu", "name": "Gematsu", "feedUrl": "https://www.gematsu.com/feed", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "siliconera", "name": "Siliconera", "feedUrl": "https://www.siliconera.com/feed/", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "nintendolife", "name": "Nintendo Life", "feedUrl": "https://www.nintendolife.com/feeds/latest", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "pushsquare", "name": "Push Square", "feedUrl": "https://www.pushsquare.com/feeds/latest", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "purexbox", "name": "Pure Xbox", "feedUrl": "https://www.purexbox.com/feeds/latest", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "pocketgamer", "name": "Pocket Gamer", "feedUrl": "https://www.pocketgamer.com/feed/", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "gdcvault", "name": "GDC Vault", "feedUrl": "https://gdconf.com/rss.xml", "region": "en", "type": "gaming-media", "batch": 3, "enabled": true },
  { "id": "steam-blog", "name": "Steam Blog", "feedUrl": "https://store.steampowered.com/feeds/news.xml", "region": "en", "type": "official", "batch": 3, "enabled": true },
  { "id": "epic-games-blog", "name": "Epic Games Store Blog", "feedUrl": "https://www.epicgames.com/site/en-US/news-rss", "region": "en", "type": "official", "batch": 3, "enabled": true },
  { "id": "xbox-wire", "name": "Xbox Wire", "feedUrl": "https://news.xbox.com/en-us/feed/", "region": "en", "type": "official", "batch": 3, "enabled": true },
  { "id": "playstation-blog", "name": "PlayStation Blog", "feedUrl": "https://blog.playstation.com/feed/", "region": "en", "type": "official", "batch": 4, "enabled": true },
  { "id": "unity-blog", "name": "Unity Blog", "feedUrl": "https://blog.unity.com/feed", "region": "en", "type": "ai-tech", "batch": 4, "enabled": true },
  { "id": "unreal-blog", "name": "Unreal Engine Blog", "feedUrl": "https://www.unrealengine.com/en-US/blog-rss", "region": "en", "type": "ai-tech", "batch": 4, "enabled": true },
  { "id": "36kr", "name": "36氪", "feedUrl": "https://36kr.com/feed", "region": "zh", "type": "investment", "batch": 4, "enabled": true },
  { "id": "chinaventure", "name": "投中网", "feedUrl": "https://www.chinaventure.com.cn/feed", "region": "zh", "type": "investment", "batch": 4, "enabled": true },
  { "id": "itjuzi", "name": "IT桔子", "feedUrl": "https://itjuzi.com/feed", "region": "zh", "type": "investment", "batch": 4, "enabled": true },
  { "id": "cyzone", "name": "创业邦", "feedUrl": "https://www.cyzone.cn/feed", "region": "zh", "type": "investment", "batch": 4, "enabled": true },
  { "id": "lieyunwang", "name": "猎云网", "feedUrl": "https://www.lieyunwang.com/feed", "region": "zh", "type": "investment", "batch": 4, "enabled": true },
  { "id": "cbinsights", "name": "CB Insights", "feedUrl": "https://www.cbinsights.com/blog/feed/", "region": "en", "type": "investment", "batch": 4, "enabled": true },
  { "id": "techcrunch", "name": "TechCrunch", "feedUrl": "https://techcrunch.com/feed/", "region": "en", "type": "investment", "batch": 4, "enabled": true },
  { "id": "venturebeat", "name": "VentureBeat", "feedUrl": "https://venturebeat.com/feed/", "region": "en", "type": "investment", "batch": 4, "enabled": true },
  { "id": "crunchbase-news", "name": "Crunchbase News", "feedUrl": "https://news.crunchbase.com/feed/", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "pitchbook-news", "name": "PitchBook News", "feedUrl": "https://pitchbook.com/news/feed", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "theverge", "name": "The Verge", "feedUrl": "https://www.theverge.com/rss/index.xml", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "bloomberg-tech", "name": "Bloomberg - Tech", "feedUrl": "https://feeds.bloomberg.com/technology/news.rss", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "reuters-tech", "name": "Reuters - Tech", "feedUrl": "https://www.reuters.com/arc/outboundfeeds/v3/all/?outputType=xml", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "ft-tech", "name": "Financial Times - Tech", "feedUrl": "https://www.ft.com/technology?format=rss", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "a16z-blog", "name": "a16z Blog", "feedUrl": "https://a16z.com/feed/", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "lightspeed-blog", "name": "Lightspeed Blog", "feedUrl": "https://lsvp.com/feed/", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "naavik", "name": "Naavik", "feedUrl": "https://naavik.co/feed/", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "gamediscoverco", "name": "GameDiscoverCo", "feedUrl": "https://newsletter.gamediscover.co/feed", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "katan-games", "name": "Katan Games", "feedUrl": "https://katanagames.substack.com/feed", "region": "en", "type": "investment", "batch": 5, "enabled": true },
  { "id": "investgame", "name": "InvestGame", "feedUrl": "https://investgame.net/feed/", "region": "en", "type": "investment", "batch": 6, "enabled": true },
  { "id": "newzoo", "name": "Newzoo", "feedUrl": "https://newzoo.com/feed/", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "sensor-tower", "name": "Sensor Tower Blog", "feedUrl": "https://sensortower.com/blog/rss", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "data-ai", "name": "data.ai Blog", "feedUrl": "https://www.data.ai/en/insights/feed/", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "appmagic", "name": "AppMagic Blog", "feedUrl": "https://appmagic.rocks/blog/feed", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "npd-circana", "name": "NPD (Circana)", "feedUrl": "https://www.circana.com/intelligence/rss/", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "steamdb-blog", "name": "SteamDB Blog", "feedUrl": "https://steamdb.info/blog/feed/", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "statista-gaming", "name": "Statista - Gaming", "feedUrl": "https://www.statista.com/topics/1551/video-games/feed", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "superdata-nielsen", "name": "SuperData (尼尔森)", "feedUrl": "https://www.nielsen.com/insights/feed/", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "ampere-analysis", "name": "Ampere Analysis", "feedUrl": "https://www.ampereanalysis.com/feed", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "midia-research", "name": "MIDiA Research", "feedUrl": "https://www.midiaresearch.com/blog/feed", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "stream-hatchet", "name": "Stream Hatchet", "feedUrl": "https://blog.streamhatchet.com/feed/", "region": "en", "type": "data-research", "batch": 6, "enabled": true },
  { "id": "famitsu", "name": "Famitsu", "feedUrl": "https://www.famitsu.com/feed", "region": "jp", "type": "gaming-media", "batch": 6, "enabled": true },
  { "id": "huggingface-blog", "name": "Hugging Face Blog", "feedUrl": "https://huggingface.co/blog/feed.xml", "region": "en", "type": "ai-tech", "batch": 4, "enabled": true },
  { "id": "openai-blog", "name": "OpenAI Blog", "feedUrl": "https://openai.com/blog/rss.xml", "region": "en", "type": "ai-tech", "batch": 4, "enabled": true },
  { "id": "stability-ai-blog", "name": "Stability AI Blog", "feedUrl": "https://stability.ai/blog/rss.xml", "region": "en", "type": "ai-tech", "batch": 4, "enabled": true },
  { "id": "nvidia-dev-blog", "name": "NVIDIA Developer Blog", "feedUrl": "https://developer.nvidia.com/blog/feed/", "region": "en", "type": "ai-tech", "batch": 5, "enabled": true },
  { "id": "80lv", "name": "80.lv", "feedUrl": "https://80.lv/feed/", "region": "en", "type": "ai-tech", "batch": 5, "enabled": true },
  { "id": "hackernews", "name": "Hacker News", "feedUrl": "https://hnrss.org/frontpage", "region": "en", "type": "ai-tech", "batch": 5, "enabled": true }
]
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
scripts/node_modules/
.env
*.log
```

- [ ] **Step 5: Install dependencies**

```bash
npm install --prefix scripts
```

- [ ] **Step 6: Commit**

```bash
git add scripts/ game-watch/data/ .gitignore
git commit -m "feat: add project scaffolding and 76 source configs"
```

---

### Task 2: RSS Fetch Script

**Files:**
- Create: `scripts/fetch.js`

**Interfaces:**
- Consumes: `scripts/sources.json` (Task 1), `rss-parser` (Task 1)
- Produces: `scripts/output/batch-N.json` — array of normalized articles, consumed by merge.js (Task 3)
- CLI: `node fetch.js --batch=N`

- [ ] **Step 1: Write fetch.js**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch.js
git commit -m "feat: add RSS fetch script with batch support"
```

---

### Task 3: Merge Script (deduplicate + categorize + archive)

**Files:**
- Create: `scripts/merge.js`

**Interfaces:**
- Consumes: `scripts/output/batch-*.json` (Task 2), `game-watch/data/articles.json` (existing), `game-watch/data/archive/` (existing)
- Produces: `game-watch/data/articles.json`, `game-watch/data/archive/YYYY-MM.json`

- [ ] **Step 1: Write merge.js**

```javascript
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_DIR = path.join(__dirname, '..', 'game-watch', 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json');

// ---- Category Keywords ----
const CATEGORY_RULES = [
  { cat: '产业动态', kw: ['财报', '营收', '裁员', '组织架构', '战略', '季度', '重组', 'earnings', 'revenue', 'layoff', 'restructuring', 'quarterly'] },
  { cat: '投融资/并购', kw: ['融资', '收购', '投资', '估值', '上市', 'IPO', 'PE', 'VC', 'M&A', 'funding', 'acquisition', 'investment', 'valuation', 'merger'] },
  { cat: '新品发布', kw: ['上线', '发售', '公测', 'EA', '抢先体验', '测试', '预告', '发布', 'launch', 'release', 'beta', 'early access', 'announces'] },
  { cat: '政策法规', kw: ['版号', '监管', '政策', '合规', '审查', '禁令', '分级', '法规', 'regulation', 'policy', 'ban', 'approval', 'license'] },
  { cat: '技术趋势', kw: ['引擎', '渲染', '云游戏', 'AI', '机器学习', '程序化', 'GPU', 'engine', 'rendering', 'cloud gaming', 'machine learning', 'procedural', 'ray tracing'] },
  { cat: '数据报告', kw: ['报告', '市场规模', 'MAU', 'DAU', '留存', '流水', '排行榜', '数据', 'report', 'market size', 'revenue share', 'download', 'ranking', 'chart'] },
  { cat: '电竞/直播', kw: ['赛事', '锦标赛', '直播', 'Twitch', '战队', '奖金', '电竞', 'esports', 'tournament', 'streaming', 'championship', 'prize pool'] },
  { cat: '独立游戏', kw: ['独立游戏', 'indie', 'Steam新品', '个人开发', '小型工作室', 'indie game', 'solo dev', 'small studio'] },
  { cat: '出海/全球化', kw: ['出海', '本地化', '全球化', '海外市场', '国际服', '全球发行', 'global', 'localization', 'overseas', 'expansion', 'publishing'] }
];

function classifyArticle(article) {
  const text = (article.title + ' ' + article.summary).toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.kw) {
      if (text.includes(kw.toLowerCase())) return rule.cat;
    }
  }
  return '综合';
}

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[m][n];
}

function isDuplicateByTitle(a, b) {
  const maxLen = Math.max(a.title.length, b.title.length);
  if (maxLen === 0) return false;
  const dist = levenshteinDistance(a.title.toLowerCase(), b.title.toLowerCase());
  return dist / maxLen < 0.2;
}

function deduplicate(articles) {
  const map = new Map();
  const duplicates = new Map();

  for (const art of articles) {
    if (!art.url) continue;
    if (map.has(art.url)) {
      const existing = map.get(art.url);
      existing.sources.push({ name: art.source.name, url: art.url });
      if (new Date(art.publishedAt) < new Date(existing.publishedAt)) {
        existing.publishedAt = art.publishedAt;
      }
      duplicates.set(art.id, { duplicateOf: existing.id, by: 'url' });
      continue;
    }
    map.set(art.url, art);
  }

  const deduped = Array.from(map.values());

  for (let i = 0; i < deduped.length; i++) {
    if (duplicates.has(deduped[i].id)) continue;
    for (let j = i + 1; j < deduped.length; j++) {
      if (duplicates.has(deduped[j].id)) continue;
      if (isDuplicateByTitle(deduped[i], deduped[j])) {
        deduped[i].sources.push({ name: deduped[j].source.name, url: deduped[j].url });
        if (new Date(deduped[j].publishedAt) < new Date(deduped[i].publishedAt)) {
          deduped[i].publishedAt = deduped[j].publishedAt;
        }
        duplicates.set(deduped[j].id, { duplicateOf: deduped[i].id, by: 'title' });
      }
    }
  }

  return deduped.filter(a => !duplicates.has(a.id));
}

function loadExistingArticles() {
  if (fs.existsSync(ARTICLES_PATH)) {
    return JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
  }
  return [];
}

function loadArchiveForMonth(yearMonth) {
  const p = path.join(ARCHIVE_DIR, `${yearMonth}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  return [];
}

function saveArchive(yearMonth, articles) {
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const existing = loadArchiveForMonth(yearMonth);
  const existingIds = new Set(existing.map(a => a.id));
  const newArticles = articles.filter(a => !existingIds.has(a.id) && a.id);
  const merged = [...existing, ...newArticles];
  const p = path.join(ARCHIVE_DIR, `${yearMonth}.json`);
  fs.writeFileSync(p, JSON.stringify(merged, null, 2));
  console.log(`Archive ${yearMonth}: ${existing.length} existing + ${newArticles.length} new = ${merged.length} total`);
}

function toYearMonth(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('No batch output dir, nothing to merge');
    return;
  }

  const batchFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('batch-') && f.endsWith('.json'));
  if (batchFiles.length === 0) {
    console.log('No batch files to merge');
    return;
  }

  const newArticles = [];
  for (const f of batchFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf-8'));
    newArticles.push(...data);
  }

  const existing = loadExistingArticles();
  const allArticles = [...existing, ...newArticles];

  const deduped = deduplicate(allArticles);

  for (const art of deduped) {
    art.category = classifyArticle(art);
  }

  deduped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const grouped = {};
  for (const art of deduped) {
    const ym = toYearMonth(art.publishedAt);
    if (!grouped[ym]) grouped[ym] = [];
    grouped[ym].push(art);
  }
  for (const [ym, arts] of Object.entries(grouped)) {
    saveArchive(ym, arts);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = deduped.filter(a => new Date(a.publishedAt) >= thirtyDaysAgo);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ARTICLES_PATH, JSON.stringify(recent, null, 2));

  console.log(`Merged ${newArticles.length} new → ${deduped.length} deduped → ${recent.length} in 30-day window`);

  for (const f of batchFiles) {
    fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/merge.js
git commit -m "feat: add merge script with dedup, categorize, and archive"
```

---

### Task 4: GitHub Actions Workflows

**Files:**
- Create: `.github/workflows/fetch.yml`
- Create: `.github/workflows/keepalive.yml`
- Create: `.github/workflows/health-check.yml`

**Interfaces:**
- Consumes: `scripts/sources.json` (Task 1)
- Produces: Automated daily data pipeline, weekly keepalive, monthly health check

- [ ] **Step 1: Write .github/workflows/fetch.yml**

```yaml
name: Daily Fetch

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  fetch:
    name: Fetch Batch ${{ matrix.batch }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        batch: [1, 2, 3, 4, 5, 6]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: scripts

      - name: Fetch RSS batch ${{ matrix.batch }}
        run: node fetch.js --batch=${{ matrix.batch }}
        working-directory: scripts

      - name: Upload batch artifact
        uses: actions/upload-artifact@v4
        with:
          name: batch-${{ matrix.batch }}
          path: scripts/output/batch-${{ matrix.batch }}.json

  merge:
    name: Merge & Commit
    runs-on: ubuntu-latest
    needs: fetch
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Download all batch artifacts
        uses: actions/download-artifact@v4
        with:
          path: scripts/output
          pattern: batch-*
          merge-multiple: true

      - name: Merge and categorize
        run: node merge.js
        working-directory: scripts

      - name: Commit and push data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add game-watch/data/
          git diff --staged --quiet || git commit -m "data: daily update $(date -u +%Y-%m-%d)"
          git push
```

- [ ] **Step 2: Write .github/workflows/keepalive.yml**

```yaml
name: Keepalive

on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: date > .keepalive
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .keepalive
          git diff --staged --quiet || git commit -m "keepalive $(date -u +%Y-%m-%d)"
          git push
```

- [ ] **Step 3: Write .github/workflows/health-check.yml**

```yaml
name: Source Health Check

on:
  schedule:
    - cron: '0 2 1 * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run health check
        run: node health-check.js
        working-directory: scripts

      - name: Commit health report
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add game-watch/data/source-health.json .github/HEALTH_REPORT.md
          git diff --staged --quiet || git commit -m "health: monthly source check $(date -u +%Y-%m)"
          git push
```

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions workflows for fetch, keepalive, and health check"
```

---

### Task 5: Health Check Script

**Files:**
- Create: `scripts/health-check.js`

**Interfaces:**
- Consumes: `scripts/sources.json` (Task 1)
- Produces: `game-watch/data/source-health.json`, `.github/HEALTH_REPORT.md`

- [ ] **Step 1: Write health-check.js**

```javascript
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SOURCES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf-8')
);

function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const start = Date.now();
    const req = client.get(url, { timeout: 15000 }, (res) => {
      const latency = Date.now() - start;
      resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400, latencyMs: latency, error: null });
    });
    req.on('error', (err) => {
      resolve({ status: 0, ok: false, latencyMs: null, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, ok: false, latencyMs: null, error: 'timeout' });
    });
  });
}

async function main() {
  const results = [];
  for (const source of SOURCES) {
    if (source.enabled === false) continue;
    const result = await checkUrl(source.feedUrl);
    results.push({
      id: source.id,
      name: source.name,
      feedUrl: source.feedUrl,
      ...result
    });
  }

  const summary = {
    total: results.length,
    healthy: results.filter(r => r.ok).length,
    broken: results.filter(r => !r.ok).length
  };

  const report = {
    checkedAt: new Date().toISOString(),
    results,
    summary
  };

  const dataDir = path.join(__dirname, '..', 'game-watch', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'source-health.json'), JSON.stringify(report, null, 2));

  let md = '# Source Health Report\n\n';
  md += `**Checked:** ${report.checkedAt}\n\n`;
  md += `| Status | Total | Healthy | Broken |\n`;
  md += `|--------|-------|---------|--------|\n`;
  md += `| Sources | ${summary.total} | ${summary.healthy} | ${summary.broken} |\n\n`;

  const broken = results.filter(r => !r.ok);
  if (broken.length > 0) {
    md += '## Broken Sources\n\n';
    md += '| Source | Status | Error |\n';
    md += '|--------|--------|-------|\n';
    for (const b of broken) {
      md += `| ${b.name} | ${b.status} | ${b.error} |\n`;
    }
  } else {
    md += 'All sources are healthy.\n';
  }

  const reportDir = path.join(__dirname, '..', '.github');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'HEALTH_REPORT.md'), md);

  console.log(`Health check complete: ${summary.healthy}/${summary.total} healthy`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/health-check.js
git commit -m "feat: add source health check script"
```

---

### Task 6: Landing Page (Tool Collection Entry)

**Files:**
- Create: `index.html`

**Interfaces:**
- Produces: Navigable entry page linking to GameWatch (and future tools)

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sandbox — 工具集</title>
<style>
  :root { --bg: #0d1117; --card-bg: #161b22; --text: #c9d1d9; --text-muted: #8b949e; --border: #30363d; --accent: #58a6ff; }
  [data-theme="light"] { --bg: #f6f8fa; --card-bg: #ffffff; --text: #24292f; --text-muted: #57606a; --border: #d0d7de; --accent: #0969da; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .container { max-width: 800px; margin: 0 auto; padding: 60px 20px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .subtitle { color: var(--text-muted); font-size: 14px; margin-bottom: 40px; }
  .theme-toggle { position: absolute; top: 20px; right: 20px; background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; text-decoration: none; transition: border-color 0.2s; }
  .card:hover { border-color: var(--accent); }
  .card-icon { font-size: 32px; margin-bottom: 12px; }
  .card h2 { font-size: 18px; color: var(--text); margin-bottom: 8px; }
  .card p { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
  .card .tag { display: inline-block; margin-top: 12px; padding: 2px 8px; font-size: 11px; background: var(--border); color: var(--text-muted); border-radius: 4px; }
</style>
</head>
<body>
<button class="theme-toggle" onclick="toggleTheme()">切换主题</button>
<div class="container">
  <h1>Sandbox 工具集</h1>
  <p class="subtitle">个人工具集合</p>
  <div class="grid">
    <a href="game-watch/" class="card">
      <div class="card-icon">Game Watch</div>
      <h2>GameWatch</h2>
      <p>全球游戏行业热点 & 投资信息聚合，每日自动更新，76个RSS源覆盖中英日文媒体。</p>
      <span class="tag">游戏</span>
      <span class="tag">投资</span>
    </a>
  </div>
</div>
<script>
function toggleTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  localStorage.setItem('theme', html.getAttribute('data-theme'));
}
(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add tool collection landing page"
```

---

### Task 7: GameWatch Web App

**Files:**
- Create: `game-watch/index.html`
- Create: `game-watch/data/articles.json` (initialized with empty array `[]`)
- Create: `game-watch/data/sources.json` (mirror of scripts/sources.json for web use)

**Interfaces:**
- Consumes: `game-watch/data/articles.json`
- Produces: Full-featured article browser with categories, filters, search

- [ ] **Step 1: Create initial data files**

Create `game-watch/data/articles.json`:
```json
[]
```

Create `game-watch/data/sources.json` by copying `scripts/sources.json` but keeping only the fields needed by the web app: `id`, `name`, `region`, `type`.

- [ ] **Step 2: Write game-watch/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GameWatch — 游戏 & 投资信息聚合</title>
<style>
  :root {
    --bg: #0d1117; --sidebar-bg: #010409; --card-bg: #161b22;
    --text: #c9d1d9; --text-muted: #8b949e; --text-dim: #6e7681;
    --border: #30363d; --accent: #58a6ff; --accent-bg: #1f6feb22;
    --tag-bg: #388bfd26; --tag-text: #58a6ff;
    --cat-active-bg: #1f6feb33; --cat-active-text: #58a6ff;
    --scrollbar-thumb: #30363d; --scrollbar-track: #0d1117;
  }
  [data-theme="light"] {
    --bg: #f6f8fa; --sidebar-bg: #ffffff; --card-bg: #ffffff;
    --text: #24292f; --text-muted: #57606a; --text-dim: #8c959f;
    --border: #d0d7de; --accent: #0969da; --accent-bg: #ddf4ff;
    --tag-bg: #ddf4ff; --tag-text: #0969da;
    --cat-active-bg: #ddf4ff; --cat-active-text: #0969da;
    --scrollbar-thumb: #d0d7de; --scrollbar-track: #f6f8fa;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
  a { color: var(--accent); text-decoration: none; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--scrollbar-track); }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }

  .sidebar { width: 240px; min-width: 240px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; padding: 16px 0; }
  .sidebar-header { padding: 8px 16px 16px; }
  .sidebar-header h2 { font-size: 14px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .sidebar-header a { font-size: 12px; color: var(--text-dim); }
  .cat-item { display: flex; align-items: center; gap: 8px; padding: 6px 16px; font-size: 13px; cursor: pointer; color: var(--text); transition: background 0.15s; }
  .cat-item:hover { background: var(--accent-bg); }
  .cat-item.active { background: var(--cat-active-bg); color: var(--cat-active-text); font-weight: 600; }
  .cat-item .count { margin-left: auto; font-size: 11px; color: var(--text-dim); background: var(--border); padding: 1px 6px; border-radius: 8px; }
  .sidebar-divider { border-top: 1px solid var(--border); margin: 12px 16px; }
  .source-section h3 { font-size: 11px; color: var(--text-dim); padding: 4px 16px; text-transform: uppercase; letter-spacing: 0.5px; }
  .source-item { display: flex; align-items: center; gap: 6px; padding: 4px 16px 4px 24px; font-size: 12px; cursor: pointer; color: var(--text-muted); }
  .source-item input { accent-color: var(--accent); }
  .source-item:has(input:checked) { color: var(--text); }

  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); }
  .topbar input { flex: 1; background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; }
  .topbar input:focus { border-color: var(--accent); }
  .topbar .info { font-size: 12px; color: var(--text-dim); white-space: nowrap; }
  .theme-btn { background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap; }
  .back-btn { font-size: 12px; color: var(--text-dim); }

  .content { flex: 1; overflow-y: auto; padding: 16px 20px; }
  .article-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; margin-bottom: 8px; transition: border-color 0.15s; }
  .article-card:hover { border-color: var(--accent); }
  .article-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; color: var(--text-dim); }
  .article-meta .source { font-weight: 600; color: var(--accent); }
  .article-meta .region { padding: 1px 5px; border-radius: 3px; font-size: 10px; background: var(--border); }
  .article-meta .time { margin-left: auto; }
  .article-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--text); }
  .article-summary { font-size: 12px; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .article-tags { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
  .article-tag { font-size: 10px; padding: 2px 6px; background: var(--tag-bg); color: var(--tag-text); border-radius: 3px; }

  .bottombar { display: flex; align-items: center; padding: 10px 20px; border-top: 1px solid var(--border); gap: 12px; font-size: 12px; color: var(--text-dim); }
  .bottombar select { background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: 4px 8px; border-radius: 4px; font-size: 12px; }
  .pagination { display: flex; gap: 4px; margin-left: auto; }
  .pagination button { background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .pagination button:disabled { opacity: 0.4; cursor: default; }
  .pagination button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .loading { display: flex; align-items: center; justify-content: center; height: 200px; color: var(--text-muted); font-size: 14px; }
  .empty { display: flex; align-items: center; justify-content: center; height: 200px; color: var(--text-dim); font-size: 14px; }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .topbar { flex-wrap: wrap; }
  }
</style>
</head>
<body>

<aside class="sidebar">
  <div class="sidebar-header">
    <h2>GameWatch</h2>
    <a href="../">Back to Sandbox</a>
  </div>
  <div id="categories"></div>
  <div class="sidebar-divider"></div>
  <div id="sourceFilters"></div>
</aside>

<div class="main">
  <div class="topbar">
    <a href="../" class="back-btn">Sandbox</a>
    <input type="text" id="searchInput" placeholder="Search articles..." oninput="render()">
    <span class="info" id="updateInfo"></span>
    <button class="theme-btn" onclick="toggleTheme()">Theme</button>
  </div>

  <div class="content" id="articleList">
    <div class="loading">Loading articles...</div>
  </div>

  <div class="bottombar">
    <select id="timeRange" onchange="render()">
      <option value="7">Last 7 days</option>
      <option value="15" selected>Last 15 days</option>
      <option value="30">Last 30 days</option>
    </select>
    <span id="articleCount"></span>
    <span class="pagination" id="pagination"></span>
  </div>
</div>

<script>
let ARTICLES = [];
let SOURCE_CONFIG = [];
const CATEGORIES = ['全部', '产业动态', '投融资/并购', '新品发布', '政策法规', '技术趋势', '数据报告', '电竞/直播', '独立游戏', '出海/全球化', '综合'];
const CAT_ICONS = { '全部': '#', '产业动态': '#', '投融资/并购': '#', '新品发布': '#', '政策法规': '#', '技术趋势': '#', '数据报告': '#', '电竞/直播': '#', '独立游戏': '#', '出海/全球化': '#', '综合': '#' };

let state = { activeCat: '全部', sourceFilters: new Set(), searchQuery: '', page: 1, pageSize: 50 };

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return Math.floor(diff / 60000) + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (hours < 48) return '1d ago';
  return d.toISOString().slice(0, 10);
}

function getFilteredArticles() {
  const days = parseInt(document.getElementById('timeRange').value);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return ARTICLES.filter(a => {
    if (new Date(a.publishedAt) < cutoff) return false;
    if (state.activeCat !== '全部' && a.category !== state.activeCat) return false;
    if (state.sourceFilters.size > 0 && !state.sourceFilters.has(a.source.name)) return false;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.summary.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function render() {
  renderCategories();
  renderSourceFilters();
  renderArticles();
  renderPagination();
}

function renderCategories() {
  const container = document.getElementById('categories');
  const counts = {};
  CATEGORIES.forEach(c => counts[c] = 0);
  ARTICLES.forEach(a => {
    if (counts[a.category] !== undefined) counts[a.category]++;
    counts['全部']++;
  });

  container.innerHTML = CATEGORIES.map(c =>
    `<div class="cat-item ${state.activeCat === c ? 'active' : ''}" onclick="setCategory('${c}')">
      <span>${c}</span><span class="count">${counts[c] || 0}</span>
    </div>`
  ).join('');
}

function setCategory(cat) {
  state.activeCat = cat;
  state.page = 1;
  render();
}

function renderSourceFilters() {
  const container = document.getElementById('sourceFilters');
  if (!SOURCE_CONFIG.length) { container.innerHTML = ''; return; }

  const types = { 'gaming-media': 'Game Media', 'investment': 'Investment', 'data-research': 'Data Research', 'ai-tech': 'AI / Tech', 'official': 'Official' };

  container.innerHTML = Object.entries(types).map(([type, label]) => {
    const sources = SOURCE_CONFIG.filter(s => s.type === type);
    if (!sources.length) return '';
    return `<div class="source-section"><h3>${label}</h3>` +
      sources.map(s => `<label class="source-item">
        <input type="checkbox" ${state.sourceFilters.has(s.name) ? 'checked' : ''} onchange="toggleSource('${s.name}')">${s.name}
      </label>`).join('') + `</div>`;
  }).join('');
}

function toggleSource(name) {
  if (state.sourceFilters.has(name)) state.sourceFilters.delete(name);
  else state.sourceFilters.add(name);
  state.page = 1;
  render();
}

function renderArticles() {
  const filtered = getFilteredArticles();
  const list = document.getElementById('articleList');
  if (!ARTICLES.length && filtered.length === 0) {
    list.innerHTML = '<div class="loading">Loading articles...</div>';
    return;
  }
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty">No articles found</div>';
    return;
  }

  const start = (state.page - 1) * state.pageSize;
  const page = filtered.slice(start, start + state.pageSize);

  list.innerHTML = page.map(a => `
    <div class="article-card">
      <div class="article-meta">
        <span class="source">${a.source.name}</span>
        <span class="region">${a.source.region.toUpperCase()}</span>
        <span>${a.category}</span>
        <span class="time">${formatTime(a.publishedAt)}</span>
      </div>
      <div class="article-title"><a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a></div>
      <div class="article-summary">${escapeHtml(a.summary)}</div>
      ${a.tags && a.tags.length ? `<div class="article-tags">${a.tags.map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${a.sources && a.sources.length > 1 ? `<div class="article-tags"><span class="article-tag">Also reported by: ${a.sources.slice(1).map(s => s.name).join(', ')}</span></div>` : ''}
    </div>
  `).join('');

  document.getElementById('articleCount').textContent = `${filtered.length} articles`;
}

function renderPagination() {
  const filtered = getFilteredArticles();
  const totalPages = Math.ceil(filtered.length / state.pageSize);
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '';
  html += `<button ${state.page <= 1 ? 'disabled' : ''} onclick="goPage(${state.page - 1})"> Prev </button>`;
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<button class="${i === state.page ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button ${state.page >= totalPages ? 'disabled' : ''} onclick="goPage(${state.page + 1})"> Next </button>`;
  pag.innerHTML = html;
}

function goPage(p) {
  state.page = p;
  render();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  localStorage.setItem('theme', html.getAttribute('data-theme'));
}

async function load() {
  try {
    const [articlesRes, sourcesRes] = await Promise.all([
      fetch('data/articles.json'),
      fetch('data/sources.json')
    ]);
    ARTICLES = await articlesRes.json();
    SOURCE_CONFIG = await sourcesRes.json();
    document.getElementById('updateInfo').textContent = ARTICLES.length > 0
      ? `Updated ${formatTime(ARTICLES[0].fetchedAt || ARTICLES[0].publishedAt)}`
      : 'No data';
  } catch (err) {
    console.error('Failed to load articles:', err);
    document.getElementById('articleList').innerHTML = '<div class="empty">Failed to load data</div>';
  }
  render();
}

document.getElementById('searchInput').addEventListener('input', function(e) {
  state.searchQuery = e.target.value;
  state.page = 1;
  render();
});

(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

load();
</script>

</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add game-watch/
git commit -m "feat: add GameWatch web app with categories, filters, and search"
```

---

### Task 8: Integration Verification

**Files:**
- No new files
- Verify: All pieces work together

- [ ] **Step 1: Verify directory structure**

```bash
git status
```

Expected: All files committed, working tree clean.

- [ ] **Step 2: Check data initialization**

```bash
node -e "const d = require('./game-watch/data/articles.json'); console.log('articles:', Array.isArray(d) ? d.length : 'NOT ARRAY')"
node -e "const d = require('./scripts/sources.json'); console.log('sources:', d.length)"
```

- [ ] **Step 3: Enable GitHub Pages**

1. Go to repository Settings > Pages
2. Source: Deploy from branch
3. Branch: `main`, folder: `/ (root)`
4. Save

- [ ] **Step 4: Push and verify**

Push all code to GitHub. Verify:
- `https://neileo.github.io/sandbox/` loads the landing page
- `https://neileo.github.io/sandbox/game-watch/` loads GameWatch
- Actions tab shows `Daily Fetch` workflow available (manual trigger for first run)
- Manually trigger `Daily Fetch` from Actions tab to populate initial data

- [ ] **Step 5: Commit**

No new files to commit (verification only). Push existing commits:

```bash
git push
```
