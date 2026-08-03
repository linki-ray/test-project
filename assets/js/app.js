/* =========================================================
   主程序：导航路由 / 时钟 / 存储设置 / 每日重置 / 提醒调度
   ========================================================= */
(function () {
  var U = App.U, S = App.Store;
  var current = 'daily-plan';
  var notified = {}; // 当天已提醒记录：key -> true

  var TITLES = {
    'daily-plan': '每日计划', 'viral-videos': '爆款抖音小红书视频',
    'inspiration': '灵感记录', 'finance': '全球金融热点',
    'vv-analyzer': '视频智能解析', 'vv-library': '爆款素材库', 'vv-creation': '爆款二创', 'reading': '阅读读书',
    'recipes': '今日菜谱', 'burn': '燃烧卡路里', 'daily-advice': '今日参谋'
  };

  // 分组（含二级类目）：视频解析 -> [视频智能解析, 爆款二创]
  var NAV_GROUPS = {
    'video': ['vv-analyzer', 'vv-creation']
  };

  function navigate(page) {
    current = page;
    U.$all('.nav-item').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-page') === page); });
    U.$all('.nav-sub-item').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-page') === page); });
    // 分组展开/收起
    U.$all('.nav-group').forEach(function (g) {
      var pages = (g.getAttribute('data-pages') || '').split(',');
      g.classList.toggle('open', pages.indexOf(page) >= 0);
    });
    U.$('#pageTitle').textContent = TITLES[page] || '';
    renderSubNav(page);
    U.$('#nav').classList.remove('open');
    var root = U.$('#pageRoot');
    if (App.pages[page]) App.pages[page](root);
    // 切换页面时重置当天提醒标记（避免跨页重复）
  }

  // 顶部二级类目：当页面属于某分组时显示横向子导航
  function renderSubNav(page) {
    var bar = U.$('#subNav'); if (!bar) return;
    var key = null;
    for (var k in NAV_GROUPS) { if (NAV_GROUPS[k].indexOf(page) >= 0) { key = k; break; } }
    if (!key) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
    bar.style.display = '';
    bar.innerHTML = '';
    NAV_GROUPS[key].forEach(function (p) {
      var b = U.el('button', { class: 'sub-nav-item' + (p === page ? ' active' : '') });
      b.setAttribute('data-page', p);
      b.textContent = TITLES[p] || p;
      bar.appendChild(b);
    });
  }

  /* ---------- 时钟 ---------- */
  function tick() {
    var d = new Date();
    U.$('#clock').textContent = S.todayStr() + ' ' + U.fmtTime(d);
  }
  setInterval(tick, 1000); tick();

  /* ---------- 每日重置（跨天检测） ---------- */
  function checkDayChange() {
    var before = S.todayStr();
    var changed = S.ensureDailyReset();
    if (changed) {
      notified = {};
      navigate(current); // 重新渲染，刷新当日数据
      U.toast('已执行每日重置 / 数据归档');
    }
  }
  setInterval(checkDayChange, 60000);

  /* ---------- 提醒调度 ---------- */
  function scheduleReminders() {
    // 每分钟检查一次
    U.scheduleCheck(checkReminders, 30000);
  }
  function checkReminders() {
    var d = new Date();
    var hhmm = U.fmtTime(d);
    // 1) 每日计划任务提醒
    var dp = S.getDailyPlan();
    dp.tasks.forEach(function (t) {
      if (t.remind && !t.done) {
        var key = 'dp_' + t.id + '_' + S.todayStr();
        if (t.remind === hhmm && !notified[key]) { notified[key] = true; U.notify('任务提醒', '「' + t.name + '」该完成了！', { warn: true }); }
      }
    });
    // 2) 灵感 20:00 提醒
    var inspKey = 'insp_' + S.todayStr();
    if (hhmm === '20:00' && !notified[inspKey]) {
      notified[inspKey] = true;
      if (App._inspSavedToday && !App._inspSavedToday()) {
        U.notify('灵感小提醒', '今天还没有记录灵感哦，快写下你的奇思妙想吧！', { warn: true });
      }
    }
    // 3) 爆款视频 5:00 自动采集
    var vidKey = 'vid_' + S.todayStr();
    if (hhmm >= '05:00' && !notified[vidKey] && App._videoAutoCollect) {
      notified[vidKey] = true;
      App._videoAutoCollect();
    }
  }

  /* ---------- 存储设置 ---------- */
  function openSettings() {
    var body = U.el('div');
    var mode = S.getMode();
    body.appendChild(U.el('div', { class: 'muted', text: '选择数据存储模式：' }));
    var opt1 = U.el('div', { class: 'field' });
    opt1.appendChild(U.el('label', {}, [U.el('input', { type: 'radio', name: 'mode', checked: mode === 'daily' ? 'checked' : null, onchange: function () { this.checked && setMode('daily'); } }), document.createTextNode(' 每日零点重置（临时数据次日清空，仅保留预设）')]));
    var opt2 = U.el('div', { class: 'field' });
    opt2.appendChild(U.el('label', {}, [U.el('input', { type: 'radio', name: 'mode', checked: mode === 'permanent' ? 'checked' : null, onchange: function () { this.checked && setMode('permanent'); } }), document.createTextNode(' 永久累计（所有记录长期留存）')]));
    body.appendChild(opt1); body.appendChild(opt2);

    var st = S.stats();
    body.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '当前模式：' + (mode === 'daily' ? '每日重置' : '永久累计') + ' · 本地占用约 ' + st.kb + ' KB' }));
    if (App.Sync && App.Sync.ENABLED) {
      var syncTxt = App.Sync.isLoggedIn() ? '已开启云端同步：手机与电脑共用同一份数据' : '已配置云端同步，但未登录（点右上角「账号」登录）';
      body.appendChild(U.el('div', { class: 'muted', style: 'margin-top:4px;color:var(--accent)', text: syncTxt }));
    } else {
      body.appendChild(U.el('div', { class: 'muted', text: '未配置云端同步，数据仅存于本机浏览器。' }));
    }

    body.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px', text: '立即执行一次重置（演示）', onclick: function () { S.forceReset(); U.toast('已重置'); navigate(current); close(); } }));
    body.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px', text: '🔄 检查更新', onclick: function () { if (App.checkForUpdate) App.checkForUpdate(); else U.toast('当前环境不支持'); } }));

    var close;
    var m = U.modal({ title: '存储设置', body: body, actions: [{ label: '关闭', primary: true, onClick: function () {} }] });
    close = m.close;
    function setMode(mm) { S.setMode(mm); U.toast('已切换为' + (mm === 'daily' ? '每日重置' : '永久累计') + '模式'); navigate(current); }
  }

  /* ---------- 云端同步 ---------- */
  function updateSyncPill(status) {
    var pill = U.$('#syncPill'); if (!pill) return;
    var map = {
      offline: ['● 本地', 'pill-offline'],
      idle: ['✓ 已同步', 'pill-ok'],
      syncing: ['↻ 同步中', 'pill-sync'],
      error: ['⚠ 同步异常', 'pill-err']
    };
    var info = map[status] || map.offline;
    pill.textContent = info[0];
    pill.className = 'sync-pill ' + info[1];
  }
  function showLogin(show) { var o = U.$('#loginOverlay'); if (o) o.classList.toggle('hidden', !show); }

  function pollHandler(m) {
    App.Store.applyRemote(m);
    var ae = document.activeElement;
    // 不打断正在输入：若焦点在输入框/文本域，跳过本次重绘（数据已写入本地，下次轮询或切页即见）
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    navigate(current);
    U.toast('已同步最新数据');
  }

  async function onLoggedIn() {
    showLogin(false);
    updateSyncPill('syncing');
    try {
      // 先刷新 token，延长登录有效期（避免 1 小时过期）
      if (App.Sync.refresh) { try { await App.Sync.refresh(); } catch (e) {} }
      var map = await App.Sync.pullAll();
      App.Store.applyRemote(map);
      App.Sync.seedVersions(map);
      navigate(current);
      App.Sync.startPolling(pollHandler, 20000);
    } catch (e) {
      U.toast('首次同步失败：' + (e.message || e));
      App.Sync.startPolling(pollHandler, 20000);
    }
  }

  function initSync() {
    if (!App.Sync || !App.Sync.ENABLED) { updateSyncPill('offline'); return; }
    App.Sync.setStatusCb(updateSyncPill);
    if (App.Sync.loadSession() && App.Sync.isLoggedIn()) { onLoggedIn(); }
    else { showLogin(true); }
  }

  // 注册 Service Worker（PWA：可添加到主屏幕 + 离线缓存 + 登录态持久）
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    var refreshing = false;
    function showUpdateBar(waiting) {
      if (U.$('#swUpdateBar')) return;
      var bar = U.el('div', { id: 'swUpdateBar', style: 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--accent);color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,.2)' });
      bar.appendChild(U.el('span', { text: '🔄 发现新版本，点击刷新获取最新功能' }));
      bar.appendChild(U.el('button', { class: 'btn', style: 'background:#fff;color:var(--accent);border:none;margin-left:12px;flex:none', text: '立即刷新', onclick: function () { waiting.postMessage({ type: 'SKIP_WAITING' }); } }));
      document.body.appendChild(bar);
    }
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      window.__swReg = reg;
      if (reg.waiting) showUpdateBar(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(nw);
        });
      });
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return; refreshing = true; location.reload();
    });
  }
  // 手动「检查更新」：强制浏览器重新校验 sw.js；有新版本则提示刷新
  App.checkForUpdate = function () {
    if (!window.__swReg) { U.toast('正在初始化，请稍后再试'); return; }
    U.toast('正在检查更新…');
    window.__swReg.update().then(function () {
      if (window.__swReg.waiting) U.toast('已有新版本，点底部「立即刷新」');
      else U.toast('已是最新版本');
    }).catch(function () { U.toast('检查更新失败，请稍后重试'); });
  };

  // 登录表单
  var loginMode = 'signin';
  async function doLogin() {
    var email = U.$('#loginEmail').value.trim();
    var pwd = U.$('#loginPwd').value;
    var msg = U.$('#loginMsg');
    if (!email || !pwd) { msg.textContent = '请输入邮箱和密码'; return; }
    if (pwd.length < 6) { msg.textContent = '密码至少 6 位'; return; }
    msg.textContent = '处理中…';
    try {
      if (loginMode === 'signup') await App.Sync.signUp(email, pwd);
      else await App.Sync.signIn(email, pwd);
      await onLoggedIn();
    } catch (e) { msg.textContent = e.message || '操作失败'; }
  }

  /* ---------- 事件绑定 ---------- */
  U.$('#navMenu').addEventListener('click', function (e) {
    if (U.$('#navMenu').classList.contains('sorting')) return; // 排序模式下不触发导航
    var btn = e.target.closest('.nav-item, .nav-sub-item'); if (!btn) return;
    navigate(btn.getAttribute('data-page'));
  });
  U.$('#subNav').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]'); if (!btn) return;
    navigate(btn.getAttribute('data-page'));
  });
  U.$('#openSettings').addEventListener('click', openSettings);

  // 登录相关
  if (U.$('#loginSubmit')) {
    U.$('#loginSubmit').addEventListener('click', doLogin);
    U.$all('.ltab').forEach(function (t) {
      t.addEventListener('click', function () {
        U.$all('.ltab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        loginMode = t.getAttribute('data-mode');
        U.$('#loginSubmit').textContent = loginMode === 'signup' ? '注册并登录' : '登录';
      });
    });
    U.$('#loginPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    U.$('#loginEmail').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  }
  // 账号按钮（仅云端同步开启时存在）；纯本地模式已移除，这里做存在性守卫
  var accountBtn = U.$('#accountBtn');
  if (accountBtn) {
    accountBtn.addEventListener('click', function () {
      if (!App.Sync || !App.Sync.ENABLED) { U.toast('未配置云端同步'); return; }
      if (App.Sync.isLoggedIn()) {
        if (window.confirm('退出当前账号？本地数据保留，云端同步将暂停。')) {
          App.Sync.logout(); updateSyncPill('offline'); U.toast('已退出登录');
        }
      } else { showLogin(true); }
    });
  }

  // 首次交互申请通知权限
  document.addEventListener('click', function once() {
    U.requestNotifyPermission();
    document.removeEventListener('click', once);
  });

  // 供同步轮询重绘当前页
  App.renderCurrent = function () { navigate(current); };

  /* ---------- 一级类目自由排序（持久化到 localStorage） ---------- */
  var NAV_ORDER_KEY = 'nav_order_v1';
  function navIdent(el) {
    if (el.classList.contains('nav-group')) return 'group:' + (el.getAttribute('data-group') || '');
    return 'page:' + (el.getAttribute('data-page') || '');
  }
  function saveNavOrder() {
    var menu = U.$('#navMenu'); if (!menu) return;
    var ids = [];
    Array.prototype.forEach.call(menu.children, function (c) {
      if (c.classList.contains('nav-item') || c.classList.contains('nav-group')) ids.push(navIdent(c));
    });
    try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(ids)); } catch (e) {}
  }
  function applyNavOrder() {
    var menu = U.$('#navMenu'); if (!menu) return;
    var raw; try { raw = localStorage.getItem(NAV_ORDER_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    var ids; try { ids = JSON.parse(raw); } catch (e) { return; }
    if (!ids || !ids.length) return;
    ids.forEach(function (id) {
      var sel = id.indexOf('group:') === 0 ? '.nav-group[data-group="' + id.slice(6) + '"]' : '.nav-item[data-page="' + id.slice(5) + '"]';
      var el = menu.querySelector(sel);
      if (el) menu.appendChild(el); // 按存储顺序依次移到末尾，最终顺序即等于 ids
    });
  }
  function moveNavEl(el, dir) {
    if (dir < 0) {
      var prev = el.previousElementSibling;
      if (prev && (prev.classList.contains('nav-item') || prev.classList.contains('nav-group'))) el.parentNode.insertBefore(el, prev);
    } else {
      var next = el.nextElementSibling;
      if (next && (next.classList.contains('nav-item') || next.classList.contains('nav-group'))) el.parentNode.insertBefore(next, el);
    }
    saveNavOrder();
  }
  function setupNavSort() {
    var btn = U.$('#navSortBtn'); if (!btn) return;
    var menu = U.$('#navMenu');
    btn.addEventListener('click', function () {
      var on = menu.classList.toggle('sorting');
      btn.classList.toggle('active', on);
      btn.textContent = on ? '✓ 完成排序' : '≡ 排序类目';
      if (on) {
        Array.prototype.forEach.call(menu.children, function (c) {
          if (!(c.classList.contains('nav-item') || c.classList.contains('nav-group'))) return;
          if (c.querySelector('.nav-handle')) return;
          var h = U.el('div', { class: 'nav-handle' });
          h.appendChild(U.el('button', { class: 'nav-move', text: '↑', title: '上移', onclick: function (e) { e.stopPropagation(); moveNavEl(c, -1); } }));
          h.appendChild(U.el('button', { class: 'nav-move', text: '↓', title: '下移', onclick: function (e) { e.stopPropagation(); moveNavEl(c, 1); } }));
          c.insertBefore(h, c.firstChild);
        });
      } else {
        Array.prototype.forEach.call(menu.querySelectorAll('.nav-handle'), function (h) { h.remove(); });
        U.toast('类目顺序已保存');
      }
    });
  }
  applyNavOrder();
  setupNavSort();

  /* ---------- 启动 ---------- */
  S.ensureDailyReset();
  navigate('daily-plan');
  scheduleReminders();
  initSync();
  registerSW();
  // 启动后若已过 5:00 且今日未采集，立即补采
  (function () { var hhmm = U.fmtTime(new Date()); if (hhmm >= '05:00' && App._videoAutoCollect) App._videoAutoCollect(); })();
})();
