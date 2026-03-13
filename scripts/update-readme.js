const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const README_PATH = path.join(process.cwd(), 'README.md');
const START = '<!-- AUTO_REVIEW_START -->';
const END = '<!-- AUTO_REVIEW_END -->';

function run(cmd, fallback = '') {
  try {
    return String(execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch (_) {
    return fallback;
  }
}

function formatShanghaiTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return formatter.format(date).replace(/\//g, '-');
}

function buildAutoReviewBlock() {
  const now = formatShanghaiTime();
  const branch = run('git branch --show-current', '-');
  const commit = run('git log -1 --pretty=format:%h%x20%s', '-');
  const statusCount = Number(run('git status --short | wc -l', '0')) || 0;
  return [
    START,
    `- 最近审核时间：${now}（Asia/Shanghai）`,
    '- 审核命令：`npm run check`',
    `- 当前分支：${branch || '-'}`,
    `- 最近提交：${commit || '-'}`,
    `- 当前工作区变更数：${statusCount}`,
    END
  ].join('\n');
}

function updateReadme() {
  if (!fs.existsSync(README_PATH)) {
    throw new Error(`README 不存在: ${README_PATH}`);
  }
  const source = fs.readFileSync(README_PATH, 'utf8');
  const block = buildAutoReviewBlock();
  const startIndex = source.indexOf(START);
  const endIndex = source.indexOf(END);
  let next = source;

  if (startIndex >= 0 && endIndex > startIndex) {
    next = `${source.slice(0, startIndex)}${block}${source.slice(endIndex + END.length)}`;
  } else if (source.includes('## 自动审核记录')) {
    next = source.replace('## 自动审核记录', `## 自动审核记录\n\n${block}`);
  } else {
    next = `${source.trimEnd()}\n\n## 自动审核记录\n\n${block}\n`;
  }

  if (next !== source) {
    fs.writeFileSync(README_PATH, next, 'utf8');
    console.log('README 已自动更新: 自动审核记录');
  } else {
    console.log('README 无需更新');
  }
}

updateReadme();
