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
    try {
      return JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
    } catch (e) {
      console.warn('Failed to parse existing articles.json, starting fresh:', e.message);
      return [];
    }
  }
  return [];
}

function loadArchiveForMonth(yearMonth) {
  const p = path.join(ARCHIVE_DIR, `${yearMonth}.json`);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
      console.warn(`Failed to parse archive ${yearMonth}.json, starting fresh:`, e.message);
      return [];
    }
  }
  return [];
}

function saveArchive(yearMonth, articles) {
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const existing = loadArchiveForMonth(yearMonth);
  // Only add new articles by ID; existing entries are preserved as-is.
  // NOTE: Articles that were "merged away" by title dedup in a later run
  // may silently disappear from the archive because they are no longer in
  // the deduped set. This is acceptable since they are duplicates.
  const existingIds = new Set(existing.map(a => a.id));
  const newArticles = articles.filter(a => !existingIds.has(a.id) && a.id);
  const merged = [...existing, ...newArticles];
  const p = path.join(ARCHIVE_DIR, `${yearMonth}.json`);
  const tmpPath = p + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
  fs.renameSync(tmpPath, p);
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
  const tmpPath = ARTICLES_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(recent, null, 2));
  fs.renameSync(tmpPath, ARTICLES_PATH);

  console.log(`Merged ${newArticles.length} new → ${deduped.length} deduped → ${recent.length} in 30-day window`);

  for (const f of batchFiles) {
    fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }
}

main();
