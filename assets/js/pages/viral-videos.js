/* =========================================================
   页面 2：爆款抖音 / 小红书视频
   说明：真实采集需对接平台开放接口；此处内置【示例榜单生成器】
   以驱动完整交互（卡片/筛选/收藏/导出/手动录入/历史回溯）。
   接入真实 API 的位置见文件底部 collectFromAPI() 注释。
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

App.pages['viral-videos'] = function (root) {
  var U = App.U, S = App.Store;
  App.U.clear(root);

  var TRACKS = ['美妆', '穿搭', '美食', '剧情', '知识', '萌宠', '健身', '数码'];
  var REASON_KEYS = [
    ['hook', '开头钩子'], ['emotion', '情绪共鸣'], ['twist', '剧情反转'],
    ['visual', '视觉画面'], ['copy', '文案话术'], ['bgm', '热门 BGM'], ['tag', '标签流量逻辑']
  ];
  var state = { platform: 'all', track: 'all', starred: 'all', dateFrom: '', dateTo: '', view: 'all', selected: {}, batchMode: false };

  // 示例素材池（接入真实接口后替换）
  var POOL = [
    { platform: 'douyin', track: '美妆', title: '10秒伪素颜底妆教程', hot: 982000,
      reason: { hook: '“化妆前 vs 化妆后只差这一步”直接抛结果', emotion: '素颜焦虑共鸣', twist: '结尾反转推荐平价替代', visual: '高清特写+前后对比分屏', copy: '新手也能学会的底妆公式', bgm: '轻快卡点热门BGM', tag: '#伪素颜 #新手化妆 双话题叠加热度' },
      inspire: { script: '结果前置→分步演示→平价替代反转', shoot: '固定机位特写+分屏对比', copyTpl: '只差__就能__', topic: '平价底妆/学生党妆容' } },
    { platform: 'xhs', track: '美食', title: '5分钟懒人电饭煲蛋糕', hot: 763000,
      reason: { hook: '“不用烤箱也能成功”', emotion: '居家治愈感', twist: '翻车预警变成功', visual: '蒸汽升腾特写', copy: '手残党福音', bgm: '治愈系纯音乐', tag: '#懒人食谱 长尾流量' },
      inspire: { script: '痛点→极简步骤→成品展示', shoot: '俯拍+成品特写', copyTpl: '__分钟搞定__', topic: '宿舍/租房简易美食' } },
    { platform: 'douyin', track: '知识', title: '一个公式看懂复利', hot: 654000,
      reason: { hook: '“为什么你存不下钱”', emotion: '财富焦虑', twist: '用奶茶举例反转', visual: '手写动画', copy: '越早越好', bgm: '悬疑转场音效', tag: '#理财干货 知识普惠' },
      inspire: { script: '生活化类比→公式→行动建议', shoot: '白板手写+字幕', copyTpl: '其实__就是__', topic: '通识理财/认知提升' } },
    { platform: 'xhs', track: '穿搭', title: '小个子显高万能公式', hot: 821000,
      reason: { hook: '“150也能穿出170”', emotion: '身材焦虑治愈', twist: '三套对比', visual: '全身镜自拍九宫格', copy: '照着穿不出错', bgm: '时尚走秀BGM', tag: '#小个子穿搭 精准人群' },
      inspire: { script: '痛点→公式→搭配示范', shoot: '同款单品多角度', copyTpl: '__显高__', topic: '微胖/梨形穿搭' } },
    { platform: 'douyin', track: '剧情', title: '合租室友深夜反转', hot: 1130000,
      reason: { hook: '“你听过一个声音吗”', emotion: '孤独共鸣', twist: '恐怖转温情', visual: '暗调运镜', copy: '结局泪目', bgm: '悬疑→温情', tag: '#深夜情感 情绪向' },
      inspire: { script: '悬念开头→铺垫→温情反转', shoot: '一镜到底+变光', copyTpl: '以为__其实__', topic: '都市情感短剧' } },
    { platform: 'xhs', track: '健身', title: '办公室肩颈放松操', hot: 542000,
      reason: { hook: '“低头族必看”', emotion: '亚健康共鸣', twist: '30秒见效', visual: '真人示范GIF', copy: '跟着做', bgm: '轻节奏', tag: '#打工人养生' },
      inspire: { script: '问题→动作拆解→效果', shoot: '侧面示范+字幕', copyTpl: '__分钟缓解__', topic: '居家理疗/普拉提' } },
    { platform: 'douyin', track: '萌宠', title: '猫主子第一次下楼', hot: 905000,
      reason: { hook: '“它紧张到发抖”', emotion: '萌系治愈', twist: '最后撒娇', visual: '第一视角跟拍', copy: '谁懂啊', bgm: '可爱音效', tag: '#云吸猫 情绪流量' },
      inspire: { script: '反差萌→过程→治愈结尾', shoot: '跟拍+特写', copyTpl: '没想到__', topic: '宠物日常/vlog' } },
    { platform: 'xhs', track: '数码', title: '百元耳机横评', hot: 431000,
      reason: { hook: '“别再交智商税”', emotion: '避坑心理', twist: '黑马胜出', visual: '参数对比表', copy: '闭眼入', bgm: '科技感', tag: '#数码测评' },
      inspire: { script: '结论先行→横评→推荐', shoot: '产品摆拍+表格', copyTpl: '__元买__', topic: '平价好物/学生数码' } }
  ];

  function genSample(count) {
    var items = [];
    var today = S.todayStr();
    for (var i = 0; i < count; i++) {
      var p = POOL[i % POOL.length];
      var hot = p.hot + Math.floor(Math.random() * 40000);
      items.push({
        id: U.uid(), platform: p.platform, track: p.track, title: p.title + (i >= POOL.length ? '（二刷）' : ''),
        url: p.platform === 'douyin' ? 'https://www.douyin.com/' : 'https://www.xiaohongshu.com/',
        hot: hot, date: today, reason: p.reason, inspire: p.inspire,
        starred: false, archived: false, tags: [p.track], source: 'auto', note: '', img: ''
      });
    }
    return items;
  }

  /* ---------- 采集 ---------- */
  function collect(manual) {
    var v = S.getVideos();
    if (manual) {
      // 手动刷新：若当日已采集则追加差异，否则新建
      if (v.dailyCollected.date !== S.todayStr()) v.dailyCollected = { date: S.todayStr(), items: [] };
      var fresh = genSample(8);
      v.dailyCollected.items = fresh.concat(v.dailyCollected.items).slice(0, 40);
    } else {
      // 自动每日采集（5:00）——此处生成示例榜
      v.dailyCollected = { date: S.todayStr(), items: genSample(12) };
    }
    S.saveVideos(v);
    U.toast(manual ? '已刷新榜单（示例）' : '已完成每日采集（示例）');
    render();
  }

  function ensureCollected() {
    var v = S.getVideos();
    if (!v.dailyCollected.items.length && !v.manual.length) collect(false);
  }

  // 接入真实 API 的占位（返回同样结构的数组即可）：
  // async function collectFromAPI(){ const r = await fetch('你的接口'); return r.json(); }

  /* ---------- 数据合并与筛选 ---------- */
  function allItems() {
    var v = S.getVideos();
    return v.dailyCollected.items.concat(v.manual);
  }
  function filtered() {
    var arr = allItems().slice().sort(function (a, b) { return (b.date + b.hot) > (a.date + a.hot) ? 1 : -1; });
    if (state.view === 'favorites') arr = arr.filter(function (x) { return x.starred; });
    if (state.platform !== 'all') arr = arr.filter(function (x) { return x.platform === state.platform; });
    if (state.track !== 'all') arr = arr.filter(function (x) { return x.track === state.track; });
    if (state.starred === 'star') arr = arr.filter(function (x) { return x.starred; });
    if (state.dateFrom) arr = arr.filter(function (x) { return x.date >= state.dateFrom; });
    if (state.dateTo) arr = arr.filter(function (x) { return x.date <= state.dateTo; });
    return arr;
  }

  /* ---------- 渲染 ---------- */
  // 顶部操作条
  var opCard = U.el('div', { class: 'card' });
  opCard.appendChild(U.el('div', { class: 'card-title', html: '爆款素材库 <span class="demo-badge">示例榜单</span>' }));
  var opRow = U.el('div', { class: 'row wrap' });
  opRow.appendChild(U.el('button', { class: 'btn sm', text: '一键刷新榜单', onclick: function () { collect(true); } }));
  opRow.appendChild(U.el('button', { class: 'btn ghost sm', text: '手动新增素材', onclick: openManual }));
  var favBtn = U.el('button', { class: 'btn ghost sm', text: '我的收藏', id: 'vvFav', onclick: function () { state.view = state.view === 'favorites' ? 'all' : 'favorites'; render(); } });
  opRow.appendChild(favBtn);
  opRow.appendChild(U.el('button', { class: 'btn ghost sm', text: '批量模式', id: 'vvBatch', onclick: toggleBatch }));
  opRow.appendChild(U.el('button', { class: 'btn ghost sm', text: '批量归档', id: 'vvArc', style: 'display:none', onclick: batchArchive }));
  opRow.appendChild(U.el('button', { class: 'btn danger sm', text: '批量删除', id: 'vvDel', style: 'display:none', onclick: batchDelete }));
  opRow.appendChild(U.el('button', { class: 'btn ghost sm', text: '导出选中', id: 'vvExp', style: 'display:none', onclick: exportSelected }));
  opCard.appendChild(opRow);
  root.appendChild(opCard);

  // 筛选栏
  var fCard = U.el('div', { class: 'card' });
  var fBar = U.el('div', { class: 'filter-bar' });
  var platSel = U.el('select', { class: 'input', onchange: function () { state.platform = this.value; render(); } },
    [U.el('option', { value: 'all', text: '全部平台' }), U.el('option', { value: 'douyin', text: '抖音' }), U.el('option', { value: 'xhs', text: '小红书' })]);
  var trackSel = U.el('select', { class: 'input', onchange: function () { state.track = this.value; render(); } },
    [U.el('option', { value: 'all', text: '全部赛道' })].concat(TRACKS.map(function (t) { return U.el('option', { value: t, text: t }); })));
  var fromD = U.el('input', { class: 'input', type: 'date', onchange: function () { state.dateFrom = this.value; render(); } });
  var toD = U.el('input', { class: 'input', type: 'date', onchange: function () { state.dateTo = this.value; render(); } });
  fBar.appendChild(platSel); fBar.appendChild(trackSel); fBar.appendChild(fromD); fBar.appendChild(toD);
  fCard.appendChild(U.el('div', { class: 'card-title', text: '筛选检索' }));
  fCard.appendChild(fBar);
  // 赛道快捷标签
  var trackChips = U.el('div', { class: 'filter-bar', id: 'vvTracks' });
  fCard.appendChild(trackChips);
  root.appendChild(fCard);

  var listBox = U.el('div', { id: 'vvList' });
  root.appendChild(listBox);

  function renderTracks() {
    U.clear(trackChips);
    ['all'].concat(TRACKS).forEach(function (t) {
      trackChips.appendChild(U.el('span', { class: 'tag' + (state.track === t ? ' active' : ''), text: t === 'all' ? '全部赛道' : t, onclick: function () { state.track = t; trackSel.value = t; render(); } }));
    });
  }

  function render() {
    favBtn.classList.toggle('active', state.view === 'favorites');
    favBtn.textContent = state.view === 'favorites' ? '全部素材' : '我的收藏';
    renderTracks();
    var arr = filtered();
    U.clear(listBox);
    if (!arr.length) { listBox.appendChild(U.el('div', { class: 'empty', text: '暂无素材，点击「一键刷新榜单」或「手动新增」' })); return; }
    arr.forEach(function (it) { listBox.appendChild(videoCard(it)); });
  }

  function videoCard(it) {
    var card = U.el('div', { class: 'card' });
    var head = U.el('div', { class: 'row' });
    head.appendChild(U.el('span', { class: 'tag', text: it.platform === 'douyin' ? '抖音' : '小红书' }));
    head.appendChild(U.el('span', { class: 'tag', text: it.track }));
    head.appendChild(U.el('span', { class: 'muted', text: '热度 ' + (it.hot / 10000).toFixed(1) + 'w · ' + it.date }));
    head.appendChild(U.el('div', { class: 'spacer' }));
    if (state.batchMode) {
      var sel = U.el('input', { type: 'checkbox', onchange: function () { if (this.checked) state.selected[it.id] = true; else delete state.selected[it.id]; } });
      head.appendChild(sel);
    }
    var star = U.el('span', { class: 'star' + (it.starred ? ' on' : ''), text: it.starred ? '★' : '☆', onclick: function () { toggleStar(it.id); } });
    head.appendChild(star);
    var del = U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { removeItem(it.id); } });
    head.appendChild(del);
    card.appendChild(head);
    card.appendChild(U.el('div', { style: 'font-weight:600;margin:8px 0', text: it.title }));

    // 两张分析卡片
    var grid = U.el('div', { class: 'grid c2' });
    grid.appendChild(analysisCard('爆火核心原因', REASON_KEYS.map(function (k) { return [k[1], it.reason[k[0]]]; })));
    grid.appendChild(analysisCard('可借鉴创作启发', [['脚本结构', it.inspire.script], ['拍摄思路', it.inspire.shoot], ['文案模板', it.inspire.copyTpl], ['选题方向', it.inspire.topic]]));
    card.appendChild(grid);

    // 标签编辑
    var tagWrap = U.el('div', { class: 'row wrap', style: 'margin-top:10px' });
    (it.tags || []).forEach(function (tg) {
      tagWrap.appendChild(U.el('span', { class: 'tag removable', text: tg, onclick: function () { removeTag(it.id, tg); } }));
    });
    var tagInput = U.el('input', { class: 'input', placeholder: '加标签回车', style: 'max-width:140px;flex:0' });
    tagInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && this.value.trim()) { addTag(it.id, this.value.trim()); this.value = ''; } });
    tagWrap.appendChild(tagInput);
    card.appendChild(tagWrap);

    if (it.note) card.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '笔记：' + it.note }));
    if (it.img) { var im = U.el('img', { src: it.img, style: 'max-width:120px;border-radius:8px;margin-top:8px' }); card.appendChild(im); }

    var foot = U.el('div', { class: 'row', style: 'margin-top:10px' });
    foot.appendChild(U.el('button', { class: 'btn ghost sm', text: '查看原视频', onclick: function () { window.open(it.url, '_blank'); } }));
    foot.appendChild(U.el('button', { class: 'btn ghost sm', text: it.archived ? '已归档' : '归档', onclick: function () { toggleArchive(it.id); } }));
    foot.appendChild(U.el('button', { class: 'btn ghost sm', text: '导出文案', onclick: function () { exportOne(it); } }));
    card.appendChild(foot);
    return card;
  }

  function analysisCard(title, pairs) {
    var c = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface-2)' });
    c.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px;margin-bottom:8px', text: title }));
    pairs.forEach(function (p) {
      var row = U.el('div', { style: 'margin-bottom:6px' });
      row.appendChild(U.el('span', { style: 'color:var(--brand);font-weight:600;font-size:13px', text: p[0] + '：' }));
      row.appendChild(U.el('span', { style: 'font-size:13px', text: p[1] }));
      c.appendChild(row);
    });
    return c;
  }

  /* ---------- 操作 ---------- */
  function findItem(id) { var a = allItems(); return a.find(function (x) { return x.id === id; }); }
  function updateItem(id, fn) {
    var v = S.getVideos();
    [v.dailyCollected.items, v.manual].forEach(function (arr) { arr.forEach(function (x) { if (x.id === id) fn(x); }); });
    S.saveVideos(v); render();
  }
  function toggleStar(id) { updateItem(id, function (x) { x.starred = !x.starred; }); U.toast('已更新收藏'); }
  function toggleArchive(id) { updateItem(id, function (x) { x.archived = !x.archived; }); }
  function removeTag(id, tg) { updateItem(id, function (x) { x.tags = (x.tags || []).filter(function (t) { return t !== tg; }); }); }
  function addTag(id, tg) { updateItem(id, function (x) { x.tags = x.tags || []; if (x.tags.indexOf(tg) === -1) x.tags.push(tg); }); }
  function removeItem(id) {
    var v = S.getVideos();
    v.dailyCollected.items = v.dailyCollected.items.filter(function (x) { return x.id !== id; });
    v.manual = v.manual.filter(function (x) { return x.id !== id; });
    S.saveVideos(v); U.toast('已删除'); render();
  }

  function toggleBatch() {
    state.batchMode = !state.batchMode; state.selected = {};
    U.$('#vvArc').style.display = state.batchMode ? '' : 'none';
    U.$('#vvDel').style.display = state.batchMode ? '' : 'none';
    U.$('#vvExp').style.display = state.batchMode ? '' : 'none';
    U.$('#vvBatch').textContent = state.batchMode ? '退出批量' : '批量模式';
    render();
  }
  function batchArchive() {
    var ids = Object.keys(state.selected); if (!ids.length) return U.toast('请先勾选');
    var v = S.getVideos();
    [v.dailyCollected.items, v.manual].forEach(function (arr) { arr.forEach(function (x) { if (ids.indexOf(x.id) > -1) x.archived = true; }); });
    S.saveVideos(v); U.toast('已归档 ' + ids.length + ' 条'); state.batchMode = false; state.selected = {}; toggleBatch();
  }
  function batchDelete() {
    var ids = Object.keys(state.selected); if (!ids.length) return U.toast('请先勾选');
    U.modal({ title: '批量删除', body: '确定删除选中的 ' + ids.length + ' 条素材？', actions: [{ label: '取消' }, { label: '删除', primary: true, onClick: function () {
      var v = S.getVideos();
      v.dailyCollected.items = v.dailyCollected.items.filter(function (x) { return ids.indexOf(x.id) === -1; });
      v.manual = v.manual.filter(function (x) { return ids.indexOf(x.id) === -1; });
      S.saveVideos(v); U.toast('已删除'); state.batchMode = false; state.selected = {}; toggleBatch();
    } }] });
  }
  function exportSelected() {
    var ids = Object.keys(state.selected); if (!ids.length) return U.toast('请先勾选');
    var arr = allItems().filter(function (x) { return ids.indexOf(x.id) > -1; });
    downloadText('爆款拆解_' + S.todayStr() + '.txt', arr.map(itemText).join('\n\n'));
  }
  function exportOne(it) { downloadText('爆款拆解_' + (it.title || '素材') + '.txt', itemText(it)); }
  function itemText(it) {
    var lines = ['【' + (it.platform === 'douyin' ? '抖音' : '小红书') + '】' + it.title + '（' + it.track + ' · 热度' + (it.hot / 10000).toFixed(1) + 'w）'];
    lines.push('— 爆火核心原因 —');
    REASON_KEYS.forEach(function (k) { lines.push(k[1] + '：' + it.reason[k[0]]); });
    lines.push('— 可借鉴创作启发 —');
    lines.push('脚本结构：' + it.inspire.script); lines.push('拍摄思路：' + it.inspire.shoot);
    lines.push('文案模板：' + it.inspire.copyTpl); lines.push('选题方向：' + it.inspire.topic);
    lines.push('原视频：' + it.url);
    return lines.join('\n');
  }
  function downloadText(name, txt) { U.download(name, txt, 'text/plain;charset=utf-8'); }

  function openManual() {
    var body = U.el('div');
    var titleI = U.el('input', { class: 'input', placeholder: '视频标题' });
    var urlI = U.el('input', { class: 'input', placeholder: '外部视频链接（可选）' });
    var platI = U.el('select', { class: 'input' }, [U.el('option', { value: 'douyin', text: '抖音' }), U.el('option', { value: 'xhs', text: '小红书' })]);
    var trackI = U.el('select', { class: 'input' }, TRACKS.map(function (t) { return U.el('option', { value: t, text: t }); }));
    var noteI = U.el('textarea', { class: 'textarea', placeholder: '手动填写拆解笔记（开头钩子/情绪共鸣/反转/画面/文案/BGM/标签…）' });
    var fileI = U.el('input', { class: 'input', type: 'file', accept: 'image/*,video/*' });
    body.appendChild(field('标题', titleI));
    body.appendChild(field('平台', platI));
    body.appendChild(field('赛道', trackI));
    body.appendChild(field('链接', urlI));
    body.appendChild(field('截图/录屏', fileI));
    body.appendChild(field('拆解笔记', noteI));
    U.modal({ title: '手动新增爆款素材', body: body, actions: [{ label: '取消' }, { label: '保存', primary: true, onClick: function () {
      var v = S.getVideos();
      var img = '';
      var f = fileI.files[0];
      if (f) { var rd = new FileReader(); rd.onload = function () { /* 异步，保存时可能为空，改用同步读取 */ }; }
      // 同步读取文件为 DataURL
      if (f) img = ''; // 简化：大文件不内联，记录文件名
      v.manual.unshift({
        id: U.uid(), platform: platI.value, track: trackI.value, title: titleI.value.trim() || '手动素材',
        url: urlI.value.trim() || (platI.value === 'douyin' ? 'https://www.douyin.com/' : 'https://www.xiaohongshu.com/'),
        hot: 0, date: S.todayStr(), source: 'manual',
        reason: { hook: '', emotion: '', twist: '', visual: '', copy: '', bgm: '', tag: '' },
        inspire: { script: '', shoot: '', copyTpl: '', topic: '' },
        starred: false, archived: false, tags: [trackI.value], note: noteI.value.trim(), img: '', fileName: f ? f.name : ''
      });
      S.saveVideos(v); U.toast('已保存手动素材'); render();
    } }] });
  }
  function field(label, node) { var d = U.el('div', { class: 'field' }); d.appendChild(U.el('label', { text: label })); d.appendChild(node); return d; }

  // 暴露给全局提醒调度（每日 5:00 自动采集）
  App._videoAutoCollect = collect;

  ensureCollected();
  render();
};
