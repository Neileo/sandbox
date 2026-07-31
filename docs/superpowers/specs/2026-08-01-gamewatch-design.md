# GameWatch — 游戏 & 投资信息聚合器 设计文档

> 日期：2026-08-01
> 状态：设计完成，待审核

---

## 1. 概述

GameWatch 是一个面向个人的网页应用，聚合全球游戏行业热点和投资相关信息。打开页面即展示近 15 天重要内容，按主题分类、可按来源筛选、支持全文搜索。

部署在 GitHub Pages，数据由 GitHub Actions 每日定时抓取 RSS 源自动更新。

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────┐
│                  GitHub Actions                   │
│  每日 UTC 0:00 触发                               │
│                                                  │
│  fetch (matrix: 6 批次)                          │
│    └── 每批抓取 12-13 个 RSS 源                   │
│    └── 输出 batch-N.json artifact                 │
│                                                  │
│  merge (等待 fetch 完成)                          │
│    ├── 合并所有批次                               │
│    ├── URL 去重 + 标题相似度去重                    │
│    ├── 关键词自动分类                              │
│    ├── 月度归档 (archive/)                         │
│    ├── articles.json 裁剪近30天                   │
│    └── git commit & push                          │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│               GitHub Pages                       │
│                                                  │
│  index.html ─── 加载 data/articles.json          │
│  ├── 分类标签页 (Tab)                             │
│  ├── 来源筛选 (Sidebar)                           │
│  ├── 时间范围 (默认15天)                          │
│  └── 全文搜索                                     │
└─────────────────────────────────────────────────┘
```

---

## 3. 数据源

共 76 个 RSS/API 来源，分为 5 大类：

| 类别 | 数量 | 代表源 |
|------|------|--------|
| 中文游戏媒体 | 15 | GameLook、游戏葡萄、游资网、游戏陀螺、36氪-游戏、竞核、触乐等 |
| 国际游戏媒体 | 23 | GamesIndustry.biz、IGN、Kotaku、Polygon、PC Gamer、Eurogamer 等 |
| 投资/商业 | 20 | 36氪、投中网、TechCrunch、VentureBeat、CB Insights、a16z 等 |
| 数据/市场研究 | 11 | Newzoo、Sensor Tower、data.ai、SteamDB、NPD 等 |
| AI/技术交叉 | 7 | Hugging Face、OpenAI、NVIDIA Developer、80.lv、Hacker News 等 |

每批分配 12-13 个源，6 批并行抓取。

---

## 4. 数据管道

### 4.1 抓取 (fetch.js)

- 运行环境：Node.js
- 依赖：`rss-parser`
- 输入：批次编号 `--batch=N`，读取 `sources.json` 中对应批次的 RSS URL
- 输出：`batch-N.json`（标准化文章数组）
- 超时：单源 15s，失败跳过不阻塞整批

### 4.2 合并 (merge.js)

执行顺序：
1. 读取所有 `batch-*.json`
2. URL 精确匹配去重（保留发布时间最早的）
3. 标题 Levenshtein 距离 < 20% 二次去重
4. 关键词规则匹配 → 分配 category
5. 合并到本月 `archive/YYYY-MM.json`
6. 生成 `articles.json`（仅保留近 30 天）
7. 写入文件 + commit + push

### 4.3 去重规则

- `duplicateOf` 字段标记被合并的文章，指向主记录 id
- `sources` 字段记录所有转载来源
- 标题相似度阈值 0.8（80% 匹配视为同一篇）

### 4.4 保留策略

| 文件 | 内容 | 更新方式 |
|------|------|----------|
| `data/articles.json` | 滚动近 30 天 | 每日裁剪 |
| `data/archive/YYYY-MM.json` | 当月全部文章 | 每日增量追加 |

---

## 5. 分类体系

10 个主类别，基于关键词规则自动匹配：

| 类别 | 关键词 |
|------|--------|
| 产业动态 | 财报、营收、裁员、组织架构、战略、季度、重组 |
| 投融资/并购 | 融资、收购、投资、估值、上市、IPO、PE、VC、M&A |
| 新品发布 | 上线、发售、公测、EA、抢先体验、测试、预告、发布 |
| 政策法规 | 版号、监管、政策、合规、审查、禁令、分级、法规 |
| 技术趋势 | 引擎、渲染、云游戏、AI、机器学习、程序化、物理引擎 |
| 数据报告 | 报告、市场规模、MAU、DAU、留存、流水、排行榜、数据 |
| 电竞/直播 | 赛事、锦标赛、直播、Twitch、战队、奖金、电竞 |
| 独立游戏 | 独立游戏、indie、Steam新品、个人开发、小型工作室 |
| 出海/全球化 | 出海、本地化、全球化、海外市场、国际服、全球发行 |
| 综合 | 无法匹配以上类别的文章 |

---

## 6. 数据 Schema

### 6.1 Article

```json
{
  "id": "sha256(url)",
  "title": "文章标题",
  "url": "https://original-url",
  "source": {
    "name": "GameLook",
    "region": "zh",
    "type": "gaming-media"
  },
  "category": "产业动态",
  "summary": "文章摘要（RSS description 前 200 字）",
  "publishedAt": "2026-07-28T08:00:00Z",
  "tags": ["腾讯", "财报", "手游"],
  "fetchedAt": "2026-07-29T00:05:12Z",
  "duplicateOf": null,
  "sources": [
    { "name": "GameLook", "url": "..." }
  ]
}
```

### 6.2 Source Config (sources.json)

```json
{
  "id": "gamelook",
  "name": "GameLook",
  "feedUrl": "https://.../rss",
  "region": "zh",
  "type": "gaming-media",
  "priority": 1
}
```

`type` 枚举：`gaming-media` | `investment` | `data-research` | `ai-tech` | `official`

---

## 7. Web 应用

### 7.1 入口页 (index.html)

工具集合导航页，卡片式布局，每个工具一个入口卡片。

### 7.2 GameWatch 页 (game-watch/index.html)

纯静态 HTML，无框架，内嵌 CSS + JS。

**功能：**
- 打开即加载 `data/articles.json`，默认展示近 15 天
- 左侧：10 个分类 Tab，点击切换过滤
- 左侧：来源多选筛选（按 type 分组）
- 右侧：卡片式文章列表，显示来源、时间、标题、摘要、标签
- 顶部搜索框：全文搜索（标题 + 摘要）
- 底部：时间范围选择器、文章计数、分页
- 暗色/亮色主题切换（默认暗色）

**布局草图：**
```
┌─────────────────────────────────────────────────────────┐
│  🎮 GameWatch                                        🔍 │
│  游戏 & 投资信息聚合   更新于 2026-08-01 08:00          │
├──────────┬──────────────────────────────────────────────┤
│ 分类      │                                              │
│ 📋 全部   │ ┌──────────────────────────────────────┐     │
│ 🏭 产业   │ │ [GameLook]  2h ago                    │     │
│ 💰 投融资 │ │ 腾讯Q2游戏营收突破500亿               │     │
│ 🆕 新品   │ │ 摘要...                               │     │
│ 📜 政策   │ │ 标签: 腾讯 财报 手游                  │     │
│ 🔧 技术   │ └──────────────────────────────────────┘     │
│ 📊 数据   │ ...卡片列表...                              │
│ ⚡ 电竞   │ ...                                         │
│ 🎲 独立   │                            < 1 2 3 ... > │
│ 🌏 出海   │                                              │
│ 📦 综合   │                                              │
│          │                                              │
│ 来源      │                                              │
│ ☑ 全部    │                                              │
│ ☐ GameLook│                                              │
│ ...      │                                              │
├──────────┴──────────────────────────────────────────────┤
│  展示: 近15天 ▼ | 共 847 篇文章 | 中文 456 · EN 391     │
└─────────────────────────────────────────────────────────┘
```

---

## 8. 仓库结构

```
sandbox/
├── index.html                      # 工具集合入口
├── game-watch/
│   ├── index.html                  # 信息聚合主页面
│   └── data/
│       ├── articles.json           # 近30天文章
│       ├── sources.json            # 源配置
│       └── archive/
│           └── YYYY-MM.json        # 月度归档
├── scripts/
│   ├── fetch.js                    # RSS 抓取脚本
│   ├── merge.js                    # 合并去重分类脚本
│   └── sources.json                # 抓取源列表
└── .github/workflows/
    └── fetch.yml                   # Actions 定时任务
```

---

## 9. 部署

- **GitHub Pages**：从 `main` 分支根目录部署
- **访问地址**：`https://neileo.github.io/sandbox/`
- **Actions 调度**：`cron: "0 0 * * *"` (UTC 0:00)
- **数据更新**：Actions 自动 commit + push 到 main，Pages 自动关联部署
