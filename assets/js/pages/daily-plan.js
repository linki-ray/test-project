/* =========================================================
   页面 1：每日计划
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

App.pages['daily-plan'] = function (root) {
  var U = App.U, S = App.Store;
  App.U.clear(root);

  var DEFAULT_TAGS = ['自媒体', '股票学习', '生活自律'];
  var state = { filterTag: '全部', batchMode: false, selected: {} };

  var dp = S.getDailyPlan();

  // ---- 顶部进度卡片 ----
  var progressCard = U.el('div', { class: 'card' });
  var progressWrap = U.el('div', { class: 'progress-wrap' });
  var bar = U.el('div', { class: 'progress-bar' });
  var fill = U.el('div', { class: 'progress-fill' });
  bar.appendChild(fill);
  var ptext = U.el('div', { class: 'progress-text' });
  progressWrap.appendChild(ptext); progressWrap.appendChild(bar);
  progressCard.appendChild(U.el('div', { class: 'card-title', html: '今日完成进度 <span class="card-sub" id="dpDate"></span>' }));
  progressCard.appendChild(progressWrap);
  root.appendChild(progressCard);

  // ---- 标签筛选 + 批量 ----
  var filterCard = U.el('div', { class: 'card' });
  filterCard.appendChild(U.el('div', { class: 'card-title', text: '分类标签' }));
  var tagBar = U.el('div', { class: 'filter-bar', id: 'dpTagBar' });
  filterCard.appendChild(tagBar);
  var batchBtn = U.el('button', { class: 'btn ghost sm', text: '批量管理', onclick: toggleBatch });
  var clearCustomBtn = U.el('button', { class: 'btn ghost sm', text: '清空自定义任务', onclick: clearCustom });
  var delSelBtn = U.el('button', { class: 'btn danger sm', text: '删除选中', id: 'dpDelSel', style: 'display:none' });
  var cancelBatchBtn = U.el('button', { class: 'btn ghost sm', text: '取消', id: 'dpCancelBatch', style: 'display:none', onclick: toggleBatch });
  var row2 = U.el('div', { class: 'row wrap', style: 'margin-top:10px' }, [batchBtn, clearCustomBtn, delSelBtn, cancelBatchBtn]);
  filterCard.appendChild(row2);
  root.appendChild(filterCard);

  // ---- 新增任务 ----
  var addCard = U.el('div', { class: 'card' });
  addCard.appendChild(U.el('div', { class: 'card-title', text: '新增任务' }));
  var nameInput = U.el('input', { class: 'input', placeholder: '输入任务名称…', id: 'dpName' });
  var priSel = U.el('select', { class: 'input', id: 'dpPri', style: 'max-width:130px' },
    [U.el('option', { value: 'high', text: '高优先级' }), U.el('option', { value: 'mid', text: '中优先级' }), U.el('option', { value: 'low', text: '低优先级' })]);
  var remindInput = U.el('input', { class: 'input', type: 'time', id: 'dpRemind', style: 'max-width:140px' });
  var tagSel = U.el('select', { class: 'input', id: 'dpTag', style: 'max-width:150px' });
  var addBtn = U.el('button', { class: 'btn', text: '添加', onclick: addTask });
  addCard.appendChild(U.el('div', { class: 'row wrap' }, [nameInput, priSel, remindInput, tagSel]));
  addCard.appendChild(U.el('div', { class: 'row', style: 'margin-top:10px' }, [addBtn, U.el('span', { class: 'muted', text: '提醒时间留空则不提醒' })]));
  root.appendChild(addCard);

  // ---- 任务列表 ----
  var listCard = U.el('div', { class: 'card' });
  listCard.appendChild(U.el('div', { class: 'card-title', html: '待办清单 <span class="card-sub">点击方框完成打卡</span>' }));
  var listBox = U.el('div', { id: 'dpList' });
  listCard.appendChild(listBox);
  root.appendChild(listCard);

  // ---- 历史复盘 ----
  var histCard = U.el('div', { class: 'card' });
  histCard.appendChild(U.el('div', { class: 'card-title', text: '历史复盘' }));
  var histDate = U.el('input', { class: 'input', type: 'date', id: 'dpHistDate', style: 'max-width:200px', value: S.todayStr() });
  var histViewBtn = U.el('button', { class: 'btn ghost sm', text: '查看', onclick: viewHistory });
  histCard.appendChild(U.el('div', { class: 'row', style: 'margin-bottom:10px' }, [histDate, histViewBtn]));
  var histBox = U.el('div', { id: 'dpHistBox' });
  histCard.appendChild(histBox);
  root.appendChild(histCard);

  /* ---- 逻辑 ---- */
  function allTags() {
    var tags = DEFAULT_TAGS.slice();
    S.getTags('dp').forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    dp.tasks.forEach(function (t) { if (t.tag && tags.indexOf(t.tag) === -1) tags.push(t.tag); });
    return tags;
  }
  function refreshTagBar() {
    U.clear(tagBar);
    var tags = ['全部'].concat(allTags());
    tags.forEach(function (t) {
      tagBar.appendChild(U.el('span', { class: 'tag' + (state.filterTag === t ? ' active' : ''), text: t, onclick: function () { state.filterTag = t; refreshTagBar(); refreshList(); } }));
    });
  }
  function refreshTagSelect() {
    U.clear(tagSel);
    allTags().forEach(function (t) { tagSel.appendChild(U.el('option', { value: t, text: t })); });
  }

  function refresh() {
    dp = S.getDailyPlan();
    U.$('#dpDate').textContent = ' · ' + dp.date + (S.getMode() === 'daily' ? '（每日重置模式）' : '（永久累计模式）');
    var total = dp.tasks.length, done = dp.tasks.filter(function (t) { return t.done; }).length;
    ptext.textContent = '已完成 ' + done + '/' + total + ' 项';
    fill.style.width = (total ? (done / total * 100) : 0) + '%';
    refreshTagBar(); refreshTagSelect(); refreshList();
  }

  function refreshList() {
    U.clear(listBox);
    var tasks = dp.tasks.filter(function (t) { return state.filterTag === '全部' || t.tag === state.filterTag; });
    if (!tasks.length) { listBox.appendChild(U.el('div', { class: 'empty', text: '暂无任务，添加一个开始吧' })); return; }
    tasks.forEach(function (t) {
      var todo = U.el('div', { class: 'todo' + (t.done ? ' done' : '') + (t.pri === 'high' ? ' pri-high' : t.pri === 'mid' ? ' pri-mid' : ' pri-low') });
      if (state.batchMode) {
        var sel = U.el('input', { type: 'checkbox', onchange: function () { if (this.checked) state.selected[t.id] = true; else delete state.selected[t.id]; } });
        todo.appendChild(sel);
      }
      var cb = U.el('div', { class: 'checkbox' + (t.done ? ' on' : '') , onclick: function () { toggleDone(t.id); } });
      cb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';
      todo.appendChild(cb);
      var nameWrap = U.el('div', { class: 'todo-name' }, [U.el('div', { text: t.name })]);
      var meta = U.el('div', { class: 'meta' });
      var priTxt = t.pri === 'high' ? '高' : t.pri === 'mid' ? '中' : '低';
      meta.appendChild(U.el('span', { class: 'tag', text: priTxt + '优先' }));
      if (t.tag) meta.appendChild(U.el('span', { class: 'tag', text: t.tag }));
      if (t.remind) meta.appendChild(U.el('span', { class: 'tag', text: '⏰' + t.remind }));
      if (t.preset) meta.appendChild(U.el('span', { class: 'tag', text: '预设' }));
      nameWrap.appendChild(meta);
      todo.appendChild(nameWrap);
      if (!t.preset) {
        var del = U.el('button', { class: 'icon-btn', html: '🗑', title: '删除', onclick: function () { removeTask(t.id); } });
        todo.appendChild(del);
      }
      listBox.appendChild(todo);
    });
  }

  function toggleDone(id) {
    dp.tasks.forEach(function (t) { if (t.id === id) t.done = !t.done; });
    S.saveDailyPlan(dp); refresh();
  }
  function addTask() {
    var name = nameInput.value.trim();
    if (!name) { U.toast('请输入任务名称'); return; }
    dp.tasks.push({ id: U.uid(), name: name, preset: false, pri: priSel.value, remind: remindInput.value, tag: tagSel.value, done: false });
    S.saveDailyPlan(dp);
    nameInput.value = ''; remindInput.value = '';
    U.toast('已添加'); refresh();
  }
  function removeTask(id) {
    dp.tasks = dp.tasks.filter(function (t) { return t.id !== id; });
    S.saveDailyPlan(dp); refresh();
  }
  function toggleBatch() {
    state.batchMode = !state.batchMode; state.selected = {};
    batchBtn.style.display = state.batchMode ? 'none' : '';
    delSelBtn.style.display = state.batchMode ? '' : 'none';
    cancelBatchBtn.style.display = state.batchMode ? '' : 'none';
    refreshList();
  }
  function clearCustom() {
    U.modal({ title: '清空自定义任务', body: '将删除全部自定义任务，4 项预设任务保留。确定？',
      actions: [{ label: '取消' }, { label: '清空', primary: true, onClick: function () {
        dp.tasks = dp.tasks.filter(function (t) { return t.preset; });
        S.saveDailyPlan(dp); U.toast('已清空自定义任务'); refresh();
      } }] });
  }
  function delSelBtnFn() {
    var ids = Object.keys(state.selected);
    if (!ids.length) { U.toast('请先勾选任务'); return; }
    var blocked = ids.filter(function (id) { var t = dp.tasks.find(function (x) { return x.id === id; }); return t && t.preset; });
    dp.tasks = dp.tasks.filter(function (t) { return !state.selected[t.id] || t.preset; });
    S.saveDailyPlan(dp); state.selected = {};
    toggleBatch();
    U.toast(blocked.length ? ('已删除，' + blocked.length + ' 项预设不可删除') : '已删除选中');
    refresh();
  }
  // 绑定删除选中按钮
  delSelBtn.addEventListener('click', delSelBtnFn);

  function viewHistory() {
    var d = histDate.value;
    var hist = S.getDailyPlanHistory();
    U.clear(histBox);
    if (!hist[d]) { histBox.appendChild(U.el('div', { class: 'empty', text: '该日期暂无记录' })); return; }
    var tasks = hist[d];
    var done = tasks.filter(function (t) { return t.done; }).length;
    histBox.appendChild(U.el('div', { class: 'muted', text: '当日完成 ' + done + '/' + tasks.length }));
    tasks.forEach(function (t) {
      var todo = U.el('div', { class: 'todo' + (t.done ? ' done' : '') });
      var cb = U.el('div', { class: 'checkbox' + (t.done ? ' on' : '') }); cb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';
      todo.appendChild(cb);
      var meta = U.el('div', { class: 'meta' });
      if (t.tag) meta.appendChild(U.el('span', { class: 'tag', text: t.tag }));
      if (t.preset) meta.appendChild(U.el('span', { class: 'tag', text: '预设' }));
      todo.appendChild(U.el('div', { class: 'todo-name' }, [U.el('div', { text: t.name }), meta]));
      histBox.appendChild(todo);
    });
  }

  refresh();
};
