/* =========================================================
   页面 3：灵感记录
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

App.pages['inspiration'] = function (root) {
  var U = App.U, S = App.Store;
  App.U.clear(root);

  var DEFAULT_TAGS = ['短视频选题', '股票思路', '生活灵感'];
  var state = { filterTag: '全部', dateFilter: '', batchMode: false, selected: {}, recording: false, recog: null };

  /* ---- 顶部日期 + 工具栏 ---- */
  var headCard = U.el('div', { class: 'card' });
  headCard.appendChild(U.el('div', { class: 'card-title', html: '灵感便签 <span class="card-sub">' + S.todayStr() + ' · 随时记录你的奇思妙想</span>' }));
  var toolbar = U.el('div', { class: 'row wrap' });
  var btnText = U.el('button', { class: 'btn ghost sm', text: '文字', onclick: function () { setMode('text'); } });
  var btnVoice = U.el('button', { class: 'btn ghost sm', text: '语音转文字', onclick: toggleVoice });
  var btnImg = U.el('button', { class: 'btn ghost sm', text: '上传图片', onclick: function () { fileImg.click(); } });
  var btnVid = U.el('button', { class: 'btn ghost sm', text: '上传短视频', onclick: function () { fileVid.click(); } });
  toolbar.appendChild(btnText); toolbar.appendChild(btnVoice); toolbar.appendChild(btnImg); toolbar.appendChild(btnVid);
  headCard.appendChild(toolbar);

  var pendingAttach = [];
  var ta = U.el('textarea', { class: 'textarea', id: 'inspTa', placeholder: '写下今天的灵感…（支持语音自动转写、图片/视频附件）' });
  ta.value = S.getDraft();
  ta.addEventListener('input', function () { S.setDraft(ta.value); });
  headCard.appendChild(ta);

  var pendingBox = U.el('div', { class: 'row wrap', id: 'inspPending', style: 'margin:8px 0' });
  headCard.appendChild(pendingBox);

  var tagRow = U.el('div', { class: 'row wrap', style: 'margin-top:8px' });
  var tagInput = U.el('input', { class: 'input', placeholder: '标签（回车添加，可多选）', style: 'max-width:200px;flex:0' });
  tagInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && this.value.trim()) { addTag(this.value.trim()); this.value = ''; } });
  var curTags = [];
  var curTagBox = U.el('div', { class: 'row wrap', id: 'inspCurTags' });
  tagRow.appendChild(tagInput); tagRow.appendChild(curTagBox);
  headCard.appendChild(tagRow);

  var saveBtn = U.el('button', { class: 'btn block', text: '保存灵感', style: 'margin-top:12px', onclick: saveInsp });
  headCard.appendChild(saveBtn);

  // 隐藏文件输入
  var fileImg = U.el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', onchange: handleFiles.bind(null, 'image') });
  var fileVid = U.el('input', { type: 'file', accept: 'video/*', multiple: true, style: 'display:none', onchange: handleFiles.bind(null, 'video') });
  headCard.appendChild(fileImg); headCard.appendChild(fileVid);
  root.appendChild(headCard);

  /* ---- 筛选栏 ---- */
  var fCard = U.el('div', { class: 'card' });
  fCard.appendChild(U.el('div', { class: 'card-title', text: '筛选与检索' }));
  var fBar = U.el('div', { class: 'filter-bar', id: 'inspTags' });
  fCard.appendChild(fBar);
  var dateI = U.el('input', { class: 'input', type: 'date', style: 'max-width:180px', onchange: function () { state.dateFilter = this.value; renderList(); } });
  var batchBtn = U.el('button', { class: 'btn ghost sm', text: '批量导出', onclick: batchExport });
  fCard.appendChild(U.el('div', { class: 'row wrap' }, [dateI, batchBtn]));
  root.appendChild(fCard);

  var listBox = U.el('div', { id: 'inspList' });
  root.appendChild(listBox);

  /* ---- 语音 ---- */
  function setMode(m) {
    btnText.classList.add('active');
    U.toast(m === 'text' ? '已切换文字输入' : '');
  }
  function toggleVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { U.toast('当前浏览器不支持语音识别'); return; }
    if (state.recording) { try { state.recog.stop(); } catch (e) {} return; }
    var r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
    r.onresult = function (e) {
      var txt = ''; for (var i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      ta.value = (ta.value ? ta.value + ' ' : '') + txt; S.setDraft(ta.value);
    };
    r.onend = function () { state.recording = false; btnVoice.textContent = '语音转文字'; btnVoice.classList.remove('active'); };
    r.onerror = function () { state.recording = false; btnVoice.textContent = '语音转文字'; U.toast('语音识别结束/出错'); };
    state.recog = r; state.recording = true; btnVoice.textContent = '停止录音'; btnVoice.classList.add('active'); r.start();
  }
  function handleFiles(type, e) {
    var files = e.target.files; if (!files.length) return;
    Array.prototype.forEach.call(files, function (f) {
      var rd = new FileReader();
      rd.onload = function () { pendingAttach.push({ type: type, data: rd.result, name: f.name }); renderPending(); };
      rd.readAsDataURL(f);
    });
    e.target.value = '';
  }
  function renderPending() {
    U.clear(pendingBox);
    pendingAttach.forEach(function (a, idx) {
      var wrap = U.el('div', { style: 'position:relative;display:inline-block' });
      if (a.type === 'image') wrap.appendChild(U.el('img', { src: a.data, style: 'width:64px;height:64px;object-fit:cover;border-radius:8px' }));
      else wrap.appendChild(U.el('video', { src: a.data, style: 'width:64px;height:64px;object-fit:cover;border-radius:8px' }));
      wrap.appendChild(U.el('button', { class: 'icon-btn', html: '×', style: 'position:absolute;top:-6px;right:-6px;background:#fff;border-radius:50%;border:1px solid var(--line)', onclick: function () { pendingAttach.splice(idx, 1); renderPending(); } }));
      pendingBox.appendChild(wrap);
    });
  }
  function addTag(t) {
    if (curTags.indexOf(t) === -1) curTags.push(t);
    renderCurTags();
  }
  function renderCurTags() {
    U.clear(curTagBox);
    curTags.forEach(function (t) { curTagBox.appendChild(U.el('span', { class: 'tag removable', text: t, onclick: function () { curTags = curTags.filter(function (x) { return x !== t; }); renderCurTags(); } })); });
  }
  function saveInsp() {
    var content = ta.value.trim();
    if (!content && !pendingAttach.length) { U.toast('写点什么或添加附件再保存'); return; }
    var arr = S.getInspirations();
    arr.push({ id: U.uid(), date: S.todayStr(), time: U.fmtTime(), content: content, tags: curTags.slice(), pinned: false, starred: false, attachments: pendingAttach.slice() });
    S.saveInspirations(arr);
    ta.value = ''; S.setDraft(''); curTags = []; pendingAttach = []; renderPending(); renderCurTags();
    U.toast('灵感已保存（永久留存）');
    renderList();
  }

  /* ---- 列表 ---- */
  function allTags() {
    var tags = DEFAULT_TAGS.slice();
    S.getTags('insp').forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    S.getInspirations().forEach(function (x) { (x.tags || []).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); }); });
    return tags;
  }
  function renderTagBar() {
    U.clear(fBar);
    ['全部'].concat(allTags()).forEach(function (t) {
      fBar.appendChild(U.el('span', { class: 'tag' + (state.filterTag === t ? ' active' : ''), text: t, onclick: function () { state.filterTag = t; renderTagBar(); renderList(); } }));
    });
  }
  function renderList() {
    var arr = S.getInspirations().slice().sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (a.date + a.time) > (b.date + b.time) ? -1 : 1;
    });
    if (state.filterTag !== '全部') arr = arr.filter(function (x) { return (x.tags || []).indexOf(state.filterTag) > -1; });
    if (state.dateFilter) arr = arr.filter(function (x) { return x.date === state.dateFilter; });
    U.clear(listBox);
    if (!arr.length) { listBox.appendChild(U.el('div', { class: 'empty', text: '还没有灵感，记录第一条吧' })); return; }
    arr.forEach(function (x) { listBox.appendChild(inspCard(x)); });
  }
  function inspCard(x) {
    var card = U.el('div', { class: 'card' });
    var head = U.el('div', { class: 'row' });
    head.appendChild(U.el('span', { class: 'muted', text: x.date + ' ' + x.time }));
    head.appendChild(U.el('div', { class: 'spacer' }));
    head.appendChild(U.el('button', { class: 'icon-btn', html: x.pinned ? '📌' : '📍', title: '置顶', onclick: function () { x.pinned = !x.pinned; S.saveInspirations(S.getInspirations()); renderList(); } }));
    head.appendChild(U.el('button', { class: 'star' + (x.starred ? ' on' : ''), text: x.starred ? '★' : '☆', onclick: function () { x.starred = !x.starred; S.saveInspirations(S.getInspirations()); renderList(); } }));
    head.appendChild(U.el('button', { class: 'icon-btn', html: '✎', title: '编辑', onclick: function () { editInsp(x); } }));
    head.appendChild(U.el('button', { class: 'icon-btn', html: '🗑', title: '删除', onclick: function () { delInsp(x.id); } }));
    card.appendChild(head);
    if (x.content) card.appendChild(U.el('div', { style: 'margin:8px 0;white-space:pre-wrap;line-height:1.6', text: x.content }));
    (x.tags || []).forEach(function (t) { card.appendChild(U.el('span', { class: 'tag', text: t, style: 'margin-right:6px' })); });
    if (x.attachments && x.attachments.length) {
      var att = U.el('div', { class: 'row wrap', style: 'margin-top:8px' });
      x.attachments.forEach(function (a) {
        if (a.type === 'image') att.appendChild(U.el('img', { src: a.data, style: 'width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer', onclick: function () { preview(a); } }));
        else att.appendChild(U.el('video', { src: a.data, style: 'width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer', onclick: function () { preview(a); } }));
      });
      card.appendChild(att);
    }
    return card;
  }
  function preview(a) {
    var body = a.type === 'image' ? U.el('img', { src: a.data, style: 'max-width:100%' }) : U.el('video', { src: a.data, controls: true, style: 'max-width:100%' });
    U.modal({ title: a.name || '附件预览', body: body });
  }
  function editInsp(x) {
    var ta2 = U.el('textarea', { class: 'textarea', text: x.content });
    U.modal({ title: '编辑灵感', body: ta2, actions: [{ label: '取消' }, { label: '保存', primary: true, onClick: function () {
      x.content = ta2.value; S.saveInspirations(S.getInspirations()); U.toast('已更新'); renderList();
    } }] });
  }
  function delInsp(id) {
    U.modal({ title: '删除灵感', body: '确定删除这条灵感？', actions: [{ label: '取消' }, { label: '删除', primary: true, onClick: function () {
      S.saveInspirations(S.getInspirations().filter(function (x) { return x.id !== id; })); U.toast('已删除'); renderList();
    } }] });
  }
  function batchExport() {
    var arr = S.getInspirations();
    if (!arr.length) return U.toast('暂无灵感可导出');
    var txt = arr.map(function (x) {
      var lines = ['【' + x.date + ' ' + x.time + '】'];
      if (x.content) lines.push(x.content);
      if (x.tags && x.tags.length) lines.push('标签：' + x.tags.join('、'));
      if (x.attachments && x.attachments.length) lines.push('附件：' + x.attachments.map(function (a) { return a.name || a.type; }).join('、'));
      return lines.join('\n');
    }).join('\n\n');
    U.download('灵感导出_' + S.todayStr() + '.txt', txt, 'text/plain;charset=utf-8');
  }

  renderTagBar(); renderList();

  // 暴露给全局提醒调度
  App._inspSavedToday = function () { return S.getInspirations().some(function (x) { return x.date === S.todayStr(); }); };
};
