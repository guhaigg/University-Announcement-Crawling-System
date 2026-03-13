const taskForm = document.getElementById('task-form');
const manualForm = document.getElementById('manual-form');
const taskList = document.getElementById('task-list');
const fileList = document.getElementById('file-list');
const toast = document.getElementById('toast');
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const authWelcomeText = document.getElementById('auth-welcome-text');
const logoutBtn = document.getElementById('logout-btn');

const verifyPanel = document.getElementById('verify-panel');
const verifyList = document.getElementById('verify-list');
const manualVerifyPanel = document.getElementById('manual-verify-panel');
const manualVerifyList = document.getElementById('manual-verify-list');
const previewPanel = document.getElementById('preview-panel');
const previewTitle = document.getElementById('preview-title');
const previewContent = document.getElementById('preview-content');

const taskCrawlMode = document.getElementById('crawlMode');
const taskIncludeCollegePages = document.getElementById('includeCollegePages');
const taskCollegeUrls = document.getElementById('collegeUrls');
const manualCrawlMode = document.getElementById('manualCrawlMode');
const manualIncludeCollegePages = document.getElementById('manualIncludeCollegePages');
const manualCollegeUrls = document.getElementById('manualCollegeUrls');
const manualPresetList = document.getElementById('manual-preset-list');
const presetSelectAllBtn = document.getElementById('preset-select-all');
const presetInvertBtn = document.getElementById('preset-invert');
const presetDeleteSelectedBtn = document.getElementById('preset-delete-selected');
const fileSelectAllBtn = document.getElementById('file-select-all');
const fileInvertBtn = document.getElementById('file-invert');
const fileDeleteSelectedBtn = document.getElementById('file-delete-selected');
const fileDeleteAllBtn = document.getElementById('file-delete-all');
const moduleTabs = document.getElementById('module-tabs');
const modulePanels = Array.from(document.querySelectorAll('.module-panel'));

const scanPanel = document.getElementById('scan-panel');
const scanInfo = document.getElementById('scan-info');
const scanList = document.getElementById('scan-list');
const scanSelectAllBtn = document.getElementById('scan-select-all');
const scanInvertBtn = document.getElementById('scan-invert');
const scanConfirmBtn = document.getElementById('scan-confirm');
const scanClearBtn = document.getElementById('scan-clear');
const scanFilterKeyword = document.getElementById('scan-filter-keyword');
const scanFilterYear = document.getElementById('scan-filter-year');
const scanFilterResetBtn = document.getElementById('scan-filter-reset');
const scanPager = document.getElementById('scan-pager');
const verifyCollegePanel = document.getElementById('verify-college-panel');
const verifyCollegeList = document.getElementById('verify-college-list');
const manualVerifyCollegePanel = document.getElementById('manual-verify-college-panel');
const manualVerifyCollegeList = document.getElementById('manual-verify-college-list');
const adjustmentForm = document.getElementById('adjustment-form');
const adjustmentSchoolName = document.getElementById('adjustmentSchoolName');
const adjustmentCollegeName = document.getElementById('adjustmentCollegeName');
const adjustmentKeywords = document.getElementById('adjustmentKeywords');
const adjustmentScheduleTime = document.getElementById('adjustmentScheduleTime');
const adjustmentIncludeCollegePages = document.getElementById('adjustmentIncludeCollegePages');
const adjustmentApplyManualBtn = document.getElementById('adjustment-apply-manual-btn');
const adjustmentScanBtn = document.getElementById('adjustment-scan-btn');
const adjustmentCreateTaskBtn = document.getElementById('adjustment-create-task-btn');
const adjustmentResult = document.getElementById('adjustment-result');
const adjustmentSummary = document.getElementById('adjustment-summary');
const adjustmentHomepage = document.getElementById('adjustment-homepage');
const adjustmentCollegeHomepage = document.getElementById('adjustment-college-homepage');
const adjustmentAnnouncementList = document.getElementById('adjustment-announcement-list');
const adjustmentAnnouncementPager = document.getElementById('adjustment-announcement-pager');
const adjustmentCollegeHomepageList = document.getElementById('adjustment-college-homepage-list');
const adjustmentCollegeHomepagePager = document.getElementById('adjustment-college-homepage-pager');
const adjustmentCollegeList = document.getElementById('adjustment-college-list');
const adjustmentCollegePager = document.getElementById('adjustment-college-pager');
const newsQueryForm = document.getElementById('news-query-form');
const newsQueryModuleTitle = document.querySelector('#news-query-module > h2');
const newsQueryFocus = document.getElementById('newsQueryFocus');
const newsQuerySchoolName = document.getElementById('newsQuerySchoolName');
const newsQueryCollegeName = document.getElementById('newsQueryCollegeName');
const newsQueryIncludeCollegePages = document.getElementById('newsQueryIncludeCollegePages');
const newsQueryRunBtn = document.getElementById('news-query-run-btn');
const newsQueryResult = document.getElementById('news-query-result');
const newsQuerySummary = document.getElementById('news-query-summary');
const newsQueryHomepage = document.getElementById('news-query-homepage');
const newsQueryCollegeHomepage = document.getElementById('news-query-college-homepage');
const newsQueryStats = document.getElementById('news-query-stats');
const newsQueryDayFilter = document.getElementById('news-query-day-filter');
const newsQueryKeywordFilter = document.getElementById('news-query-keyword-filter');
const newsQueryFilterResetBtn = document.getElementById('news-query-filter-reset');
const newsQueryList = document.getElementById('news-query-list');
const newsQueryPager = document.getElementById('news-query-pager');
const newsViewerPanel = document.getElementById('news-viewer-panel');
const newsViewerTitle = document.getElementById('news-viewer-title');
const newsViewerFrame = document.getElementById('news-viewer-frame');
const newsQuickSchoolName = document.getElementById('newsQuickSchoolName');
const newsQuickCollegeName = document.getElementById('newsQuickCollegeName');
const newsQuickIncludeCollegePages = document.getElementById('newsQuickIncludeCollegePages');
const newsQuickAddBtn = document.getElementById('news-quick-add-btn');
const newsQuickCancelBtn = document.getElementById('news-quick-cancel-btn');
const newsQuickEditorTip = document.getElementById('news-quick-editor-tip');
const newsQuickList = document.getElementById('news-quick-list');
const adjustmentQuickSchoolName = document.getElementById('adjustmentQuickSchoolName');
const adjustmentQuickCollegeName = document.getElementById('adjustmentQuickCollegeName');
const adjustmentQuickIncludeCollegePages = document.getElementById('adjustmentQuickIncludeCollegePages');
const adjustmentQuickAddBtn = document.getElementById('adjustment-quick-add-btn');
const adjustmentQuickCancelBtn = document.getElementById('adjustment-quick-cancel-btn');
const adjustmentQuickEditorTip = document.getElementById('adjustment-quick-editor-tip');
const adjustmentQuickList = document.getElementById('adjustment-quick-list');
const filePager = document.getElementById('file-pager');

let pendingScan = null;
let manualPresetCache = [];
let fileCache = [];
let selectedFileNames = new Set();
let adjustmentMatch = null;
let newsQueryState = null;
let newsQuickSchools = [];
let adjustmentQuickSchools = [];
let editingNewsQuickId = '';
let editingAdjustmentQuickId = '';
let activeModuleId = 'daily-module';
let activeNewsQueryFocus = String(newsQueryFocus?.value || 'general') === 'retest' ? 'retest' : 'general';
let currentUser = null;

const paginationState = {
  scan: { page: 1, pageSize: 20 },
  files: { page: 1, pageSize: 10 },
  adjustmentAnnouncement: { page: 1, pageSize: 10 },
  adjustmentCollegeHomepage: { page: 1, pageSize: 8 },
  adjustmentCollege: { page: 1, pageSize: 10 },
  newsQuery: { page: 1, pageSize: 12 }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.add('show');
  toast.classList.toggle('error', isError);
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setButtonBusy(button, busy, busyText = '处理中...') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originText) {
      button.dataset.originText = button.textContent;
    }
    button.disabled = true;
    button.textContent = busyText;
    return;
  }
  button.disabled = false;
  if (button.dataset.originText) {
    button.textContent = button.dataset.originText;
  }
}

function updateAuthInfo(user) {
  currentUser = user || null;
  if (authWelcomeText) {
    authWelcomeText.textContent = currentUser ? `当前登录：${currentUser.username}` : '未登录';
  }
  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', !currentUser);
  }
}

function openAuthModal(message = '') {
  if (!authModal) return;
  authModal.classList.remove('hidden');
  if (loginError) loginError.textContent = message || '';
  if (loginUsername && !loginUsername.value) {
    loginUsername.value = 'admin';
  }
  if (loginPassword) loginPassword.value = '';
  if (loginPassword) loginPassword.focus();
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.add('hidden');
  if (loginError) loginError.textContent = '';
}

async function ensureAuthStatus() {
  try {
    const data = await api('/api/auth/status', { skipAuthRedirect: true });
    if (data.loggedIn && data.user) {
      updateAuthInfo(data.user);
      closeAuthModal();
      return true;
    }
    updateAuthInfo(null);
    openAuthModal('请先登录后再使用系统');
    return false;
  } catch (error) {
    updateAuthInfo(null);
    openAuthModal(error.message || '登录状态检查失败');
    return false;
  }
}

function getModeLabel(mode) {
  return mode === 'graduate_adjustment' ? '研究生调剂公告' : '普通公告';
}

function normalizeMode(mode) {
  return mode === 'graduate_adjustment' ? 'graduate_adjustment' : 'general';
}

function normalizeIncludeCollegePages(value, mode) {
  if (typeof value === 'boolean') return value;
  return normalizeMode(mode) === 'graduate_adjustment';
}

function parseUrlLines(text) {
  return String(text || '')
    .split(/[,\n，；;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeUrlForCompare(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    u.hash = '';
    let normalized = u.toString().toLowerCase();
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  } catch (error) {
    return raw.toLowerCase();
  }
}

function appendUniqueUrls(textarea, urls) {
  const existing = parseUrlLines(textarea.value);
  const seen = new Set(existing);
  const merged = [...existing];
  urls.forEach((url) => {
    if (!seen.has(url)) {
      seen.add(url);
      merged.push(url);
    }
  });
  textarea.value = merged.join('\n');
}

function normalizeFilterText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function ensurePagerState(key) {
  if (!paginationState[key]) {
    paginationState[key] = { page: 1, pageSize: 10 };
  }
  return paginationState[key];
}

function getPagedItems(items, key) {
  const list = Array.isArray(items) ? items : [];
  const state = ensurePagerState(key);
  const pageSize = Math.max(1, Number(state.pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  state.page = Math.min(Math.max(1, Number(state.page) || 1), totalPages);
  const start = (state.page - 1) * pageSize;
  return {
    pageItems: list.slice(start, start + pageSize),
    page: state.page,
    pageSize,
    total: list.length,
    totalPages
  };
}

function renderPager(targetEl, key, total) {
  if (!targetEl) return;
  const state = ensurePagerState(key);
  const pageSize = Math.max(1, Number(state.pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  state.page = Math.min(Math.max(1, Number(state.page) || 1), totalPages);

  if (total <= pageSize) {
    targetEl.innerHTML = '';
    targetEl.classList.add('hidden');
    return;
  }

  targetEl.classList.remove('hidden');
  targetEl.innerHTML = `
    <button type="button" data-pager-key="${key}" data-pager-action="prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
    <span>${state.page} / ${totalPages} 页（共 ${total} 条）</span>
    <button type="button" data-pager-key="${key}" data-pager-action="next" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>
  `;
}

function getScanCandidateKey(item) {
  return `${normalizeUrlForCompare(item?.url || '')}::${normalizeFilterText(item?.title || '')}`;
}

function extractScanCandidateYear(item) {
  const source = `${item?.dateHint || ''} ${item?.title || ''} ${item?.url || ''}`;
  const match = source.match(/\b(20\d{2})\b/);
  return match ? match[1] : '';
}

function getScanFilterTerms(keywordText) {
  return String(keywordText || '')
    .split(/[\s,，;；]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => normalizeFilterText(x));
}

function matchScanKeywordTerms(item, terms) {
  if (!terms.length) return true;
  const source = normalizeFilterText(`${item?.title || ''} ${item?.url || ''} ${item?.dateHint || ''} ${item?.sourcePage || ''}`);
  return terms.every((term) => source.includes(term));
}

function getNewsDayBadgeClass(bucket) {
  if (bucket === 'today') return 'news-badge-today';
  if (bucket === 'yesterday') return 'news-badge-yesterday';
  if (bucket === 'day_before') return 'news-badge-day-before';
  return 'news-badge-other';
}

function clearNewsViewer() {
  if (!newsViewerPanel || !newsViewerFrame || !newsViewerTitle) return;
  newsViewerPanel.classList.add('hidden');
  newsViewerTitle.textContent = '页内浏览';
  newsViewerFrame.src = 'about:blank';
}

function applyNewsQueryFilters() {
  if (!newsQueryState) return [];
  const dayFilter = String(newsQueryDayFilter?.value || '').trim();
  const terms = getScanFilterTerms(newsQueryKeywordFilter?.value || '');
  const filtered = (newsQueryState.items || []).filter((item) => {
    if (dayFilter && item.dayBucket !== dayFilter) return false;
    return matchScanKeywordTerms(item, terms);
  });
  newsQueryState.filteredItems = filtered;
  return filtered;
}

function renderNewsQueryList() {
  if (!newsQueryState || !newsQueryList) return;
  const filtered = Array.isArray(newsQueryState.filteredItems) ? newsQueryState.filteredItems : [];
  const pageInfo = getPagedItems(filtered, 'newsQuery');
  renderPager(newsQueryPager, 'newsQuery', filtered.length);
  if (!filtered.length) {
    newsQueryList.innerHTML = '<li class="empty">当前筛选条件下没有公告。</li>';
    return;
  }

  newsQueryList.innerHTML = pageInfo.pageItems
    .map((item) => {
      const safeUrl = escapeHtml(item.url || '');
      const schoolLabel = item.schoolName
        ? `<span class="scan-date">院校：${escapeHtml(item.schoolName)}${item.collegeName ? ` / ${escapeHtml(item.collegeName)}` : ''}</span>`
        : '';
      const dateText = item.publishedDate ? `<span class="scan-date">发布日期：${escapeHtml(item.publishedDate)}</span>` : '';
      const dayBadge = `<span class="scan-badge ${getNewsDayBadgeClass(item.dayBucket)}">${escapeHtml(item.dayLabel || '未知日期')}</span>`;
      const retestBadge = item.retestHits > 0 ? `<span class="scan-badge news-badge-retest">复试命中 x${item.retestHits}</span>` : '';
      const retestSourceBadge =
        item.retestMatchedBy && item.retestMatchedBy !== 'none'
          ? `<span class="scan-badge news-badge-retest-source">${
              item.retestMatchedBy === 'both'
                ? '标题+正文命中'
                : item.retestMatchedBy === 'content'
                  ? '正文命中'
                  : '标题命中'
            }</span>`
          : '';
      const retestSnippet = item.retestSnippet ? `<span class="scan-date news-snippet">命中片段：${escapeHtml(item.retestSnippet)}</span>` : '';
      const sourceText = item.sourcePage ? `<span class="scan-date">来源页：${escapeHtml(item.sourcePage)}</span>` : '';
      return `<li class="scan-item news-item">
        <div class="news-item-main">
          <span class="scan-title">${escapeHtml(item.title || '(无标题)')}</span>
          ${schoolLabel}
          ${dateText}
          ${dayBadge}
          ${retestBadge}
          ${retestSourceBadge}
          ${retestSnippet}
          ${sourceText}
        </div>
        <div class="news-item-actions">
          <button type="button" class="muted" data-action="preview-news-link" data-url="${encodeURIComponent(item.url || '')}" data-title="${encodeURIComponent(item.title || '')}">页内浏览</button>
          <a href="${safeUrl}" target="_blank">新窗口打开</a>
        </div>
      </li>`;
    })
    .join('');
}

function refreshNewsQuerySummary() {
  if (!newsQueryState || !newsQuerySummary) return;
  const summary = newsQueryState.summary || {};
  const filteredCount = Array.isArray(newsQueryState.filteredItems) ? newsQueryState.filteredItems.length : 0;
  const dayRange = newsQueryState.dayRange || {};
  const focusLabel = newsQueryState.focus === 'retest' ? '复试内容' : '研招公告';
  if (newsQueryState.scope === 'batch') {
    newsQuerySummary.textContent =
      `固定院校一键查询（${focusLabel}）：成功 ${summary.succeeded || 0}/${summary.requested || 0} 所，` +
      `今日(${dayRange.today || '-'}) ${summary.today || 0} 条，` +
      `昨日(${dayRange.yesterday || '-'}) ${summary.yesterday || 0} 条，` +
      `前日(${dayRange.dayBefore || '-'}) ${summary.dayBefore || 0} 条，` +
      `更早/未知 ${summary.other || 0} 条，当前显示 ${filteredCount}/${summary.total || 0} 条。`;
    return;
  }
  newsQuerySummary.textContent =
    `近三日${focusLabel}分析：今日(${dayRange.today || '-'}) ${summary.today || 0} 条，` +
    `昨日(${dayRange.yesterday || '-'}) ${summary.yesterday || 0} 条，` +
    `前日(${dayRange.dayBefore || '-'}) ${summary.dayBefore || 0} 条，` +
    `更早/未知 ${summary.other || 0} 条，当前显示 ${filteredCount}/${summary.total || 0} 条。`;
}

function rerenderNewsQueryByFilters(resetPage = false) {
  if (!newsQueryState) return;
  if (resetPage) ensurePagerState('newsQuery').page = 1;
  applyNewsQueryFilters();
  renderNewsQueryList();
  refreshNewsQuerySummary();
}

function renderNewsQueryResult(result) {
  newsQueryState = result || null;
  ensurePagerState('newsQuery').page = 1;

  if (newsQueryState?.focus) {
    applyNewsQueryFocusUI(newsQueryState.focus);
  }

  if (!newsQueryState) {
    if (newsQueryResult) newsQueryResult.classList.add('hidden');
    if (newsQueryList) newsQueryList.innerHTML = '';
    if (newsQueryStats) newsQueryStats.innerHTML = '';
    if (newsQueryHomepage) newsQueryHomepage.textContent = '';
    if (newsQueryCollegeHomepage) newsQueryCollegeHomepage.textContent = '';
    if (newsQuerySummary) newsQuerySummary.textContent = '';
    renderPager(newsQueryPager, 'newsQuery', 0);
    clearNewsViewer();
    return;
  }

  if (newsQueryResult) newsQueryResult.classList.remove('hidden');
  if (newsQueryDayFilter) newsQueryDayFilter.value = '';
  if (newsQueryKeywordFilter) newsQueryKeywordFilter.value = '';

  const profile = newsQueryState.profile || {};
  const homepageUrl = profile.homepageUrl || '';
  const collegeHomepageUrl = profile.collegeHomepageUrl || '';
  if (newsQueryHomepage) {
    if (newsQueryState.scope === 'batch') {
      newsQueryHomepage.innerHTML = `<strong>查询范围：</strong>固定院校一键查询（${newsQueryState.summary?.succeeded || 0}/${newsQueryState.summary?.requested || 0} 所成功）`;
    } else {
      newsQueryHomepage.innerHTML = homepageUrl
        ? `<strong>匹配官网：</strong><a href="${escapeHtml(homepageUrl)}" target="_blank">${escapeHtml(homepageUrl)}</a>`
        : '<strong>匹配官网：</strong>未匹配';
    }
  }
  if (newsQueryCollegeHomepage) {
    if (newsQueryState.scope === 'batch') {
      const failed = Array.isArray(newsQueryState.failedSchools) ? newsQueryState.failedSchools : [];
      newsQueryCollegeHomepage.innerHTML = failed.length
        ? `<strong>失败院校：</strong>${escapeHtml(failed.map((x) => `${x.schoolName}${x.collegeName ? `/${x.collegeName}` : ''}`).join('，'))}`
        : '<strong>失败院校：</strong>无';
    } else {
      newsQueryCollegeHomepage.innerHTML = collegeHomepageUrl
        ? `<strong>匹配学院官网：</strong><a href="${escapeHtml(collegeHomepageUrl)}" target="_blank">${escapeHtml(collegeHomepageUrl)}</a>`
        : `<strong>匹配学院官网：</strong>${newsQueryState.collegeName ? '未匹配' : '未填写学院名称'}`;
    }
  }

  if (newsQueryStats) {
    const summary = newsQueryState.summary || {};
    const cards = [
      { label: '今日', value: summary.today || 0, className: 'news-stat-today' },
      { label: '昨日', value: summary.yesterday || 0, className: 'news-stat-yesterday' },
      { label: '前日', value: summary.dayBefore || 0, className: 'news-stat-day-before' },
      { label: '更早/未知', value: summary.other || 0, className: 'news-stat-other' }
    ];
    newsQueryStats.innerHTML = cards
      .map((card) => `<article class="news-stat ${card.className}"><h4>${card.label}</h4><p>${card.value}</p></article>`)
      .join('');
  }

  applyNewsQueryFilters();
  renderNewsQueryList();
  refreshNewsQuerySummary();
  clearNewsViewer();
}

function renderNewsQuickSchools() {
  if (!newsQuickList) return;
  if (!newsQuickSchools.length) {
    newsQuickList.innerHTML = '<li class="empty">暂无固定院校（最多 10 所）</li>';
    return;
  }
  newsQuickList.innerHTML = newsQuickSchools
    .map((item) => {
      const label = `${item.schoolName}${item.collegeName ? ` / ${item.collegeName}` : ''}`;
      const editing = editingNewsQuickId && editingNewsQuickId === item.id;
      return `<li class="${editing ? 'editing' : ''}">
        <strong>${escapeHtml(label)}</strong>
        ${editing ? '<span class="quick-editing-tag">编辑中</span>' : ''}
        <button type="button" data-action="run-news-quick" data-id="${item.id}">查询</button>
        <button type="button" data-action="apply-news-quick" data-id="${item.id}" class="muted">套用</button>
        <button type="button" data-action="edit-news-quick" data-id="${item.id}" class="muted">修改</button>
        <button type="button" data-action="delete-news-quick" data-id="${item.id}" class="danger">删除</button>
      </li>`;
    })
    .join('');
}

async function loadNewsQuickSchools() {
  const data = await api('/api/news-quick-schools');
  newsQuickSchools = Array.isArray(data.schools) ? data.schools : [];
  renderNewsQuickSchools();
}

function renderAdjustmentQuickSchools() {
  if (!adjustmentQuickList) return;
  if (!adjustmentQuickSchools.length) {
    adjustmentQuickList.innerHTML = '<li class="empty">暂无固定院校（最多 10 所）</li>';
    return;
  }
  adjustmentQuickList.innerHTML = adjustmentQuickSchools
    .map((item) => {
      const label = `${item.schoolName}${item.collegeName ? ` / ${item.collegeName}` : ''}`;
      const editing = editingAdjustmentQuickId && editingAdjustmentQuickId === item.id;
      return `<li class="${editing ? 'editing' : ''}">
        <strong>${escapeHtml(label)}</strong>
        ${editing ? '<span class="quick-editing-tag">编辑中</span>' : ''}
        <button type="button" data-action="run-adjustment-quick" data-id="${item.id}">查询</button>
        <button type="button" data-action="apply-adjustment-quick" data-id="${item.id}" class="muted">套用</button>
        <button type="button" data-action="edit-adjustment-quick" data-id="${item.id}" class="muted">修改</button>
        <button type="button" data-action="delete-adjustment-quick" data-id="${item.id}" class="danger">删除</button>
      </li>`;
    })
    .join('');
}

async function loadAdjustmentQuickSchools() {
  const data = await api('/api/adjustment-quick-schools');
  adjustmentQuickSchools = Array.isArray(data.schools) ? data.schools : [];
  renderAdjustmentQuickSchools();
}

function fillAdjustmentQueryFromQuick(item) {
  if (!item) return;
  if (adjustmentSchoolName) adjustmentSchoolName.value = item.schoolName || '';
  if (adjustmentCollegeName) adjustmentCollegeName.value = item.collegeName || '';
  if (adjustmentIncludeCollegePages) adjustmentIncludeCollegePages.checked = item.includeCollegePages !== false;
  switchModule('adjustment-module');
}

function fillNewsQueryFromQuick(item) {
  if (!item) return;
  if (newsQuerySchoolName) newsQuerySchoolName.value = item.schoolName || '';
  if (newsQueryCollegeName) newsQueryCollegeName.value = item.collegeName || '';
  if (newsQueryIncludeCollegePages) newsQueryIncludeCollegePages.checked = item.includeCollegePages !== false;
  switchModule('news-query-module');
}

function startNewsQuickEdit(item) {
  if (!item) return;
  editingNewsQuickId = item.id;
  if (newsQuickSchoolName) newsQuickSchoolName.value = item.schoolName || '';
  if (newsQuickCollegeName) newsQuickCollegeName.value = item.collegeName || '';
  if (newsQuickIncludeCollegePages) newsQuickIncludeCollegePages.checked = item.includeCollegePages !== false;
  if (newsQuickAddBtn) newsQuickAddBtn.textContent = '保存修改';
  if (newsQuickEditorTip) {
    const label = `${item.schoolName || '未命名院校'}${item.collegeName ? ` / ${item.collegeName}` : ''}`;
    newsQuickEditorTip.textContent = `当前正在修改：${label}`;
  }
  renderNewsQuickSchools();
}

function startAdjustmentQuickEdit(item) {
  if (!item) return;
  editingAdjustmentQuickId = item.id;
  if (adjustmentQuickSchoolName) adjustmentQuickSchoolName.value = item.schoolName || '';
  if (adjustmentQuickCollegeName) adjustmentQuickCollegeName.value = item.collegeName || '';
  if (adjustmentQuickIncludeCollegePages) adjustmentQuickIncludeCollegePages.checked = item.includeCollegePages !== false;
  if (adjustmentQuickAddBtn) adjustmentQuickAddBtn.textContent = '保存修改';
  if (adjustmentQuickEditorTip) {
    const label = `${item.schoolName || '未命名院校'}${item.collegeName ? ` / ${item.collegeName}` : ''}`;
    adjustmentQuickEditorTip.textContent = `当前正在修改：${label}`;
  }
  renderAdjustmentQuickSchools();
}

function resetNewsQuickEditor() {
  editingNewsQuickId = '';
  if (newsQuickSchoolName) newsQuickSchoolName.value = '';
  if (newsQuickCollegeName) newsQuickCollegeName.value = '';
  if (newsQuickIncludeCollegePages) newsQuickIncludeCollegePages.checked = true;
  if (newsQuickAddBtn) newsQuickAddBtn.textContent = '加入固定院校';
  if (newsQuickEditorTip) newsQuickEditorTip.textContent = '当前为新增模式。';
  renderNewsQuickSchools();
}

function resetAdjustmentQuickEditor() {
  editingAdjustmentQuickId = '';
  if (adjustmentQuickSchoolName) adjustmentQuickSchoolName.value = '';
  if (adjustmentQuickCollegeName) adjustmentQuickCollegeName.value = '';
  if (adjustmentQuickIncludeCollegePages) adjustmentQuickIncludeCollegePages.checked = true;
  if (adjustmentQuickAddBtn) adjustmentQuickAddBtn.textContent = '加入固定院校';
  if (adjustmentQuickEditorTip) adjustmentQuickEditorTip.textContent = '当前为新增模式。';
  renderAdjustmentQuickSchools();
}

async function runNewsQuickQuery(item) {
  if (!item) return;
  fillNewsQueryFromQuick(item);
  const focus = String(newsQueryFocus?.value || 'general') === 'retest' ? 'retest' : 'general';
  try {
    setButtonBusy(newsQueryRunBtn, true, '查询中...');
    const data = await api('/api/graduate-news-check', {
      method: 'POST',
      body: JSON.stringify({
        schoolName: item.schoolName || '',
        collegeName: item.collegeName || '',
        includeCollegePages: item.includeCollegePages !== false,
        focus
      })
    });
    renderNewsQueryResult(data.result);
    const summary = data.result?.summary || {};
    const hasRecent = (summary.today || 0) + (summary.yesterday || 0) + (summary.dayBefore || 0);
    const label = focus === 'retest' ? '复试相关公告' : '研招公告';
    showToast(hasRecent > 0 ? `已查询：${item.schoolName}，近三日 ${hasRecent} 条${label}` : `已查询：${item.schoolName}，近三日无${label}`);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(newsQueryRunBtn, false);
  }
}

async function runAdjustmentQuickQuery(item) {
  if (!item) return;
  fillAdjustmentQueryFromQuick(item);
  try {
    setButtonBusy(adjustmentCreateTaskBtn, true, '查询中...');
    const data = await api('/api/graduate-assistant', {
      method: 'POST',
      body: JSON.stringify({
        schoolName: item.schoolName || '',
        collegeName: item.collegeName || '',
        includeCollegePages: item.includeCollegePages !== false
      })
    });
    renderAdjustmentMatch(data.profile);
    showToast(`已完成：${item.schoolName} 智能匹配`);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(adjustmentCreateTaskBtn, false);
  }
}

function getSelectedAdjustmentAnnouncementUrls() {
  if (adjustmentMatch && adjustmentMatch.selectedAnnouncementUrls instanceof Set) {
    return Array.from(adjustmentMatch.selectedAnnouncementUrls).filter(Boolean);
  }
  return Array.from(adjustmentAnnouncementList.querySelectorAll('input[data-announcement-url]:checked'))
    .map((x) => x.dataset.announcementUrl)
    .filter(Boolean);
}

function getSelectedAdjustmentCollegeHomepageUrl() {
  if (adjustmentMatch && adjustmentMatch.selectedCollegeHomepageUrl) {
    return adjustmentMatch.selectedCollegeHomepageUrl;
  }
  const selected = adjustmentCollegeHomepageList.querySelector('input[name="adjustment-college-homepage"]:checked');
  return selected ? selected.value : '';
}

function getSelectedAdjustmentCollegeUrls() {
  if (adjustmentMatch && adjustmentMatch.selectedCollegeUrls instanceof Set) {
    return Array.from(adjustmentMatch.selectedCollegeUrls).filter(Boolean);
  }
  return Array.from(adjustmentCollegeList.querySelectorAll('input[data-college-url]:checked'))
    .map((x) => x.dataset.collegeUrl)
    .filter(Boolean);
}

function buildAdjustmentCollegeHomepageCandidates() {
  if (!adjustmentMatch) return [];
  const candidates = [];
  const seen = new Set();
  const push = (item, fallbackText = '') => {
    if (!item || !item.url) return;
    const key = normalizeUrlForCompare(item.url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push({
      text: item.title || item.text || fallbackText || item.url,
      url: item.url,
      score: Number(item.score) || 0
    });
  };
  const matched = adjustmentMatch.collegeProfile?.matchedHomepageUrl || '';
  if (matched) {
    push({ url: matched, title: '智能匹配学院官网', score: 999 });
  }
  const fromProfile = Array.isArray(adjustmentMatch.collegeProfile?.homepageCandidates) ? adjustmentMatch.collegeProfile.homepageCandidates : [];
  fromProfile.forEach((item) => push(item));
  return candidates;
}

function renderAdjustmentAnnouncementCandidates() {
  if (!adjustmentMatch) return;
  const ann = Array.isArray(adjustmentMatch.announcementCandidates) ? adjustmentMatch.announcementCandidates : [];
  const pageInfo = getPagedItems(ann, 'adjustmentAnnouncement');
  renderPager(adjustmentAnnouncementPager, 'adjustmentAnnouncement', ann.length);
  if (!ann.length) {
    adjustmentAnnouncementList.innerHTML = '<li class="empty">未匹配到研究生招生页候选，请改用手动核对链接。</li>';
    return;
  }
  adjustmentAnnouncementList.innerHTML = pageInfo.pageItems
    .map((item) => {
      const key = normalizeUrlForCompare(item.url);
      const checked = adjustmentMatch.selectedAnnouncementUrls?.has(item.url) || adjustmentMatch.selectedAnnouncementKeys?.has(key);
      const scoreText = Number.isFinite(item.rankScore) ? `（匹配分 ${Math.round(item.rankScore)}）` : '';
      const sourceText = item.source ? ` [${item.source === 'site_discovery' ? '站内发现' : '搜索匹配'}]` : '';
      return `<li>
        <label class="check-row">
          <input type="checkbox" data-announcement-url="${escapeHtml(item.url)}" ${checked ? 'checked' : ''} />
          <span>${escapeHtml(item.text || item.url)}${escapeHtml(scoreText)}${escapeHtml(sourceText)} -> ${escapeHtml(item.url)}</span>
        </label>
      </li>`;
    })
    .join('');
}

function renderAdjustmentCollegeHomepageCandidates() {
  if (!adjustmentMatch) return;
  const candidates = Array.isArray(adjustmentMatch.collegeHomepageCandidates) ? adjustmentMatch.collegeHomepageCandidates : [];
  const pageInfo = getPagedItems(candidates, 'adjustmentCollegeHomepage');
  renderPager(adjustmentCollegeHomepagePager, 'adjustmentCollegeHomepage', candidates.length);
  if (!candidates.length) {
    adjustmentCollegeHomepageList.innerHTML = '<li class="empty">未匹配到学院官网候选。</li>';
    return;
  }
  const selectedNormalized = normalizeUrlForCompare(adjustmentMatch.selectedCollegeHomepageUrl || '');
  adjustmentCollegeHomepageList.innerHTML = pageInfo.pageItems
    .map((item, idx) => {
      const normalized = normalizeUrlForCompare(item.url);
      const checked = selectedNormalized ? normalized === selectedNormalized : idx === 0;
      const scoreText = item.score ? `（评分 ${item.score}）` : '';
      return `<li>
        <label class="check-row">
          <input type="radio" name="adjustment-college-homepage" value="${escapeHtml(item.url)}" ${checked ? 'checked' : ''} />
          <span>${escapeHtml(item.text)} ${escapeHtml(scoreText)} -> ${escapeHtml(item.url)}</span>
        </label>
      </li>`;
    })
    .join('');
}

function renderAdjustmentCollegeCandidates() {
  if (!adjustmentMatch) return;
  const colleges = Array.isArray(adjustmentMatch.collegeCandidates) ? adjustmentMatch.collegeCandidates : [];
  const pageInfo = getPagedItems(colleges, 'adjustmentCollege');
  renderPager(adjustmentCollegePager, 'adjustmentCollege', colleges.length);
  if (!colleges.length) {
    adjustmentCollegeList.innerHTML = '<li class="empty">未匹配到学院候选链接（可在自助爬取里手动填写）。</li>';
    return;
  }
  adjustmentCollegeList.innerHTML = pageInfo.pageItems
    .map((item) => {
      const key = normalizeUrlForCompare(item.url);
      const checked = adjustmentMatch.selectedCollegeUrls?.has(item.url) || adjustmentMatch.selectedCollegeKeys?.has(key);
      return `<li>
        <label class="check-row">
          <input type="checkbox" data-college-url="${escapeHtml(item.url)}" ${checked ? 'checked' : ''} />
          <span>${escapeHtml(item.text || item.url)} -> ${escapeHtml(item.url)}</span>
        </label>
      </li>`;
    })
    .join('');
}

function renderAdjustmentMatch(profile) {
  adjustmentMatch = profile || null;
  ensurePagerState('adjustmentAnnouncement').page = 1;
  ensurePagerState('adjustmentCollegeHomepage').page = 1;
  ensurePagerState('adjustmentCollege').page = 1;

  if (!adjustmentMatch) {
    adjustmentResult.classList.add('hidden');
    adjustmentSummary.textContent = '';
    adjustmentHomepage.textContent = '';
    adjustmentCollegeHomepage.textContent = '';
    adjustmentAnnouncementList.innerHTML = '';
    adjustmentCollegeHomepageList.innerHTML = '';
    adjustmentCollegeList.innerHTML = '';
    renderPager(adjustmentAnnouncementPager, 'adjustmentAnnouncement', 0);
    renderPager(adjustmentCollegeHomepagePager, 'adjustmentCollegeHomepage', 0);
    renderPager(adjustmentCollegePager, 'adjustmentCollege', 0);
    return;
  }

  adjustmentResult.classList.remove('hidden');
  const collegeLabel = adjustmentMatch.collegeName ? ` | 学院：${adjustmentMatch.collegeName}` : '';
  adjustmentSummary.textContent = `院校：${adjustmentMatch.schoolName}${collegeLabel} | 公告候选：${adjustmentMatch.announcementCandidates?.length || 0} | 学院候选：${adjustmentMatch.collegeCandidates?.length || 0}`;
  adjustmentHomepage.innerHTML = `<strong>匹配官网：</strong><a href="${escapeHtml(adjustmentMatch.homepageUrl || '')}" target="_blank">${escapeHtml(adjustmentMatch.homepageUrl || '')}</a>`;
  const collegeHomepageUrl = adjustmentMatch.collegeProfile?.matchedHomepageUrl || '';
  if (collegeHomepageUrl) {
    adjustmentCollegeHomepage.innerHTML = `<strong>匹配学院官网：</strong><a href="${escapeHtml(collegeHomepageUrl)}" target="_blank">${escapeHtml(collegeHomepageUrl)}</a>`;
  } else if (adjustmentMatch.collegeName) {
    adjustmentCollegeHomepage.innerHTML = `<strong>匹配学院官网：</strong>未匹配到“${escapeHtml(adjustmentMatch.collegeName)}”独立站点`;
  } else {
    adjustmentCollegeHomepage.textContent = '';
  }

  const ann = Array.isArray(adjustmentMatch.announcementCandidates) ? adjustmentMatch.announcementCandidates : [];
  const defaultAnnouncementSelection = new Set(
    ann
      .slice(0, 3)
      .map((x) => String(x.url || '').trim())
      .filter(Boolean)
  );
  if (adjustmentMatch.suggestedAnnouncementUrl) {
    defaultAnnouncementSelection.add(adjustmentMatch.suggestedAnnouncementUrl);
  }
  adjustmentMatch.selectedAnnouncementUrls = defaultAnnouncementSelection;
  adjustmentMatch.selectedAnnouncementKeys = new Set(Array.from(defaultAnnouncementSelection).map((x) => normalizeUrlForCompare(x)));

  const colleges = Array.isArray(adjustmentMatch.collegeCandidates) ? adjustmentMatch.collegeCandidates : [];
  const defaultCollegeSelection = new Set(
    colleges
      .slice(0, 5)
      .map((x) => String(x.url || '').trim())
      .filter(Boolean)
  );
  adjustmentMatch.selectedCollegeUrls = defaultCollegeSelection;
  adjustmentMatch.selectedCollegeKeys = new Set(Array.from(defaultCollegeSelection).map((x) => normalizeUrlForCompare(x)));

  adjustmentMatch.collegeHomepageCandidates = buildAdjustmentCollegeHomepageCandidates();
  adjustmentMatch.selectedCollegeHomepageUrl =
    adjustmentMatch.collegeProfile?.matchedHomepageUrl ||
    adjustmentMatch.collegeHomepageCandidates[0]?.url ||
    '';

  renderAdjustmentAnnouncementCandidates();
  renderAdjustmentCollegeHomepageCandidates();
  renderAdjustmentCollegeCandidates();
}

function buildAdjustmentPayload() {
  if (!adjustmentMatch) return null;
  const selectedAnnouncementUrls = getSelectedAdjustmentAnnouncementUrls();
  const selectedCollegeHomepageUrl = getSelectedAdjustmentCollegeHomepageUrl() || adjustmentMatch.collegeProfile?.matchedHomepageUrl || '';
  const selectedColleges = getSelectedAdjustmentCollegeUrls();
  const announcementPool = [];
  const announcementSeen = new Set();
  [...selectedAnnouncementUrls, adjustmentMatch.suggestedAnnouncementUrl || ''].forEach((url) => {
    const value = String(url || '').trim();
    if (!value) return;
    const key = normalizeUrlForCompare(value);
    if (!key || announcementSeen.has(key)) return;
    announcementSeen.add(key);
    announcementPool.push(value);
  });
  const announcementUrl = announcementPool[0] || '';
  const announcementUrls = announcementPool;
  const mergedCollegeUrls = [];
  const seen = new Set();
  [selectedCollegeHomepageUrl, ...selectedColleges].forEach((url) => {
    const value = String(url || '').trim();
    if (!value) return;
    const key = normalizeUrlForCompare(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    mergedCollegeUrls.push(value);
  });
  return {
    schoolName: adjustmentMatch.schoolName || adjustmentSchoolName.value.trim(),
    collegeName: adjustmentCollegeName.value.trim(),
    homepageUrl: adjustmentMatch.homepageUrl || '',
    announcementUrl,
    announcementUrls: announcementUrls.join('\n'),
    collegeHomepageUrl: selectedCollegeHomepageUrl,
    collegeUrls: mergedCollegeUrls.join('\n'),
    keywords: adjustmentKeywords.value.trim(),
    crawlMode: 'graduate_adjustment',
    includeCollegePages: adjustmentIncludeCollegePages.checked
  };
}

function updateCollegeToggleByMode(modeInput, checkbox) {
  const mode = normalizeMode(modeInput.value);
  if (mode === 'graduate_adjustment') {
    checkbox.disabled = false;
    return;
  }
  checkbox.checked = false;
  checkbox.disabled = true;
}

function getSafeModuleId(moduleId) {
  const id = String(moduleId || '').trim();
  if (id === 'scan-panel' && !pendingScan) {
    return 'manual-module';
  }
  if (!modulePanels.some((panel) => panel.id === id)) {
    return 'daily-module';
  }
  return id;
}

function switchModule(moduleId) {
  const safeModuleId = getSafeModuleId(moduleId);
  activeModuleId = safeModuleId;

  modulePanels.forEach((panel) => {
    if (panel.id === 'scan-panel' && !pendingScan) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.toggle('hidden', panel.id !== safeModuleId);
  });

  syncModuleTabsActiveState();
}

function normalizeNewsFocus(value) {
  return String(value || 'general') === 'retest' ? 'retest' : 'general';
}

function syncModuleTabsActiveState() {
  if (!moduleTabs) return;
  activeNewsQueryFocus = normalizeNewsFocus(newsQueryFocus?.value || activeNewsQueryFocus);
  moduleTabs.querySelectorAll('button[data-module]').forEach((btn) => {
    const targetModule = btn.dataset.module;
    const hasFocus = Object.prototype.hasOwnProperty.call(btn.dataset, 'focus');
    if (targetModule === 'news-query-module' && hasFocus) {
      const targetFocus = normalizeNewsFocus(btn.dataset.focus);
      btn.classList.toggle('active', activeModuleId === 'news-query-module' && activeNewsQueryFocus === targetFocus);
      return;
    }
    btn.classList.toggle('active', targetModule === activeModuleId);
  });
}

function applyNewsQueryFocusUI(focusLike) {
  const focus = normalizeNewsFocus(focusLike);
  activeNewsQueryFocus = focus;
  if (newsQueryFocus && newsQueryFocus.value !== focus) {
    newsQueryFocus.value = focus;
  }
  if (newsQueryRunBtn) {
    newsQueryRunBtn.textContent = focus === 'retest' ? '智能匹配并检索近三日复试内容' : '智能匹配并检查近三日研招公告';
  }
  if (newsQueryModuleTitle) {
    newsQueryModuleTitle.textContent = focus === 'retest' ? '复试内容检索' : '院校新公告查询';
  }
  syncModuleTabsActiveState();
}

async function api(url, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options || {};
  const resp = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...fetchOptions
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401 && !skipAuthRedirect) {
      updateAuthInfo(null);
      openAuthModal('登录状态已失效，请重新登录');
    }
    throw new Error(data.error || '请求失败');
  }
  return data;
}

function toLocalText(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function renderTaskCard(task) {
  const matched = Number.isFinite(task.lastMatchedCount) ? task.lastMatchedCount : 0;
  const fileLink = task.lastResultFile
    ? `<a href="/api/files/${encodeURIComponent(task.lastResultFile)}" target="_blank">${escapeHtml(task.lastResultFile)}</a>`
    : '-';
  const stateText = task.enabled ? '已开启' : '已暂停';

  const crawlMode = normalizeMode(task.crawlMode);
  const includeCollegePages = normalizeIncludeCollegePages(task.includeCollegePages, crawlMode);
  const collegeCount = Array.isArray(task.collegeUrls) ? task.collegeUrls.length : 0;
  const announcementUrls = Array.isArray(task.announcementUrls) ? task.announcementUrls.filter(Boolean) : [];
  const announcementCount = announcementUrls.length;

  const safeName = escapeHtml(task.schoolName);
  const safeHomepage = escapeHtml(task.homepageUrl);
  const safeAnnouncement = escapeHtml(task.announcementUrl || '');
  const announcementText = announcementCount > 1 ? `${announcementCount} 个已指定页面（首个如下）` : '';
  const safeKeywords = task.keywords?.length ? escapeHtml(task.keywords.join(' / ')) : '无（抓取最新公告）';
  const safeError = escapeHtml(task.lastError || '');
  const schoolAttr = encodeURIComponent(task.schoolName || '');

  return `
    <article class="task-card">
      <div class="task-header">
        <h3>${safeName}</h3>
        <span class="tag ${task.enabled ? 'ok' : 'stop'}">${stateText}</span>
      </div>
      <p><strong>官网：</strong><a href="${safeHomepage}" target="_blank">${safeHomepage}</a></p>
      <p><strong>公告页：</strong>${task.announcementUrl ? `<a href="${safeAnnouncement}" target="_blank">${safeAnnouncement}</a>${announcementText ? `（${escapeHtml(announcementText)}）` : ''}` : '自动发现'}</p>
      <p><strong>模式：</strong>${getModeLabel(crawlMode)}${crawlMode === 'graduate_adjustment' ? ` / 学院层级${includeCollegePages ? '开启' : '关闭'}` : ''}</p>
      <p><strong>学院链接：</strong>${collegeCount ? `${collegeCount} 个` : '自动发现'}</p>
      <p><strong>关键词：</strong>${safeKeywords}</p>
      <p><strong>每日时间：</strong>${task.scheduleTime}</p>
      <p><strong>上次执行：</strong>${toLocalText(task.lastRunAt)}</p>
      <p><strong>上次抓取：</strong>${matched} 条</p>
      <p><strong>上次文件：</strong>${fileLink}</p>
      <p class="error-text">${safeError}</p>
      <div class="task-actions">
        <button data-action="scan" data-id="${task.id}" data-school="${schoolAttr}">扫描候选公告</button>
        <button data-action="toggle" data-id="${task.id}" data-enabled="${task.enabled}">${task.enabled ? '暂停每日爬取' : '开启每日爬取'}</button>
        <button data-action="edit" data-id="${task.id}">编辑</button>
        <button data-action="delete" data-id="${task.id}" class="danger">删除</button>
      </div>
    </article>
  `;
}

function fillTaskForm(task) {
  const crawlMode = normalizeMode(task.crawlMode);
  document.getElementById('task-id').value = task.id || '';
  document.getElementById('schoolName').value = task.schoolName || '';
  document.getElementById('homepageUrl').value = task.homepageUrl || '';
  document.getElementById('announcementUrl').value = task.announcementUrl || '';
  document.getElementById('keywords').value = task.keywords?.join(', ') || '';
  document.getElementById('scheduleTime').value = task.scheduleTime || '08:00';
  document.getElementById('enabled').checked = task.enabled !== false;
  taskCollegeUrls.value = Array.isArray(task.collegeUrls) ? task.collegeUrls.join('\n') : '';
  taskCrawlMode.value = crawlMode;
  taskIncludeCollegePages.checked = normalizeIncludeCollegePages(task.includeCollegePages, crawlMode);
  updateCollegeToggleByMode(taskCrawlMode, taskIncludeCollegePages);
}

function resetTaskForm() {
  taskForm.reset();
  document.getElementById('task-id').value = '';
  document.getElementById('scheduleTime').value = '08:00';
  document.getElementById('enabled').checked = true;
  taskCollegeUrls.value = '';
  taskCrawlMode.value = 'general';
  taskIncludeCollegePages.checked = false;
  updateCollegeToggleByMode(taskCrawlMode, taskIncludeCollegePages);
  verifyPanel.classList.add('hidden');
  verifyList.innerHTML = '';
  verifyCollegePanel.classList.add('hidden');
  verifyCollegeList.innerHTML = '';
}

function clearPendingScan() {
  pendingScan = null;
  ensurePagerState('scan').page = 1;
  scanPanel.classList.add('hidden');
  scanList.innerHTML = '';
  scanInfo.textContent = '';
  if (scanPager) {
    scanPager.innerHTML = '';
    scanPager.classList.add('hidden');
  }
  if (scanFilterKeyword) scanFilterKeyword.value = '';
  if (scanFilterYear) {
    scanFilterYear.innerHTML = '<option value="">全部年份</option>';
    scanFilterYear.value = '';
  }
  if (activeModuleId === 'scan-panel') {
    switchModule('manual-module');
  }
}

function updateScanYearFilterOptions() {
  if (!pendingScan || !scanFilterYear) return;
  const years = Array.from(
    new Set(
      pendingScan.candidates
        .map((item) => extractScanCandidateYear(item))
        .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));

  const current = scanFilterYear.value || '';
  scanFilterYear.innerHTML = '<option value="">全部年份</option>';
  years.forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    scanFilterYear.appendChild(option);
  });
  scanFilterYear.value = years.includes(current) ? current : '';
}

function applyPendingScanFilters() {
  if (!pendingScan) return [];
  const terms = getScanFilterTerms(scanFilterKeyword?.value || '');
  const year = String(scanFilterYear?.value || '').trim();
  const filtered = pendingScan.candidates.filter((item) => {
    if (year) {
      const itemYear = extractScanCandidateYear(item);
      if (itemYear !== year) return false;
    }
    return matchScanKeywordTerms(item, terms);
  });
  pendingScan.filteredCandidates = filtered;
  return filtered;
}

function renderPendingScanList() {
  if (!pendingScan) return;
  const filtered = Array.isArray(pendingScan.filteredCandidates) ? pendingScan.filteredCandidates : [];
  const pageInfo = getPagedItems(filtered, 'scan');
  renderPager(scanPager, 'scan', filtered.length);
  if (!filtered.length) {
    scanList.innerHTML = '<li class="empty">当前筛选条件下没有候选公告。</li>';
    return;
  }

  scanList.innerHTML = pageInfo.pageItems
    .map((item) => {
      const key = getScanCandidateKey(item);
      const checked = pendingScan.selectedKeys?.has(key) ? 'checked' : '';
      const dateText = item.dateHint ? `<span class="scan-date">${escapeHtml(item.dateHint)}</span>` : '';
      const badge = item.isLikelyDetail ? '<span class="scan-badge">推荐正文</span>' : '';
      const sourceText = item.sourcePage ? `<span class="scan-date">来源页：${escapeHtml(item.sourcePage)}</span>` : '';
      return `<li class="scan-item">
        <label>
          <input type="checkbox" data-key="${escapeHtml(key)}" ${checked} />
          <span class="scan-title">${escapeHtml(item.title)}</span>
          ${dateText}
          ${badge}
          ${sourceText}
        </label>
        <a href="${escapeHtml(item.url)}" target="_blank">打开链接</a>
      </li>`;
    })
    .join('');
}

function refreshPendingScanSummary() {
  if (!pendingScan) return;
  const pageSummary = pendingScan.usedAnnouncementUrls.length
    ? `${pendingScan.usedAnnouncementUrls.length} 个`
    : pendingScan.usedAnnouncementUrl || '自动发现失败';
  const pageState = getPagedItems(pendingScan.filteredCandidates || [], 'scan');
  const visibleCount = pendingScan.filteredCandidates?.length || 0;
  const totalCount = pendingScan.candidates.length;
  const selectedCount = pendingScan.selectedKeys ? pendingScan.selectedKeys.size : 0;
  const summary = `来源：${pendingScan.contextText} | 模式：${getModeLabel(pendingScan.crawlMode)}${pendingScan.crawlMode === 'graduate_adjustment' ? ` / 学院层级${pendingScan.includeCollegePages ? '开启' : '关闭'}` : ''} | 公告页：${pageSummary} | 显示：${visibleCount}/${totalCount} | 分页：${pageState.page}/${pageState.totalPages} | 已勾选：${selectedCount} | 关键词命中：${pendingScan.matchedByKeywords ?? 0}${pendingScan.selectedCollegeCount ? ` | 指定学院：${pendingScan.selectedCollegeCount}` : ''}`;
  scanInfo.textContent = summary;
}

function rerenderPendingScanByFilters(resetPage = false) {
  if (!pendingScan) return;
  if (resetPage) {
    ensurePagerState('scan').page = 1;
  }
  applyPendingScanFilters();
  renderPendingScanList();
  refreshPendingScanSummary();
}

function renderPendingScan(contextText, scan, mode, extra = {}) {
  const usedAnnouncementUrls = Array.isArray(scan.usedAnnouncementUrls) ? scan.usedAnnouncementUrls.filter(Boolean) : [];
  pendingScan = {
    contextText,
    mode,
    taskId: extra.taskId || '',
    payload: extra.payload || null,
    usedAnnouncementUrl: scan.usedAnnouncementUrl || '',
    usedAnnouncementUrls,
    crawlMode: normalizeMode(scan.crawlMode),
    includeCollegePages: normalizeIncludeCollegePages(scan.includeCollegePages, scan.crawlMode),
    candidates: scan.candidates || [],
    matchedByKeywords: scan.matchedByKeywords ?? 0,
    selectedCollegeCount: scan.selectedCollegeCount || 0,
    selectedKeys: new Set(),
    filteredCandidates: []
  };

  if (!pendingScan.candidates.length) {
    clearPendingScan();
    showToast('扫描完成，但未找到可选公告链接', true);
    return;
  }

  pendingScan.candidates.forEach((item, index) => {
    if (item.isLikelyDetail || index < 5) {
      pendingScan.selectedKeys.add(getScanCandidateKey(item));
    }
  });

  scanPanel.classList.remove('hidden');
  if (scanFilterKeyword) scanFilterKeyword.value = '';
  ensurePagerState('scan').page = 1;
  updateScanYearFilterOptions();
  rerenderPendingScanByFilters(true);

  switchModule('scan-panel');
  window.scrollTo({ top: scanPanel.offsetTop - 20, behavior: 'smooth' });
}

function getSelectedCandidates() {
  if (!pendingScan) return [];
  const keySet = pendingScan.selectedKeys || new Set();
  if (!keySet.size) return [];
  const selected = [];
  const seen = new Set();
  pendingScan.candidates.forEach((item) => {
    const key = getScanCandidateKey(item);
    if (!keySet.has(key) || seen.has(key)) return;
    seen.add(key);
    selected.push({
      title: item.title,
      url: item.url,
      dateHint: item.dateHint || ''
    });
  });
  return selected;
}

async function loadTasks() {
  const data = await api('/api/tasks');
  if (!data.tasks.length) {
    taskList.innerHTML = '<p class="empty">暂无任务，请先创建。</p>';
    return;
  }
  taskList.innerHTML = data.tasks.map(renderTaskCard).join('');
}

async function loadFiles() {
  const data = await api('/api/files');
  fileCache = Array.isArray(data.files) ? data.files : [];
  const existingNames = new Set(fileCache.map((x) => x.name));
  selectedFileNames = new Set(Array.from(selectedFileNames).filter((name) => existingNames.has(name)));
  ensurePagerState('files').page = 1;
  renderFilesPage();
}

function renderFilesPage() {
  if (!fileCache.length) {
    fileList.innerHTML = '<li class="empty">暂无 Markdown 输出</li>';
    if (filePager) {
      filePager.innerHTML = '';
      filePager.classList.add('hidden');
    }
    return;
  }

  const pageInfo = getPagedItems(fileCache, 'files');
  renderPager(filePager, 'files', fileCache.length);
  fileList.innerHTML = pageInfo.pageItems
    .map((f) => {
      const sizeKb = (f.size / 1024).toFixed(1);
      const checked = selectedFileNames.has(f.name) ? 'checked' : '';
      return `<li>
        <input type="checkbox" data-file-checkbox="true" data-name="${encodeURIComponent(f.name)}" ${checked} />
        <a href="/api/files/${encodeURIComponent(f.name)}" target="_blank">${escapeHtml(f.name)}</a>
        <span>${sizeKb}KB / ${toLocalText(f.updatedAt)}</span>
        <button type="button" data-action="preview-file" data-name="${encodeURIComponent(f.name)}">预览</button>
        <button type="button" data-action="delete-file" data-name="${encodeURIComponent(f.name)}" class="danger">删除</button>
      </li>`;
    })
    .join('');
}

function getSelectedFileNames() {
  return fileCache
    .map((x) => x.name)
    .filter((name) => selectedFileNames.has(name));
}

async function deleteFilesByNames(names, triggerBtn, doneText) {
  const validNames = Array.isArray(names) ? names.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!validNames.length) {
    showToast('请先选择要删除的 Markdown 文件', true);
    return;
  }

  if (!window.confirm(`确认删除 ${validNames.length} 个 Markdown 文件吗？`)) {
    return;
  }

  try {
    if (triggerBtn) setButtonBusy(triggerBtn, true, '删除中...');
    const data = await api('/api/files/delete-many', {
      method: 'POST',
      body: JSON.stringify({ names: validNames })
    });
    const nameSet = new Set(validNames);
    selectedFileNames = new Set(Array.from(selectedFileNames).filter((name) => !nameSet.has(name)));
    await loadFiles();
    const deleted = Number(data.deleted || 0);
    if (previewPanel && !previewPanel.classList.contains('hidden')) {
      const currentName = String(previewTitle.textContent || '').replace(/^文件预览：/, '').trim();
      if (nameSet.has(currentName)) {
        previewPanel.classList.add('hidden');
        previewTitle.textContent = '文件预览';
        previewContent.textContent = '';
      }
    }
    showToast(doneText || `已删除 ${deleted} 个 Markdown 文件`);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    if (triggerBtn) setButtonBusy(triggerBtn, false);
  }
}

async function loadManualPresets() {
  const data = await api('/api/manual-presets');
  manualPresetCache = Array.isArray(data.presets) ? data.presets : [];

  if (!manualPresetCache.length) {
    manualPresetList.innerHTML = '<li class="empty">暂无历史院校</li>';
    return;
  }

  manualPresetList.innerHTML = manualPresetCache
    .map((preset) => {
      const mode = normalizeMode(preset.crawlMode);
      const includeCollege = normalizeIncludeCollegePages(preset.includeCollegePages, mode);
      const keywords = Array.isArray(preset.keywords) && preset.keywords.length ? preset.keywords.join(' / ') : '无关键词';
      const collegeCount = Array.isArray(preset.collegeUrls) ? preset.collegeUrls.length : 0;
      return `<li>
        <input type="checkbox" data-preset-checkbox="true" data-id="${preset.id}" />
        <strong>${escapeHtml(preset.displayName || preset.schoolName || '未命名院校')}</strong>
        <button type="button" data-action="apply-preset" data-id="${preset.id}">套用</button>
        <button type="button" data-action="delete-preset" data-id="${preset.id}" class="danger">删除</button>
        <span class="preset-meta">${getModeLabel(mode)}${mode === 'graduate_adjustment' ? ` / 学院层级${includeCollege ? '开' : '关'}` : ''} / 学院链接${collegeCount}个 / ${escapeHtml(keywords)}</span>
      </li>`;
    })
    .join('');
}

function fillManualFromPreset(preset) {
  const mode = normalizeMode(preset.crawlMode);
  document.getElementById('manualSchoolName').value = preset.schoolName || '';
  document.getElementById('manualHomepageUrl').value = preset.homepageUrl || '';
  document.getElementById('manualAnnouncementUrl').value = preset.announcementUrl || '';
  manualCollegeUrls.value = Array.isArray(preset.collegeUrls) ? preset.collegeUrls.join('\n') : '';
  document.getElementById('manualKeywords').value = Array.isArray(preset.keywords) ? preset.keywords.join(', ') : '';
  manualCrawlMode.value = mode;
  manualIncludeCollegePages.checked = normalizeIncludeCollegePages(preset.includeCollegePages, mode);
  updateCollegeToggleByMode(manualCrawlMode, manualIncludeCollegePages);
}

function getSelectedPresetIds() {
  return Array.from(manualPresetList.querySelectorAll('input[data-preset-checkbox="true"]:checked'))
    .map((x) => x.dataset.id)
    .filter(Boolean);
}

async function verifyLinks(
  homepageUrl,
  crawlMode,
  includeCollegePages,
  targetListEl,
  targetPanelEl,
  onPick,
  collegeListEl,
  collegePanelEl,
  onAppendColleges
) {
  const data = await api('/api/verify-links', {
    method: 'POST',
    body: JSON.stringify({ homepageUrl, crawlMode, includeCollegePages })
  });

  targetPanelEl.classList.remove('hidden');
  if (!data.candidates.length) {
    targetListEl.innerHTML = '<li class="empty">未发现明显公告链接，请手动输入公告页链接。</li>';
  } else {
    targetListEl.innerHTML = data.candidates
      .map((item) => `<li><button type="button" data-url="${encodeURIComponent(item.url)}">${escapeHtml(item.text)} -> ${escapeHtml(item.url)}</button></li>`)
      .join('');

    targetListEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        onPick(decodeURIComponent(btn.dataset.url));
        showToast('已填充公告页链接');
      });
    });
  }

  if (!collegeListEl || !collegePanelEl || !onAppendColleges) return;
  const collegeCandidates = Array.isArray(data.collegeCandidates) ? data.collegeCandidates : [];
  if (!collegeCandidates.length) {
    collegePanelEl.classList.add('hidden');
    collegeListEl.innerHTML = '';
    return;
  }

  collegePanelEl.classList.remove('hidden');
  collegeListEl.innerHTML = collegeCandidates
    .map((item, idx) => {
      const label = item.text || item.url;
      return `<li>
        <label class="check-row">
          <input type="checkbox" data-college-url="${escapeHtml(item.url)}" ${idx < 5 ? 'checked' : ''} />
          <span>${escapeHtml(label)} -> ${escapeHtml(item.url)}</span>
        </label>
      </li>`;
    })
    .join('');

  const addBtn = collegePanelEl.querySelector('button');
  if (!addBtn) return;
  addBtn.onclick = () => {
    const selected = Array.from(collegeListEl.querySelectorAll('input[data-college-url]:checked')).map((box) => box.dataset.collegeUrl).filter(Boolean);
    if (!selected.length) {
      showToast('请先勾选要添加的学院链接', true);
      return;
    }
    onAppendColleges(selected);
    showToast(`已添加 ${selected.length} 条学院链接`);
  };
}

adjustmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.submitter;
  const schoolName = adjustmentSchoolName.value.trim();
  if (!schoolName) {
    showToast('请先输入院校名称', true);
    return;
  }

  try {
    setButtonBusy(submitBtn, true, '智能匹配中...');
    const data = await api('/api/graduate-assistant', {
      method: 'POST',
      body: JSON.stringify({
        schoolName,
        collegeName: adjustmentCollegeName.value.trim(),
        includeCollegePages: adjustmentIncludeCollegePages.checked
      })
    });
    renderAdjustmentMatch(data.profile);
    showToast('已完成官网与研招页智能匹配');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(submitBtn, false);
  }
});

adjustmentApplyManualBtn.addEventListener('click', () => {
  const payload = buildAdjustmentPayload();
  if (!payload || !payload.homepageUrl) {
    showToast('请先完成智能匹配', true);
    return;
  }

  document.getElementById('manualSchoolName').value = payload.schoolName || '';
  document.getElementById('manualHomepageUrl').value = payload.homepageUrl || '';
  document.getElementById('manualAnnouncementUrl').value = payload.announcementUrl || '';
  manualCollegeUrls.value = payload.collegeUrls || '';
  document.getElementById('manualKeywords').value = payload.keywords || '';
  manualCrawlMode.value = 'graduate_adjustment';
  manualIncludeCollegePages.checked = payload.includeCollegePages !== false;
  updateCollegeToggleByMode(manualCrawlMode, manualIncludeCollegePages);
  switchModule('manual-module');
  showToast('已回填到自助爬取模块');
});

adjustmentScanBtn.addEventListener('click', async () => {
  const payload = buildAdjustmentPayload();
  if (!payload || !payload.homepageUrl) {
    showToast('请先完成智能匹配', true);
    return;
  }

  try {
    setButtonBusy(adjustmentScanBtn, true, '扫描中...');
    const data = await api('/api/manual-scan', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderPendingScan(`调剂智能导航：${payload.schoolName || '未命名院校'}`, data.scan, 'manual', { payload });
    showToast('已生成候选公告，请勾选后确认爬取');
    await loadManualPresets();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(adjustmentScanBtn, false);
  }
});

adjustmentCreateTaskBtn.addEventListener('click', async () => {
  const payload = buildAdjustmentPayload();
  if (!payload || !payload.homepageUrl) {
    showToast('请先完成智能匹配', true);
    return;
  }

  const scheduleTime = String(adjustmentScheduleTime.value || '08:00').trim() || '08:00';
  const normalizedSchool = payload.schoolName || '';
  const normalizedHomepage = payload.homepageUrl || '';

  try {
    setButtonBusy(adjustmentCreateTaskBtn, true, '生成中...');
    const tasksData = await api('/api/tasks');
    const existing = (tasksData.tasks || []).find((task) => {
      return (
        normalizeMode(task.crawlMode) === 'graduate_adjustment' &&
        String(task.schoolName || '').trim() === normalizedSchool &&
        String(task.homepageUrl || '').trim() === normalizedHomepage
      );
    });

    const taskPayload = {
      id: existing?.id,
      schoolName: normalizedSchool,
      homepageUrl: normalizedHomepage,
      announcementUrl: payload.announcementUrl || '',
      announcementUrls: payload.announcementUrls || '',
      collegeUrls: payload.collegeUrls || '',
      keywords: payload.keywords || '',
      scheduleTime,
      enabled: true,
      crawlMode: 'graduate_adjustment',
      includeCollegePages: payload.includeCollegePages !== false
    };

    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskPayload)
    });
    await loadTasks();
    switchModule('tasks-module');
    showToast(existing ? '已更新每日任务并开启自动爬取' : '已创建每日任务并开启自动爬取');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(adjustmentCreateTaskBtn, false);
  }
});

adjustmentAnnouncementList.addEventListener('change', (e) => {
  if (!adjustmentMatch) return;
  const input = e.target.closest('input[type="checkbox"][data-announcement-url]');
  if (!input) return;
  const url = String(input.dataset.announcementUrl || '').trim();
  if (!url) return;
  const key = normalizeUrlForCompare(url);
  if (!(adjustmentMatch.selectedAnnouncementUrls instanceof Set)) {
    adjustmentMatch.selectedAnnouncementUrls = new Set();
  }
  if (!(adjustmentMatch.selectedAnnouncementKeys instanceof Set)) {
    adjustmentMatch.selectedAnnouncementKeys = new Set();
  }
  if (input.checked) {
    adjustmentMatch.selectedAnnouncementUrls.add(url);
    if (key) adjustmentMatch.selectedAnnouncementKeys.add(key);
  } else {
    adjustmentMatch.selectedAnnouncementUrls.delete(url);
    if (key) adjustmentMatch.selectedAnnouncementKeys.delete(key);
  }
});

adjustmentCollegeList.addEventListener('change', (e) => {
  if (!adjustmentMatch) return;
  const input = e.target.closest('input[type="checkbox"][data-college-url]');
  if (!input) return;
  const url = String(input.dataset.collegeUrl || '').trim();
  if (!url) return;
  const key = normalizeUrlForCompare(url);
  if (!(adjustmentMatch.selectedCollegeUrls instanceof Set)) {
    adjustmentMatch.selectedCollegeUrls = new Set();
  }
  if (!(adjustmentMatch.selectedCollegeKeys instanceof Set)) {
    adjustmentMatch.selectedCollegeKeys = new Set();
  }
  if (input.checked) {
    adjustmentMatch.selectedCollegeUrls.add(url);
    if (key) adjustmentMatch.selectedCollegeKeys.add(key);
  } else {
    adjustmentMatch.selectedCollegeUrls.delete(url);
    if (key) adjustmentMatch.selectedCollegeKeys.delete(key);
  }
});

adjustmentCollegeHomepageList.addEventListener('change', (e) => {
  if (!adjustmentMatch) return;
  const input = e.target.closest('input[type="radio"][name="adjustment-college-homepage"]');
  if (!input) return;
  adjustmentMatch.selectedCollegeHomepageUrl = String(input.value || '').trim();
});

if (newsQueryForm) {
  newsQueryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolName = newsQuerySchoolName?.value?.trim() || '';
    const focus = String(newsQueryFocus?.value || 'general');
    if (!schoolName) {
      showToast('请先输入院校名称', true);
      return;
    }

    try {
      setButtonBusy(newsQueryRunBtn, true, '查询中...');
      const data = await api('/api/graduate-news-check', {
        method: 'POST',
        body: JSON.stringify({
          schoolName,
          collegeName: newsQueryCollegeName?.value?.trim() || '',
          includeCollegePages: Boolean(newsQueryIncludeCollegePages?.checked),
          focus
        })
      });
      renderNewsQueryResult(data.result);
      const summary = data.result?.summary || {};
      const hasRecent = (summary.today || 0) + (summary.yesterday || 0) + (summary.dayBefore || 0);
      const label = focus === 'retest' ? '复试相关公告' : '研招公告';
      showToast(hasRecent > 0 ? `近三日发现 ${hasRecent} 条${label}` : `近三日未发现${label}`);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(newsQueryRunBtn, false);
    }
  });
}

if (newsQueryFocus) {
  newsQueryFocus.addEventListener('change', () => {
    applyNewsQueryFocusUI(newsQueryFocus.value);
  });
}

if (newsQuickAddBtn) {
  newsQuickAddBtn.addEventListener('click', async () => {
    const schoolName = String(newsQuickSchoolName?.value || '').trim();
    const collegeName = String(newsQuickCollegeName?.value || '').trim();
    const isEditing = Boolean(editingNewsQuickId);
    if (!schoolName) {
      showToast('请先填写院校名称', true);
      return;
    }
    try {
      setButtonBusy(newsQuickAddBtn, true, isEditing ? '保存中...' : '添加中...');
      await api('/api/news-quick-schools', {
        method: 'POST',
        body: JSON.stringify({
          id: editingNewsQuickId || undefined,
          schoolName,
          collegeName,
          includeCollegePages: Boolean(newsQuickIncludeCollegePages?.checked)
        })
      });
      await loadNewsQuickSchools();
      resetNewsQuickEditor();
      showToast(isEditing ? '固定院校已更新' : '已加入固定院校');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(newsQuickAddBtn, false);
    }
  });
}

if (newsQuickCancelBtn) {
  newsQuickCancelBtn.addEventListener('click', () => {
    if (!editingNewsQuickId && !newsQuickSchoolName?.value?.trim() && !newsQuickCollegeName?.value?.trim()) return;
    resetNewsQuickEditor();
    showToast('已取消修改');
  });
}

if (newsQuickList) {
  newsQuickList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const item = newsQuickSchools.find((x) => x.id === btn.dataset.id);
    if (!item) return;
    const action = btn.dataset.action;
    if (action === 'apply-news-quick') {
      fillNewsQueryFromQuick(item);
      showToast('已套用到查询表单');
      return;
    }
    if (action === 'run-news-quick') {
      await runNewsQuickQuery(item);
      return;
    }
    if (action === 'delete-news-quick') {
      try {
        setButtonBusy(btn, true, '删除中...');
        await api(`/api/news-quick-schools/${item.id}`, { method: 'DELETE' });
        await loadNewsQuickSchools();
        if (editingNewsQuickId === item.id) resetNewsQuickEditor();
        showToast('已删除固定院校');
      } catch (error) {
        showToast(error.message, true);
      } finally {
        setButtonBusy(btn, false);
      }
      return;
    }
    if (action === 'edit-news-quick') {
      startNewsQuickEdit(item);
      showToast('已进入修改模式');
    }
  });
}

if (adjustmentQuickAddBtn) {
  adjustmentQuickAddBtn.addEventListener('click', async () => {
    const schoolName = String(adjustmentQuickSchoolName?.value || '').trim();
    const collegeName = String(adjustmentQuickCollegeName?.value || '').trim();
    const isEditing = Boolean(editingAdjustmentQuickId);
    if (!schoolName) {
      showToast('请先填写院校名称', true);
      return;
    }
    try {
      setButtonBusy(adjustmentQuickAddBtn, true, isEditing ? '保存中...' : '添加中...');
      await api('/api/adjustment-quick-schools', {
        method: 'POST',
        body: JSON.stringify({
          id: editingAdjustmentQuickId || undefined,
          schoolName,
          collegeName,
          includeCollegePages: Boolean(adjustmentQuickIncludeCollegePages?.checked)
        })
      });
      await loadAdjustmentQuickSchools();
      resetAdjustmentQuickEditor();
      showToast(isEditing ? '固定院校已更新' : '已加入固定院校');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(adjustmentQuickAddBtn, false);
    }
  });
}

if (adjustmentQuickCancelBtn) {
  adjustmentQuickCancelBtn.addEventListener('click', () => {
    if (!editingAdjustmentQuickId && !adjustmentQuickSchoolName?.value?.trim() && !adjustmentQuickCollegeName?.value?.trim()) return;
    resetAdjustmentQuickEditor();
    showToast('已取消修改');
  });
}

if (adjustmentQuickList) {
  adjustmentQuickList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const item = adjustmentQuickSchools.find((x) => x.id === btn.dataset.id);
    if (!item) return;
    const action = btn.dataset.action;
    if (action === 'apply-adjustment-quick') {
      fillAdjustmentQueryFromQuick(item);
      showToast('已套用到调剂智能导航');
      return;
    }
    if (action === 'run-adjustment-quick') {
      await runAdjustmentQuickQuery(item);
      return;
    }
    if (action === 'delete-adjustment-quick') {
      try {
        setButtonBusy(btn, true, '删除中...');
        await api(`/api/adjustment-quick-schools/${item.id}`, { method: 'DELETE' });
        await loadAdjustmentQuickSchools();
        if (editingAdjustmentQuickId === item.id) resetAdjustmentQuickEditor();
        showToast('已删除固定院校');
      } catch (error) {
        showToast(error.message, true);
      } finally {
        setButtonBusy(btn, false);
      }
      return;
    }
    if (action === 'edit-adjustment-quick') {
      startAdjustmentQuickEdit(item);
      showToast('已进入修改模式');
    }
  });
}

if (newsQueryDayFilter) {
  newsQueryDayFilter.addEventListener('change', () => {
    rerenderNewsQueryByFilters(true);
  });
}

if (newsQueryKeywordFilter) {
  newsQueryKeywordFilter.addEventListener('input', () => {
    rerenderNewsQueryByFilters(true);
  });
}

if (newsQueryFilterResetBtn) {
  newsQueryFilterResetBtn.addEventListener('click', () => {
    if (newsQueryDayFilter) newsQueryDayFilter.value = '';
    if (newsQueryKeywordFilter) newsQueryKeywordFilter.value = '';
    rerenderNewsQueryByFilters(true);
  });
}

if (newsQueryList) {
  newsQueryList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="preview-news-link"]');
    if (!btn) return;
    const url = decodeURIComponent(btn.dataset.url || '');
    const title = decodeURIComponent(btn.dataset.title || '');
    if (!url || !newsViewerFrame || !newsViewerPanel || !newsViewerTitle) return;
    newsViewerTitle.textContent = `页内浏览：${title || url}`;
    newsViewerFrame.src = url;
    newsViewerPanel.classList.remove('hidden');
    newsViewerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.submitter;
  setButtonBusy(submitBtn, true, '保存中...');

  const crawlMode = normalizeMode(taskCrawlMode.value);
  const payload = {
    id: document.getElementById('task-id').value || undefined,
    schoolName: document.getElementById('schoolName').value.trim(),
    homepageUrl: document.getElementById('homepageUrl').value.trim(),
    announcementUrl: document.getElementById('announcementUrl').value.trim(),
    collegeUrls: taskCollegeUrls.value.trim(),
    keywords: document.getElementById('keywords').value.trim(),
    scheduleTime: document.getElementById('scheduleTime').value,
    enabled: document.getElementById('enabled').checked,
    crawlMode,
    includeCollegePages: normalizeIncludeCollegePages(taskIncludeCollegePages.checked, crawlMode)
  };

  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast(payload.id ? '任务已更新' : '任务已创建');
    resetTaskForm();
    await loadTasks();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(submitBtn, false);
  }
});

manualForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.submitter;
  setButtonBusy(submitBtn, true, '扫描中...');

  const crawlMode = normalizeMode(manualCrawlMode.value);
  const payload = {
    schoolName: document.getElementById('manualSchoolName').value.trim(),
    homepageUrl: document.getElementById('manualHomepageUrl').value.trim(),
    announcementUrl: document.getElementById('manualAnnouncementUrl').value.trim(),
    collegeUrls: manualCollegeUrls.value.trim(),
    keywords: document.getElementById('manualKeywords').value.trim(),
    crawlMode,
    includeCollegePages: normalizeIncludeCollegePages(manualIncludeCollegePages.checked, crawlMode)
  };

  try {
    const data = await api('/api/manual-scan', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderPendingScan(`自助爬取：${payload.schoolName || '未命名院校'}`, data.scan, 'manual', { payload });
    showToast('候选链接已生成，请勾选后点击“确认爬取并生成文件”');
    await loadManualPresets();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(submitBtn, false);
  }
});

document.getElementById('verify-btn').addEventListener('click', async () => {
  const btn = document.getElementById('verify-btn');
  setButtonBusy(btn, true, '核对中...');
  const homepageUrl = document.getElementById('homepageUrl').value.trim();
  if (!homepageUrl) {
    showToast('请先填写院校官网链接', true);
    setButtonBusy(btn, false);
    return;
  }

  try {
    await verifyLinks(
      homepageUrl,
      normalizeMode(taskCrawlMode.value),
      normalizeIncludeCollegePages(taskIncludeCollegePages.checked, taskCrawlMode.value),
      verifyList,
      verifyPanel,
      (url) => {
        document.getElementById('announcementUrl').value = url;
      },
      verifyCollegeList,
      verifyCollegePanel,
      (urls) => appendUniqueUrls(taskCollegeUrls, urls)
    );
    showToast('核对完成');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(btn, false);
  }
});

document.getElementById('manual-verify-btn').addEventListener('click', async () => {
  const btn = document.getElementById('manual-verify-btn');
  setButtonBusy(btn, true, '核对中...');
  const homepageUrl = document.getElementById('manualHomepageUrl').value.trim();
  if (!homepageUrl) {
    showToast('请先填写院校官网链接', true);
    setButtonBusy(btn, false);
    return;
  }

  try {
    await verifyLinks(
      homepageUrl,
      normalizeMode(manualCrawlMode.value),
      normalizeIncludeCollegePages(manualIncludeCollegePages.checked, manualCrawlMode.value),
      manualVerifyList,
      manualVerifyPanel,
      (url) => {
        document.getElementById('manualAnnouncementUrl').value = url;
      },
      manualVerifyCollegeList,
      manualVerifyCollegePanel,
      (urls) => appendUniqueUrls(manualCollegeUrls, urls)
    );
    showToast('核对完成');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(btn, false);
  }
});

document.getElementById('reset-btn').addEventListener('click', resetTaskForm);

if (moduleTabs) {
  moduleTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-module]');
    if (!btn) return;
    if (btn.dataset.module === 'news-query-module' && Object.prototype.hasOwnProperty.call(btn.dataset, 'focus')) {
      applyNewsQueryFocusUI(btn.dataset.focus);
    }
    switchModule(btn.dataset.module);
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = String(loginUsername?.value || '').trim();
    const password = String(loginPassword?.value || '');
    if (!username || !password) {
      if (loginError) loginError.textContent = '请输入用户名和密码';
      return;
    }
    try {
      setButtonBusy(loginSubmitBtn, true, '登录中...');
      if (loginError) loginError.textContent = '';
      const data = await api('/api/auth/login', {
        method: 'POST',
        skipAuthRedirect: true,
        body: JSON.stringify({ username, password })
      });
      updateAuthInfo(data.user || { username });
      closeAuthModal();
      await Promise.all([loadTasks(), loadFiles(), loadManualPresets(), loadNewsQuickSchools(), loadAdjustmentQuickSchools()]);
      showToast(`欢迎回来，${(data.user && data.user.username) || username}`);
    } catch (error) {
      if (loginError) loginError.textContent = error.message || '登录失败';
    } finally {
      setButtonBusy(loginSubmitBtn, false);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      setButtonBusy(logoutBtn, true, '退出中...');
      await api('/api/auth/logout', { method: 'POST', skipAuthRedirect: true });
    } catch (error) {
      // ignore logout error
    } finally {
      setButtonBusy(logoutBtn, false);
      updateAuthInfo(null);
      openAuthModal('已退出登录');
    }
  });
}

taskList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  try {
    if (action === 'scan') {
      setButtonBusy(btn, true, '扫描中...');
      const data = await api(`/api/tasks/${id}/scan`, { method: 'POST' });
      const school = btn.dataset.school ? decodeURIComponent(btn.dataset.school) : id;
      renderPendingScan(`任务：${school}`, data.scan, 'task', { taskId: id });
      showToast('候选链接已生成，请勾选后确认爬取');
      return;
    }

    if (action === 'delete') {
      setButtonBusy(btn, true, '删除中...');
      await api(`/api/tasks/${id}`, { method: 'DELETE' });
      showToast('任务已删除');
      await Promise.all([loadTasks(), loadFiles()]);
      return;
    }

    if (action === 'toggle') {
      setButtonBusy(btn, true, '切换中...');
      const enabled = btn.dataset.enabled !== 'true';
      await api(`/api/tasks/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });
      showToast(enabled ? '已开启每日爬取' : '已暂停每日爬取');
      await loadTasks();
      return;
    }

    if (action === 'edit') {
      setButtonBusy(btn, true, '加载中...');
      const data = await api('/api/tasks');
      const task = data.tasks.find((t) => t.id === id);
      if (!task) {
        showToast('任务不存在', true);
        return;
      }
      fillTaskForm(task);
      switchModule('daily-module');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('已加载任务到编辑区');
    }
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(btn, false);
  }
});

scanSelectAllBtn.addEventListener('click', () => {
  if (!pendingScan) return;
  (pendingScan.filteredCandidates || []).forEach((item) => {
    pendingScan.selectedKeys.add(getScanCandidateKey(item));
  });
  renderPendingScanList();
  refreshPendingScanSummary();
});

scanInvertBtn.addEventListener('click', () => {
  if (!pendingScan) return;
  (pendingScan.filteredCandidates || []).forEach((item) => {
    const key = getScanCandidateKey(item);
    if (pendingScan.selectedKeys.has(key)) pendingScan.selectedKeys.delete(key);
    else pendingScan.selectedKeys.add(key);
  });
  renderPendingScanList();
  refreshPendingScanSummary();
});

scanClearBtn.addEventListener('click', () => {
  clearPendingScan();
  showToast('候选列表已清空');
});

scanList.addEventListener('change', (e) => {
  const input = e.target.closest('input[type="checkbox"][data-key]');
  if (!input || !pendingScan) return;
  const key = String(input.dataset.key || '');
  if (!key) return;
  if (input.checked) pendingScan.selectedKeys.add(key);
  else pendingScan.selectedKeys.delete(key);
  refreshPendingScanSummary();
});

if (scanFilterKeyword) {
  scanFilterKeyword.addEventListener('input', () => {
    rerenderPendingScanByFilters(true);
  });
}

if (scanFilterYear) {
  scanFilterYear.addEventListener('change', () => {
    rerenderPendingScanByFilters(true);
  });
}

if (scanFilterResetBtn) {
  scanFilterResetBtn.addEventListener('click', () => {
    if (scanFilterKeyword) scanFilterKeyword.value = '';
    if (scanFilterYear) scanFilterYear.value = '';
    rerenderPendingScanByFilters(true);
  });
}

function handlePagerAction(key, action) {
  const state = ensurePagerState(key);
  if (action === 'prev') state.page -= 1;
  if (action === 'next') state.page += 1;
  state.page = Math.max(1, state.page);
  if (key === 'scan') {
    rerenderPendingScanByFilters(false);
    return;
  }
  if (key === 'files') {
    renderFilesPage();
    return;
  }
  if (key === 'adjustmentAnnouncement') {
    renderAdjustmentAnnouncementCandidates();
    return;
  }
  if (key === 'adjustmentCollegeHomepage') {
    renderAdjustmentCollegeHomepageCandidates();
    return;
  }
  if (key === 'adjustmentCollege') {
    renderAdjustmentCollegeCandidates();
    return;
  }
  if (key === 'newsQuery') {
    renderNewsQueryList();
  }
}

function bindPagerEvents(container) {
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pager-key][data-pager-action]');
    if (!btn) return;
    handlePagerAction(btn.dataset.pagerKey, btn.dataset.pagerAction);
  });
}

bindPagerEvents(scanPager);
bindPagerEvents(filePager);
bindPagerEvents(adjustmentAnnouncementPager);
bindPagerEvents(adjustmentCollegeHomepagePager);
bindPagerEvents(adjustmentCollegePager);
bindPagerEvents(newsQueryPager);

scanConfirmBtn.addEventListener('click', async () => {
  if (!pendingScan) {
    showToast('请先扫描候选公告链接', true);
    return;
  }

  const selectedItems = getSelectedCandidates();
  if (!selectedItems.length) {
    showToast('请至少勾选 1 条公告', true);
    return;
  }

  try {
    setButtonBusy(scanConfirmBtn, true, '正文爬取中...');

    if (pendingScan.mode === 'manual') {
      const data = await api('/api/manual-confirm', {
        method: 'POST',
        body: JSON.stringify({
          ...pendingScan.payload,
          usedAnnouncementUrl: pendingScan.usedAnnouncementUrl,
          usedAnnouncementUrls: pendingScan.usedAnnouncementUrls || [],
          selectedItems
        })
      });
      showToast(`已生成文件：${data.result.fileName}`);
      await loadManualPresets();
    } else {
      const data = await api(`/api/tasks/${pendingScan.taskId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          usedAnnouncementUrl: pendingScan.usedAnnouncementUrl,
          usedAnnouncementUrls: pendingScan.usedAnnouncementUrls || [],
          selectedItems
        })
      });
      showToast(`已生成文件：${data.result.fileName}`);
    }

    clearPendingScan();
    await Promise.all([loadTasks(), loadFiles()]);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(scanConfirmBtn, false);
  }
});

manualPresetList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const preset = manualPresetCache.find((x) => x.id === id);

  if (action === 'apply-preset') {
    if (!preset) {
      showToast('院校记录不存在', true);
      return;
    }
    fillManualFromPreset(preset);
    switchModule('manual-module');
    showToast('已套用院校配置');
    return;
  }

  if (action === 'delete-preset') {
    try {
      setButtonBusy(btn, true, '删除中...');
      await api(`/api/manual-presets/${id}`, { method: 'DELETE' });
      await loadManualPresets();
      showToast('已删除院校记录');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(btn, false);
    }
  }
});

presetSelectAllBtn.addEventListener('click', () => {
  manualPresetList.querySelectorAll('input[data-preset-checkbox="true"]').forEach((box) => {
    box.checked = true;
  });
});

presetInvertBtn.addEventListener('click', () => {
  manualPresetList.querySelectorAll('input[data-preset-checkbox="true"]').forEach((box) => {
    box.checked = !box.checked;
  });
});

presetDeleteSelectedBtn.addEventListener('click', async () => {
  const ids = getSelectedPresetIds();
  if (!ids.length) {
    showToast('请先勾选要删除的院校记录', true);
    return;
  }

  try {
    setButtonBusy(presetDeleteSelectedBtn, true, '删除中...');
    const data = await api('/api/manual-presets/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
    await loadManualPresets();
    showToast(`已删除 ${data.deleted} 条院校记录`);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(presetDeleteSelectedBtn, false);
  }
});

fileList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  const name = decodeURIComponent(btn.dataset.name || '');
  if (!name) return;

  if (action === 'delete-file') {
    await deleteFilesByNames([name], btn, `已删除文件：${name}`);
    return;
  }

  if (action === 'preview-file') {
    try {
      setButtonBusy(btn, true, '加载中...');
      const data = await api(`/api/files/${encodeURIComponent(name)}/content`);
      previewPanel.classList.remove('hidden');
      previewTitle.textContent = `文件预览：${data.name}`;
      previewContent.textContent = data.content || '(空内容)';
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(btn, false);
    }
  }
});

fileList.addEventListener('change', (e) => {
  const box = e.target.closest('input[type="checkbox"][data-file-checkbox="true"]');
  if (!box) return;
  const name = decodeURIComponent(box.dataset.name || '');
  if (!name) return;
  if (box.checked) selectedFileNames.add(name);
  else selectedFileNames.delete(name);
});

if (fileSelectAllBtn) {
  fileSelectAllBtn.addEventListener('click', () => {
    fileCache.forEach((file) => selectedFileNames.add(file.name));
    renderFilesPage();
  });
}

if (fileInvertBtn) {
  fileInvertBtn.addEventListener('click', () => {
    const next = new Set();
    fileCache.forEach((file) => {
      if (!selectedFileNames.has(file.name)) next.add(file.name);
    });
    selectedFileNames = next;
    renderFilesPage();
  });
}

if (fileDeleteSelectedBtn) {
  fileDeleteSelectedBtn.addEventListener('click', async () => {
    await deleteFilesByNames(getSelectedFileNames(), fileDeleteSelectedBtn);
  });
}

if (fileDeleteAllBtn) {
  fileDeleteAllBtn.addEventListener('click', async () => {
    const allNames = fileCache.map((x) => x.name);
    await deleteFilesByNames(allNames, fileDeleteAllBtn, '已清空 Markdown 输出');
  });
}

taskCrawlMode.addEventListener('change', () => {
  updateCollegeToggleByMode(taskCrawlMode, taskIncludeCollegePages);
  if (normalizeMode(taskCrawlMode.value) === 'graduate_adjustment' && !taskIncludeCollegePages.checked) {
    taskIncludeCollegePages.checked = true;
  }
});

manualCrawlMode.addEventListener('change', () => {
  updateCollegeToggleByMode(manualCrawlMode, manualIncludeCollegePages);
  if (normalizeMode(manualCrawlMode.value) === 'graduate_adjustment' && !manualIncludeCollegePages.checked) {
    manualIncludeCollegePages.checked = true;
  }
});

async function init() {
  updateCollegeToggleByMode(taskCrawlMode, taskIncludeCollegePages);
  updateCollegeToggleByMode(manualCrawlMode, manualIncludeCollegePages);
  applyNewsQueryFocusUI(activeNewsQueryFocus);
  switchModule('adjustment-module');
  const loggedIn = await ensureAuthStatus();
  if (!loggedIn) {
    return;
  }
  await Promise.all([loadTasks(), loadFiles(), loadManualPresets(), loadNewsQuickSchools(), loadAdjustmentQuickSchools()]);
}

init().catch((error) => {
  showToast(error.message, true);
});
