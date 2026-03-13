const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const iconv = require('iconv-lite');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns/promises');
const net = require('net');
const { execFile } = require('child_process');
const { promisify } = require('util');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'outputs');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSION_COOKIE_NAME = 'crawler_sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_USER = String(process.env.DEFAULT_ADMIN_USER || 'admin').trim() || 'admin';
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123456');
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const DEFAULT_ADMIN_PASSWORD_FALLBACK = 'admin123456';
const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LOCK_MS = 10 * 60 * 1000;
const LOGIN_RATE_MAX_ATTEMPTS = 8;
const MUTATING_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const RAW_ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const LINK_HINTS = ['通知', '公告', '新闻', '资讯', 'notice', 'announcement', 'tzgg', 'xwzx', 'news'];
const LIST_URL_HINT_RE = /(list|notice|announcement|tzgg|xwzx|news|tongzhi)/i;
const DETAIL_URL_HINT_RE = /(detail|content|article|show|info)/i;
const ANNOUNCEMENT_URL_RE = /(notice|announcement|notices|tzgg|tongzhi|gonggao|tonggao)/i;
const NON_ANNOUNCE_SECTION_RE = /(ztrd|subject|mtbd|bdrw|jxky|ztwz|dslt)/i;
const GRAD_ENTRY_HINTS = ['研究生', '研招', '招生', 'yjs', 'yz', 'graduate', 'admission'];
const ADJUSTMENT_HINTS = ['调剂', '调剂公告', '调剂通知', '调剂复试', '调剂信息', '接受调剂', 'adjustment', 'transfer'];
const RETEST_HINTS = ['复试', '复试通知', '复试安排', '复试名单', '复试资格', '复试分数线', '复试成绩', '面试', '综合面试', '综合考核'];
const COLLEGE_HINTS = ['学院', '学部', '系', '研究院', '学院官网', 'school', 'college', 'department', 'faculty'];
const MANUAL_PRESET_LIMIT = 10;
const GRAD_PORTAL_URL_RE = /(yjs|yz|gsao|admission|graduate|yjszs|yzb|gra)/i;
const NEWS_PORTAL_URL_RE = /(news|xw|ztrd|mtbd)/i;
const GRAD_PORTAL_HINTS = ['研究生院', '研究生处', '研招网', '研究生招生', 'graduate school', 'grs', 'gsao', 'yjsy', 'yzb'];
const ADMISSION_SECTION_HINTS = ['招生信息', '硕士招生', '博士招生', '招生章程', '招生简章', '专业目录', '复试', '调剂', '分数线'];
const FRIEND_LINK_HINT_RE = /(友情链接|友链|相关链接|常用链接|合作链接|link exchange|friend link|youqing|yqlj|linklist)/i;
const NOISY_SEARCH_HOST_RE =
  /(zhihu\.com|baidu\.com|weibo\.com|douyin\.com|bilibili\.com|xiaohongshu\.com|163\.com|sohu\.com|ifeng\.com|sina\.com|tieba|bbs|forum|thepaper\.cn|csdn\.net)/i;
const MAX_PAGINATION_PAGES = 5;
const KEYWORD_SYNONYM_MAP = {
  调剂: ['调剂', '接受调剂', '调剂公告', '调剂通知', '调剂复试', '调剂信息'],
  复试: ['复试', '面试', '复试名单', '复试安排'],
  研招: ['研究生招生', '研招', '硕士招生', '博士招生', '招生信息'],
  招生: ['招生', '招考', '报名', '录取', '拟录取'],
  奖学金: ['奖学金', '助学金', '资助', '学业奖学金', '国家奖学金']
};

const scheduledJobs = new Map();
const runningTasks = new Set();
const sessions = new Map();
const loginAttemptStore = new Map();
let configMutationQueue = Promise.resolve();
const execFileAsync = promisify(execFile);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public')));

function nowTs() {
  return Date.now();
}

function normalizeOriginValue(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const origin = new URL(raw).origin;
    return origin.toLowerCase().replace(/\/$/, '');
  } catch (error) {
    return '';
  }
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').split(',')[0].trim();
}

function getSocketClientIp(req) {
  const raw = String(req?.socket?.remoteAddress || '').trim();
  if (!raw) return '';
  return raw.replace(/^::ffff:/i, '');
}

function isLoopbackIp(ip) {
  const text = String(ip || '').trim();
  return text === '::1' || text.startsWith('127.');
}

function getRequestBaseOrigin(req) {
  const host = firstHeaderValue(req.headers?.['x-forwarded-host']) || String(req.headers?.host || '').trim();
  if (!host) return '';
  const forwardedProto = firstHeaderValue(req.headers?.['x-forwarded-proto']);
  const protocol = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');
  return normalizeOriginValue(`${protocol}://${host}`);
}

function getAllowedOrigins(req) {
  const list = RAW_ALLOWED_ORIGINS.map((item) => normalizeOriginValue(item)).filter(Boolean);
  const base = getRequestBaseOrigin(req);
  if (base) list.push(base);
  return new Set(list);
}

function getRefererOrigin(req) {
  const referer = String(req.headers?.referer || '').trim();
  if (!referer) return '';
  try {
    return normalizeOriginValue(new URL(referer).origin);
  } catch (error) {
    return '';
  }
}

function isTrustedMutationRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!MUTATING_HTTP_METHODS.has(method)) {
    return true;
  }
  const origin = normalizeOriginValue(firstHeaderValue(req.headers?.origin));
  const refererOrigin = getRefererOrigin(req);
  const candidate = origin || refererOrigin;
  if (!candidate) {
    return isLoopbackIp(getSocketClientIp(req));
  }
  return getAllowedOrigins(req).has(candidate);
}

function purgeExpiredLoginAttempts() {
  const now = nowTs();
  for (const [key, state] of loginAttemptStore.entries()) {
    const blockedUntil = Number(state?.blockedUntil || 0);
    const lastAttemptAt = Number(state?.lastAttemptAt || 0);
    if (!blockedUntil && now - lastAttemptAt > LOGIN_RATE_WINDOW_MS) {
      loginAttemptStore.delete(key);
      continue;
    }
    if (blockedUntil && blockedUntil <= now && now - lastAttemptAt > LOGIN_RATE_WINDOW_MS) {
      loginAttemptStore.delete(key);
    }
  }
}

function buildLoginRateKeys(req, username) {
  const ip = getSocketClientIp(req) || 'unknown';
  const normalizedUser = String(username || '').trim().toLowerCase() || 'unknown';
  return [`ip:${ip}`, `ip_user:${ip}:${normalizedUser}`];
}

function getLoginBlockMs(req, username) {
  purgeExpiredLoginAttempts();
  const keys = buildLoginRateKeys(req, username);
  const now = nowTs();
  let maxRemaining = 0;
  for (const key of keys) {
    const state = loginAttemptStore.get(key);
    if (!state) continue;
    const blockedUntil = Number(state.blockedUntil || 0);
    if (blockedUntil > now) {
      maxRemaining = Math.max(maxRemaining, blockedUntil - now);
    }
  }
  return maxRemaining;
}

function markLoginFailure(req, username) {
  const now = nowTs();
  for (const key of buildLoginRateKeys(req, username)) {
    const prev = loginAttemptStore.get(key) || { failCount: 0, firstAttemptAt: now, blockedUntil: 0, lastAttemptAt: now };
    let failCount = Number(prev.failCount || 0);
    let firstAttemptAt = Number(prev.firstAttemptAt || now);
    const blockedUntil = Number(prev.blockedUntil || 0);
    if (blockedUntil > now) {
      loginAttemptStore.set(key, { ...prev, lastAttemptAt: now });
      continue;
    }
    if (now - firstAttemptAt > LOGIN_RATE_WINDOW_MS) {
      failCount = 0;
      firstAttemptAt = now;
    }
    failCount += 1;
    const next = {
      failCount,
      firstAttemptAt,
      lastAttemptAt: now,
      blockedUntil: failCount >= LOGIN_RATE_MAX_ATTEMPTS ? now + LOGIN_RATE_LOCK_MS : 0
    };
    loginAttemptStore.set(key, next);
  }
}

function clearLoginFailures(req, username) {
  for (const key of buildLoginRateKeys(req, username)) {
    loginAttemptStore.delete(key);
  }
}

function parseCookies(headerValue) {
  const out = {};
  const raw = String(headerValue || '');
  if (!raw) return out;
  const pairs = raw.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hashPassword(password, salt = '') {
  const safeSalt = String(salt || '').trim() || crypto.randomBytes(16).toString('hex');
  const iterations = 120000;
  const keylen = 64;
  const digest = 'sha512';
  const hash = crypto.pbkdf2Sync(String(password || ''), safeSalt, iterations, keylen, digest).toString('hex');
  return {
    salt: safeSalt,
    hash,
    iterations,
    keylen,
    digest
  };
}

function verifyPassword(password, userRecord) {
  if (!userRecord || !userRecord.passwordHash || !userRecord.passwordSalt) return false;
  const iterations = Number(userRecord.passwordIterations) || 120000;
  const keylen = Number(userRecord.passwordKeylen) || 64;
  const digest = String(userRecord.passwordDigest || 'sha512');
  const hash = crypto.pbkdf2Sync(String(password || ''), String(userRecord.passwordSalt), iterations, keylen, digest).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(String(userRecord.passwordHash), 'utf8'));
  } catch (error) {
    return false;
  }
}

function normalizeUserRecord(raw) {
  const item = raw || {};
  return {
    id: String(item.id || '').trim() || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    username: String(item.username || '').trim(),
    passwordHash: String(item.passwordHash || ''),
    passwordSalt: String(item.passwordSalt || ''),
    passwordIterations: Number(item.passwordIterations) || 120000,
    passwordKeylen: Number(item.passwordKeylen) || 64,
    passwordDigest: String(item.passwordDigest || 'sha512'),
    createdAt: String(item.createdAt || new Date().toISOString())
  };
}

async function readUsers() {
  try {
    const raw = await fsp.readFile(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const users = (Array.isArray(parsed.users) ? parsed.users : [])
      .map(normalizeUserRecord)
      .filter((u) => u.username && u.passwordHash && u.passwordSalt);
    return { users };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { users: [] };
    }
    throw error;
  }
}

async function writeUsers(payload) {
  const data = {
    users: (Array.isArray(payload?.users) ? payload.users : []).map(normalizeUserRecord)
  };
  const tmpFile = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmpFile, USERS_FILE);
}

function findUserByUsername(users, username) {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return null;
  return (Array.isArray(users) ? users : []).find((u) => String(u.username || '').trim().toLowerCase() === target) || null;
}

function createSession(user) {
  const sessionId = toBase64Url(crypto.randomBytes(32));
  sessions.set(sessionId, {
    id: sessionId,
    userId: user.id,
    username: user.username,
    createdAt: nowTs(),
    expiresAt: nowTs() + SESSION_TTL_MS
  });
  return sessionId;
}

function purgeExpiredSessions() {
  const ts = nowTs();
  for (const [id, session] of sessions.entries()) {
    if (!session || Number(session.expiresAt) <= ts) {
      sessions.delete(id);
    }
  }
}

function setSessionCookie(res, sessionId) {
  const isSecure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const isSecure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function getSessionFromRequest(req) {
  purgeExpiredSessions();
  const cookies = parseCookies(req.headers?.cookie || '');
  const sid = String(cookies[SESSION_COOKIE_NAME] || '').trim();
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  if (Number(session.expiresAt) <= nowTs()) {
    sessions.delete(sid);
    return null;
  }
  session.expiresAt = nowTs() + SESSION_TTL_MS;
  return session;
}

function authRequired(req, res, next) {
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  if (req.path === '/api/health' || req.path.startsWith('/api/auth/')) {
    return next();
  }
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: '请先登录' });
  }
  if (!isTrustedMutationRequest(req)) {
    return res.status(403).json({ error: '来源校验失败，请在同源页面中重试' });
  }
  req.authUser = {
    id: session.userId,
    username: session.username
  };
  return next();
}

app.use(authRequired);

async function ensureStorage() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });

  if (!fs.existsSync(CONFIG_FILE)) {
    await writeConfig({ tasks: [], manualPresets: [], quickRetestSchools: [], quickNewsSchools: [], quickAdjustmentSchools: [] });
  }
  if (!fs.existsSync(USERS_FILE)) {
    await writeUsers({ users: [] });
  }
  const userData = await readUsers();
  if (!Array.isArray(userData.users) || userData.users.length === 0) {
    if (IS_PRODUCTION && DEFAULT_ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD_FALLBACK) {
      throw new Error('生产环境禁止使用默认管理员密码，请设置 DEFAULT_ADMIN_PASSWORD 后重启');
    }
    const pass = hashPassword(DEFAULT_ADMIN_PASSWORD);
    const admin = normalizeUserRecord({
      id: 'admin',
      username: DEFAULT_ADMIN_USER,
      passwordHash: pass.hash,
      passwordSalt: pass.salt,
      passwordIterations: pass.iterations,
      passwordKeylen: pass.keylen,
      passwordDigest: pass.digest,
      createdAt: new Date().toISOString()
    });
    await writeUsers({ users: [admin] });
    console.log(`[auth] initialized default admin user: ${admin.username}`);
  }
}

async function readConfig(retries = 2) {
  try {
    const raw = await fsp.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map(normalizeTaskRecord);
    const rawPresets = (Array.isArray(parsed.manualPresets) ? parsed.manualPresets : []).map(normalizePresetRecord);
    const rawQuickNewsSchools = (
      Array.isArray(parsed.quickNewsSchools) ? parsed.quickNewsSchools : Array.isArray(parsed.quickRetestSchools) ? parsed.quickRetestSchools : []
    ).map(normalizeQuickRetestSchoolRecord);
    const rawQuickAdjustmentSchools = (Array.isArray(parsed.quickAdjustmentSchools) ? parsed.quickAdjustmentSchools : []).map(normalizeQuickRetestSchoolRecord);
    const manualPresets = [];
    const seen = new Set();
    for (const preset of rawPresets) {
      const key = buildPresetDedupKey(preset);
      if (seen.has(key)) continue;
      seen.add(key);
      manualPresets.push(preset);
      if (manualPresets.length >= MANUAL_PRESET_LIMIT) break;
    }
    const quickNewsSchools = [];
    const quickNewsSeen = new Set();
    for (const school of rawQuickNewsSchools) {
      const key = buildQuickRetestSchoolDedupKey(school);
      if (quickNewsSeen.has(key)) continue;
      quickNewsSeen.add(key);
      quickNewsSchools.push(school);
      if (quickNewsSchools.length >= 10) break;
    }
    const quickAdjustmentSchools = [];
    const quickAdjustmentSeen = new Set();
    for (const school of rawQuickAdjustmentSchools) {
      const key = buildQuickRetestSchoolDedupKey(school);
      if (quickAdjustmentSeen.has(key)) continue;
      quickAdjustmentSeen.add(key);
      quickAdjustmentSchools.push(school);
      if (quickAdjustmentSchools.length >= 10) break;
    }
    return {
      tasks,
      manualPresets,
      quickRetestSchools: quickNewsSchools,
      quickNewsSchools,
      quickAdjustmentSchools
    };
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return readConfig(retries - 1);
    }
    throw error;
  }
}

async function writeConfig(config) {
  const tmpFile = `${CONFIG_FILE}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(config, null, 2), 'utf8');
  await fsp.rename(tmpFile, CONFIG_FILE);
}

function runInConfigMutationQueue(job) {
  const run = configMutationQueue.then(job, job);
  configMutationQueue = run.catch(() => {});
  return run;
}

async function mutateConfig(mutator) {
  return runInConfigMutationQueue(async () => {
    const config = await readConfig();
    const result = await mutator(config);
    await writeConfig(config);
    return result;
  });
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = Number(status) || 500;
  return error;
}

function sanitizeFilename(input) {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

function parseKeywords(input) {
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof input !== 'string') {
    return [];
  }
  return input
    .split(/[，,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseUrlList(input) {
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof input !== 'string') {
    return [];
  }
  return input
    .split(/[，,\n；;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeUrlForKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const u = new URL(text);
    u.hash = '';
    let normalized = u.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch (error) {
    return text;
  }
}

function normalizeMarkdownOutputMode(value) {
  return String(value || '').trim() === 'separate' ? 'separate' : 'merged';
}

async function revealFileInOs(fullPath) {
  const safePath = path.resolve(fullPath);
  if (process.platform === 'darwin') {
    await execFileAsync('open', ['-R', safePath]);
    return;
  }
  if (process.platform === 'win32') {
    await execFileAsync('explorer', ['/select,', safePath]);
    return;
  }
  await execFileAsync('xdg-open', [path.dirname(safePath)]);
}

function normalizeCollegeUrls(input) {
  const tokens = parseUrlList(input);
  const urls = [];
  const invalid = [];
  const seen = new Set();
  for (const token of tokens) {
    if (!isValidHttpUrl(token)) {
      invalid.push(token);
      continue;
    }
    const key = normalizeUrlForKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(String(token).trim());
  }
  return { urls, invalid };
}

function normalizeAnnouncementUrls(input) {
  const tokens = parseUrlList(input);
  const urls = [];
  const invalid = [];
  const seen = new Set();
  for (const token of tokens) {
    if (!isValidHttpUrl(token)) {
      invalid.push(token);
      continue;
    }
    const key = normalizeUrlForKey(token);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    urls.push(String(token).trim());
  }
  return { urls, invalid };
}

function combineAnnouncementUrls(primaryUrl, listInput) {
  const parsed = normalizeAnnouncementUrls(listInput);
  const urls = [];
  const invalid = [...parsed.invalid];
  const seen = new Set();

  const pushUrl = (value) => {
    const url = String(value || '').trim();
    if (!url) return;
    if (!isValidHttpUrl(url)) {
      invalid.push(url);
      return;
    }
    const key = normalizeUrlForKey(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    urls.push(url);
  };

  pushUrl(primaryUrl);
  for (const url of parsed.urls) {
    pushUrl(url);
  }

  return { urls, invalid };
}

function normalizeTaskRecord(taskLike) {
  const task = taskLike || {};
  const crawlMode = normalizeCrawlMode(task.crawlMode);
  const announcementCombined = combineAnnouncementUrls(task.announcementUrl, task.announcementUrls);
  return {
    ...task,
    schoolName: String(task.schoolName || '').trim(),
    homepageUrl: String(task.homepageUrl || '').trim(),
    announcementUrl: announcementCombined.urls[0] || '',
    announcementUrls: announcementCombined.urls,
    keywords: parseKeywords(task.keywords),
    markdownOutputMode: normalizeMarkdownOutputMode(task.markdownOutputMode),
    crawlMode,
    includeCollegePages: normalizeIncludeCollegePages(task.includeCollegePages, crawlMode),
    collegeUrls: normalizeCollegeUrls(task.collegeUrls).urls
  };
}

function normalizePresetRecord(presetLike) {
  const preset = presetLike || {};
  const crawlMode = normalizeCrawlMode(preset.crawlMode);
  const announcementCombined = combineAnnouncementUrls(preset.announcementUrl, preset.announcementUrls);
  return {
    ...preset,
    id: String(preset.id || '').trim() || `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    schoolName: String(preset.schoolName || '').trim() || '未命名院校',
    collegeName: String(preset.collegeName || '').trim(),
    homepageUrl: String(preset.homepageUrl || '').trim(),
    announcementUrl: announcementCombined.urls[0] || '',
    announcementUrls: announcementCombined.urls,
    keywords: parseKeywords(preset.keywords),
    markdownOutputMode: normalizeMarkdownOutputMode(preset.markdownOutputMode),
    crawlMode,
    includeCollegePages: normalizeIncludeCollegePages(preset.includeCollegePages, crawlMode),
    collegeUrls: normalizeCollegeUrls(preset.collegeUrls).urls,
    savedAt: String(preset.savedAt || nowIsoSafe())
  };
}

function normalizeQuickRetestSchoolRecord(recordLike) {
  const record = recordLike || {};
  const schoolName = String(record.schoolName || '').trim();
  const collegeName = String(record.collegeName || '').trim();
  return {
    id: String(record.id || '').trim() || `quick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    schoolName,
    collegeName,
    includeCollegePages: record.includeCollegePages !== false,
    savedAt: String(record.savedAt || nowIsoSafe())
  };
}

function buildPresetDedupKey(presetLike) {
  const preset = normalizePresetRecord(presetLike);
  return normalizeMatchText(preset.schoolName || '');
}

function buildQuickRetestSchoolDedupKey(recordLike) {
  const record = normalizeQuickRetestSchoolRecord(recordLike);
  return [
    normalizeMatchText(record.schoolName || ''),
    normalizeMatchText(record.collegeName || ''),
    record.includeCollegePages ? '1' : '0'
  ].join('::');
}

function upsertQuickSchoolRecords(currentList, record, limit = 10) {
  const current = Array.isArray(currentList) ? currentList.map(normalizeQuickRetestSchoolRecord) : [];
  const normalized = normalizeQuickRetestSchoolRecord(record);
  const output = [];
  const seen = new Set();
  const push = (item) => {
    const target = normalizeQuickRetestSchoolRecord(item);
    if (!target.schoolName) return;
    const key = buildQuickRetestSchoolDedupKey(target);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(target);
  };
  if (normalized.schoolName) {
    if (!normalized.id) {
      normalized.id = `quick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    push(normalized);
  }
  current
    .filter((item) => item.id !== normalized.id)
    .forEach((item) => push(item));
  return output.slice(0, limit);
}

function mergeQuickSchoolRecords(currentList, incomingList, limit = 10) {
  let merged = Array.isArray(currentList) ? currentList.map(normalizeQuickRetestSchoolRecord) : [];
  for (const record of Array.isArray(incomingList) ? incomingList : []) {
    merged = upsertQuickSchoolRecords(merged, record, limit);
  }
  return merged.slice(0, limit);
}

function decorateManualPresets(presets) {
  return presets.map((preset) => {
    const name = String(preset.schoolName || '未命名院校');
    const collegeName = String(preset.collegeName || '').trim();
    const displayName = collegeName ? `${name} / ${collegeName}` : name;
    return { ...preset, displayName };
  });
}

function normalizeCrawlMode(value) {
  return value === 'graduate_adjustment' ? 'graduate_adjustment' : 'general';
}

function getBuiltInKeywords(crawlMode) {
  if (normalizeCrawlMode(crawlMode) === 'graduate_adjustment') {
    return ['调剂', '调剂公告', '调剂通知', '调剂复试', '接受调剂'];
  }
  return [];
}

function normalizeIncludeCollegePages(value, crawlMode) {
  if (typeof value === 'boolean') return value;
  return normalizeCrawlMode(crawlMode) === 'graduate_adjustment';
}

function mergeKeywords(userKeywords, builtInKeywords) {
  return Array.from(
    new Set([...(Array.isArray(userKeywords) ? userKeywords : []), ...(Array.isArray(builtInKeywords) ? builtInKeywords : [])])
  ).filter(Boolean);
}

function countHintHits(text, hints) {
  const lower = String(text || '').toLowerCase();
  let score = 0;
  for (const hint of hints) {
    if (lower.includes(String(hint).toLowerCase())) {
      score += 1;
    }
  }
  return score;
}

function buildCombinedText(link) {
  return `${String(link?.text || '')} ${String(link?.url || '')}`;
}

function isLikelyListPageLink(url, text = '') {
  const lowerUrl = String(url || '').toLowerCase();
  const lowerText = String(text || '').toLowerCase();
  if (/(list|index|column|channel|notice|announcement|tzgg|admission|yjs|yz)/.test(lowerUrl)) return true;
  if (countHintHits(lowerText, ADMISSION_SECTION_HINTS) > 0 && !isLikelyDetailNoticeUrl(url)) return true;
  if (/(通知|公告|招生信息|复试|调剂|分数线|章程|目录)/.test(String(text || ''))) return true;
  return false;
}

function scoreGraduatePortalCandidate(link) {
  const combined = buildCombinedText(link);
  const gradPortalHits = countHintHits(combined, GRAD_PORTAL_HINTS) * 14;
  const gradHits = countHintHits(combined, GRAD_ENTRY_HINTS) * 6;
  const portalBonus = GRAD_PORTAL_URL_RE.test(link.url) ? 36 : 0;
  const newsPenalty = NEWS_PORTAL_URL_RE.test(link.url) ? -36 : 0;
  return gradPortalHits + gradHits + portalBonus + newsPenalty;
}

function isFriendLinkNode($, node, text = '', url = '') {
  const own = `${text} ${url}`;
  if (FRIEND_LINK_HINT_RE.test(own)) return true;

  const parent = $(node).closest('li,div,section,aside,footer,nav');
  const marker = `${parent.attr('id') || ''} ${parent.attr('class') || ''}`;
  if (FRIEND_LINK_HINT_RE.test(marker)) return true;

  const heading = parent.find('h1,h2,h3,h4,strong,b').first().text().trim();
  if (FRIEND_LINK_HINT_RE.test(heading)) return true;

  return false;
}

function scoreAdmissionSectionCandidate(link) {
  const combined = buildCombinedText(link);
  const admissionHits = countHintHits(combined, ADMISSION_SECTION_HINTS) * 10;
  const gradHits = countHintHits(combined, GRAD_ENTRY_HINTS) * 4;
  const adjustHits = countHintHits(combined, ADJUSTMENT_HINTS) * 12;
  const listBonus = isLikelyListPageLink(link.url, link.text) ? 20 : 0;
  const portalBonus = GRAD_PORTAL_URL_RE.test(link.url) ? 10 : 0;
  const newsPenalty = NEWS_PORTAL_URL_RE.test(link.url) ? -30 : 0;
  return admissionHits + gradHits + adjustHits + listBonus + portalBonus + newsPenalty;
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function ipv4ToInt(ip) {
  const parts = String(ip || '')
    .split('.')
    .map((x) => Number(x));
  if (parts.length !== 4 || parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
    return null;
  }
  return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inIpv4Cidr(ip, base, prefix) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

function isBlockedIpv4(ip) {
  const text = String(ip || '').trim();
  if (!text) return true;
  return (
    inIpv4Cidr(text, '0.0.0.0', 8) ||
    inIpv4Cidr(text, '10.0.0.0', 8) ||
    inIpv4Cidr(text, '100.64.0.0', 10) ||
    inIpv4Cidr(text, '127.0.0.0', 8) ||
    inIpv4Cidr(text, '169.254.0.0', 16) ||
    inIpv4Cidr(text, '172.16.0.0', 12) ||
    inIpv4Cidr(text, '192.0.0.0', 24) ||
    inIpv4Cidr(text, '192.0.2.0', 24) ||
    inIpv4Cidr(text, '192.168.0.0', 16) ||
    inIpv4Cidr(text, '198.18.0.0', 15) ||
    inIpv4Cidr(text, '198.51.100.0', 24) ||
    inIpv4Cidr(text, '203.0.113.0', 24) ||
    inIpv4Cidr(text, '224.0.0.0', 4) ||
    inIpv4Cidr(text, '240.0.0.0', 4)
  );
}

function isBlockedIpv6(ip) {
  const text = String(ip || '').trim().toLowerCase();
  if (!text) return true;
  if (text === '::' || text === '::1') return true;
  if (text.startsWith('fe80:')) return true;
  if (text.startsWith('ff')) return true;
  if (text.startsWith('fc') || text.startsWith('fd')) return true;
  if (text.startsWith('2001:db8:')) return true;
  if (text.startsWith('::ffff:')) {
    const mapped = text.slice('::ffff:'.length);
    return isBlockedIpv4(mapped);
  }
  return false;
}

function isBlockedIpAddress(address) {
  const ip = String(address || '').trim();
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

function isBlockedHostName(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return { blocked: true, reason: '空主机名' };
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { blocked: true, reason: '禁止访问 localhost' };
  }
  if (host.endsWith('.local')) {
    return { blocked: true, reason: '禁止访问局域网域名' };
  }
  const ipVersion = net.isIP(host);
  if (ipVersion && isBlockedIpAddress(host)) {
    return { blocked: true, reason: '禁止访问内网或保留地址' };
  }
  return { blocked: false, reason: '' };
}

async function assertSafeRemoteUrl(url, sourceLabel = '抓取任务') {
  if (!isValidHttpUrl(url)) {
    throw new Error(`${sourceLabel}链接非法`);
  }
  const parsed = new URL(url);
  const host = String(parsed.hostname || '').trim().toLowerCase();
  const hostCheck = isBlockedHostName(host);
  if (hostCheck.blocked) {
    throw new Error(`${sourceLabel}被安全策略拦截：${hostCheck.reason}`);
  }
  return parsed.toString();
}

function secureDnsLookup(hostname, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }
  const done = typeof cb === 'function' ? cb : () => {};
  (async () => {
    const host = String(hostname || '').trim().toLowerCase();
    const hostCheck = isBlockedHostName(host);
    if (hostCheck.blocked) {
      throw new Error(`抓取任务被安全策略拦截：${hostCheck.reason}`);
    }

    const hostFamily = net.isIP(host);
    if (hostFamily) {
      if (isBlockedIpAddress(host)) {
        throw new Error('抓取任务被安全策略拦截：禁止访问内网或保留地址');
      }
      return { address: host, family: hostFamily };
    }

    const familyHint = Number(opts?.family || 0);
    const lookupOptions = {
      all: true,
      verbatim: true
    };
    if (familyHint === 4 || familyHint === 6) {
      lookupOptions.family = familyHint;
    }
    const addresses = await dns.lookup(host, lookupOptions);
    if (!Array.isArray(addresses) || !addresses.length) {
      throw new Error('抓取任务域名解析失败');
    }
    if (addresses.some((item) => isBlockedIpAddress(item?.address))) {
      throw new Error('抓取任务被安全策略拦截：禁止访问内网或保留地址');
    }
    const picked = addresses[0];
    return {
      address: picked.address,
      family: Number(picked.family || net.isIP(picked.address) || 4)
    };
  })()
    .then(({ address, family }) => done(null, address, family))
    .catch((error) => done(error));
}

function normalizeUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch (error) {
    return '';
  }
}

function isAnchorOnlyHref(href) {
  return /^#/.test(String(href || '').trim());
}

function isSamePageAnchorUrl(candidateUrl, baseUrl) {
  try {
    const a = new URL(candidateUrl);
    const b = new URL(baseUrl);
    return a.origin === b.origin && a.pathname === b.pathname && !!a.hash && !a.search;
  } catch (error) {
    return false;
  }
}

function getDomainRoot(hostname) {
  const host = String(hostname || '').toLowerCase();
  const specialCn = host.match(/([^.]+\.(edu|gov|com|org)\.cn)$/);
  if (specialCn) return specialCn[1];
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

function isSameDomainFamily(urlA, urlB) {
  try {
    const hostA = new URL(urlA).hostname;
    const hostB = new URL(urlB).hostname;
    return getDomainRoot(hostA) === getDomainRoot(hostB);
  } catch (error) {
    return false;
  }
}

function isLikelyOfficialHomeHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (/\.(edu\.cn|ac\.cn)$/.test(host)) return true;
  if (/(^|\.)(edu|ac)\./.test(host)) return true;
  return false;
}

function isLikelyOfficialHomepageUrl(url) {
  if (!isValidHttpUrl(url)) return false;
  try {
    return isLikelyOfficialHomeHost(new URL(url).hostname);
  } catch (error) {
    return false;
  }
}

function extractSogouRedirectHtmlUrl(html) {
  const text = String(html || '');
  if (!text) return '';
  const patterns = [
    /window\.location\.replace\("([^"]+)"\)/i,
    /window\.location\s*=\s*"([^"]+)"/i,
    /URL='([^']+)'/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && isValidHttpUrl(match[1])) {
      return match[1];
    }
  }
  return '';
}

async function resolveSogouRedirectUrl(url) {
  if (!isValidHttpUrl(url)) return '';
  try {
    const u = new URL(url);
    if (!/sogou\.com$/i.test(u.hostname) || !/^\/link/i.test(u.pathname)) {
      return url;
    }

    const { response } = await safeHttpGet(url, {
      timeout: 12000,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.sogou.com/'
      },
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400
    });
    const redirected = extractSogouRedirectHtmlUrl(response.data);
    if (redirected) return redirected;
  } catch (error) {
    // ignore
  }
  return url;
}

async function searchBingWeb(query, limit = 12) {
  const q = String(query || '').trim();
  if (!q) return [];
  const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(q)}`;
  const { html } = await fetchHtml(searchUrl);
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  $('li.b_algo').each((_, node) => {
    const a = $(node).find('h2 a').first();
    const href = String(a.attr('href') || '').trim();
    const title = normalizeText(a.text());
    const snippet = normalizeText($(node).find('.b_caption p').first().text());
    if (!href || !title || !isValidHttpUrl(href)) return;
    if (seen.has(href)) return;
    seen.add(href);
    out.push({ title, url: href, snippet });
  });

  return out.slice(0, limit);
}

async function searchSogouWeb(query, limit = 12) {
  const q = String(query || '').trim();
  if (!q) return [];
  const searchUrl = `https://www.sogou.com/web?query=${encodeURIComponent(q)}`;
  const { html } = await fetchHtml(searchUrl);
  const $ = cheerio.load(html);
  const rawItems = [];
  const seen = new Set();

  const pushItem = (title, href, snippet = '') => {
    const rawHref = String(href || '').trim();
    const rawTitle = normalizeText(title);
    if (!rawHref || !rawTitle) return;
    let absHref = rawHref;
    if (/^\/link\?/i.test(rawHref)) {
      absHref = `https://www.sogou.com${rawHref}`;
    }
    const dedupKey = `${rawTitle}@@${absHref}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    rawItems.push({ title: rawTitle, url: absHref, snippet: normalizeText(snippet) });
  };

  $('h3 a[href]').each((_, node) => {
    const a = $(node);
    const href = a.attr('href');
    const title = a.text();
    const snippet =
      a.closest('.vrwrap').find('.str_box, .text-layout, .ft').first().text() ||
      a.closest('.rb').find('.str_box, .text-layout, .ft').first().text();
    pushItem(title, href, snippet);
  });

  const resolved = [];
  for (const item of rawItems.slice(0, Math.min(limit * 2, 24))) {
    const finalUrl = await resolveSogouRedirectUrl(item.url);
    if (!isValidHttpUrl(finalUrl)) continue;
    resolved.push({
      title: item.title,
      url: finalUrl,
      snippet: item.snippet
    });
    if (resolved.length >= limit) break;
  }
  return resolved;
}

function scoreOfficialHomepageCandidate(item, schoolName) {
  const title = String(item.title || '');
  const url = String(item.url || '');
  const snippet = String(item.snippet || '');
  const combined = `${title} ${url} ${snippet}`;
  let score = 0;

  if (title.includes(schoolName)) score += 80;
  if (combined.includes('官网')) score += 20;
  if (combined.includes('大学')) score += 15;
  if (countHintHits(combined, GRAD_ENTRY_HINTS) > 0) score += 10;
  if (/研究生招生网|研究生处|研究生院|招生网|招生信息网/.test(title)) score -= 26;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const root = getDomainRoot(host);
    const officialHost = isLikelyOfficialHomeHost(host);
    if (host === root || host === `www.${root}`) {
      score += 22;
    } else {
      score -= 22;
    }
    if (host.startsWith('www.')) score += 8;
    if (officialHost) score += 90;
    else score -= 36;
    if (!u.pathname || u.pathname === '/') score += 22;
    if (u.pathname.length <= 12) score += 6;
    if (/(www|main|index)/i.test(u.pathname)) score += 5;
    if (NOISY_SEARCH_HOST_RE.test(host)) score -= 260;
  } catch (error) {
    score -= 20;
  }

  if (/(login|cas|portal|jwc|oa|mail|baike|weibo|chsi|zhihu|baidu)/i.test(combined)) score -= 50;
  if (/(bbs|forum|tieba|univs\.cn|zhongan|bilibili)/i.test(combined)) score -= 70;
  if (/研究生处|研究生院|研招/.test(combined)) score += 8;
  return score;
}

function pickOfficialHomepage(searchItems, schoolName) {
  const candidates = [];
  const byOrigin = new Map();

  for (const item of searchItems) {
    if (!isValidHttpUrl(item.url)) continue;
    const score = scoreOfficialHomepageCandidate(item, schoolName);
    const u = new URL(item.url);
    const key = u.origin;
    const current = byOrigin.get(key);
    if (!current || current.score < score) {
      byOrigin.set(key, { ...item, score });
    }
  }

  candidates.push(...Array.from(byOrigin.values()).sort((a, b) => b.score - a.score));
  if (!candidates.length) {
    throw new Error('未搜索到可用官网候选，请手动输入官网链接。');
  }

  const usableCandidates = candidates.filter((item) => item.score > -40);
  if (!usableCandidates.length) {
    throw new Error('未搜索到可用官网候选，请手动输入官网链接。');
  }

  const rootStats = new Map();
  for (const item of usableCandidates) {
    try {
      const u = new URL(item.url);
      if (!isLikelyOfficialHomeHost(u.hostname)) continue;
      if (/(bbs|forum|tieba)/i.test(u.hostname)) continue;
      const root = getDomainRoot(u.hostname);
      const prev = rootStats.get(root) || 0;
      rootStats.set(root, prev + Math.max(0, item.score));
    } catch (error) {
      continue;
    }
  }

  let homepageUrl = '';
  let topRoot = '';
  if (rootStats.size) {
    topRoot = Array.from(rootStats.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const preferredOrigins = [`https://www.${topRoot}`, `https://${topRoot}`];
    const matched = usableCandidates.find((item) => {
      try {
        const origin = new URL(item.url).origin.toLowerCase();
        return preferredOrigins.some((target) => target.toLowerCase() === origin);
      } catch (error) {
        return false;
      }
    });
    if (matched) {
      homepageUrl = `${new URL(matched.url).origin}/`;
    } else {
      homepageUrl = `https://www.${topRoot}/`;
    }
  }

  if (!homepageUrl) {
    const best =
      usableCandidates.find((item) => {
        try {
          return isLikelyOfficialHomeHost(new URL(item.url).hostname);
        } catch (error) {
          return false;
        }
      }) || usableCandidates[0];
    const bestUrl = new URL(best.url);
    homepageUrl = `${bestUrl.origin}/`;
  }

  return {
    homepageUrl,
    homepageCandidates: usableCandidates.slice(0, 8)
  };
}

function scoreGradSearchCandidate(item, schoolName, homepageUrl) {
  const combined = `${item.title || ''} ${item.url || ''} ${item.snippet || ''}`;
  let score =
    countHintHits(combined, GRAD_ENTRY_HINTS) * 14 +
    countHintHits(combined, ADMISSION_SECTION_HINTS) * 10 +
    countHintHits(combined, ADJUSTMENT_HINTS) * 12;

  if (combined.includes(schoolName)) score += 30;
  if (isLikelyListPageLink(item.url, item.title)) score += 24;
  if (isLikelyDetailNoticeUrl(item.url)) score -= 14;
  if (GRAD_PORTAL_URL_RE.test(item.url)) score += 18;
  if (NEWS_PORTAL_URL_RE.test(item.url)) score -= 25;
  if (isSameDomainFamily(item.url, homepageUrl)) score += 28;
  else score -= 14;
  return score;
}

function pickSuggestedAnnouncementCandidate(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (!list.length) return null;
  const isFileUrl = (url) => /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)(\?|$)/i.test(String(url || ''));
  const isArticleUrl = (url) => /\/info\/\d+\/\d+\.htm|detail|article|content|show|\/docs\/\d{6,}/i.test(String(url || '').toLowerCase());
  const preferred = list.find((item) => {
    const combined = `${item.text || ''} ${item.url || ''}`;
    return (
      !isFileUrl(item.url) &&
      !isArticleUrl(item.url) &&
      isLikelyListPageLink(item.url, item.text || '') &&
      (countHintHits(combined, ADMISSION_SECTION_HINTS) > 0 || /招生/.test(combined))
    );
  });
  if (preferred) return preferred;
  const gradList = list.find((item) => {
    const combined = `${item.text || ''} ${item.url || ''}`;
    return (
      !isFileUrl(item.url) &&
      !isArticleUrl(item.url) &&
      isLikelyListPageLink(item.url, item.text || '') &&
      countHintHits(combined, GRAD_ENTRY_HINTS) > 0 &&
      (countHintHits(combined, ADMISSION_SECTION_HINTS) > 0 || /招生|admission|zsxx|tzgg|notice/i.test(combined))
    );
  });
  if (gradList) return gradList;
  const secondary = list.find((item) => isLikelyListPageLink(item.url, item.text || ''));
  if (secondary) return secondary;
  return list[0];
}

function normalizeCollegeTokens(collegeName) {
  const raw = String(collegeName || '').trim();
  if (!raw) return [];
  const trimmed = raw.replace(/\s+/g, '');
  const base = trimmed.replace(/(学院|学部|研究院|系)$/g, '');
  const tokens = [trimmed, base].filter((x) => x && x.length >= 2);
  return Array.from(new Set(tokens));
}

function textContainsCollegeToken(text, tokens) {
  const source = String(text || '');
  return tokens.some((token) => source.includes(token));
}

function normalizeLikelyHomepageUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || '').trim());
    const pathName = u.pathname || '/';
    const lower = pathName.toLowerCase();
    const withSlash = (p) => (p.endsWith('/') ? p : `${p}/`);
    if (!pathName || pathName === '/') {
      return `${u.origin}/`;
    }

    if (/\/(index|default|main|home)\.(s?html?|php|jsp|aspx)$/i.test(lower)) {
      const dir = pathName.slice(0, pathName.lastIndexOf('/') + 1) || '/';
      return `${u.origin}${withSlash(dir)}`;
    }

    if (/\.(s?html?|php|jsp|aspx)$/.test(lower) || /\/(info|article|show|detail|content)\//.test(lower)) {
      const segments = pathName.split('/').filter(Boolean);
      if (segments.length && /^20\d{2}$/.test(segments[0])) {
        return `${u.origin}/`;
      }
      if (segments.length >= 1 && segments[0].length <= 24) {
        return `${u.origin}/${segments[0]}/`;
      }
      return `${u.origin}/`;
    }

    const segments = pathName.split('/').filter(Boolean);
    if (segments.length && /^20\d{2}$/.test(segments[0])) {
      return `${u.origin}/`;
    }
    if (segments.length <= 2) {
      return `${u.origin}${withSlash(pathName)}`;
    }
    return `${u.origin}/${segments[0]}/`;
  } catch (error) {
    return String(rawUrl || '').trim();
  }
}

function scoreCollegeHomepageCandidate(item, schoolName, collegeName, schoolHomepageUrl) {
  const combined = `${item.title || ''} ${item.url || ''} ${item.snippet || ''}`;
  const collegeTokens = normalizeCollegeTokens(collegeName);
  const schoolHomepageLooksOfficial = isLikelyOfficialHomepageUrl(schoolHomepageUrl);
  let score = 0;

  if (combined.includes(schoolName)) score += 28;
  if (combined.includes(collegeName)) score += 62;
  if (textContainsCollegeToken(combined, collegeTokens)) score += 26;
  if (/(学院|学部|系|department|school|faculty)/i.test(combined)) score += 16;
  if (countHintHits(combined, GRAD_ENTRY_HINTS) > 0) score += 12;
  if (countHintHits(combined, ADMISSION_SECTION_HINTS) > 0) score += 12;
  if (/官网|官方网站/.test(combined)) score += 10;
  if (isLikelyListPageLink(item.url, item.title || '')) score += 8;
  if (isLikelyDetailNoticeUrl(item.url)) score -= 120;

  try {
    const parsed = new URL(item.url);
    const host = parsed.hostname;
    const pathname = parsed.pathname || '/';
    if (!pathname || pathname === '/') score += 48;
    if (/\/20\d{2}\//.test(pathname)) score -= 90;
    if (/\/c\d+a\d+\/page\.htm/i.test(pathname)) score -= 120;
    if (isLikelyOfficialHomeHost(host)) score += 42;
    else score -= 26;
  } catch (error) {
    score -= 16;
  }

  if (schoolHomepageLooksOfficial) {
    if (schoolHomepageUrl && isSameDomainFamily(item.url, schoolHomepageUrl)) score += 26;
    else score -= 14;
  }

  if (/(login|cas|portal|jwc|oa|mail|baike|weibo|zhihu|bbs|forum|tieba)/i.test(combined)) score -= 48;
  return score;
}

function scoreCollegeGradLinkCandidate(item, schoolHomepageUrl, collegeName) {
  const combined = `${item.text || ''} ${item.url || ''}`;
  const collegeTokens = normalizeCollegeTokens(collegeName);
  const schoolHomepageLooksOfficial = isLikelyOfficialHomepageUrl(schoolHomepageUrl);
  let score =
    countHintHits(combined, GRAD_ENTRY_HINTS) * 14 +
    countHintHits(combined, ADMISSION_SECTION_HINTS) * 12 +
    countHintHits(combined, ADJUSTMENT_HINTS) * 12;
  if (textContainsCollegeToken(combined, collegeTokens)) score += 26;
  if (isLikelyListPageLink(item.url, item.text || '')) score += 18;
  if (isLikelyDetailNoticeUrl(item.url)) score -= 10;
  if (schoolHomepageLooksOfficial && schoolHomepageUrl && isSameDomainFamily(item.url, schoolHomepageUrl)) score += 14;
  try {
    if (isLikelyOfficialHomeHost(new URL(item.url).hostname)) score += 20;
  } catch (error) {
    // ignore
  }
  return score;
}

async function smartMatchCollegeSite(schoolName, collegeName, schoolHomepageUrl, options = {}) {
  const includeCollegePages = options.includeCollegePages !== false;
  const normalizedCollege = String(collegeName || '').trim();
  if (!normalizedCollege) return null;

  const queries = [
    `${schoolName}${normalizedCollege} 官网`,
    `${schoolName} ${normalizedCollege} 官网`,
    `${schoolName}${normalizedCollege} 研究生招生`,
    `${schoolName} ${normalizedCollege} 招生信息`,
    `${schoolName}${normalizedCollege} site:edu.cn`,
    `${schoolName} ${normalizedCollege} site:edu.cn`
  ];

  const bingResultSets = await Promise.all(
    queries.map((q) =>
      searchBingWeb(q, 10).catch(() => {
        return [];
      })
    )
  );
  const sogouResultSets = await Promise.all(
    queries.slice(0, 4).map((q) =>
      searchSogouWeb(q, 8).catch(() => {
        return [];
      })
    )
  );
  const merged = [];
  const seen = new Set();
  for (const set of [...bingResultSets, ...sogouResultSets]) {
    for (const item of set) {
      const key = normalizeUrlForKey(item.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  if (!merged.length) return null;

  const homepageCandidates = merged
    .map((item) => ({
      ...item,
      score: scoreCollegeHomepageCandidate(item, schoolName, normalizedCollege, schoolHomepageUrl)
    }))
    .filter((item) => item.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  if (!homepageCandidates.length) return null;
  const matchedHomepageUrl = normalizeLikelyHomepageUrl(homepageCandidates[0].url);
  if (!isValidHttpUrl(matchedHomepageUrl)) return null;

  const candidateMap = new Map();
  const addCandidate = (item, source) => {
    if (!item || !isValidHttpUrl(item.url)) return;
    const key = normalizeUrlForKey(item.url);
    const score = scoreCollegeGradLinkCandidate(item, schoolHomepageUrl, normalizedCollege);
    const old = candidateMap.get(key);
    if (!old || old.score < score) {
      candidateMap.set(key, {
        text: item.text || item.title || item.url,
        url: item.url,
        score,
        source
      });
    }
  };

  addCandidate({ text: `${normalizedCollege}官网`, url: matchedHomepageUrl }, 'college_home');

  try {
    const discovered = await discoverGraduateAdjustmentLinks(matchedHomepageUrl, { includeCollegePages, returnMeta: true });
    (discovered.announcementCandidates || []).forEach((item) => addCandidate(item, 'college_discovery'));
  } catch (error) {
    // ignore
  }
  try {
    const discovered = await discoverAnnouncementLinks(matchedHomepageUrl, 'graduate_adjustment');
    discovered.forEach((item) => addCandidate(item, 'college_discovery'));
  } catch (error) {
    // ignore
  }

  const announcementCandidates = Array.from(candidateMap.values())
    .filter((x) => x.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    collegeName: normalizedCollege,
    matchedHomepageUrl,
    homepageCandidates,
    announcementCandidates
  };
}

async function smartMatchGraduateBySchoolName(schoolName, options = {}) {
  const includeCollegePages = options.includeCollegePages !== false;
  const collegeName = String(options.collegeName || '').trim();
  const normalizedName = String(schoolName || '').trim();
  if (!normalizedName) {
    throw new Error('schoolName 不能为空');
  }

  const queries = [
    `${normalizedName} 官网`,
    `${normalizedName} 研究生院`,
    `${normalizedName} 研究生招生`,
    `${normalizedName} 研招网`,
    `${normalizedName} 招生信息 site:edu.cn`
  ];

  const bingResultSets = await Promise.all(
    queries.map((q) =>
      searchBingWeb(q, 12).catch(() => {
        return [];
      })
    )
  );
  const sogouResultSets = await Promise.all(
    [queries[0], queries[1], queries[2]].map((q) =>
      searchSogouWeb(q, 10).catch(() => {
        return [];
      })
    )
  );
  const merged = [];
  const seen = new Set();
  for (const set of [...bingResultSets, ...sogouResultSets]) {
    for (const item of set) {
      const key = normalizeUrlForKey(item.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  if (!merged.length) {
    throw new Error('未检索到结果，请稍后重试或手动输入官网链接。');
  }

  const picked = pickOfficialHomepage(merged, normalizedName);
  let homepageUrl = picked.homepageUrl;
  const collegeProfile = await smartMatchCollegeSite(normalizedName, collegeName, homepageUrl, { includeCollegePages });

  if (collegeProfile?.matchedHomepageUrl && (!isLikelyOfficialHomepageUrl(homepageUrl) || !isSameDomainFamily(homepageUrl, collegeProfile.matchedHomepageUrl))) {
    try {
      const matchedHost = new URL(collegeProfile.matchedHomepageUrl).hostname;
      const root = getDomainRoot(matchedHost);
      if (/\.(edu\.cn|ac\.cn)$/i.test(root)) {
        homepageUrl = `https://${root}/`;
      }
    } catch (error) {
      // ignore
    }
  }

  const resources = await discoverGraduateAdjustmentLinks(homepageUrl, { includeCollegePages, returnMeta: true }).catch(() => ({
    announcementCandidates: [],
    collegeCandidates: []
  }));

  const gradSearchCandidates = merged
    .map((item) => ({ ...item, score: scoreGradSearchCandidate(item, normalizedName, homepageUrl) }))
    .filter((x) => x.score > 18)
    .filter((x) => isSameDomainFamily(x.url, homepageUrl))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map((x) => ({ text: x.title, url: x.url, score: x.score }));

  const announcementMap = new Map();
  for (const item of resources.announcementCandidates || []) {
    announcementMap.set(normalizeUrlForKey(item.url), { ...item, source: 'site_discovery' });
  }
  for (const item of gradSearchCandidates) {
    const key = normalizeUrlForKey(item.url);
    const old = announcementMap.get(key);
    if (!old || old.score < item.score) {
      announcementMap.set(key, { ...item, source: 'web_search' });
    }
  }

  const scoredAnnouncementCandidates = Array.from(announcementMap.values())
    .filter((x) => isValidHttpUrl(x.url))
    .map((x) => {
      const combined = `${x.text || ''} ${x.url || ''}`;
      const sameDomainBonus = isSameDomainFamily(x.url, homepageUrl) ? 60 : -80;
      const sourceBonus = x.source === 'site_discovery' ? 100 : 0;
      const listBonus = isLikelyListPageLink(x.url, x.text || '') ? 44 : 0;
      const detailPenalty = isLikelyDetailNoticeUrl(x.url) ? -76 : 0;
      const admissionBonus = countHintHits(combined, ADMISSION_SECTION_HINTS) * 18;
      const adjustBonus = countHintHits(combined, ADJUSTMENT_HINTS) * 12;
      const overviewPenalty = /(概况|领导|index\/|\/index\.htm)/i.test(combined) ? -55 : 0;
      return {
        ...x,
        rankScore: (x.score || 0) + sameDomainBonus + sourceBonus + listBonus + detailPenalty + admissionBonus + adjustBonus + overviewPenalty
      };
    });

  const topListRank = scoredAnnouncementCandidates
    .filter((x) => isLikelyListPageLink(x.url, x.text || ''))
    .sort((a, b) => b.rankScore - a.rankScore)[0]?.rankScore;

  const announcementCandidates = scoredAnnouncementCandidates
    .filter((x) => x.rankScore > 20)
    .filter((x) => {
      if (!topListRank) return true;
      if (!isLikelyDetailNoticeUrl(x.url)) return true;
      return x.rankScore >= topListRank - 30;
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 20);

  const collegeMap = new Map();
  for (const item of resources.collegeCandidates || []) {
    collegeMap.set(normalizeUrlForKey(item.url), item);
  }
  const collegeCandidates = Array.from(collegeMap.values())
    .filter((x) => isValidHttpUrl(x.url))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 20);

  if (collegeProfile) {
    for (const item of collegeProfile.announcementCandidates || []) {
      const key = normalizeUrlForKey(item.url);
      const old = collegeMap.get(key);
      if (!old || (old.score || 0) < (item.score || 0)) {
        collegeMap.set(key, {
          text: item.text,
          url: item.url,
          score: item.score,
          source: item.source || 'college_match'
        });
      }
    }
  }

  const mergedCollegeCandidates = Array.from(collegeMap.values())
    .filter((x) => isValidHttpUrl(x.url))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 24);

  const suggestedAnnouncement = pickSuggestedAnnouncementCandidate(announcementCandidates);
  const suggestedCollegeUrls = mergedCollegeCandidates.slice(0, 8).map((x) => x.url);

  return {
    schoolName: normalizedName,
    collegeName,
    homepageUrl,
    homepageCandidates: picked.homepageCandidates,
    announcementCandidates,
    collegeCandidates: mergedCollegeCandidates,
    collegeProfile,
    suggestedAnnouncementUrl: suggestedAnnouncement?.url || '',
    suggestedCollegeUrls,
    includeCollegePages
  };
}

function pad2(value) {
  return String(Number(value) || 0).padStart(2, '0');
}

function buildLocalDateSafe(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatLocalDateKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function extractPublishedDate(item) {
  const source = `${item?.dateHint || ''} ${item?.title || ''} ${item?.url || ''}`;
  const patterns = [
    /(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})/,
    /\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/,
    /\/(20\d{2})\/(\d{2})(\d{2})(?:\/|$)/,
    /\b(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])\b/
  ];
  for (const pattern of patterns) {
    const match = String(source || '').match(pattern);
    if (!match) continue;
    const date = buildLocalDateSafe(match[1], match[2], match[3]);
    if (date) return date;
  }
  return null;
}

function getRecentDayInfo(publishedDate, todayStart) {
  if (!publishedDate) {
    return { bucket: 'other', label: '未知日期', diff: null };
  }
  const diff = Math.round((todayStart.getTime() - publishedDate.getTime()) / 86400000);
  if (diff === 0) return { bucket: 'today', label: '今日', diff };
  if (diff === 1) return { bucket: 'yesterday', label: '昨日', diff };
  if (diff === 2) return { bucket: 'day_before', label: '前日', diff };
  return { bucket: 'other', label: diff > 2 ? `更早(${diff}天前)` : '未来日期', diff };
}

function isLikelyGraduateNoticeItem(item) {
  const source = `${item?.title || ''} ${item?.url || ''}`;
  if (countHintHits(source, GRAD_ENTRY_HINTS) > 0) return true;
  if (countHintHits(source, ADMISSION_SECTION_HINTS) > 0) return true;
  if (countHintHits(source, ADJUSTMENT_HINTS) > 0) return true;
  return /(研究生|研招|硕士|博士|招生|复试|调剂|拟录取|录取)/.test(source);
}

function isLikelyRetestNoticeItem(item) {
  const source = `${item?.title || ''} ${item?.url || ''}`;
  if (countHintHits(source, RETEST_HINTS) > 0) return true;
  if (/(复试|面试|综合考核|资格审查|复试线|复试成绩|复试名单)/.test(source)) return true;
  return false;
}

function countRetestSignals(text) {
  const source = String(text || '');
  if (!source) return 0;
  let score = countHintHits(source, RETEST_HINTS);
  if (/(复试|面试|综合考核|资格审查|复试线|复试成绩|复试名单|复试安排|复试细则|调剂复试|同等学力加试)/.test(source)) {
    score += 2;
  }
  return score;
}

function extractRetestSnippet(text) {
  const lines = normalizeText(text)
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
  if (!lines.length) return '';
  const marker = /(复试|面试|综合考核|资格审查|复试名单|复试安排|复试成绩|复试线|调剂复试|同等学力加试)/;
  const hit = lines.find((line) => marker.test(line));
  const source = hit || lines[0] || '';
  return source.length > 120 ? `${source.slice(0, 117)}...` : source;
}

function mergeRetestMatch(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing };
  const titleHits = Math.max(existing.retestTitleHits || 0, incoming.retestTitleHits || 0);
  const contentHits = Math.max(existing.retestContentHits || 0, incoming.retestContentHits || 0);
  merged.retestTitleHits = titleHits;
  merged.retestContentHits = contentHits;
  merged.retestHits = titleHits + contentHits;
  if (titleHits > 0 && contentHits > 0) {
    merged.retestMatchedBy = 'both';
  } else if (contentHits > 0) {
    merged.retestMatchedBy = 'content';
  } else if (titleHits > 0) {
    merged.retestMatchedBy = 'title';
  } else {
    merged.retestMatchedBy = 'none';
  }
  if (incoming.retestSnippet && !merged.retestSnippet) {
    merged.retestSnippet = incoming.retestSnippet;
  }
  if (incoming.rankScore > merged.rankScore) {
    merged.rankScore = incoming.rankScore;
  }
  return merged;
}

async function enrichRetestNoticesByContent(notices, maxInspect = 28) {
  const source = Array.isArray(notices) ? notices : [];
  if (!source.length) return [];

  const outputMap = new Map();
  const inspectQueue = [];
  for (const item of source) {
    const titleHits = countRetestSignals(`${item.title || ''} ${item.url || ''}`);
    const normalized = {
      ...item,
      retestTitleHits: titleHits,
      retestContentHits: 0,
      retestHits: titleHits,
      retestMatchedBy: titleHits > 0 ? 'title' : 'none',
      retestSnippet: ''
    };
    const key = `${normalizeUrlForKey(item.url)}::${normalizeMatchText(item.title || '')}`;
    if (titleHits > 0) {
      outputMap.set(key, normalized);
      continue;
    }

    if (inspectQueue.length >= maxInspect) continue;
    if (item.dayBucket !== 'other' || inspectQueue.length < Math.ceil(maxInspect / 2)) {
      inspectQueue.push(normalized);
    }
  }

  const detailJobs = inspectQueue.map(async (item) => {
    try {
      const detail = await fetchNoticeDetail({
        title: item.title,
        url: item.url,
        dateHint: item.dateHint || ''
      });
      const attachmentText = Array.isArray(detail.attachments) ? detail.attachments.map((x) => x.name).join(' ') : '';
      const retestContentHits = countRetestSignals(`${detail.title || ''}\n${detail.content || ''}\n${attachmentText}`);
      if (retestContentHits <= 0) return null;
      return {
        ...item,
        title: detail.title || item.title,
        url: detail.url || item.url,
        dateHint: item.dateHint || detail.dateHint || '',
        retestTitleHits: item.retestTitleHits || 0,
        retestContentHits,
        retestHits: (item.retestTitleHits || 0) + retestContentHits,
        retestMatchedBy: item.retestTitleHits > 0 ? 'both' : 'content',
        retestSnippet: extractRetestSnippet(detail.content || ''),
        rankScore: (item.rankScore || 0) + retestContentHits * 14
      };
    } catch (error) {
      return null;
    }
  });
  const detailMatches = (await Promise.all(detailJobs)).filter(Boolean);
  for (const item of detailMatches) {
    const key = `${normalizeUrlForKey(item.url)}::${normalizeMatchText(item.title || '')}`;
    const existing = outputMap.get(key);
    outputMap.set(key, mergeRetestMatch(existing, item));
  }

  return Array.from(outputMap.values());
}

function buildGraduateNewsPageCandidates(profile) {
  const map = new Map();
  const push = (item, source, baseScore = 0) => {
    const url = String(item?.url || item || '').trim();
    if (!isValidHttpUrl(url)) return;
    const key = normalizeUrlForKey(url);
    if (!key) return;
    const text = String(item?.text || item?.title || url).trim();
    const combined = `${text} ${url}`;
    let score = Number(item?.rankScore || item?.score || 0) + Number(baseScore || 0);
    if (isLikelyListPageLink(url, text)) score += 120;
    if (isLikelyDetailNoticeUrl(url) && !isNoticeDocumentUrl(url)) score -= 80;
    if (isNoticeDocumentUrl(url)) score += 30;
    score += countHintHits(combined, GRAD_ENTRY_HINTS) * 18;
    score += countHintHits(combined, ADMISSION_SECTION_HINTS) * 16;
    score += countHintHits(combined, ADJUSTMENT_HINTS) * 12;
    const old = map.get(key);
    if (!old || old.score < score) {
      map.set(key, { text, url, source, score });
    }
  };

  push(profile?.suggestedAnnouncementUrl, 'suggested', 280);
  (profile?.announcementCandidates || []).slice(0, 24).forEach((item) => push(item, 'announcement', 120));
  (profile?.collegeProfile?.announcementCandidates || []).slice(0, 16).forEach((item) => push(item, 'college_announcement', 90));
  (profile?.collegeCandidates || []).slice(0, 18).forEach((item) => push(item, 'college_page', 60));

  const ranked = Array.from(map.values()).sort((a, b) => b.score - a.score);
  const preferred = ranked.filter((item) => item.score > 20).slice(0, 18);
  if (preferred.length) return preferred;
  return ranked.slice(0, 12);
}

async function queryGraduateRecentNoticesBySchoolName(options = {}) {
  const schoolName = String(options.schoolName || '').trim();
  const collegeName = String(options.collegeName || '').trim();
  const includeCollegePages = options.includeCollegePages !== false;
  const focus = String(options.focus || 'general') === 'retest' ? 'retest' : 'general';
  if (!schoolName) {
    throw new Error('请输入院校名称');
  }

  const profile = await smartMatchGraduateBySchoolName(schoolName, { collegeName, includeCollegePages });
  const pageCandidates = buildGraduateNewsPageCandidates(profile);
  if (!pageCandidates.length) {
    throw new Error('未匹配到可用研招公告页');
  }
  const guidanceKeywords = mergeKeywords(
    focus === 'retest'
      ? ['复试', '复试通知', '复试安排', '复试名单', '面试', '综合考核', '资格审查', '复试成绩']
      : ['研究生', '研招', '招生', '复试', '调剂', '录取', '拟录取'],
    getBuiltInKeywords('graduate_adjustment')
  );

  const evaluateJobs = pageCandidates.map(async (candidate) => {
    try {
      const evaluated = await evaluateAnnouncementPage(candidate.url, guidanceKeywords, 'graduate_adjustment');
      evaluated.requestedUrl = candidate.url;
      evaluated.requestedText = candidate.text;
      evaluated.candidateSource = candidate.source;
      evaluated.rankScore = (evaluated.score || 0) + (candidate.score || 0);
      return evaluated;
    } catch (error) {
      return null;
    }
  });

  const evaluatedPages = (await Promise.all(evaluateJobs)).filter(Boolean);
  if (!evaluatedPages.length) {
    throw new Error('未能读取研招公告列表页');
  }
  evaluatedPages.sort((a, b) => (b.rankScore || b.score || 0) - (a.rankScore || a.score || 0));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayStart.getTime() - 86400000);
  const dayBefore = new Date(todayStart.getTime() - 86400000 * 2);
  const dayRange = {
    today: formatLocalDateKey(todayStart),
    yesterday: formatLocalDateKey(yesterday),
    dayBefore: formatLocalDateKey(dayBefore)
  };

  const noticeMap = new Map();
  for (const page of evaluatedPages.slice(0, 8)) {
    for (const item of (page.allItems || []).slice(0, 160)) {
      if (!item?.title || !item?.url) continue;
      if (!isLikelyGraduateNoticeItem(item)) {
        continue;
      }
      const publishedDate = extractPublishedDate(item);
      const dayInfo = getRecentDayInfo(publishedDate, todayStart);
      const dateKey = publishedDate ? formatLocalDateKey(publishedDate) : '';
      const key = `${normalizeUrlForKey(item.url)}::${normalizeMatchText(item.title)}`;
      const retestTitleHits = countRetestSignals(`${item.title} ${item.url}`);
      const rankScore =
        (page.rankScore || page.score || 0) +
        (dayInfo.bucket === 'today' ? 220 : dayInfo.bucket === 'yesterday' ? 160 : dayInfo.bucket === 'day_before' ? 110 : 20) +
        (publishedDate ? 40 : 0) +
        countHintHits(`${item.title} ${item.url}`, ADMISSION_SECTION_HINTS) * 12 +
        countHintHits(`${item.title} ${item.url}`, ADJUSTMENT_HINTS) * 10 +
        retestTitleHits * (focus === 'retest' ? 36 : 10);
      const normalizedItem = {
        title: item.title,
        url: item.url,
        dateHint: item.dateHint || '',
        publishedDate: dateKey,
        dayBucket: dayInfo.bucket,
        dayLabel: dayInfo.label,
        sourcePage: page.finalUrl || page.requestedUrl || '',
        retestTitleHits,
        retestContentHits: 0,
        retestHits: retestTitleHits,
        retestMatchedBy: retestTitleHits > 0 ? 'title' : 'none',
        retestSnippet: '',
        rankScore
      };
      const old = noticeMap.get(key);
      if (!old || old.rankScore < rankScore) {
        noticeMap.set(key, normalizedItem);
      }
    }
  }

  const bucketRank = { today: 0, yesterday: 1, day_before: 2, other: 3 };
  let notices = Array.from(noticeMap.values())
    .sort((a, b) => {
      const d = (bucketRank[a.dayBucket] ?? 9) - (bucketRank[b.dayBucket] ?? 9);
      if (d !== 0) return d;
      if (a.publishedDate && b.publishedDate && a.publishedDate !== b.publishedDate) {
        return b.publishedDate.localeCompare(a.publishedDate);
      }
      return (b.rankScore || 0) - (a.rankScore || 0);
    })
    .slice(0, 260);

  if (focus === 'retest') {
    notices = await enrichRetestNoticesByContent(notices, 30);
  }

  notices = notices
    .filter((item) => (focus === 'retest' ? (item.retestHits || 0) > 0 : true))
    .sort((a, b) => {
      const d = (bucketRank[a.dayBucket] ?? 9) - (bucketRank[b.dayBucket] ?? 9);
      if (d !== 0) return d;
      if (a.publishedDate && b.publishedDate && a.publishedDate !== b.publishedDate) {
        return b.publishedDate.localeCompare(a.publishedDate);
      }
      return (b.rankScore || 0) - (a.rankScore || 0);
    })
    .slice(0, 180);

  const grouped = { today: [], yesterday: [], day_before: [], other: [] };
  notices.forEach((item) => {
    const bucket = grouped[item.dayBucket] ? item.dayBucket : 'other';
    grouped[bucket].push(item);
  });

  const summary = {
    total: notices.length,
    today: grouped.today.length,
    yesterday: grouped.yesterday.length,
    dayBefore: grouped.day_before.length,
    other: grouped.other.length,
    hasToday: grouped.today.length > 0,
    hasYesterday: grouped.yesterday.length > 0,
    hasDayBefore: grouped.day_before.length > 0
  };

  return {
    checkedAt: nowIsoSafe(),
    focus,
    scope: 'single',
    schoolName: profile.schoolName || schoolName,
    collegeName: profile.collegeName || collegeName,
    includeCollegePages,
    dayRange,
    summary,
    items: notices,
    grouped,
    pages: evaluatedPages.slice(0, 8).map((page) => ({
      requestedUrl: page.requestedUrl || '',
      finalUrl: page.finalUrl || page.requestedUrl || '',
      score: page.rankScore || page.score || 0,
      itemCount: Array.isArray(page.allItems) ? page.allItems.length : 0
    })),
    profile: {
      homepageUrl: profile.homepageUrl || '',
      collegeHomepageUrl: profile.collegeProfile?.matchedHomepageUrl || '',
      announcementCandidateCount: Array.isArray(profile.announcementCandidates) ? profile.announcementCandidates.length : 0,
      collegeCandidateCount: Array.isArray(profile.collegeCandidates) ? profile.collegeCandidates.length : 0
    }
  };
}

async function queryGraduateRecentNoticesBatch(schools, options = {}) {
  const focus = String(options.focus || 'retest') === 'retest' ? 'retest' : 'general';
  const inputSchools = Array.isArray(schools) ? schools : [];
  const normalizedSchools = inputSchools
    .map((item) => normalizeQuickRetestSchoolRecord(item))
    .filter((item) => item.schoolName)
    .slice(0, 10);

  if (!normalizedSchools.length) {
    throw new Error('请至少提供 1 所院校');
  }

  const results = [];
  const failedSchools = [];
  for (const school of normalizedSchools) {
    try {
      const result = await queryGraduateRecentNoticesBySchoolName({
        schoolName: school.schoolName,
        collegeName: school.collegeName,
        includeCollegePages: school.includeCollegePages,
        focus
      });
      const items = (result.items || []).map((item) => ({
        ...item,
        schoolName: result.schoolName,
        collegeName: result.collegeName || ''
      }));
      results.push({
        id: school.id,
        schoolName: result.schoolName,
        collegeName: result.collegeName || '',
        includeCollegePages: school.includeCollegePages,
        summary: result.summary,
        dayRange: result.dayRange,
        profile: result.profile,
        items,
        pages: result.pages
      });
    } catch (error) {
      failedSchools.push({
        id: school.id,
        schoolName: school.schoolName,
        collegeName: school.collegeName || '',
        error: error.message || '查询失败'
      });
    }
  }

  const allItems = results.flatMap((x) => x.items || []);
  const summary = {
    requested: normalizedSchools.length,
    succeeded: results.length,
    failed: failedSchools.length,
    total: allItems.length,
    today: allItems.filter((x) => x.dayBucket === 'today').length,
    yesterday: allItems.filter((x) => x.dayBucket === 'yesterday').length,
    dayBefore: allItems.filter((x) => x.dayBucket === 'day_before').length,
    other: allItems.filter((x) => x.dayBucket === 'other').length
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dayRange = {
    today: formatLocalDateKey(todayStart),
    yesterday: formatLocalDateKey(new Date(todayStart.getTime() - 86400000)),
    dayBefore: formatLocalDateKey(new Date(todayStart.getTime() - 86400000 * 2))
  };

  return {
    checkedAt: nowIsoSafe(),
    focus,
    scope: 'batch',
    summary,
    dayRange,
    items: allItems
      .sort((a, b) => {
        const rank = { today: 0, yesterday: 1, day_before: 2, other: 3 };
        const d = (rank[a.dayBucket] ?? 9) - (rank[b.dayBucket] ?? 9);
        if (d !== 0) return d;
        if (a.publishedDate && b.publishedDate && a.publishedDate !== b.publishedDate) {
          return b.publishedDate.localeCompare(a.publishedDate);
        }
        return (b.rankScore || 0) - (a.rankScore || 0);
      })
      .slice(0, 320),
    schools: results,
    failedSchools
  };
}

function isLikelyDetailNoticeUrl(url) {
  const lower = String(url || '').toLowerCase();
  if (/\/20\d{2}\//.test(lower)) return true;
  if (/\/c\d+a\d+\/page\.htm/.test(lower)) return true;
  if (/\.(s?html?)($|\?)/.test(lower) && !/list|index/.test(lower)) return true;
  if (/detail|article|content|show/.test(lower)) return true;
  return false;
}

function isNoticeDocumentUrl(url) {
  return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)(\?|$)/i.test(String(url || '').toLowerCase());
}

function isNoticeDocumentContentType(contentType) {
  return /(application\/pdf|msword|officedocument|excel|powerpoint|octet-stream|application\/zip|application\/x-rar-compressed)/i.test(
    String(contentType || '')
  );
}

function buildDocumentNoticeTitle(url) {
  const raw = String(url || '').trim();
  if (!raw) return '附件公告';
  try {
    const pathname = new URL(raw).pathname || '';
    const name = decodeURIComponent(path.basename(pathname || '')) || '';
    if (name) return name;
  } catch (error) {
    // ignore
  }
  return raw;
}

function detectDocumentType(url, contentType = '') {
  const source = `${String(url || '').toLowerCase()} ${String(contentType || '').toLowerCase()}`;
  if (/\.pdf(\?|$|\s)|application\/pdf/.test(source)) return 'PDF';
  if (/\.docx?(\?|$|\s)|msword|officedocument\.wordprocessingml/.test(source)) return 'Word';
  if (/\.xlsx?(\?|$|\s)|excel|officedocument\.spreadsheetml/.test(source)) return 'Excel';
  if (/\.pptx?(\?|$|\s)|powerpoint|officedocument\.presentationml/.test(source)) return 'PPT';
  if (/\.zip(\?|$|\s)|\.rar(\?|$|\s)|\.7z(\?|$|\s)|application\/zip|x-rar-compressed/.test(source)) return '压缩包';
  return '附件文档';
}

function detectCharset(headers, rawBuffer) {
  const headerType = headers['content-type'] || '';
  const headerMatch = headerType.match(/charset=([^;]+)/i);
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].trim().toLowerCase();
  }

  const sniff = rawBuffer.slice(0, 2048).toString('ascii');
  const metaMatch = sniff.match(/charset=['\"]?([a-zA-Z0-9_-]+)/i);
  if (metaMatch && metaMatch[1]) {
    return metaMatch[1].trim().toLowerCase();
  }

  return 'utf-8';
}

async function safeHttpGet(url, config = {}, maxRedirects = 5) {
  let currentUrl = String(url || '').trim();
  for (let step = 0; step <= maxRedirects; step += 1) {
    const safeUrl = await assertSafeRemoteUrl(currentUrl, '抓取任务');
    const response = await axios.get(safeUrl, {
      ...config,
      lookup: secureDnsLookup,
      maxRedirects: 0
    });
    const status = Number(response.status || 0);
    const location = String(response.headers?.location || '').trim();
    if (status >= 300 && status < 400 && location) {
      currentUrl = normalizeUrl(safeUrl, location);
      if (!currentUrl) {
        throw new Error('重定向链接非法');
      }
      continue;
    }
    return { response, finalUrl: safeUrl };
  }
  throw new Error('重定向次数超过限制');
}

async function fetchHtml(url) {
  const { response, finalUrl } = await safeHttpGet(
    url,
    {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      validateStatus: (status) => status >= 200 && status < 400
    },
    5
  );

  const raw = Buffer.from(response.data);
  let charset = detectCharset(response.headers, raw);
  if (charset === 'gbk' || charset === 'gb2312') {
    charset = 'gb18030';
  }

  let html;
  try {
    html = iconv.decode(raw, charset);
  } catch (error) {
    html = raw.toString('utf8');
  }

  return {
    html,
    finalUrl,
    contentType: String(response.headers?.['content-type'] || '').toLowerCase()
  };
}

function scoreCandidateLink(baseHost, text, href, crawlMode = 'general') {
  const textLower = text.toLowerCase();
  const hrefLower = href.toLowerCase();

  let score = 0;
  for (const hint of LINK_HINTS) {
    if (textLower.includes(hint)) score += 3;
    if (hrefLower.includes(hint)) score += 2;
  }

  try {
    const host = new URL(href).host;
    if (host === baseHost) {
      score += 2;
    } else {
      score -= 1;
    }
  } catch (error) {
    score -= 1;
  }

  if (/list|article|detail|index|show|content|news|notice|tongzhi/i.test(hrefLower)) {
    score += 1;
  }
  if (LIST_URL_HINT_RE.test(hrefLower)) {
    score += 5;
  }
  if (DETAIL_URL_HINT_RE.test(hrefLower)) {
    score -= 6;
  }

  if (normalizeCrawlMode(crawlMode) === 'graduate_adjustment') {
    const gradHits = countHintHits(`${textLower} ${hrefLower}`, GRAD_ENTRY_HINTS);
    const adjustHits = countHintHits(`${textLower} ${hrefLower}`, ADJUSTMENT_HINTS);
    score += gradHits * 4 + adjustHits * 8;
  }

  return score;
}

async function extractPageLinks(pageUrl) {
  const { html, finalUrl } = await fetchHtml(pageUrl);
  const $ = cheerio.load(html);
  const links = [];

  $('a').each((_, node) => {
    const text = $(node).text().replace(/\s+/g, ' ').trim();
    const href = $(node).attr('href');

    if (!href || !text) return;
    if (/^javascript:/i.test(href)) return;
    if (isAnchorOnlyHref(href)) return;

    const fullUrl = normalizeUrl(finalUrl, href);
    if (!isValidHttpUrl(fullUrl)) return;
    if (isSamePageAnchorUrl(fullUrl, finalUrl)) return;
    if (isFriendLinkNode($, node, text, fullUrl)) return;
    links.push({ text, url: fullUrl });
  });

  return { finalUrl, links };
}

async function discoverAnnouncementLinks(homepageUrl, crawlMode = 'general') {
  const { finalUrl, links } = await extractPageLinks(homepageUrl);
  const baseHost = new URL(finalUrl).host;
  const map = new Map();

  for (const link of links) {
    const fullUrl = link.url;
    const score = scoreCandidateLink(baseHost, link.text, fullUrl, crawlMode);
    if (score <= 0) continue;

    const old = map.get(fullUrl);
    if (!old || old.score < score) {
      map.set(fullUrl, { text: link.text, url: fullUrl, score });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

async function discoverGraduateAdjustmentLinks(homepageUrl, options = {}) {
  const includeCollegePages = options.includeCollegePages !== false;
  const returnMeta = options.returnMeta === true;
  const home = await extractPageLinks(homepageUrl);
  const gradPortalMap = new Map();

  for (const link of home.links) {
    if (!isSameDomainFamily(link.url, home.finalUrl)) continue;
    const score = scoreGraduatePortalCandidate(link);
    if (score <= 6) continue;
    const old = gradPortalMap.get(link.url);
    if (!old || old.score < score) {
      gradPortalMap.set(link.url, { text: link.text, url: link.url, score });
    }
  }

  const gradPortals = Array.from(gradPortalMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const portalSeeds = [home.finalUrl, ...gradPortals.map((x) => x.url)];
  const admissionSectionMap = new Map();
  const collegePageMap = new Map();

  for (const seed of Array.from(new Set(portalSeeds))) {
    try {
      const page = await extractPageLinks(seed);
      for (const link of page.links) {
        if (!isSameDomainFamily(link.url, page.finalUrl)) continue;
        const sectionScore = scoreAdmissionSectionCandidate(link);
        if (sectionScore > 10 && isLikelyListPageLink(link.url, link.text)) {
          const old = admissionSectionMap.get(link.url);
          if (!old || old.score < sectionScore) {
            admissionSectionMap.set(link.url, { text: link.text, url: link.url, score: sectionScore });
          }
        }

        if (includeCollegePages) {
          const combined = buildCombinedText(link);
          const collegeScore = countHintHits(combined, COLLEGE_HINTS) * 8 + countHintHits(combined, GRAD_ENTRY_HINTS) * 3;
          if (collegeScore > 10 && !NEWS_PORTAL_URL_RE.test(link.url) && !isLikelyDetailNoticeUrl(link.url) && link.text.length <= 48) {
            const old = collegePageMap.get(link.url);
            if (!old || old.score < collegeScore) {
              collegePageMap.set(link.url, { text: link.text, url: link.url, score: collegeScore });
            }
          }
        }
      }
    } catch (error) {
      continue;
    }
  }

  if (includeCollegePages && collegePageMap.size) {
    const collegeSeeds = Array.from(collegePageMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    for (const collegeSeed of collegeSeeds) {
      try {
        const page = await extractPageLinks(collegeSeed.url);
        for (const link of page.links) {
          if (!isSameDomainFamily(link.url, page.finalUrl)) continue;
          const sectionScore = scoreAdmissionSectionCandidate(link) + countHintHits(buildCombinedText(link), ADJUSTMENT_HINTS) * 8;
          if (sectionScore <= 10 || !isLikelyListPageLink(link.url, link.text)) continue;
          const old = admissionSectionMap.get(link.url);
          if (!old || old.score < sectionScore) {
            admissionSectionMap.set(link.url, { text: link.text, url: link.url, score: sectionScore });
          }
        }
      } catch (error) {
        continue;
      }
    }
  }

  const admissionSections = Array.from(admissionSectionMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
  const collegeCandidates = Array.from(collegePageMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const announcementCandidates = admissionSections.length ? admissionSections : await discoverAnnouncementLinks(homepageUrl, 'graduate_adjustment');
  if (returnMeta) {
    return {
      announcementCandidates,
      collegeCandidates
    };
  }
  return announcementCandidates;
}

function extractDateHint(line) {
  const match = line.match(/(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/);
  return match ? match[1].replace(/年|月/g, '-').replace('日', '') : '';
}

function isPaginationLabel(text) {
  const value = String(text || '').replace(/\s+/g, '');
  if (!value) return false;
  if (/^\d{1,3}$/.test(value)) return true;
  if (/^(上一页|下一页|上页|下页|前页|后页|首页|尾页|末页|next|prev|previous|>|>>|<|<<)$/i.test(value)) return true;
  return false;
}

function parsePaginationOrder(url, label) {
  const labelText = String(label || '').trim();
  if (/^\d{1,3}$/.test(labelText)) return Number(labelText);
  const rawUrl = String(url || '');
  const queryMatch = rawUrl.match(/[?&](?:page|p|pn|pageindex|pageNo)=(\d{1,4})/i);
  if (queryMatch) return Number(queryMatch[1]);
  const pathMatch = rawUrl.match(/(?:list|index|page|p)(\d{1,4})\.(?:s?html?|php|jsp|aspx)(?:$|\?)/i);
  if (pathMatch) return Number(pathMatch[1]);
  return 9999;
}

function extractPaginationUrls(pageUrl, html, maxPages = MAX_PAGINATION_PAGES) {
  if (!isValidHttpUrl(pageUrl)) return [];
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const dirPath = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
  const baseName = path
    .basename(base.pathname || '')
    .toLowerCase()
    .replace(/\.(s?html?|php|jsp|aspx)$/i, '')
    .replace(/\d+$/, '');
  const out = [];
  const seen = new Set([normalizeUrlForKey(pageUrl)]);

  $('a[href]').each((_, node) => {
    const href = String($(node).attr('href') || '').trim();
    const label = normalizeText($(node).text());
    if (!href || /^javascript:/i.test(href) || isAnchorOnlyHref(href)) return;
    const fullUrl = normalizeUrl(pageUrl, href);
    if (!isValidHttpUrl(fullUrl)) return;
    if (!isSameDomainFamily(fullUrl, pageUrl)) return;
    if (isLikelyDetailNoticeUrl(fullUrl)) return;
    const key = normalizeUrlForKey(fullUrl);
    if (!key || seen.has(key)) return;

    let parsed;
    try {
      parsed = new URL(fullUrl);
    } catch (error) {
      return;
    }
    if (!parsed.pathname.startsWith(dirPath)) return;

    const targetName = path
      .basename(parsed.pathname || '')
      .toLowerCase()
      .replace(/\.(s?html?|php|jsp|aspx)$/i, '');
    const isPageQuery = /[?&](?:page|p|pn|pageindex|pageNo)=\d{1,4}/i.test(parsed.search || '');
    const looksLikePagerFile = /(?:list|index|page|p)\d{1,4}$/i.test(targetName);
    const baseMatched = baseName && targetName ? targetName.startsWith(baseName) : false;
    const byLabel = isPaginationLabel(label);

    if (!isPageQuery && !looksLikePagerFile && !(baseMatched && byLabel)) return;
    if (!byLabel && !isPageQuery && !looksLikePagerFile) return;

    seen.add(key);
    out.push({
      url: fullUrl,
      order: parsePaginationOrder(fullUrl, label)
    });
  });

  const discovered = out
    .sort((a, b) => a.order - b.order)
    .slice(0, Math.max(0, maxPages - 1))
    .map((x) => x.url);

  if (discovered.length) return discovered;

  const guessed = [];
  try {
    const u = new URL(pageUrl);
    const pathname = u.pathname || '';
    const extMatch = pathname.match(/\.(s?html?|php|jsp|aspx)$/i);
    const ext = extMatch ? extMatch[0] : '.htm';
    const dirPath = pathname.slice(0, pathname.lastIndexOf('/') + 1);
    const fileName = path.basename(pathname).replace(/\.(s?html?|php|jsp|aspx)$/i, '');
    const baseName = fileName.replace(/\d+$/, '');

    for (let i = 1; i <= Math.max(1, maxPages - 1); i += 1) {
      const listNumUrl = `${u.origin}${dirPath}${baseName}${i}${ext}`;
      const queryUrl = `${u.origin}${pathname}?page=${i + 1}`;
      [listNumUrl, queryUrl].forEach((candidate) => {
        const key = normalizeUrlForKey(candidate);
        if (!key || seen.has(key)) return;
        seen.add(key);
        guessed.push(candidate);
      });
    }
  } catch (error) {
    // ignore
  }
  return guessed.slice(0, Math.max(0, maxPages - 1));
}

function collectNoticeItems(pageUrl, html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('a').each((_, node) => {
    const text = $(node).text().replace(/\s+/g, ' ').trim();
    const href = $(node).attr('href');

    if (!text || !href) return;
    if (text.length < 8 || text.length > 140) return;
    if (/^javascript:/i.test(href)) return;
    if (isAnchorOnlyHref(href)) return;
    if (/^(更多|查看更多|了解更多|点击|详情|more)$/i.test(text)) return;

    const fullUrl = normalizeUrl(pageUrl, href);
    if (!isValidHttpUrl(fullUrl)) return;
    if (isSamePageAnchorUrl(fullUrl, pageUrl)) return;
    if (fullUrl === pageUrl) return;
    if (!isSameDomainFamily(fullUrl, pageUrl)) return;
    if (isFriendLinkNode($, node, text, fullUrl)) return;

    const key = `${text}::${fullUrl}`;
    if (seen.has(key)) return;

    const rowText = $(node).closest('li,tr,div,p').text().replace(/\s+/g, ' ').trim();
    const dateHint = extractDateHint(rowText);

    seen.add(key);
    items.push({
      title: text,
      url: fullUrl,
      dateHint
    });
  });

  return items.slice(0, 200);
}

function normalizeMatchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
}

function splitToNgrams(text, n = 2) {
  const source = String(text || '');
  if (!source || source.length < n) return [];
  const out = [];
  for (let i = 0; i <= source.length - n; i += 1) {
    out.push(source.slice(i, i + n));
  }
  return out;
}

function fuzzyKeywordHit(text, keyword) {
  const t = normalizeMatchText(text);
  const k = normalizeMatchText(keyword);
  if (!k) return false;
  if (t.includes(k)) return true;
  if (k.length <= 2) return t.includes(k[0] || '');
  const ngrams = splitToNgrams(k, 2);
  if (!ngrams.length) return false;
  let hit = 0;
  for (const gram of ngrams) {
    if (t.includes(gram)) hit += 1;
  }
  return hit >= Math.max(1, Math.ceil(ngrams.length * 0.6));
}

function buildKeywordMatchers(keywords) {
  const normalized = parseKeywords(keywords);
  const output = [];
  for (const keyword of normalized) {
    const variants = new Set([keyword]);
    for (const [base, aliasList] of Object.entries(KEYWORD_SYNONYM_MAP)) {
      const inBase = keyword.includes(base) || base.includes(keyword);
      const inAlias = aliasList.some((alias) => alias.includes(keyword) || keyword.includes(alias));
      if (inBase || inAlias) {
        variants.add(base);
        aliasList.forEach((alias) => variants.add(alias));
      }
    }
    output.push({
      keyword,
      variants: Array.from(variants)
    });
  }
  return output;
}

function scoreKeywordMatches(text, keywordMatchers) {
  const matched = [];
  let score = 0;
  for (const matcher of keywordMatchers) {
    let localScore = 0;
    for (const variant of matcher.variants) {
      const exact = normalizeMatchText(text).includes(normalizeMatchText(variant));
      if (exact) {
        localScore = Math.max(localScore, 2);
        break;
      }
      if (fuzzyKeywordHit(text, variant)) {
        localScore = Math.max(localScore, 1);
      }
    }
    if (localScore > 0) {
      matched.push(matcher.keyword);
      score += localScore;
    }
  }
  return {
    matchedKeywords: Array.from(new Set(matched)),
    keywordMatchScore: score
  };
}

function filterByKeywords(items, keywords) {
  const cleanKeywords = parseKeywords(keywords);
  if (!cleanKeywords.length) {
    return items.slice(0, 30).map((item) => ({
      ...item,
      matchedKeywords: [],
      keywordMatchScore: 0
    }));
  }

  const matchers = buildKeywordMatchers(cleanKeywords);
  return items
    .map((item) => {
      const target = `${item.title || ''} ${item.url || ''}`;
      const match = scoreKeywordMatches(target, matchers);
      return {
        ...item,
        matchedKeywords: match.matchedKeywords,
        keywordMatchScore: match.keywordMatchScore
      };
    })
    .filter((item) => item.keywordMatchScore > 0)
    .sort((a, b) => b.keywordMatchScore - a.keywordMatchScore || (b.dateHint ? 1 : 0) - (a.dateHint ? 1 : 0));
}

function nowIsoSafe() {
  return new Date().toISOString();
}

function nowFilenameStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function rankPageResult(result, keywords) {
  if (keywords.length) {
    const totalKeywordScore = result.matchedItems.reduce((sum, item) => sum + (item.keywordMatchScore || 0), 0);
    return result.matchedItems.length * 900 + totalKeywordScore * 120 + Math.min(result.allItems.length, 200);
  }
  return Math.min(result.allItems.length, 200);
}

async function evaluateAnnouncementPage(candidateUrl, keywords, crawlMode = 'general') {
  const { html, finalUrl, contentType } = await fetchHtml(candidateUrl);
  if (isNoticeDocumentUrl(finalUrl) || isNoticeDocumentContentType(contentType)) {
    const fileItem = {
      title: buildDocumentNoticeTitle(finalUrl),
      url: finalUrl,
      dateHint: extractDateHint(finalUrl)
    };
    const matchedItems = filterByKeywords([fileItem], keywords).slice(0, 50);
    return {
      finalUrl,
      allItems: [fileItem],
      matchedItems,
      score: matchedItems.length ? 620 : 260
    };
  }
  const pageBundles = [{ pageUrl: finalUrl, html }];
  const shouldFollowPages = isLikelyListPageLink(finalUrl, '') && !isLikelyDetailNoticeUrl(finalUrl);
  if (shouldFollowPages) {
    const paginationUrls = extractPaginationUrls(finalUrl, html, MAX_PAGINATION_PAGES);
    const paginationJobs = paginationUrls.map(async (url) => {
      try {
        const page = await fetchHtml(url);
        if (isNoticeDocumentUrl(page.finalUrl) || isNoticeDocumentContentType(page.contentType)) return null;
        return { pageUrl: page.finalUrl, html: page.html };
      } catch (error) {
        return null;
      }
    });
    const extraPages = (await Promise.all(paginationJobs)).filter(Boolean);
    pageBundles.push(...extraPages);
  }

  const itemMap = new Map();
  for (const bundle of pageBundles) {
    const items = collectNoticeItems(bundle.pageUrl, bundle.html);
    for (const item of items) {
      const key = normalizeUrlForKey(item.url) || `${item.title}::${item.url}`;
      if (!key || itemMap.has(key)) continue;
      itemMap.set(key, item);
    }
  }
  const allItems = Array.from(itemMap.values()).slice(0, 400);
  const matchedItems = filterByKeywords(allItems, keywords).slice(0, 50);
  const gradScore = countHintHits(finalUrl, GRAD_ENTRY_HINTS);
  const adjustScore = countHintHits(finalUrl, ADJUSTMENT_HINTS);
  const admissionScore = countHintHits(finalUrl, ADMISSION_SECTION_HINTS);
  const adjustmentItemCount = allItems.filter((item) => countHintHits(item.title, ADJUSTMENT_HINTS) > 0).length;
  const admissionItemCount = allItems.filter((item) => countHintHits(`${item.title} ${item.url}`, ADMISSION_SECTION_HINTS) > 0).length;
  const datedItemCount = allItems.filter((item) => item.dateHint).length;
  const dateRatio = allItems.length ? datedItemCount / allItems.length : 0;
  const gradPortalUrlBonus = GRAD_PORTAL_URL_RE.test(finalUrl) ? 50 : 0;
  const newsPenalty = NEWS_PORTAL_URL_RE.test(finalUrl) && adjustmentItemCount === 0 ? -220 : 0;
  const noAdmissionPenalty = admissionItemCount === 0 ? -140 : 0;
  const noAdjustPenalty = adjustmentItemCount === 0 ? -180 : 0;
  const lowDatePenalty = dateRatio < 0.08 ? -120 : 0;
  const score =
    rankPageResult({ allItems, matchedItems }, keywords) +
    (LIST_URL_HINT_RE.test(finalUrl) ? 30 : 0) +
    (DETAIL_URL_HINT_RE.test(finalUrl) ? -30 : 0) +
    (ANNOUNCEMENT_URL_RE.test(finalUrl) ? 120 : 0) +
    (NON_ANNOUNCE_SECTION_RE.test(finalUrl) ? -60 : 0) +
    (normalizeCrawlMode(crawlMode) === 'graduate_adjustment'
      ? gradScore * 12 +
        adjustScore * 20 +
        admissionScore * 10 +
        adjustmentItemCount * 120 +
        admissionItemCount * 50 +
        datedItemCount * 8 +
        gradPortalUrlBonus +
        newsPenalty +
        noAdmissionPenalty +
        noAdjustPenalty +
        lowDatePenalty
      : 0);

  return {
    finalUrl,
    allItems,
    matchedItems,
    score
  };
}

async function collectNoticePageCandidates(taskLike) {
  const crawlMode = normalizeCrawlMode(taskLike.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(taskLike.includeCollegePages, crawlMode);
  const candidates = [];
  const manualAnnouncementUrls = combineAnnouncementUrls(taskLike.announcementUrl, taskLike.announcementUrls).urls;
  for (const url of manualAnnouncementUrls.slice(0, 20)) {
    candidates.push(url);
  }
  if (taskLike.announcementUrl) {
    candidates.push(String(taskLike.announcementUrl).trim());
  }

  const selectedColleges = normalizeCollegeUrls(taskLike.collegeUrls).urls;
  for (const url of selectedColleges.slice(0, 20)) {
    candidates.push(url);
  }

  const discovered =
    crawlMode === 'graduate_adjustment'
      ? await discoverGraduateAdjustmentLinks(taskLike.homepageUrl, { includeCollegePages }).catch(() => [])
      : await discoverAnnouncementLinks(taskLike.homepageUrl, crawlMode).catch(() => []);
  for (const item of discovered.slice(0, 16)) {
    candidates.push(item.url);
  }

  const uniqueCandidates = [];
  const seen = new Set();
  for (const url of candidates) {
    if (!isValidHttpUrl(url)) continue;
    const key = normalizeUrlForKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(url);
  }
  return uniqueCandidates;
}

async function pickBestNoticePage(taskLike) {
  const crawlMode = normalizeCrawlMode(taskLike.crawlMode);
  const effectiveKeywords = mergeKeywords(taskLike.keywords || [], getBuiltInKeywords(crawlMode));
  const uniqueCandidates = await collectNoticePageCandidates(taskLike);
  if (!uniqueCandidates.length) {
    throw new Error('未自动发现公告链接，请先使用“核对链接”并手动指定公告页链接。');
  }

  let best = null;
  let lastError = null;
  for (const url of uniqueCandidates) {
    try {
      const evaluated = await evaluateAnnouncementPage(url, effectiveKeywords, crawlMode);
      if (!best || evaluated.score > best.score) {
        best = evaluated;
      }
      if (evaluated.matchedItems.length >= 5) {
        best = evaluated;
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!best) {
    throw new Error(lastError?.message || '抓取失败：未能读取公告页面');
  }

  return best;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanExtractedContent(text) {
  const source = normalizeText(text);
  if (!source) return '';
  const lines = source
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const output = [];
  const seen = new Set();
  for (const line of lines) {
    if (line.length < 2) continue;
    if (/^(首页|上一条|下一条|返回|打印|关闭|附件下载|责任编辑|当前位置)/.test(line) && line.length <= 20) continue;
    const key = line.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(line);
  }
  return output.join('\n\n');
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTopKeywordsFromText(text, taskKeywords, crawlMode, limit = 12) {
  const source = normalizeMatchText(text);
  if (!source) return [];
  const candidateSet = new Set([
    ...mergeKeywords(taskKeywords || [], getBuiltInKeywords(crawlMode)),
    '研究生',
    '招生',
    '调剂',
    '复试',
    '录取',
    '拟录取',
    '公告',
    '通知',
    '专业',
    '考试',
    '报名',
    '分数线'
  ]);
  const stats = [];
  for (const kw of candidateSet) {
    const normalized = normalizeMatchText(kw);
    if (!normalized || normalized.length < 2) continue;
    const regex = new RegExp(escapeRegExp(normalized), 'g');
    const hits = source.match(regex);
    const count = hits ? hits.length : 0;
    if (count > 0) {
      stats.push({ keyword: kw, count });
    }
  }
  return stats.sort((a, b) => b.count - a.count).slice(0, limit);
}

function extractMainContent(html) {
  const $ = cheerio.load(html);
  const NAV_TEXT_HINT_RE =
    /(首页|研究生处概况|现任领导|联系我们|版权所有|上一篇|下一篇|当前位置|师生风采|下载专区|友情链接)/;
  const NAV_MARKER_RE = /(nav|menu|header|footer|sidebar|breadcrumb|crumb|top|bottom|friend|link|end_link|sxt)/i;
  $('script,style,noscript,iframe,header,footer,nav,aside,svg,canvas').remove();
  // 部分高校模板把正文包在 form 里，不能整块删除，只移除表单控件。
  $('form').each((_, formEl) => {
    $(formEl).find('input,button,select,textarea').remove();
  });
  $('.sxt,.prev-next,.end_link,.breadcrumb,.crumb,.sjfx,.jiathis_style').remove();
  $('[class*="share"],[id*="share"]').remove();

  const fixedSelectors = [
    '.v_news_content',
    '#vsb_content_2',
    '#vsb_content',
    '.content-content',
    '.TRS_Editor',
    '.Article_Content',
    '.news_content',
    '.wp_articlecontent',
    '.article-content',
    'article',
    '.article',
    '.content',
    '.detail',
    '.news_text',
    '.entry-content',
    '.post-content'
  ];

  let bestEl = null;
  let bestScore = 0;

  function countRegexMatches(text, regex) {
    const matches = String(text || '').match(new RegExp(regex.source, `${regex.flags.includes('g') ? regex.flags : `${regex.flags}g`}`));
    return matches ? matches.length : 0;
  }

  function scoreElement(el) {
    const raw = normalizeText($(el).text());
    if (raw.length < 80) return 0;

    const marker = `${$(el).attr('id') || ''} ${$(el).attr('class') || ''}`;
    const markerLower = marker.toLowerCase();
    const pCount = $(el).find('p').length;
    const hCount = $(el).find('h1,h2,h3,h4').length;
    const liCount = $(el).find('li').length;
    const aCount = $(el).find('a').length;
    const aTextLen = normalizeText($(el).find('a').text()).length;
    const linkDensity = aTextLen / Math.max(raw.length, 1);
    const navTextHits = countRegexMatches(raw, NAV_TEXT_HINT_RE);
    const navMarkerPenalty = NAV_MARKER_RE.test(markerLower) ? 2500 : 0;
    const contentMarkerBonus = /(content|article|detail|text|news|post|main|con|vsb|editor)/i.test(markerLower) ? 260 : 0;
    const metaBonus = /(来源|发布日期|发布时间|作者|浏览|点击量)/.test(raw) ? 100 : 0;

    return (
      raw.length +
      pCount * 35 +
      hCount * 90 +
      liCount * 6 -
      aCount * 12 -
      Math.round(linkDensity * 1800) -
      navTextHits * 40 -
      navMarkerPenalty +
      contentMarkerBonus +
      metaBonus
    );
  }

  for (const selector of fixedSelectors) {
    $(selector).each((_, el) => {
      const score = scoreElement(el);
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    });
  }

  if (!bestEl) {
    $('section,div').each((_, el) => {
      const marker = `${$(el).attr('class') || ''} ${$(el).attr('id') || ''}`;
      if (!/(content|article|detail|text|news|post|main|con)/i.test(marker)) return;
      const score = scoreElement(el);
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    });
  }

  const target = bestEl ? $(bestEl).clone() : $('body').clone();
  target.find('script,style,noscript,iframe,svg,canvas').remove();
  target.find('input,button,select,textarea').remove();
  target.find('.sxt,.prev-next,.end_link,.breadcrumb,.crumb,.sjfx,.jiathis_style').remove();
  target.find('[class*="share"],[id*="share"]').remove();
  const paragraphs = [];
  const seen = new Set();
  target
    .find('h1,h2,h3,h4,p,li,td,th')
    .each((_, node) => {
      const line = normalizeText($(node).text());
      if (!line || line.length < 2) return;
      if (NAV_TEXT_HINT_RE.test(line) && line.length <= 24) return;
      if (/^(当前位置|首页)$/.test(line)) return;
      if (seen.has(line)) return;
      seen.add(line);
      paragraphs.push(line);
    });

  let text = paragraphs.join('\n\n');
  if (!text) {
    text = normalizeText(target.text());
  }

  const maxChars = 8000;
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n\n[内容过长，已截断]`;
  }
  return text;
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch (error) {
    return '';
  }
}

function isAttachmentCandidate(text, href) {
  const combined = `${String(text || '')} ${String(href || '')}`.toLowerCase();
  const extHit = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|txt|csv|jpg|jpeg|png)(\?|$)/i.test(combined);
  const hintHit = /(附件|下载|download|upload|_content\/download|file|files|resource)/i.test(combined);
  return extHit || hintHit;
}

function extractAttachments(html, pageUrl) {
  const $ = cheerio.load(html);
  const selectors = [
    '.v_news_content',
    '#vsb_content_2',
    '#vsb_content',
    '.content-content',
    '.TRS_Editor',
    '.Article_Content',
    '.news_content',
    '.wp_articlecontent',
    '.article-content',
    'article',
    '.article',
    '.content',
    '.detail'
  ];
  let root = null;
  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length) {
      root = el;
      break;
    }
  }
  const roots = [];
  if (root && root.length) {
    roots.push(root);
  } else {
    roots.push($('body'));
  }
  const extraRootSelectors = ['.wz_fj', '.attachment', '.attachments', '.file', '.download', '.fj', '[class*="attach"]', '[id*="attach"]'];
  for (const selector of extraRootSelectors) {
    $(selector).each((_, el) => roots.push($(el)));
  }

  const attachments = [];
  const seen = new Set();
  for (const r of roots) {
    r.find('a[href]').each((_, link) => {
      const href = String($(link).attr('href') || '').trim();
      const text = normalizeText($(link).text());
      if (!href || href.startsWith('#') || /^javascript:/i.test(href) || /^mailto:/i.test(href)) return;
      const url = resolveUrl(href, pageUrl);
      if (!isValidHttpUrl(url)) return;
      const nearText = normalizeText($(link).closest('p,li,div,td,span').text());
      const inAttachmentZone = /(附件|下载|download|attach|file|fj)/i.test(
        `${$(link).closest('[class],[id]').attr('class') || ''} ${$(link).closest('[class],[id]').attr('id') || ''} ${nearText}`
      );
      if (!inAttachmentZone && !isAttachmentCandidate(text, url)) return;
      if (seen.has(url)) return;
      seen.add(url);
      attachments.push({
        name: text || path.basename(new URL(url).pathname) || '附件',
        url
      });
    });
  }
  return attachments.slice(0, 20);
}

async function fetchNoticeDetail(item) {
  if (isNoticeDocumentUrl(item.url)) {
    const finalUrl = String(item.url || '').trim();
    const title = item.title || buildDocumentNoticeTitle(finalUrl);
    const fileType = detectDocumentType(finalUrl);
    return {
      title,
      url: finalUrl,
      dateHint: item.dateHint || extractDateHint(`${title} ${finalUrl}`),
      content: `（该公告为${fileType}文件，系统已保留原始下载链接，请打开链接查看原文。）`,
      attachments: [
        {
          name: buildDocumentNoticeTitle(finalUrl),
          url: finalUrl
        }
      ],
      fileNoticeType: fileType
    };
  }

  const { html, finalUrl, contentType } = await fetchHtml(item.url);
  if (isNoticeDocumentUrl(finalUrl) || isNoticeDocumentContentType(contentType)) {
    const title = item.title || buildDocumentNoticeTitle(finalUrl);
    const fileType = detectDocumentType(finalUrl, contentType);
    return {
      title,
      url: finalUrl,
      dateHint: item.dateHint || extractDateHint(`${title} ${finalUrl}`),
      content: `（该公告为${fileType}文件，系统已保留原始下载链接，请打开链接查看原文。）`,
      attachments: [
        {
          name: buildDocumentNoticeTitle(finalUrl),
          url: finalUrl
        }
      ],
      fileNoticeType: fileType
    };
  }

  const $ = cheerio.load(html);
  const h1 = normalizeText($('h1').first().text());
  const titleTag = normalizeText($('title').first().text()).replace(/[\-_|].*$/, '').trim();
  const title = item.title || h1 || titleTag || finalUrl;
  const dateHint = item.dateHint || extractDateHint(normalizeText($('body').text().slice(0, 1200)));
  const content = extractMainContent(html);
  const attachments = extractAttachments(html, finalUrl);
  return {
    title,
    url: finalUrl,
    dateHint,
    content,
    attachments,
    fileNoticeType: ''
  };
}

function normalizeSelectedItems(rawSelected) {
  if (!Array.isArray(rawSelected)) return [];
  const output = [];
  const seen = new Set();
  for (const raw of rawSelected) {
    const title = normalizeText(raw?.title || '');
    const url = String(raw?.url || '').trim();
    const dateHint = normalizeText(raw?.dateHint || '');
    if (!title || !isValidHttpUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    output.push({ title, url, dateHint });
  }
  return output;
}

function buildManualPreset(taskLike) {
  const schoolName = String(taskLike.schoolName || '').trim();
  const homepageUrl = String(taskLike.homepageUrl || '').trim();
  const announcementCombined = combineAnnouncementUrls(taskLike.announcementUrl, taskLike.announcementUrls);
  const announcementUrl = announcementCombined.urls[0] || '';
  const announcementUrls = announcementCombined.urls;
  const keywords = Array.isArray(taskLike.keywords) ? taskLike.keywords : parseKeywords(taskLike.keywords);
  const collegeUrls = normalizeCollegeUrls(taskLike.collegeUrls).urls;
  const crawlMode = normalizeCrawlMode(taskLike.crawlMode);
  const markdownOutputMode = normalizeMarkdownOutputMode(taskLike.markdownOutputMode);
  const includeCollegePages = normalizeIncludeCollegePages(taskLike.includeCollegePages, crawlMode);

  if (!homepageUrl || !isValidHttpUrl(homepageUrl)) {
    return null;
  }

  return {
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    schoolName: schoolName || '未命名院校',
    collegeName: String(taskLike.collegeName || '').trim(),
    homepageUrl,
    announcementUrl,
    announcementUrls,
    keywords,
    markdownOutputMode,
    crawlMode,
    includeCollegePages,
    collegeUrls,
    savedAt: nowIsoSafe()
  };
}

async function saveManualPreset(taskLike) {
  const preset = buildManualPreset(taskLike);
  if (!preset) return [];
  return mutateConfig(async (config) => {
    const current = (Array.isArray(config.manualPresets) ? config.manualPresets : []).map(normalizePresetRecord);
    const merged = [];
    const seen = new Set();
    for (const item of [preset, ...current]) {
      const normalized = normalizePresetRecord(item);
      const key = buildPresetDedupKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(normalized);
      if (merged.length >= MANUAL_PRESET_LIMIT) break;
    }
    config.manualPresets = merged;
    return merged;
  });
}

function buildMarkdownWithContents(task, pageRefs, details, source) {
  const crawlMode = normalizeCrawlMode(task.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(task.includeCollegePages, crawlMode);
  const modeText = crawlMode === 'graduate_adjustment' ? '研究生调剂公告' : '普通公告';
  const usedPages = Array.isArray(pageRefs) ? pageRefs.filter(Boolean) : parseUrlList(pageRefs);
  const matchedNoticeCount = details.filter((item) => Array.isArray(item.matchedKeywords) && item.matchedKeywords.length).length;
  const extractedKeywordMap = new Map();
  details.forEach((item) => {
    (item.extractedKeywords || []).forEach((kw) => {
      const prev = extractedKeywordMap.get(kw.keyword) || 0;
      extractedKeywordMap.set(kw.keyword, prev + (kw.count || 0));
    });
  });
  const topExtracted = Array.from(extractedKeywordMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  const lines = [];
  lines.push(`# ${task.schoolName} 公告内容抓取报告`);
  lines.push('');
  lines.push(`- 任务ID: ${task.id}`);
  lines.push(`- 触发方式: ${source === 'cron' ? '每日定时' : '手动触发'}`);
  lines.push(`- 抓取时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 抓取模式: ${modeText}`);
  lines.push(`- 学院层级: ${includeCollegePages ? '开启' : '关闭'}`);
  lines.push(`- 公告列表页数: ${usedPages.length || 0}`);
  if (usedPages.length) {
    lines.push('- 公告列表页:');
    usedPages.forEach((url, idx) => {
      lines.push(`  ${idx + 1}. ${url}`);
    });
  }
  lines.push(`- 关键词: ${task.keywords.length ? task.keywords.join(' / ') : '未设置'}`);
  lines.push(`- 抓取公告数: ${details.length}`);
  if (task.keywords.length) {
    lines.push(`- 关键词命中公告数: ${matchedNoticeCount}`);
  }
  if (topExtracted.length) {
    lines.push(`- 提取高频关键词: ${topExtracted.map((x) => `${x.keyword}(${x.count})`).join('、')}`);
  }
  lines.push('');

  if (!details.length) {
    lines.push('未选择公告链接，未生成正文内容。');
    return lines.join('\n');
  }

  details.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.title}`);
    lines.push('');
    lines.push(`- 链接: ${item.url}`);
    if (item.dateHint) {
      lines.push(`- 日期: ${item.dateHint}`);
    }
    if (item.fileNoticeType) {
      lines.push(`- 备注: 当前链接为附件公告（类型：${item.fileNoticeType}），已保留下载链接`);
    }
    if (Array.isArray(item.matchedKeywords) && item.matchedKeywords.length) {
      lines.push(`- 关键词命中: ${item.matchedKeywords.join(' / ')}`);
    }
    if (Array.isArray(item.extractedKeywords) && item.extractedKeywords.length) {
      lines.push(`- 正文提取关键词: ${item.extractedKeywords.map((x) => `${x.keyword}(${x.count})`).join('、')}`);
    }
    if (Array.isArray(item.attachments) && item.attachments.length) {
      lines.push(`- 附件数: ${item.attachments.length}`);
    }
    lines.push('');
    lines.push(item.content || '（未提取到正文内容）');
    if (Array.isArray(item.attachments) && item.attachments.length) {
      lines.push('');
      lines.push('### 附件链接');
      lines.push('');
      item.attachments.forEach((attachment, i) => {
        lines.push(`${i + 1}. [${attachment.name}](${attachment.url})`);
      });
    }
    lines.push('');
  });

  return lines.join('\n');
}

function buildMarkdownForSingleNotice(task, pageRefs, detail, source) {
  return buildMarkdownWithContents(task, pageRefs, [detail], source);
}

async function writeMarkdownOutputFiles(taskLike, details, pageRefList, source) {
  const task = normalizeTaskRecord(taskLike);
  const outputMode = normalizeMarkdownOutputMode(task.markdownOutputMode);
  const stamp = nowFilenameStamp();

  if (outputMode === 'separate') {
    const fileNames = [];
    for (let index = 0; index < details.length; index += 1) {
      const detail = details[index];
      const titlePart = sanitizeFilename(detail.title || `公告_${index + 1}`) || `公告_${index + 1}`;
      const fileName = `${sanitizeFilename(task.schoolName)}_${String(index + 1).padStart(2, '0')}_${titlePart}_${stamp}.md`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      const content = buildMarkdownForSingleNotice(task, pageRefList, detail, source);
      await fsp.writeFile(filePath, content, 'utf8');
      fileNames.push(fileName);
    }
    return {
      outputMode,
      fileName: fileNames[0] || '',
      fileNames,
      fileCount: fileNames.length
    };
  }

  const content = buildMarkdownWithContents(task, pageRefList, details, source);
  const fileName = `${sanitizeFilename(task.schoolName)}_${stamp}.md`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fsp.writeFile(filePath, content, 'utf8');
  return {
    outputMode,
    fileName,
    fileNames: [fileName],
    fileCount: 1
  };
}

async function crawlSelectedNotices(taskLike, source, selectedItems, usedAnnouncementUrl = '', usedAnnouncementUrls = []) {
  const safeSelected = normalizeSelectedItems(selectedItems).slice(0, 20);
  if (!safeSelected.length) {
    throw new Error('请至少选择 1 条公告后再确认爬取。');
  }

  const task = normalizeTaskRecord(taskLike);
  const crawlMode = normalizeCrawlMode(task.crawlMode);
  const effectiveKeywords = mergeKeywords(task.keywords || [], getBuiltInKeywords(crawlMode));
  const keywordMatchers = buildKeywordMatchers(effectiveKeywords);
  const details = [];
  for (const item of safeSelected) {
    try {
      const detail = await fetchNoticeDetail(item);
      detail.content = cleanExtractedContent(detail.content);
      const keywordMatch = scoreKeywordMatches(`${detail.title}\n${detail.content}`, keywordMatchers);
      detail.matchedKeywords = keywordMatch.matchedKeywords;
      detail.keywordMatchScore = keywordMatch.keywordMatchScore;
      detail.extractedKeywords = extractTopKeywordsFromText(`${detail.title}\n${detail.content}`, effectiveKeywords, crawlMode, 10);
      details.push(detail);
    } catch (error) {
      details.push({
        title: item.title,
        url: item.url,
        dateHint: item.dateHint,
        content: `（正文抓取失败：${error.message || '未知错误'}）`,
        matchedKeywords: [],
        extractedKeywords: []
      });
    }
  }

  const pageRefList = [];
  const pageSeen = new Set();
  for (const url of [usedAnnouncementUrl, ...parseUrlList(usedAnnouncementUrls)]) {
    const value = String(url || '').trim();
    if (!value || !isValidHttpUrl(value)) continue;
    const key = normalizeUrlForKey(value);
    if (!key || pageSeen.has(key)) continue;
    pageSeen.add(key);
    pageRefList.push(value);
  }

  const outputResult = await writeMarkdownOutputFiles(task, details, pageRefList, source);

  return {
    fileName: outputResult.fileName,
    fileNames: outputResult.fileNames,
    fileCount: outputResult.fileCount,
    outputMode: outputResult.outputMode,
    matchedCount: details.length,
    usedAnnouncementUrl: pageRefList[0] || usedAnnouncementUrl || '',
    usedAnnouncementUrls: pageRefList,
    sampledCount: details.length
  };
}

async function scanAnnouncementCandidates(taskLike) {
  const task = normalizeTaskRecord(taskLike);
  const crawlMode = normalizeCrawlMode(task.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(task.includeCollegePages, crawlMode);
  const effectiveKeywords = mergeKeywords(task.keywords || [], getBuiltInKeywords(crawlMode));
  const preferredAnnouncementKeys = new Set((task.announcementUrls || []).map((url) => normalizeUrlForKey(url)).filter(Boolean));
  const selectedCollegeKeys = new Set(normalizeCollegeUrls(task.collegeUrls).urls.map((x) => normalizeUrlForKey(x)));
  const pageCandidates = await collectNoticePageCandidates(task);
  if (!pageCandidates.length) {
    throw new Error('未自动发现公告链接，请先使用“核对链接”并手动指定公告页链接。');
  }

  let evaluatedPages = [];
  let lastError = null;
  const evaluateJobs = pageCandidates.slice(0, 18).map(async (pageUrl) => {
    try {
      const evaluated = await evaluateAnnouncementPage(pageUrl, effectiveKeywords, crawlMode);
      evaluated.requestedUrl = pageUrl;
      const pageKey = normalizeUrlForKey(pageUrl);
      const manualBoost = preferredAnnouncementKeys.has(pageKey) ? 700 : 0;
      const collegeBoost = selectedCollegeKeys.has(pageKey) ? 260 : 0;
      evaluated.rankScore = evaluated.score + manualBoost + collegeBoost;
      return evaluated;
    } catch (error) {
      lastError = error;
      return null;
    }
  });
  evaluatedPages = (await Promise.all(evaluateJobs)).filter(Boolean);

  if (!evaluatedPages.length) {
    throw new Error(lastError?.message || '扫描失败：未能读取任何候选公告页');
  }

  const preferredPages = evaluatedPages.filter((page) => {
    const key = normalizeUrlForKey(page.requestedUrl || page.finalUrl);
    return preferredAnnouncementKeys.has(key) && page.allItems && page.allItems.length > 0;
  });
  evaluatedPages.sort((a, b) => {
    const aPreferred = preferredPages.includes(a) ? 1 : 0;
    const bPreferred = preferredPages.includes(b) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;
    return (b.rankScore || b.score) - (a.rankScore || a.score);
  });
  const itemPool = [];
  for (const page of evaluatedPages.slice(0, 6)) {
    const preferredItems = page.matchedItems.length ? page.matchedItems : page.allItems;
    preferredItems.slice(0, 40).forEach((item) => {
      itemPool.push({
        ...item,
        sourcePage: page.finalUrl,
        pageScore: page.rankScore || page.score
      });
    });
  }

  if (!itemPool.length) {
    evaluatedPages[0].allItems.slice(0, 60).forEach((item) => {
      itemPool.push({
        ...item,
        sourcePage: evaluatedPages[0].finalUrl,
        pageScore: evaluatedPages[0].rankScore || evaluatedPages[0].score
      });
    });
  }

  const ranked = itemPool
    .map((item) => ({
      ...item,
      detailScore:
        (isLikelyDetailNoticeUrl(item.url) ? 10 : 0) +
        (item.dateHint ? 1 : 0) +
        Math.max(0, Math.min(4, Math.floor((item.pageScore || 0) / 1000))) +
        (crawlMode === 'graduate_adjustment' ? countHintHits(`${item.title} ${item.url}`, ADJUSTMENT_HINTS) * 10 : 0)
    }))
    .sort((a, b) => b.detailScore - a.detailScore);

  const candidates = ranked.slice(0, 60).map((item, index) => ({
    id: `n_${index + 1}`,
    title: item.title,
    url: item.url,
    dateHint: item.dateHint || '',
    isLikelyDetail: isLikelyDetailNoticeUrl(item.url),
    sourcePage: item.sourcePage || ''
  }));

  const usedAnnouncementUrls = [];
  const usedSeen = new Set();
  for (const page of evaluatedPages.slice(0, 6)) {
    const url = page.requestedUrl || page.finalUrl;
    const key = normalizeUrlForKey(url);
    if (!url || !key || usedSeen.has(key)) continue;
    usedSeen.add(key);
    usedAnnouncementUrls.push(url);
  }

  return {
    usedAnnouncementUrl: usedAnnouncementUrls[0] || evaluatedPages[0].requestedUrl || evaluatedPages[0].finalUrl,
    usedAnnouncementUrls,
    crawlMode,
    includeCollegePages,
    candidates,
    matchedByKeywords: evaluatedPages.reduce((sum, page) => sum + page.matchedItems.length, 0),
    totalDiscovered: evaluatedPages.reduce((sum, page) => sum + page.allItems.length, 0),
    selectedCollegeCount: normalizeCollegeUrls(task.collegeUrls).urls.length
  };
}

async function executeCrawl(taskLike, source) {
  const scan = await scanAnnouncementCandidates(taskLike);
  const autoSelected = scan.candidates.slice(0, 8);
  return crawlSelectedNotices(taskLike, source, autoSelected, scan.usedAnnouncementUrl, scan.usedAnnouncementUrls || []);
}

async function runTask(taskId, source = 'manual') {
  if (runningTasks.has(taskId)) {
    throw new Error('该任务正在执行中，请稍后重试。');
  }

  runningTasks.add(taskId);
  try {
    const config = await readConfig();
    const idx = config.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) {
      throw new Error('任务不存在');
    }

    const task = config.tasks[idx];
    const result = await executeCrawl(task, source);
    const updatedTask = await mutateConfig(async (latestConfig) => {
      const latestIdx = latestConfig.tasks.findIndex((t) => t.id === taskId);
      if (latestIdx < 0) {
        throw new Error('任务不存在');
      }
      const latestTask = latestConfig.tasks[latestIdx];
      latestTask.lastRunAt = nowIsoSafe();
      latestTask.lastError = '';
      latestTask.lastResultFile = result.fileName;
      latestTask.lastResultFiles = Array.isArray(result.fileNames) ? result.fileNames : result.fileName ? [result.fileName] : [];
      latestTask.lastMatchedCount = result.matchedCount;
      latestTask.updatedAt = nowIsoSafe();
      latestConfig.tasks[latestIdx] = latestTask;
      return latestTask;
    });

    return {
      task: updatedTask,
      ...result
    };
  } catch (error) {
    try {
      await mutateConfig(async (config) => {
        const idx = config.tasks.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          config.tasks[idx].lastRunAt = nowIsoSafe();
          config.tasks[idx].lastError = error.message || '抓取失败';
          config.tasks[idx].updatedAt = nowIsoSafe();
        }
      });
    } catch (writeError) {
      console.error(`[task] failed to persist task error for ${taskId}:`, writeError.message || writeError);
    }
    throw error;
  } finally {
    runningTasks.delete(taskId);
  }
}

function buildCronExpression(timeText) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(timeText || '').trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return `${minute} ${hour} * * *`;
}

function unscheduleTask(taskId) {
  const existing = scheduledJobs.get(taskId);
  if (existing) {
    existing.stop();
    scheduledJobs.delete(taskId);
  }
}

function scheduleSingleTask(task) {
  unscheduleTask(task.id);

  if (!task.enabled) return;

  const expr = buildCronExpression(task.scheduleTime);
  if (!expr) return;

  const job = cron.schedule(expr, async () => {
    try {
      await runTask(task.id, 'cron');
      console.log(`[cron] task ${task.id} completed`);
    } catch (error) {
      console.error(`[cron] task ${task.id} failed:`, error.message);
    }
  });

  scheduledJobs.set(task.id, job);
}

async function refreshAllSchedules() {
  const config = await readConfig();

  for (const id of Array.from(scheduledJobs.keys())) {
    if (!config.tasks.some((t) => t.id === id)) {
      unscheduleTask(id);
    }
  }

  for (const task of config.tasks) {
    scheduleSingleTask(task);
  }
}

app.get('/api/auth/status', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.json({ loggedIn: false, user: null });
  }
  return res.json({
    loggedIn: true,
    user: {
      id: session.userId,
      username: session.username
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  const blockedMs = getLoginBlockMs(req, username);
  if (blockedMs > 0) {
    res.setHeader('Retry-After', String(Math.ceil(blockedMs / 1000)));
    return res.status(429).json({ error: `登录失败次数过多，请 ${Math.ceil(blockedMs / 1000)} 秒后重试` });
  }
  try {
    const userData = await readUsers();
    const user = findUserByUsername(userData.users, username);
    if (!user || !verifyPassword(password, user)) {
      markLoginFailure(req, username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    clearLoginFailures(req, username);
    const sid = createSession(user);
    setSessionCookie(res, sid);
    return res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || '登录失败' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const session = getSessionFromRequest(req);
  if (session?.id) {
    sessions.delete(session.id);
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get('/api/tasks', async (_, res) => {
  const config = await readConfig();
  res.json({ tasks: config.tasks });
});

app.post('/api/tasks', async (req, res) => {
  const body = req.body || {};

  const schoolName = String(body.schoolName || '').trim();
  const homepageUrl = String(body.homepageUrl || '').trim();
  const announcementParsed = combineAnnouncementUrls(body.announcementUrl, body.announcementUrls);
  const announcementUrl = announcementParsed.urls[0] || '';
  const announcementUrls = announcementParsed.urls;
  const scheduleTime = String(body.scheduleTime || '08:00').trim();
  const enabled = body.enabled !== false;
  const keywords = parseKeywords(body.keywords);
  const markdownOutputMode = normalizeMarkdownOutputMode(body.markdownOutputMode);
  const collegeParsed = normalizeCollegeUrls(body.collegeUrls);
  const collegeUrls = collegeParsed.urls;
  const crawlMode = normalizeCrawlMode(body.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(body.includeCollegePages, crawlMode);

  if (!schoolName) {
    return res.status(400).json({ error: 'schoolName 不能为空' });
  }
  if (!isValidHttpUrl(homepageUrl)) {
    return res.status(400).json({ error: 'homepageUrl 不是有效链接' });
  }
  if (announcementParsed.invalid.length) {
    return res.status(400).json({ error: `announcementUrls 含无效链接：${announcementParsed.invalid.slice(0, 3).join('，')}` });
  }
  if (collegeParsed.invalid.length) {
    return res.status(400).json({ error: `collegeUrls 含无效链接：${collegeParsed.invalid.slice(0, 3).join('，')}` });
  }
  if (!buildCronExpression(scheduleTime)) {
    return res.status(400).json({ error: 'scheduleTime 格式必须为 HH:mm，例如 08:30' });
  }

  try {
    const task = await mutateConfig(async (config) => {
      let nextTask;
      if (body.id) {
        const idx = config.tasks.findIndex((t) => t.id === body.id);
        if (idx < 0) {
          throw createHttpError(404, '任务不存在，无法更新');
        }

        const current = config.tasks[idx];
        nextTask = {
          ...current,
          schoolName,
          homepageUrl,
          announcementUrl,
          announcementUrls,
          scheduleTime,
          enabled,
          keywords,
          markdownOutputMode,
          crawlMode,
          includeCollegePages,
          collegeUrls,
          updatedAt: nowIsoSafe()
        };
        config.tasks[idx] = nextTask;
      } else {
        nextTask = {
          id: `task_${Date.now()}`,
          schoolName,
          homepageUrl,
          announcementUrl,
          announcementUrls,
          scheduleTime,
          enabled,
          keywords,
          markdownOutputMode,
          crawlMode,
          includeCollegePages,
          collegeUrls,
          createdAt: nowIsoSafe(),
          updatedAt: nowIsoSafe(),
          lastRunAt: '',
          lastError: '',
          lastResultFile: '',
          lastResultFiles: [],
          lastMatchedCount: 0
        };
        config.tasks.push(nextTask);
      }
      return nextTask;
    });
    scheduleSingleTask(task);
    res.json({ task });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '任务保存失败' });
  }
});

app.post('/api/tasks/:id/toggle', async (req, res) => {
  const id = req.params.id;
  const enabled = Boolean((req.body || {}).enabled);
  try {
    const task = await mutateConfig(async (config) => {
      const idx = config.tasks.findIndex((t) => t.id === id);
      if (idx < 0) {
        throw createHttpError(404, '任务不存在');
      }
      config.tasks[idx].enabled = enabled;
      config.tasks[idx].updatedAt = nowIsoSafe();
      return config.tasks[idx];
    });
    scheduleSingleTask(task);
    res.json({ task });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '任务更新失败' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await mutateConfig(async (config) => {
      const before = config.tasks.length;
      config.tasks = config.tasks.filter((t) => t.id !== id);
      if (config.tasks.length === before) {
        throw createHttpError(404, '任务不存在');
      }
    });
    unscheduleTask(id);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '任务删除失败' });
  }
});

app.post('/api/tasks/:id/scan', async (req, res) => {
  const id = req.params.id;
  const config = await readConfig();
  const task = config.tasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  try {
    const normalizedTask = normalizeTaskRecord(task);
    const scan = await scanAnnouncementCandidates(normalizedTask);
    res.json({ ok: true, taskId: id, task: normalizedTask, scan });
  } catch (error) {
    res.status(400).json({ error: error.message || '扫描失败' });
  }
});

app.post('/api/tasks/:id/confirm', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const selectedItems = body.selectedItems;
  const usedAnnouncementUrl = String(body.usedAnnouncementUrl || '').trim();
  const usedAnnouncementUrls = parseUrlList(body.usedAnnouncementUrls || []);

  const config = await readConfig();
  const idx = config.tasks.findIndex((t) => t.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const task = config.tasks[idx];
  try {
    const markdownOutputMode = normalizeMarkdownOutputMode(body.markdownOutputMode || task.markdownOutputMode);
    const fallbackUsedUrls = usedAnnouncementUrls.length ? usedAnnouncementUrls : task.announcementUrls || [];
    const result = await crawlSelectedNotices(
      { ...task, markdownOutputMode },
      'manual',
      selectedItems,
      usedAnnouncementUrl || task.announcementUrl,
      fallbackUsedUrls
    );

    const updatedTask = await mutateConfig(async (latestConfig) => {
      const latestIdx = latestConfig.tasks.findIndex((t) => t.id === id);
      if (latestIdx < 0) {
        throw createHttpError(404, '任务不存在');
      }
      const latestTask = latestConfig.tasks[latestIdx];
      latestTask.lastRunAt = nowIsoSafe();
      latestTask.lastError = '';
      latestTask.lastResultFile = result.fileName;
      latestTask.lastResultFiles = Array.isArray(result.fileNames) ? result.fileNames : result.fileName ? [result.fileName] : [];
      latestTask.lastMatchedCount = result.matchedCount;
      latestTask.updatedAt = nowIsoSafe();
      latestConfig.tasks[latestIdx] = latestTask;
      return latestTask;
    });

    res.json({ ok: true, result, task: updatedTask });
  } catch (error) {
    try {
      await mutateConfig(async (latestConfig) => {
        const latestIdx = latestConfig.tasks.findIndex((t) => t.id === id);
        if (latestIdx < 0) return;
        latestConfig.tasks[latestIdx].lastRunAt = nowIsoSafe();
        latestConfig.tasks[latestIdx].lastError = error.message || '抓取失败';
        latestConfig.tasks[latestIdx].updatedAt = nowIsoSafe();
      });
    } catch (writeError) {
      console.error(`[task] failed to persist confirm error for ${id}:`, writeError.message || writeError);
    }
    res.status(error.status || 400).json({ error: error.message || '确认爬取失败' });
  }
});

app.post('/api/tasks/:id/run', async (req, res) => {
  try {
    const result = await runTask(req.params.id, 'manual');
    res.json({
      ok: true,
      message: '抓取完成',
      result
    });
  } catch (error) {
    res.status(400).json({ error: error.message || '抓取失败' });
  }
});

app.post('/api/manual-scan', async (req, res) => {
  const body = req.body || {};
  const schoolName = String(body.schoolName || '').trim() || '自助爬取';
  const homepageUrl = String(body.homepageUrl || '').trim();
  const announcementParsed = combineAnnouncementUrls(body.announcementUrl, body.announcementUrls);
  const announcementUrl = announcementParsed.urls[0] || '';
  const announcementUrls = announcementParsed.urls;
  const keywords = parseKeywords(body.keywords);
  const markdownOutputMode = normalizeMarkdownOutputMode(body.markdownOutputMode);
  const collegeParsed = normalizeCollegeUrls(body.collegeUrls);
  const collegeUrls = collegeParsed.urls;
  const crawlMode = normalizeCrawlMode(body.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(body.includeCollegePages, crawlMode);

  if (!isValidHttpUrl(homepageUrl)) {
    return res.status(400).json({ error: 'homepageUrl 不是有效链接' });
  }
  if (announcementParsed.invalid.length) {
    return res.status(400).json({ error: `announcementUrls 含无效链接：${announcementParsed.invalid.slice(0, 3).join('，')}` });
  }
  if (collegeParsed.invalid.length) {
    return res.status(400).json({ error: `collegeUrls 含无效链接：${collegeParsed.invalid.slice(0, 3).join('，')}` });
  }

  try {
    const crawlTask = {
      id: 'manual',
      schoolName,
      homepageUrl,
      announcementUrl,
      announcementUrls,
      keywords,
      markdownOutputMode,
      crawlMode,
      includeCollegePages,
      collegeUrls
    };
    await saveManualPreset(crawlTask);
    const scan = await scanAnnouncementCandidates(crawlTask);
    res.json({ ok: true, scan });
  } catch (error) {
    res.status(400).json({ error: error.message || '扫描失败' });
  }
});

app.post('/api/manual-confirm', async (req, res) => {
  const body = req.body || {};
  const schoolName = String(body.schoolName || '').trim() || '自助爬取';
  const homepageUrl = String(body.homepageUrl || '').trim();
  const announcementParsed = combineAnnouncementUrls(body.announcementUrl, body.announcementUrls);
  const announcementUrl = announcementParsed.urls[0] || '';
  const announcementUrls = announcementParsed.urls;
  const keywords = parseKeywords(body.keywords);
  const markdownOutputMode = normalizeMarkdownOutputMode(body.markdownOutputMode);
  const collegeParsed = normalizeCollegeUrls(body.collegeUrls);
  const collegeUrls = collegeParsed.urls;
  const crawlMode = normalizeCrawlMode(body.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(body.includeCollegePages, crawlMode);
  const selectedItems = body.selectedItems;
  const usedAnnouncementUrl = String(body.usedAnnouncementUrl || '').trim();
  const usedAnnouncementUrls = parseUrlList(body.usedAnnouncementUrls || []);

  if (!isValidHttpUrl(homepageUrl)) {
    return res.status(400).json({ error: 'homepageUrl 不是有效链接' });
  }
  if (announcementParsed.invalid.length) {
    return res.status(400).json({ error: `announcementUrls 含无效链接：${announcementParsed.invalid.slice(0, 3).join('，')}` });
  }
  if (collegeParsed.invalid.length) {
    return res.status(400).json({ error: `collegeUrls 含无效链接：${collegeParsed.invalid.slice(0, 3).join('，')}` });
  }

  try {
    const crawlTask = {
      id: 'manual',
      schoolName,
      homepageUrl,
      announcementUrl,
      announcementUrls,
      keywords,
      markdownOutputMode,
      crawlMode,
      includeCollegePages,
      collegeUrls
    };
    await saveManualPreset(crawlTask);
    const fallbackUsedUrls = usedAnnouncementUrls.length ? usedAnnouncementUrls : announcementUrls;
    const result = await crawlSelectedNotices(
      crawlTask,
      'manual',
      selectedItems,
      usedAnnouncementUrl || announcementUrl,
      fallbackUsedUrls
    );
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message || '确认爬取失败' });
  }
});

app.post('/api/manual-crawl', async (req, res) => {
  const body = req.body || {};
  const schoolName = String(body.schoolName || '').trim() || '自助爬取';
  const homepageUrl = String(body.homepageUrl || '').trim();
  const announcementParsed = combineAnnouncementUrls(body.announcementUrl, body.announcementUrls);
  const announcementUrl = announcementParsed.urls[0] || '';
  const announcementUrls = announcementParsed.urls;
  const keywords = parseKeywords(body.keywords);
  const markdownOutputMode = normalizeMarkdownOutputMode(body.markdownOutputMode);
  const collegeParsed = normalizeCollegeUrls(body.collegeUrls);
  const collegeUrls = collegeParsed.urls;
  const crawlMode = normalizeCrawlMode(body.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(body.includeCollegePages, crawlMode);

  if (!isValidHttpUrl(homepageUrl)) {
    return res.status(400).json({ error: 'homepageUrl 不是有效链接' });
  }
  if (announcementParsed.invalid.length) {
    return res.status(400).json({ error: `announcementUrls 含无效链接：${announcementParsed.invalid.slice(0, 3).join('，')}` });
  }
  if (collegeParsed.invalid.length) {
    return res.status(400).json({ error: `collegeUrls 含无效链接：${collegeParsed.invalid.slice(0, 3).join('，')}` });
  }

  try {
    const crawlTask = {
      id: 'manual',
      schoolName,
      homepageUrl,
      announcementUrl,
      announcementUrls,
      keywords,
      markdownOutputMode,
      crawlMode,
      includeCollegePages,
      collegeUrls
    };
    await saveManualPreset(crawlTask);
    const result = await executeCrawl(crawlTask, 'manual');
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message || '自助爬取失败' });
  }
});

app.post('/api/verify-links', async (req, res) => {
  const homepageUrl = String((req.body || {}).homepageUrl || '').trim();
  const crawlMode = normalizeCrawlMode((req.body || {}).crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages((req.body || {}).includeCollegePages, crawlMode);

  if (!isValidHttpUrl(homepageUrl)) {
    return res.status(400).json({ error: '请输入有效的院校官网链接' });
  }

  try {
    let links = [];
    let collegeCandidates = [];
    if (crawlMode === 'graduate_adjustment') {
      const resources = await discoverGraduateAdjustmentLinks(homepageUrl, { includeCollegePages, returnMeta: true });
      links = resources.announcementCandidates || [];
      collegeCandidates = resources.collegeCandidates || [];
    } else {
      links = await discoverAnnouncementLinks(homepageUrl, crawlMode);
    }
    res.json({
      ok: true,
      homepageUrl,
      crawlMode,
      includeCollegePages,
      candidates: links,
      collegeCandidates,
      suggested: links[0] || null
    });
  } catch (error) {
    res.status(400).json({
      error: `核对失败：${error.message || '无法访问该链接'}`
    });
  }
});

app.post('/api/graduate-assistant', async (req, res) => {
  const body = req.body || {};
  const schoolName = String(body.schoolName || '').trim();
  const collegeName = String(body.collegeName || '').trim();
  const includeCollegePages = body.includeCollegePages !== false;
  if (!schoolName) {
    return res.status(400).json({ error: '请输入院校名称' });
  }

  try {
    const profile = await smartMatchGraduateBySchoolName(schoolName, { collegeName, includeCollegePages });
    res.json({ ok: true, profile });
  } catch (error) {
    res.status(400).json({ error: error.message || '智能匹配失败' });
  }
});

app.post('/api/graduate-news-check', async (req, res) => {
  const body = req.body || {};
  const schoolName = String(body.schoolName || '').trim();
  const collegeName = String(body.collegeName || '').trim();
  const includeCollegePages = body.includeCollegePages !== false;
  const focus = String(body.focus || 'general') === 'retest' ? 'retest' : 'general';
  if (!schoolName) {
    return res.status(400).json({ error: '请输入院校名称' });
  }

  try {
    const result = await queryGraduateRecentNoticesBySchoolName({
      schoolName,
      collegeName,
      includeCollegePages,
      focus
    });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message || '新公告查询失败' });
  }
});

app.get('/api/news-quick-schools', async (_, res) => {
  const config = await readConfig();
  res.json({ schools: config.quickNewsSchools || [] });
});

app.post('/api/news-quick-schools', async (req, res) => {
  const school = normalizeQuickRetestSchoolRecord(req.body || {});
  if (!school.schoolName) {
    return res.status(400).json({ error: '院校名称不能为空' });
  }
  const schools = await mutateConfig(async (config) => {
    const next = upsertQuickSchoolRecords(config.quickNewsSchools || [], school, 10);
    config.quickNewsSchools = next;
    config.quickRetestSchools = next;
    return config.quickNewsSchools;
  });
  res.json({ ok: true, schools });
});

app.post('/api/news-quick-schools/delete-many', async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!ids.length) {
    return res.status(400).json({ error: '请提供要删除的院校 ID 列表' });
  }
  try {
    const result = await mutateConfig(async (config) => {
      const before = (config.quickNewsSchools || []).length;
      config.quickNewsSchools = (config.quickNewsSchools || []).filter((x) => !ids.includes(x.id));
      config.quickRetestSchools = config.quickNewsSchools;
      if (config.quickNewsSchools.length === before) {
        throw createHttpError(404, '未找到可删除的院校记录');
      }
      return {
        deleted: before - config.quickNewsSchools.length,
        schools: config.quickNewsSchools
      };
    });
    res.json({ ok: true, deleted: result.deleted, schools: result.schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '删除固定院校失败' });
  }
});

app.delete('/api/news-quick-schools/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    const schools = await mutateConfig(async (config) => {
      const before = (config.quickNewsSchools || []).length;
      config.quickNewsSchools = (config.quickNewsSchools || []).filter((x) => x.id !== id);
      config.quickRetestSchools = config.quickNewsSchools;
      if (config.quickNewsSchools.length === before) {
        throw createHttpError(404, '院校记录不存在');
      }
      return config.quickNewsSchools;
    });
    res.json({ ok: true, schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '删除固定院校失败' });
  }
});

app.post('/api/news-quick-schools/sync', async (req, res) => {
  try {
    const result = await mutateConfig(async (config) => {
      const source = Array.isArray(config.quickNewsSchools) ? config.quickNewsSchools : [];
      if (!source.length) {
        throw createHttpError(400, '当前固定院校列表为空，无法同步');
      }
      const before = Array.isArray(config.quickAdjustmentSchools) ? config.quickAdjustmentSchools.length : 0;
      config.quickAdjustmentSchools = mergeQuickSchoolRecords(config.quickAdjustmentSchools || [], source, 10);
      return {
        syncedCount: Math.max(0, config.quickAdjustmentSchools.length - before),
        schools: config.quickAdjustmentSchools
      };
    });
    res.json({ ok: true, syncedCount: result.syncedCount, schools: result.schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '固定院校同步失败' });
  }
});

app.post('/api/graduate-news-batch', async (req, res) => {
  const body = req.body || {};
  const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const focus = String(body.focus || 'general') === 'retest' ? 'retest' : 'general';
  try {
    const config = await readConfig();
    const source = Array.isArray(config.quickNewsSchools) ? config.quickNewsSchools : [];
    const selected = (ids.length ? source.filter((x) => ids.includes(x.id)) : source).slice(0, 10);
    if (!selected.length) {
      return res.status(400).json({ error: '请先添加固定院校' });
    }
    const result = await queryGraduateRecentNoticesBatch(selected, { focus });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message || '固定院校查询失败' });
  }
});

app.get('/api/adjustment-quick-schools', async (_, res) => {
  const config = await readConfig();
  res.json({ schools: config.quickAdjustmentSchools || [] });
});

app.post('/api/adjustment-quick-schools', async (req, res) => {
  const school = normalizeQuickRetestSchoolRecord(req.body || {});
  if (!school.schoolName) {
    return res.status(400).json({ error: '院校名称不能为空' });
  }
  const schools = await mutateConfig(async (config) => {
    config.quickAdjustmentSchools = upsertQuickSchoolRecords(config.quickAdjustmentSchools || [], school, 10);
    return config.quickAdjustmentSchools;
  });
  res.json({ ok: true, schools });
});

app.post('/api/adjustment-quick-schools/delete-many', async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!ids.length) {
    return res.status(400).json({ error: '请提供要删除的院校 ID 列表' });
  }
  try {
    const result = await mutateConfig(async (config) => {
      const before = (config.quickAdjustmentSchools || []).length;
      config.quickAdjustmentSchools = (config.quickAdjustmentSchools || []).filter((x) => !ids.includes(x.id));
      if (config.quickAdjustmentSchools.length === before) {
        throw createHttpError(404, '未找到可删除的院校记录');
      }
      return {
        deleted: before - config.quickAdjustmentSchools.length,
        schools: config.quickAdjustmentSchools
      };
    });
    res.json({ ok: true, deleted: result.deleted, schools: result.schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '删除固定院校失败' });
  }
});

app.delete('/api/adjustment-quick-schools/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    const schools = await mutateConfig(async (config) => {
      const before = (config.quickAdjustmentSchools || []).length;
      config.quickAdjustmentSchools = (config.quickAdjustmentSchools || []).filter((x) => x.id !== id);
      if (config.quickAdjustmentSchools.length === before) {
        throw createHttpError(404, '院校记录不存在');
      }
      return config.quickAdjustmentSchools;
    });
    res.json({ ok: true, schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '删除固定院校失败' });
  }
});

app.post('/api/adjustment-quick-schools/sync', async (req, res) => {
  try {
    const result = await mutateConfig(async (config) => {
      const source = Array.isArray(config.quickAdjustmentSchools) ? config.quickAdjustmentSchools : [];
      if (!source.length) {
        throw createHttpError(400, '当前固定院校列表为空，无法同步');
      }
      const before = Array.isArray(config.quickNewsSchools) ? config.quickNewsSchools.length : 0;
      config.quickNewsSchools = mergeQuickSchoolRecords(config.quickNewsSchools || [], source, 10);
      config.quickRetestSchools = config.quickNewsSchools;
      return {
        syncedCount: Math.max(0, config.quickNewsSchools.length - before),
        schools: config.quickNewsSchools
      };
    });
    res.json({ ok: true, syncedCount: result.syncedCount, schools: result.schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '固定院校同步失败' });
  }
});

app.post('/api/graduate-assistant-batch', async (req, res) => {
  const body = req.body || {};
  const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  try {
    const config = await readConfig();
    const source = Array.isArray(config.quickAdjustmentSchools) ? config.quickAdjustmentSchools : [];
    const selected = (ids.length ? source.filter((x) => ids.includes(x.id)) : source).slice(0, 10);
    if (!selected.length) {
      return res.status(400).json({ error: '请先添加固定院校' });
    }
    const schools = [];
    const failedSchools = [];
    for (const item of selected) {
      try {
        const profile = await smartMatchGraduateBySchoolName(item.schoolName, {
          collegeName: item.collegeName || '',
          includeCollegePages: item.includeCollegePages !== false
        });
        schools.push({
          id: item.id,
          schoolName: profile.schoolName || item.schoolName,
          collegeName: profile.collegeName || item.collegeName || '',
          homepageUrl: profile.homepageUrl || '',
          collegeHomepageUrl: profile.collegeProfile?.matchedHomepageUrl || '',
          announcementCandidateCount: Array.isArray(profile.announcementCandidates) ? profile.announcementCandidates.length : 0,
          collegeCandidateCount: Array.isArray(profile.collegeCandidates) ? profile.collegeCandidates.length : 0,
          profile
        });
      } catch (error) {
        failedSchools.push({
          id: item.id,
          schoolName: item.schoolName,
          collegeName: item.collegeName || '',
          error: error.message || '查询失败'
        });
      }
    }
    res.json({
      ok: true,
      result: {
        scope: 'adjustment_batch',
        checkedAt: nowIsoSafe(),
        summary: {
          requested: selected.length,
          succeeded: schools.length,
          failed: failedSchools.length
        },
        schools,
        failedSchools
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || '调剂固定院校查询失败' });
  }
});

app.get('/api/retest-quick-schools', async (_, res) => {
  const config = await readConfig();
  res.json({ schools: config.quickNewsSchools || [] });
});

app.post('/api/retest-quick-schools', async (req, res) => {
  req.url = '/api/news-quick-schools';
  return app._router.handle(req, res, () => {});
});

app.post('/api/retest-quick-schools/delete-many', async (req, res) => {
  req.url = '/api/news-quick-schools/delete-many';
  return app._router.handle(req, res, () => {});
});

app.delete('/api/retest-quick-schools/:id', async (req, res) => {
  req.url = `/api/news-quick-schools/${req.params.id}`;
  return app._router.handle(req, res, () => {});
});

app.post('/api/graduate-retest-batch', async (req, res) => {
  req.body = { ...(req.body || {}), focus: 'retest' };
  req.url = '/api/graduate-news-batch';
  return app._router.handle(req, res, () => {});
});

app.get('/api/manual-presets', async (_, res) => {
  const config = await readConfig();
  res.json({ presets: decorateManualPresets(config.manualPresets || []) });
});

app.post('/api/manual-presets/sync-news', async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  try {
    const result = await mutateConfig(async (config) => {
      const source = Array.isArray(config.manualPresets) ? config.manualPresets.map(normalizePresetRecord) : [];
      const selected = ids.length ? source.filter((item) => ids.includes(item.id)) : source;
      if (!selected.length) {
        throw createHttpError(400, ids.length ? '未找到可同步的院校记录' : '最近十所院校为空，无法同步');
      }
      const incoming = selected.map((item) => ({
        schoolName: item.schoolName,
        collegeName: item.collegeName || '',
        includeCollegePages: item.includeCollegePages !== false
      }));
      const before = Array.isArray(config.quickNewsSchools) ? config.quickNewsSchools.length : 0;
      config.quickNewsSchools = mergeQuickSchoolRecords(config.quickNewsSchools || [], incoming, 10);
      config.quickRetestSchools = config.quickNewsSchools;
      return {
        syncedCount: Math.max(0, config.quickNewsSchools.length - before),
        schools: config.quickNewsSchools
      };
    });
    res.json({ ok: true, syncedCount: result.syncedCount, schools: result.schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '院校同步失败' });
  }
});

app.post('/api/manual-presets/sync-adjustment', async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  try {
    const result = await mutateConfig(async (config) => {
      const source = Array.isArray(config.manualPresets) ? config.manualPresets.map(normalizePresetRecord) : [];
      const selected = ids.length ? source.filter((item) => ids.includes(item.id)) : source;
      if (!selected.length) {
        throw createHttpError(400, ids.length ? '未找到可同步的院校记录' : '最近十所院校为空，无法同步');
      }
      const incoming = selected.map((item) => ({
        schoolName: item.schoolName,
        collegeName: item.collegeName || '',
        includeCollegePages: item.includeCollegePages !== false
      }));
      const before = Array.isArray(config.quickAdjustmentSchools) ? config.quickAdjustmentSchools.length : 0;
      config.quickAdjustmentSchools = mergeQuickSchoolRecords(config.quickAdjustmentSchools || [], incoming, 10);
      return {
        syncedCount: Math.max(0, config.quickAdjustmentSchools.length - before),
        schools: config.quickAdjustmentSchools
      };
    });
    res.json({ ok: true, syncedCount: result.syncedCount, schools: result.schools });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '院校同步失败' });
  }
});

app.post('/api/manual-presets/delete-many', async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map((x) => String(x)) : [];
  if (!ids.length) {
    return res.status(400).json({ error: '请提供要删除的院校记录 ID 列表' });
  }
  try {
    const result = await mutateConfig(async (config) => {
      const before = (config.manualPresets || []).length;
      config.manualPresets = (config.manualPresets || []).filter((x) => !ids.includes(x.id));
      if (config.manualPresets.length === before) {
        throw createHttpError(404, '未找到可删除的院校记录');
      }
      return { deleted: before - config.manualPresets.length, presets: config.manualPresets };
    });
    res.json({ ok: true, deleted: result.deleted, presets: result.presets });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '删除院校记录失败' });
  }
});

app.delete('/api/manual-presets/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const presets = await mutateConfig(async (config) => {
      const before = (config.manualPresets || []).length;
      config.manualPresets = (config.manualPresets || []).filter((x) => x.id !== id);
      if (config.manualPresets.length === before) {
        throw createHttpError(404, '格式不存在');
      }
      return config.manualPresets;
    });
    res.json({ ok: true, presets });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || '删除院校记录失败' });
  }
});

app.get('/api/files', async (_, res) => {
  const files = await fsp.readdir(OUTPUT_DIR);
  const mdFiles = files
    .filter((x) => x.endsWith('.md'))
    .map((name) => {
      const full = path.join(OUTPUT_DIR, name);
      const stat = fs.statSync(full);
      return {
        name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  res.json({ files: mdFiles });
});

app.post('/api/files/delete-many', async (req, res) => {
  const names = Array.isArray((req.body || {}).names)
    ? req.body.names.map((x) => path.basename(String(x || '').trim())).filter((x) => x && x.endsWith('.md'))
    : [];
  const uniqueNames = Array.from(new Set(names));
  if (!uniqueNames.length) {
    return res.status(400).json({ error: '请提供要删除的 Markdown 文件名列表' });
  }

  let deleted = 0;
  const missing = [];
  for (const fileName of uniqueNames) {
    const fullPath = path.join(OUTPUT_DIR, fileName);
    try {
      await fsp.unlink(fullPath);
      deleted += 1;
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        missing.push(fileName);
        continue;
      }
      return res.status(500).json({ error: `删除失败：${fileName}` });
    }
  }

  if (!deleted) {
    return res.status(404).json({ error: '未找到可删除的 Markdown 文件' });
  }
  res.json({ ok: true, deleted, missing });
});

app.get('/api/files/:name/content', async (req, res) => {
  const fileName = path.basename(req.params.name);
  if (!fileName.endsWith('.md')) {
    return res.status(400).json({ error: '仅支持预览 Markdown 文件' });
  }
  const fullPath = path.join(OUTPUT_DIR, fileName);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'file not found' });
  }

  const content = await fsp.readFile(fullPath, 'utf8');
  res.json({ name: fileName, content });
});

app.post('/api/files/:name/reveal', async (req, res) => {
  const fileName = path.basename(req.params.name);
  if (!fileName.endsWith('.md')) {
    return res.status(400).json({ error: '仅支持定位 Markdown 文件' });
  }
  const fullPath = path.join(OUTPUT_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'file not found' });
  }
  try {
    await revealFileInOs(fullPath);
    res.json({ ok: true, fileName, fullPath });
  } catch (error) {
    res.status(500).json({ error: error.message || '打开本地文件失败' });
  }
});

app.delete('/api/files/:name', async (req, res) => {
  const fileName = path.basename(req.params.name);
  if (!fileName.endsWith('.md')) {
    return res.status(400).json({ error: '仅支持删除 Markdown 文件' });
  }
  const fullPath = path.join(OUTPUT_DIR, fileName);
  try {
    await fsp.unlink(fullPath);
    res.json({ ok: true, deleted: fileName });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return res.status(404).json({ error: 'file not found' });
    }
    res.status(500).json({ error: '删除文件失败' });
  }
});

app.get('/api/files/:name', (req, res) => {
  const fileName = path.basename(req.params.name);
  if (!fileName.endsWith('.md')) {
    return res.status(400).send('only markdown files are allowed');
  }
  const fullPath = path.join(OUTPUT_DIR, fileName);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('file not found');
  }

  res.download(fullPath);
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, now: nowIsoSafe() });
});

async function bootstrap() {
  await ensureStorage();
  await refreshAllSchedules();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
