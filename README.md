# University Announcement Crawling System

一个面向高校公告抓取场景的可视化网页工具，支持院校官网公告抓取、研究生调剂智能导航、复试内容检索、关键词过滤，以及 Markdown 导出。

![CI](https://github.com/guhaigg/University-Announcement-Crawling-System/actions/workflows/ci.yml/badge.svg)

## 功能特点

- 可视化界面操作，适合日常使用，不需要手动写爬虫
- 支持每日定时抓取，也支持一次性自助抓取
- 支持研究生调剂智能导航，自动匹配院校官网、研招页面和学院页面
- 支持复试内容检索，并能显示标题命中、正文命中和命中片段
- 支持关键词筛选、分页浏览、页内预览、Markdown 导出
- 支持固定十所院校快捷查询
- 内置登录鉴权，未登录无法调用业务 API

## 界面模块

- `调剂智能导航`：智能匹配院校和学院的研究生招生入口
- `新公告查询`：按院校快速查看近三日研招公告
- `复试内容检索`：聚焦复试相关内容，支持正文级匹配
- `每日任务`：配置自动抓取计划
- `自助爬取`：手动扫描候选公告并确认抓取
- `Markdown 输出`：浏览、预览、删除已生成文件

## 技术栈

- 后端：`Node.js` + `Express`
- 抓取解析：`axios`、`cheerio`、`iconv-lite`
- 定时任务：`node-cron`
- 前端：原生 `HTML`、`CSS`、`JavaScript`

## 本地运行

要求：

- `Node.js 18+`
- 建议使用 `Node.js 20+`

安装并启动：

```bash
npm install
npm start
```

打开浏览器访问：

```text
http://localhost:3000
```

## 登录说明

首次启动会自动创建默认管理员账号：

- 用户名：`admin`
- 密码：`admin123456`

建议在生产环境通过环境变量覆盖默认账号：

```bash
DEFAULT_ADMIN_USER=your_admin
DEFAULT_ADMIN_PASSWORD=your_strong_password
COOKIE_SECURE=true
```

## 目录结构

- `server.js`：后端服务、抓取逻辑、任务调度、鉴权接口
- `public/index.html`：页面结构
- `public/app.js`：前端交互逻辑
- `public/styles.css`：界面样式
- `data/`：本地配置与用户数据
- `outputs/`：生成的 Markdown 文件

## 常用命令

```bash
npm start
npm run dev
npm run check
```

## GitHub Actions

仓库已配置基础 CI：

- 安装依赖
- 运行 `npm run check`

这样每次推送和 Pull Request 都会自动检查基础语法是否正常。

## 使用建议

- 如果自动匹配不到合适的公告页，优先用页面里的“核对链接”手动确认
- 不同学校网站结构差异较大，学院页、PDF 页、附件页属于正常情况
- 如果要给别人长期使用，建议继续补充多用户隔离、Docker 部署和 HTTPS 反向代理

## 说明

- 本项目适合信息收集与辅助整理，不保证所有高校站点都能 100% 自动识别
- 部分网站存在反爬策略或临时访问限制，查询失败时可稍后重试
