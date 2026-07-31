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
  const enabledSources = SOURCES.filter(s => s.enabled !== false);
  const checks = await Promise.all(enabledSources.map(async (source) => {
    const result = await checkUrl(source.feedUrl);
    return {
      id: source.id,
      name: source.name,
      feedUrl: source.feedUrl,
      ...result
    };
  }));
  const results = checks;

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
