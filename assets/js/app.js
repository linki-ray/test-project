/* =========================================================
   主程序：导航路由 / 时钟 / 存储设置 / 每日重置 / 提醒调度
   ========================================================= */
(function () {
  var U = App.U, S = App.Store;
  var current = 'daily-plan';
  var notified = {}; // 当天已提醒记录：key -> true

  var TITLES = {
    'daily-plan': '每日计划', 'viral-videos': '爆款抖音小红书视频',
    'pet-ops': '宠物运营中心',
    'inspiration': '灵感记录', 'finance': '全球金融热点', 'checkin': '打卡计划'
  };

  function navigate(page) {
    current = page;
    U.$all('.nav-item').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-page') === page); });
    U.$('#pageTitle').textContent = TITLES[page] || '';
    U.$('#nav').classList.remove('open');
    var root = U.$('#pageRoot');
    if (App.pages[page]) App.pages[page](root);
    // 切换页面时重置当天提醒标记（避免跨页重复）
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
    // 4) 自定义打卡提醒
    var c = S.getCheckins();
    (c.custom || []).forEach(function (it) {
      if (it.remind) {
        var k = 'cu_' + it.id + '_' + S.todayStr();
        if (it.remind === hhmm && !notified[k]) { notified[k] = true; U.notify('打卡提醒', '「' + it.name + '」到时间啦！', { warn: true }); }
      }
    });
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
    body.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '当前模式：' + (mode === 'daily' ? '每日重置' : '永久累计') + ' · 本地占用约 ' + st.kb + ' KB（仅存于本机）' }));
    body.appendChild(U.el('div', { class: 'muted', text: '所有数据仅保存在本地浏览器，不上传任何服务器。' }));

    body.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px', text: '立即执行一次重置（演示）', onclick: function () { S.forceReset(); U.toast('已重置'); navigate(current); close(); } }));

    var close;
    var m = U.modal({ title: '存储设置', body: body, actions: [{ label: '关闭', primary: true, onClick: function () {} }] });
    close = m.close;
    function setMode(mm) { S.setMode(mm); U.toast('已切换为' + (mm === 'daily' ? '每日重置' : '永久累计') + '模式'); navigate(current); }
  }

  /* ---------- 事件绑定 ---------- */
  U.$('#navMenu').addEventListener('click', function (e) {
    var btn = e.target.closest('.nav-item'); if (!btn) return;
    navigate(btn.getAttribute('data-page'));
  });
  U.$('#openSettings').addEventListener('click', openSettings);

  // 首次交互申请通知权限
  document.addEventListener('click', function once() {
    U.requestNotifyPermission();
    document.removeEventListener('click', once);
  });

  /* ---------- 启动 ---------- */
  S.ensureDailyReset();
  navigate('daily-plan');
  scheduleReminders();
  // 启动后若已过 5:00 且今日未采集，立即补采
  (function () { var hhmm = U.fmtTime(new Date()); if (hhmm >= '05:00' && App._videoAutoCollect) App._videoAutoCollect(); })();
})();
