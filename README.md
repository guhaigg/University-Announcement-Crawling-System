# 高校研招公告工作台

一个面向高校官网公告抓取的可视化系统，重点服务于研究生调剂/复试信息检索场景。

![CI](https://github.com/guhaigg/University-Announcement-Crawling-System/actions/workflows/ci.yml/badge.svg)

## 项目定位

本项目不是“只抓链接”的脚本，而是完整流程工具：

- 智能匹配院校官网、研究生招生入口、学院入口
- 候选公告先展示，用户确认后再抓取正文
- 默认过滤友情链接等噪声入口，聚焦公告正文链路
- 支持关键词/年份/来源等筛选
- 支持 Markdown 合并输出或分别输出
- 支持日常自动任务与手动一次性任务并行

适合场景：调剂信息跟踪、复试通知跟踪、院校公告归档、信息清洗与二次筛选。

## 功能总览

当前前端导航已包含以下模块（与代码一致）：

1. `调剂智能导航`
- 输入院校名（可加学院名）后，自动匹配官网与研招入口
- 输出“研究生招生页面候选（可多选）”“学院官网候选（单选）”“学院页面候选（多选）”
- 可直接回填到自助爬取，或一键生成每日任务
- 内置“固定 10 所院校（一键查询）”，支持新增/修改/删除/同步

2. `新公告查询` / `复试内容检索`
- 同一套引擎，支持 `general` 与 `retest` 两种焦点
- 智能匹配院校与学院后，检查近三日研招公告
- 支持日期筛选（今日/昨日/前日）和关键词筛选
- 支持页内浏览（iframe）和新窗口打开
- 内置“固定 10 所院校（一键查询）”

3. `调剂数据清洗`
- 支持来源：研招网 + 小木虫
- 支持院校、专业/学院关键词、年份、附加关键词
- 支持“仅按专业搜索（不限定院校）”
- 清洗级别：`loose` / `standard` / `strict`
- 支持筛选后导出 Markdown
- 内置固定 10 所院校快捷查询并可同步

4. `专业调剂测试`
- 先用本地研招网院校库+专业库匹配院校，再抓取对应院校研招正文做二次过滤
- 支持地区、学位类型、名额、附件等筛选
- 支持导出 Markdown
- 含缓存管理：
  - 专业缓存筛选
  - 保留最近 N 次
  - 清空当前专业/清空全部缓存
  - 一键“套用查询”

5. `每日任务`
- 保存按校任务（普通公告/研究生调剂公告）
- 支持设定每日时间、开启/暂停、手动立即运行
- 支持“核对公告链接”后再保存
- 支持调剂模式下学院页面扩展抓取

6. `自助爬取（一次性）`
- 手动输入链接后先扫描候选，再确认抓正文
- 支持普通/调剂模式与学院链接补充
- 支持 Markdown 合并或分别输出
- 内置“最近十所院校”及同步到其他模块

7. `候选确认`
- 对扫描结果做关键词/年份筛选
- 支持全选/反选
- 确认后抓取正文并生成 Markdown
- 候选公告支持分页展示（含多页列表抓取结果）

8. `Markdown 输出`
- 列表分页、预览、下载、删除
- 支持批量清洗（loose/standard/strict）
- 支持“查看本地”（在系统文件管理器中定位文件）

## 快速开始

### 环境要求

- Node.js `18+`（建议 `20+`）
- macOS / Linux / Windows 均可运行

### 安装与启动

```bash
npm install
npm start
```

打开浏览器：

```text
http://localhost:3000
```

## 登录与安全

首次启动会自动创建管理员账号：

- 用户名：`admin`
- 密码：`admin123456`

注意：生产环境下如果 `NODE_ENV=production` 且仍使用默认密码，服务会拒绝启动。

接口鉴权规则：

- 除 `/api/health` 与 `/api/auth/*` 外，全部 API 需要登录
- 会话通过 HttpOnly Cookie 保存（默认 7 天）
- 写操作有来源校验（Origin/Referer/回环地址）
- 登录有失败次数限流与短时锁定

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务监听端口 |
| `DEFAULT_ADMIN_USER` | `admin` | 首次初始化管理员用户名 |
| `DEFAULT_ADMIN_PASSWORD` | `admin123456` | 首次初始化管理员密码 |
| `NODE_ENV` | 空 | 为 `production` 时启用默认密码保护 |
| `COOKIE_SECURE` | `false` | 为 `true` 时会话 Cookie 增加 `Secure` 标记 |
| `ALLOWED_ORIGINS` | 空 | 逗号分隔的可信来源，用于写操作来源校验 |

示例：

```bash
PORT=3000
NODE_ENV=production
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASSWORD=replace_with_strong_password
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://your-domain.com
```

## 目录结构与数据文件

```text
.
├─ server.js                  # 后端服务与爬取逻辑
├─ public/
│  ├─ index.html              # 页面结构
│  ├─ app.js                  # 前端交互逻辑
│  └─ styles.css              # 样式与动画
├─ data/
│  ├─ config.json             # 任务配置、最近十所、固定院校等
│  ├─ users.json              # 用户与密码哈希
│  ├─ yanzhao_catalog.json    # 研招网本地院校库/专业库
│  └─ adjustment_major_test_cache.json  # 专业调剂测试缓存
├─ outputs/                   # 生成的 Markdown 文件
└─ scripts/
   └─ update-readme.js        # 自动更新 README 审核记录
```

## 推荐使用流程

1. 在 `调剂智能导航` 输入院校（可选学院），先拿到高质量研招入口候选。
2. 点“直接扫描候选公告”进入 `候选确认`，筛选后勾选要抓取的公告。
3. 点“确认爬取并生成文件”，在 `Markdown 输出` 里预览、清洗、下载或查看本地。
4. 对稳定院校将配置固化到 `每日任务`，开启自动执行。

## Markdown 输出说明

- 输出模式：
  - `merged`：同次抓取合并成 1 个 Markdown
  - `separate`：按公告分别输出多个 Markdown
- 正文内容为主，非仅链接列表
- 若公告含附件，输出中会保留“附件链接”
- 遇到附件型公告/PDF 入口时，会保留原链接并标记说明
- 公告列表会自动翻页抓取（当前默认最多 5 页）

## API 概览（供二次开发）

### 认证与健康

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### 调剂导航 / 新公告 / 复试

- `POST /api/graduate-assistant`
- `POST /api/graduate-assistant-batch`
- `POST /api/graduate-news-check`
- `POST /api/graduate-news-batch`
- `POST /api/graduate-retest-batch`

### 每日任务 / 手动抓取

- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/:id/toggle`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/run`
- `POST /api/tasks/:id/scan`
- `POST /api/tasks/:id/confirm`
- `POST /api/manual-scan`
- `POST /api/manual-confirm`
- `POST /api/manual-crawl`
- `POST /api/verify-links`

### 调剂数据清洗 / 专业调剂测试

- `POST /api/adjustment-clean/query`
- `POST /api/adjustment-clean/export`
- `GET /api/adjustment-major-test/catalog-status`
- `POST /api/adjustment-major-test/catalog-refresh`
- `POST /api/adjustment-major-test/query`
- `POST /api/adjustment-major-test/export`
- `GET /api/adjustment-major-test/cache`
- `POST /api/adjustment-major-test/cache/prune`
- `POST /api/adjustment-major-test/cache/clear`

### 固定院校 / 最近十所 / 文件管理

- `GET/POST/DELETE /api/news-quick-schools*`
- `GET/POST/DELETE /api/adjustment-quick-schools*`
- `GET/POST/DELETE /api/adjustment-clean-quick-schools*`
- `GET/POST/DELETE /api/manual-presets*`
- `GET /api/files`
- `GET /api/files/:name/content`
- `POST /api/files/:name/reveal`
- `DELETE /api/files/:name`
- `POST /api/files/delete-many`
- `POST /api/files/clean-many`

## 开发命令

```bash
npm start
npm run dev
npm run check
npm run review
npm run readme:update
```

说明：

- `npm run check`：语法审核（`server.js` + `public/app.js`）
- `npm run review`：等价于 `npm run check`
- `npm run readme:update`：只刷新 README 的自动审核记录
- 已配置 `postcheck`，每次 `npm run check` 后会自动更新本 README 的“自动审核记录”

## CI

GitHub Actions 已配置：

- 分支：`main` 推送和 PR
- Node 版本矩阵：`18`、`20`
- 流程：`npm ci` + `npm run check`

## 常见问题

1. 没抓到内容，只有很少候选。
- 先用“核对链接”检查入口是否正确。
- 某些学校站点结构复杂，可开启学院层级并手动补充学院链接。

2. 页面是 PDF 或附件入口怎么办？
- 系统会尽量识别为附件型公告并保留原链接与备注，便于后续人工确认。

3. 为什么接口返回“请先登录”？
- 业务 API 默认都需要登录态，先登录再调用。

4. “来源校验失败，请在同源页面中重试”是什么意思？
- 写操作有来源校验，建议直接在本系统页面发起；反向代理场景请配置 `ALLOWED_ORIGINS`。

## 免责声明

- 本项目用于信息收集与辅助整理，不保证所有高校站点都可 100% 自动识别。
- 部分站点可能存在反爬策略、临时封禁或结构变更，需结合人工核对。

## 自动审核记录

<!-- AUTO_REVIEW_START -->
- 最近审核时间：2026-03-13 23:28:37（Asia/Shanghai）
- 审核命令：`npm run check`
- 当前分支：main
- 最近提交：b5fd6be feat: redesign interface with editorial workspace style
- 当前工作区变更数：1
<!-- AUTO_REVIEW_END -->
