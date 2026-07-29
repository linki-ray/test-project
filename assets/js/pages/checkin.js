/* =========================================================
   页面 5：打卡计划
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

App.pages['checkin'] = function (root) {
  var U = App.U, S = App.Store;
  App.U.clear(root);
  var c = S.getCheckins();
  var readingTimer = null, readingStart = 0;

  /* ---------- 阅读打卡 ---------- */
  var rCard = U.el('div', { class: 'card' });
  rCard.appendChild(U.el('div', { class: 'card-title', text: '阅读打卡（30 分钟 - 1 小时）' }));
  var rTimer = U.el('div', { class: 'timer', text: '00:00' });
  rCard.appendChild(rTimer);
  var rBtnRow = U.el('div', { class: 'row', style: 'margin-top:10px;justify-content:center' });
  var rStartBtn = U.el('button', { class: 'btn', text: '开始阅读', onclick: startReading });
  var rEndBtn = U.el('button', { class: 'btn ghost', text: '结束并打卡', style: 'display:none', onclick: endReading });
  rBtnRow.appendChild(rStartBtn); rBtnRow.appendChild(rEndBtn);
  rCard.appendChild(rBtnRow);
  var rHist = U.el('div', { id: 'rHist', style: 'margin-top:10px' });
  rCard.appendChild(rHist);
  root.appendChild(rCard);

  function startReading() {
    readingStart = Date.now();
    rStartBtn.style.display = 'none'; rEndBtn.style.display = '';
    readingTimer = setInterval(function () {
      var s = Math.floor((Date.now() - readingStart) / 1000);
      rTimer.textContent = fmtMMSS(s);
      if (s >= 3600) { // 满 1 小时达标
        clearInterval(readingTimer); readingTimer = null;
        U.notify('阅读达标 🎉', '已累计阅读满 1 小时，打卡成功！', { warn: false });
        recordReading(60);
        rStartBtn.style.display = ''; rEndBtn.style.display = 'none'; rTimer.textContent = '60:00';
      }
    }, 1000);
  }
  function endReading() {
    if (readingTimer) { clearInterval(readingTimer); readingTimer = null; }
    var s = Math.floor((Date.now() - readingStart) / 1000);
    var min = Math.round(s / 60);
    rStartBtn.style.display = ''; rEndBtn.style.display = 'none';
    if (min < 30) { U.toast('不足 30 分钟，未达标（' + min + ' 分钟）'); rTimer.textContent = '00:00'; return; }
    recordReading(Math.min(min, 60));
    rTimer.textContent = '00:00';
  }
  function recordReading(min) {
    c.reading.push({ id: U.uid(), date: S.todayStr(), time: U.fmtTime(), durationMin: min });
    S.saveCheckins(c); U.toast('阅读打卡 +' + min + ' 分钟'); renderReading();
  }
  function renderReading() {
    U.clear(rHist);
    if (!c.reading.length) { rHist.appendChild(U.el('div', { class: 'muted', text: '今日尚未阅读打卡' })); return; }
    rHist.appendChild(U.el('div', { class: 'muted', text: '今日已打卡 ' + c.reading.filter(function (x) { return x.date === S.todayStr(); }).length + ' 次' }));
    c.reading.slice().reverse().forEach(function (r) {
      var row = U.el('div', { class: 'quote-row' });
      row.appendChild(U.el('div', { text: r.date + ' ' + r.time + ' · ' + r.durationMin + ' 分钟' }));
      row.appendChild(U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { c.reading = c.reading.filter(function (x) { return x.id !== r.id; }); S.saveCheckins(c); renderReading(); } }));
      rHist.appendChild(row);
    });
  }

  /* ---------- 拼多多视频打卡 ---------- */
  var pCard = U.el('div', { class: 'card' });
  pCard.appendChild(U.el('div', { class: 'card-title', text: '拼多多视频打卡' }));
  var pBtnRow = U.el('div', { class: 'row', style: 'justify-content:center' });
  var pBtn = U.el('button', { class: 'btn', text: '标记完成打卡', onclick: function () {
    c.pdd.push({ id: U.uid(), date: S.todayStr(), time: U.fmtTime() }); S.saveCheckins(c); U.toast('拼多多打卡完成'); renderPDD();
  } });
  pBtnRow.appendChild(pBtn);
  pCard.appendChild(pBtnRow);
  var pHist = U.el('div', { id: 'pHist', style: 'margin-top:10px' });
  pCard.appendChild(pHist);
  root.appendChild(pCard);

  function renderPDD() {
    U.clear(pHist);
    var today = c.pdd.filter(function (x) { return x.date === S.todayStr(); });
    pHist.appendChild(U.el('div', { class: 'muted', text: '今日已打卡 ' + today.length + ' 次' + (today.length ? ' ✓' : '') }));
    c.pdd.slice().reverse().forEach(function (r) {
      var row = U.el('div', { class: 'quote-row' });
      row.appendChild(U.el('div', { text: r.date + ' ' + r.time }));
      row.appendChild(U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { c.pdd = c.pdd.filter(function (x) { return x.id !== r.id; }); S.saveCheckins(c); renderPDD(); } }));
      pHist.appendChild(row);
    });
  }

  /* ---------- 自定义打卡 ---------- */
  var cuCard = U.el('div', { class: 'card' });
  cuCard.appendChild(U.el('div', { class: 'card-title', text: '自定义打卡计划' }));
  var addBtn = U.el('button', { class: 'btn sm', text: '新增打卡项', onclick: openAddCustom });
  cuCard.appendChild(addBtn);
  var cuList = U.el('div', { id: 'cuList', style: 'margin-top:10px' });
  cuCard.appendChild(cuList);
  root.appendChild(cuCard);

  function openAddCustom() {
    var body = U.el('div');
    var nameI = U.el('input', { class: 'input', placeholder: '打卡名称，如 背单词' });
    var tagI = U.el('input', { class: 'input', placeholder: '标签，如 学习自律' });
    var minI = U.el('input', { class: 'input', type: 'number', placeholder: '目标时长(分钟)，可选', value: '30' });
    var remindI = U.el('input', { class: 'input', type: 'time', placeholder: '提醒时间，可选' });
    body.appendChild(field('名称', nameI));
    body.appendChild(field('标签', tagI));
    body.appendChild(field('目标时长(分钟)', minI));
    body.appendChild(field('提醒时间', remindI));
    U.modal({ title: '新增自定义打卡', body: body, actions: [{ label: '取消' }, { label: '保存', primary: true, onClick: function () {
      if (!nameI.value.trim()) { U.toast('请输入名称'); return false; }
      c.custom.push({ id: U.uid(), name: nameI.value.trim(), tag: tagI.value.trim(), targetMin: +minI.value || 30, remind: remindI.value, records: [] });
      S.saveCheckins(c); U.toast('已添加'); renderCustom();
    } }] });
  }
  function renderCustom() {
    U.clear(cuList);
    if (!c.custom.length) { cuList.appendChild(U.el('div', { class: 'empty', text: '还没有自定义打卡项' })); return; }
    c.custom.forEach(function (item) {
      var card = U.el('div', { class: 'card', style: 'margin-bottom:10px;background:var(--surface-2);padding:12px' });
      var head = U.el('div', { class: 'row' });
      head.appendChild(U.el('div', { style: 'font-weight:600', text: item.name }));
      if (item.tag) head.appendChild(U.el('span', { class: 'tag', text: item.tag }));
      head.appendChild(U.el('div', { class: 'spacer' }));
      head.appendChild(U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { c.custom = c.custom.filter(function (x) { return x.id !== item.id; }); S.saveCheckins(c); renderCustom(); } }));
      card.appendChild(head);
      var info = U.el('div', { class: 'muted', style: 'margin:6px 0', text: '目标 ' + item.targetMin + ' 分钟' + (item.remind ? ' · 提醒 ' + item.remind : '') });
      card.appendChild(info);
      // 计时打卡
      var timerBox = U.el('div', { class: 'row' });
      var tEl = U.el('span', { class: 'timer', style: 'font-size:20px;flex:1', text: '00:00' });
      var startB = U.el('button', { class: 'btn sm', text: '开始', onclick: function () { startCustom(item, tEl, startB, endB); } });
      var endB = U.el('button', { class: 'btn ghost sm', text: '结束打卡', style: 'display:none', onclick: function () { endCustom(item, startB, endB, tEl); } });
      timerBox.appendChild(tEl); timerBox.appendChild(startB); timerBox.appendChild(endB);
      card.appendChild(timerBox);
      // 历史
      var hist = U.el('div', { style: 'margin-top:8px' });
      item.records.slice().reverse().forEach(function (r) {
        var row = U.el('div', { class: 'quote-row' });
        row.appendChild(U.el('div', { text: r.date + ' ' + r.time + ' · ' + r.durationMin + ' 分钟' }));
        row.appendChild(U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { item.records = item.records.filter(function (x) { return x.id !== r.id; }); S.saveCheckins(c); renderCustom(); } }));
        hist.appendChild(row);
      });
      card.appendChild(hist);
      cuList.appendChild(card);
    });
  }

  var customTimers = {};
  function startCustom(item, tEl, startB, endB) {
    if (customTimers[item.id]) return;
    var st = Date.now();
    startB.style.display = 'none'; endB.style.display = '';
    customTimers[item.id] = setInterval(function () {
      var s = Math.floor((Date.now() - st) / 1000);
      tEl.textContent = fmtMMSS(s);
      if (s >= item.targetMin * 60) { clearInterval(customTimers[item.id]); delete customTimers[item.id];
        U.notify('打卡达标 🎉', item.name + ' 已达成目标 ' + item.targetMin + ' 分钟！', {});
        item.records.push({ id: U.uid(), date: S.todayStr(), time: U.fmtTime(), durationMin: item.targetMin }); S.saveCheckins(c); startB.style.display = ''; endB.style.display = 'none'; tEl.textContent = '00:00'; renderCustom();
      }
    }, 1000);
  }
  function endCustom(item, startB, endB, tEl) {
    if (customTimers[item.id]) { clearInterval(customTimers[item.id]); delete customTimers[item.id]; }
    startB.style.display = ''; endB.style.display = 'none'; tEl.textContent = '00:00';
    item.records.push({ id: U.uid(), date: S.todayStr(), time: U.fmtTime(), durationMin: 0 });
    S.saveCheckins(c); U.toast('已打卡（计时未达目标，记 0 分钟）'); renderCustom();
  }

  /* 一键清空当日打卡 */
  var clearCard = U.el('div', { class: 'card' });
  clearCard.appendChild(U.el('div', { class: 'card-title', text: '数据管理' }));
  clearCard.appendChild(U.el('div', { class: 'muted', text: '打卡记录永久本地留存，不受每日零点重置影响。' }));
  clearCard.appendChild(U.el('button', { class: 'btn danger sm', style: 'margin-top:8px', text: '一键清空当日打卡', onclick: function () {
    U.modal({ title: '清空当日打卡', body: '将删除今天的所有打卡记录（历史记录保留）。确定？', actions: [{ label: '取消' }, { label: '清空', primary: true, onClick: function () {
      var td = S.todayStr();
      c.reading = c.reading.filter(function (x) { return x.date !== td; });
      c.pdd = c.pdd.filter(function (x) { return x.date !== td; });
      c.custom.forEach(function (it) { it.records = it.records.filter(function (x) { return x.date !== td; }); });
      S.saveCheckins(c); U.toast('已清空当日打卡'); renderAll();
    } }] });
  } }));
  root.appendChild(clearCard);

  function fmtMMSS(s) { var m = Math.floor(s / 60), ss = s % 60; return (m < 10 ? '0' + m : m) + ':' + (ss < 10 ? '0' + ss : ss); }
  function field(label, node) { var d = U.el('div', { class: 'field' }); d.appendChild(U.el('label', { text: label })); d.appendChild(node); return d; }

  function renderAll() { renderReading(); renderPDD(); renderCustom(); }
  renderAll();
};
