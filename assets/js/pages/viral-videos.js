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

  // 二级类目：一级（宠物大类）× 二级（内容形式）
  var CATS = [
    { id: 'cat', name: '🐱 猫咪', tracks: ['猫咪日常', '猫咪剧情', '猫咪科普', '猫咪好物', '猫咪穿搭'] },
    { id: 'dog', name: '🐶 狗狗', tracks: ['狗狗日常', '狗狗剧情', '狗狗科普', '狗狗好物', '狗狗穿搭'] },
    { id: 'exotic', name: '🐉 异宠', tracks: ['异宠日常', '异宠科普', '异宠好物'] },
    { id: 'general', name: '📂 综合', tracks: ['综合日常', '综合剧情', '综合科普', '综合好物', '综合穿搭'] }
  ];
  var TRACKS = CATS.reduce(function (a, c) { return a.concat(c.tracks); }, []);
  var REASON_KEYS = [
    ['hook', '开头钩子'], ['emotion', '情绪共鸣'], ['twist', '剧情反转'],
    ['visual', '视觉画面'], ['copy', '文案话术'], ['bgm', '热门 BGM'], ['tag', '标签流量逻辑']
  ];
  var state = { platform: 'all', catGroup: 'all', track: 'all', starred: 'all', dateFrom: '', dateTo: '', view: 'all', selected: {}, batchMode: false };

  // 示例素材池（接入真实接口后替换）—— 已按二级类目组织，供结构参考
  var POOL = [
    { platform: 'douyin', track: '猫咪日常', title: '猫咪第一次吃冻干的反应', hot: 982000,
      reason: { hook: '“它闻了闻直接愣住”', emotion: '治愈萌系共鸣', twist: '最后疯狂讨要更多', visual: '近距离特写猫咪表情', copy: '谁懂啊这个表情', bgm: '可爱音效', tag: '#猫咪日常 #萌宠日常 情绪流量' },
      inspire: { script: '反差萌→真实反应→治愈结尾', shoot: '近距离抓拍+慢动作', copyTpl: '没想到__', topic: '猫咪反应视频/萌宠日常' } },
    { platform: 'xhs', track: '综合好物', title: '平价猫粮测评红黑榜', hot: 763000,
      reason: { hook: '“别再交智商税”', emotion: '养宠避坑心理', twist: '平价黑马胜出', visual: '产品对比图+成分表', copy: '闭眼入不踩雷', bgm: '科技感', tag: '#综合好物 #宠物好物 精准人群' },
      inspire: { script: '结论先行→横评→推荐', shoot: '产品摆拍+对比表格', copyTpl: '__元买__', topic: '平价猫粮/宠物用品' } },
    { platform: 'douyin', track: '猫咪科普', title: '猫咪为什么半夜跑酷', hot: 654000,
      reason: { hook: '“你家猫也这样？”', emotion: '铲屎官共鸣', twist: '科学原理解释', visual: '手绘动画+实拍', copy: '涨知识了', bgm: '悬疑转场', tag: '#猫咪科普 #宠物科普 知识普惠' },
      inspire: { script: '现象→原理→养猫建议', shoot: '字幕+实拍穿插', copyTpl: '其实__是__', topic: '养猫误区/宠物科普' } },
    { platform: 'xhs', track: '狗狗穿搭', title: '狗狗秋冬穿衣搭配', hot: 821000,
      reason: { hook: '“这样穿太可爱了”', emotion: '治愈种草', twist: '三套风格对比', visual: '全身镜自拍九宫格', copy: '照着穿不出错', bgm: '时尚走秀BGM', tag: '#狗狗穿搭 #萌宠穿搭 精准人群' },
      inspire: { script: '痛点→搭配公式→示范', shoot: '同款单品多角度', copyTpl: '__显可爱__', topic: '小型犬/狗狗穿搭' } },
    { platform: 'douyin', track: '猫咪剧情', title: '捡到流浪猫后它报恩了', hot: 1130000,
      reason: { hook: '“它在门口等了你一夜”', emotion: '孤独温情共鸣', twist: '反转治愈', visual: '暗调运镜+暖光', copy: '结局泪目', bgm: '悬疑→温情', tag: '#猫咪剧情 #宠物剧情 情绪向' },
      inspire: { script: '悬念开头→铺垫→温情反转', shoot: '一镜到底+变光', copyTpl: '以为__其实__', topic: '救助故事/宠物剧情' } },
    { platform: 'xhs', track: '狗狗日常', title: '每天遛狗30分钟打卡', hot: 542000,
      reason: { hook: '“每天30分钟改变”', emotion: '自律共鸣', twist: '狗狗肉眼变帅', visual: '户外跟拍', copy: '跟着打卡', bgm: '轻快节奏', tag: '#狗狗日常 #遛狗 自律打卡' },
      inspire: { script: '问题→动作拆解→效果', shoot: '侧面跟拍+字幕', copyTpl: '__分钟__', topic: '遛狗vlog/养狗日常' } },
    { platform: 'douyin', track: '猫咪日常', title: '布偶猫第一次洗澡现场', hot: 905000,
      reason: { hook: '“第一次洗澡名场面”', emotion: '搞笑萌系', twist: '意外超级配合', visual: '湿身特写+泡泡', copy: '笑死我了', bgm: '搞笑音效', tag: '#猫咪日常 #猫咪 搞笑流量' },
      inspire: { script: '铺垫→冲突→反转配合', shoot: '固定机位全景', copyTpl: '没想到__', topic: '猫咪洗澡/搞笑萌宠' } },
    { platform: 'xhs', track: '异宠日常', title: '仓鼠别墅布置攻略', hot: 431000,
      reason: { hook: '“小窝还能这样改”', emotion: '种草治愈', twist: '平价改造惊艳', visual: '俯拍全景', copy: '手残党也会', bgm: '治愈系纯音乐', tag: '#异宠日常 #异宠 小众圈层' },
      inspire: { script: '痛点→改造步骤→成品', shoot: '延时摄影+字幕', copyTpl: '__元搞定__', topic: '仓鼠/异宠布置' } }
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
      // 自动每日采集（5:00）——生成参考模板榜
      v.dailyCollected = { date: S.todayStr(), items: genSample(12) };
    }
    S.saveVideos(v);
    if (manual) U.toast('已刷新（参考模板）');
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
  // 实时热榜（真实联网）
  var liveType = 'douyin';
  var liveCard = U.el('div', { class: 'card' });
  liveCard.appendChild(U.el('div', { class: 'card-title', html: '实时热榜选题 <span class="src-tag" id="vvLiveSrc"></span>' }));
  liveCard.appendChild(U.el('div', { class: 'muted', text: '真实联网抓取抖音/微博热榜，选题灵感直接来自当下热点（非平台原视频，仅供方向参考）。' }));
  var liveTabs = U.el('div', { class: 'filter-bar', id: 'vvLiveTabs' });
  [['douyin', '抖音热榜'], ['weibo', '微博热搜']].forEach(function (t) {
    liveTabs.appendChild(U.el('span', { class: 'tag' + (liveType === t[0] ? ' active' : ''), text: t[1], onclick: function () { liveType = t[0]; U.$all('#vvLiveTabs .tag').forEach(function (x) { x.classList.toggle('active', x.textContent === t[1]); }); loadLive(); } }));
  });
  liveCard.appendChild(liveTabs);
  liveCard.appendChild(U.el('button', { class: 'btn sm', style: 'margin:10px 0', text: '🔄 刷新实时热榜', onclick: loadLive }));
  var liveBox = U.el('div', { id: 'vvLiveBox' });
  liveCard.appendChild(liveBox);
  root.appendChild(liveCard);

  /* ===================== 视频智能解析（猫咪账号专属） ===================== */
  var analyzerCard = U.el('div', { class: 'card' });
  analyzerCard.appendChild(U.el('div', { class: 'card-title', html: '🎬 视频智能解析 <span class="src-tag">猫咪账号专属 · 发链接一键解析</span>' }));
  analyzerCard.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '粘贴抖音/小红书视频链接，点「一键解析」自动提取标题与文案，并为你（猫咪账号）重新生成可拍脚本。若平台限制自动抓取，会提示你手动补充、或把链接发我（在对话里）帮你深度解析。' }));
  var aRow = U.el('div', { class: 'row wrap' });
  var aLink = U.el('input', { class: 'input', placeholder: '粘贴视频链接（抖音/小红书）', style: 'flex:1;min-width:220px' });
  aRow.appendChild(aLink);
  analyzerCard.appendChild(aRow);
  // 手动补充（默认隐藏，自动抓取失败或用户主动展开时显示）
  var aManual = U.el('div', { style: 'display:none;margin-top:8px' });
  var aTitle = U.el('input', { class: 'input', placeholder: '视频标题（自动获取失败时可手动填）', style: 'width:100%;margin-bottom:6px' });
  var aDesc = U.el('textarea', { class: 'textarea', placeholder: '口播文案 / 视频描述（自动获取失败时可手动粘贴你看到的台词/字幕）', style: 'width:100%' });
  aManual.appendChild(aTitle); aManual.appendChild(aDesc);
  analyzerCard.appendChild(aManual);
  var aRow2 = U.el('div', { class: 'row', style: 'margin-top:8px' });
  aRow2.appendChild(U.el('button', { class: 'btn', id: 'vvParseBtn', text: '🔍 一键解析', onclick: runAnalyze }));
  aRow2.appendChild(U.el('button', { class: 'btn ghost', text: '手动补充', onclick: function () { aManual.style.display = 'block'; aTitle.focus(); } }));
  aRow2.appendChild(U.el('button', { class: 'btn ghost', text: '打开原视频', onclick: function () { if (aLink.value.trim()) window.open(aLink.value.trim(), '_blank'); else U.toast('请先填写视频链接'); } }));
  aRow2.appendChild(U.el('button', { class: 'btn', style: 'background:linear-gradient(135deg,#5b8def,#8a5bef);color:#fff;border:none', text: '🫧 豆包解析提示词', onclick: prepareDoubaoPrompt }));
  analyzerCard.appendChild(aRow2);
  var aStatus = U.el('div', { class: 'muted', id: 'vvParseStatus', style: 'margin-top:6px' });
  analyzerCard.appendChild(aStatus);
  var aResult = U.el('div', { id: 'vvAnalyzeResult' });
  analyzerCard.appendChild(aResult);
  var aDoubao = U.el('div', { id: 'vvDoubaoBox' });
  analyzerCard.appendChild(aDoubao);
  root.appendChild(analyzerCard);

  function runAnalyze() {
    var link = aLink.value.trim();
    var title = aTitle.value.trim();
    var desc = aDesc.value.trim();
    if (!link && !title) { U.toast('请粘贴视频链接，或展开「手动补充」填标题'); aLink.focus(); return; }
    U.$('#vvParseStatus').textContent = '解析中…';
    U.$('#vvParseBtn').disabled = true;
    if (link) {
      fetchVideoMeta(link).then(function (meta) {
        if (meta && meta.ok) {
          if (!title) { title = meta.title || ''; aTitle.value = title; }
          if (!desc) { desc = meta.desc || ''; aDesc.value = desc; }
          U.$('#vvParseStatus').textContent = '✅ 已自动提取标题/文案';
          finishAnalyze(link, title, desc);
        } else {
          U.$('#vvParseStatus').innerHTML = '⚠️ 平台限制自动抓取（' + ((meta && meta.reason) || '未知') + '）。请展开「手动补充」粘贴标题/口播，或把链接发我（在对话里）帮你深度解析。';
          aManual.style.display = 'block';
          if (!title) aTitle.focus(); else finishAnalyze(link, title, desc);
        }
      }).catch(function () {
        U.$('#vvParseStatus').textContent = '⚠️ 解析异常，请手动补充或把链接发我（对话里）';
        aManual.style.display = 'block';
      });
    } else {
      finishAnalyze(link, title, desc);
    }
  }
  function fetchVideoMeta(link) {
    var base = (window.APP_CONFIG && window.APP_CONFIG.FETCH_VIDEO_API) || '/api/fetch-video';
    return fetch(base + '?url=' + encodeURIComponent(link), { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, reason: '网络/接口不可用' }; });
  }
  function finishAnalyze(link, title, desc) {
    U.$('#vvParseBtn').disabled = false;
    if (!title) { U.toast('请填写视频标题'); aTitle.focus(); return; }
    renderAnalysis(parseVideo({ link: link, title: title, desc: desc }), { link: link, title: title, desc: desc });
    renderDoubaoPrompt(link, title, desc);
  }

  function loadLive() {
    U.$('#vvLiveSrc').innerHTML = '<span class="live-dot wait"></span> 抓取中…';
    U.clear(liveBox); liveBox.appendChild(U.el('div', { class: 'muted', text: '联网抓取中…' }));
    U.fetchTrending(liveType, 9000).then(function (res) {
      if (!res.ok || !res.items.length) {
        U.$('#vvLiveSrc').innerHTML = '<span class="live-dot off"></span> 暂未获取';
        U.clear(liveBox);
        liveBox.appendChild(U.el('div', { class: 'empty', text: '实时热榜获取失败。若部署在 github.io 受跨域限制，建议部署到 Cloudflare Pages 启用服务端联网；或稍后刷新。' }));
        return;
      }
      U.$('#vvLiveSrc').innerHTML = '<span class="live-dot on"></span> 实时 · ' + res.items.length + ' 条';
      U.clear(liveBox);
      res.items.slice(0, 30).forEach(function (x) {
        var row = U.el('div', { class: 'quote-row' });
        row.appendChild(U.el('div', {}, [U.el('div', { text: x.title }), U.el('div', { class: 'muted', text: '热度 ' + (x.hot ? (x.hot / 10000).toFixed(1) + 'w' : '—') })]));
        var right = U.el('div', { style: 'display:flex;gap:6px' });
        if (x.url) right.appendChild(U.el('button', { class: 'btn ghost xs', text: '看原帖', onclick: function () { window.open(x.url, '_blank'); } }));
        right.appendChild(U.el('button', { class: 'btn ghost xs', text: '记灵感', onclick: function () { saveInspiration(x.title); } }));
        row.appendChild(right);
        liveBox.appendChild(row);
      });
    });
  }
  function saveInspiration(text) {
    var arr = S.getInspirations() || [];
    arr.unshift({ id: U.uid(), date: S.todayStr(), time: U.fmtTime(), content: text, tags: ['实时热榜'], pinned: false, starred: false, attachments: [] });
    S.saveInspirations(arr); U.toast('已记入灵感');
  }

  // 顶部操作条
  var opCard = U.el('div', { class: 'card' });
  opCard.appendChild(U.el('div', { class: 'card-title', html: '爆款素材库 <span class="demo-badge">参考模板</span>' }));
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
  var fromD = U.el('input', { class: 'input', type: 'date', onchange: function () { state.dateFrom = this.value; render(); } });
  var toD = U.el('input', { class: 'input', type: 'date', onchange: function () { state.dateTo = this.value; render(); } });
  fBar.appendChild(platSel); fBar.appendChild(fromD); fBar.appendChild(toD);
  fCard.appendChild(U.el('div', { class: 'card-title', text: '筛选检索' }));
  fCard.appendChild(fBar);
  // 一级类目（宠物大类）—— 点击切换下方二级标签
  var catGroupBar = U.el('div', { class: 'filter-bar', id: 'vvCatGroups', style: 'margin-top:10px' });
  fCard.appendChild(catGroupBar);
  // 二级类目（内容形式，受一级控制）
  var trackChips = U.el('div', { class: 'filter-bar', id: 'vvTracks', style: 'margin-top:8px' });
  fCard.appendChild(trackChips);
  root.appendChild(fCard);

  var listBox = U.el('div', { id: 'vvList' });
  root.appendChild(listBox);

  function renderTracks() {
    // 一级类目 tab
    U.clear(catGroupBar);
    var groups = [{ id: 'all', name: '全部' }, { id: 'cat', name: '🐱 猫咪' }, { id: 'dog', name: '🐶 狗狗' }, { id: 'exotic', name: '🐉 异宠' }, { id: 'general', name: '📂 综合' }];
    groups.forEach(function (g) {
      catGroupBar.appendChild(U.el('span', { class: 'tag' + (state.catGroup === g.id ? ' active' : ''), text: g.name, onclick: function () { state.catGroup = g.id; state.track = 'all'; render(); } }));
    });
    // 二级类目标签（受一级控制）
    U.clear(trackChips);
    var subs = state.catGroup === 'all' ? TRACKS : CATS.filter(function (c) { return c.id === state.catGroup; })[0].tracks;
    subs.forEach(function (t) {
      trackChips.appendChild(U.el('span', { class: 'tag sub' + (state.track === t ? ' active' : ''), text: t, onclick: function () { state.track = t; render(); } }));
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
    var catGroupI = U.el('select', { class: 'input' }, CATS.map(function (c) { return U.el('option', { value: c.id, text: c.name }); }));
    var trackI = U.el('select', { class: 'input' });
    function fillTrackI(cg) { U.clear(trackI); CATS.filter(function (c) { return c.id === cg; })[0].tracks.forEach(function (t) { trackI.appendChild(U.el('option', { value: t, text: t })); }); }
    fillTrackI('cat');
    catGroupI.onchange = function () { fillTrackI(this.value); };
    var noteI = U.el('textarea', { class: 'textarea', placeholder: '手动填写拆解笔记（开头钩子/情绪共鸣/反转/画面/文案/BGM/标签…）' });
    var fileI = U.el('input', { class: 'input', type: 'file', accept: 'image/*,video/*' });
    body.appendChild(field('标题', titleI));
    body.appendChild(field('平台', platI));
    body.appendChild(field('大类', catGroupI));
    body.appendChild(field('赛道（二级）', trackI));
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

  /* ===================== 视频解析引擎（前端规则 + 模板，宠物向） ===================== */
  function parseVideo(input) {
    var title = input.title || '';
    var raw = (input.title + ' ' + (input.desc || '')).toLowerCase();
    var desc = input.desc || '';

    // 1. 原视频分类识别（一级宠物类型 × 二级内容形式 → 二级类目）
    var petRules = [
      { keys: ['猫', '喵', '布偶', '橘', '英短', '加菲', '狸花', '蓝猫', '缅因', '奶牛猫'], p: 'cat' },
      { keys: ['狗', '汪', '金毛', '柯基', '柴犬', '边牧', '遛狗', '萨摩', '泰迪', '比熊'], p: 'dog' },
      { keys: ['仓鼠', '异宠', '爬宠', '龟', '兔', '鸟', '水族', '鱼', '蜥蜴'], p: 'exotic' }
    ];
    var formRules = [
      { keys: ['剧情', '反转', '报恩', '故事', '情感', '泪目', '感动', '救助'], f: '剧情' },
      { keys: ['科普', '为什么', '为何', '原理', '知识', '误区', '涨知识', '怎么', '如何'], f: '科普' },
      { keys: ['穿搭', '衣服', '秋冬', '春夏', '搭配', '穿衣'], f: '穿搭' },
      { keys: ['测评', '红黑榜', '好物', '种草', '平价', '推荐', '必买', '红榜', '黑榜', '避坑', '实测'], f: '好物' }
    ];
    var pet = 'general';
    for (var i = 0; i < petRules.length; i++) { if (petRules[i].keys.some(function (k) { return raw.indexOf(k) > -1; })) { pet = petRules[i].p; break; } }
    var form = '日常';
    for (var fI = 0; fI < formRules.length; fI++) { if (formRules[fI].keys.some(function (k) { return raw.indexOf(k) > -1; })) { form = formRules[fI].f; break; } }
    var PET_NAME = { cat: '猫咪', dog: '狗狗', exotic: '异宠', general: '综合' };
    var track = PET_NAME[pet] + form;

    // 2. 原视频开头钩子识别
    var hookRules = [
      { re: /第一次|首次|头一回/, h: '"第一次…名场面"反差钩子' },
      { re: /谁懂|懂的|破防/, h: '"谁懂啊"情绪共鸣钩子' },
      { re: /别再|智商税|坑|避雷|别交/, h: '"别再交智商税"避坑钩子' },
      { re: /为什么|为何|原来|其实|真相/, h: '"原来如此"好奇钩子' },
      { re: /万万没想到|竟然|居然|没想到|绝了/, h: '"万万没想到"反转钩子' },
      { re: /(\d+)\s*(个|招|种|天|分钟|秒)/, h: '"数字清单"实用钩子' },
      { re: /以为.*其实|本以为/, h: '"以为…其实"反差钩子' }
    ];
    var hook = '开篇直给强冲击钩子';
    for (var h = 0; h < hookRules.length; h++) { if (hookRules[h].re.test(raw)) { hook = hookRules[h].h; break; } }

    // 3. 原视频情绪识别
    var emoRules = [
      { keys: ['治愈', '解压', '放松', '舒服'], e: '治愈解压' },
      { keys: ['笑死', '搞笑', '名场面', '翻车', '沙雕'], e: '搞笑娱乐' },
      { keys: ['泪目', '温情', '感动', '报恩', '孤独', '心疼'], e: '温情共鸣' },
      { keys: ['种草', '闭眼入', '必买', '推荐', '红榜'], e: '种草带货' },
      { keys: ['涨知识', '科普', '原理', '避坑', '干货'], e: '知识干货' },
      { keys: ['自律', '打卡', '改变', '成长'], e: '自律陪伴' }
    ];
    var emotion = '治愈陪伴';
    for (var e = 0; e < emoRules.length; e++) { if (emoRules[e].keys.some(function (k) { return raw.indexOf(k) > -1; })) { emotion = emoRules[e].e; break; } }

    // 4. 反转 / 视觉 / 文案 / BGM / 标签（按内容形式驱动）
    var twist = (raw.indexOf('反转') > -1) ? '结尾神反转' : (emotion === '温情共鸣' ? '铺垫→温情反转' : '自然递进收尾');
    var visual = form === '穿搭' ? '全身镜多角度+同款特写' : form === '好物' ? '产品摆拍+成分对比' : form === '科普' ? '实拍+字幕讲解' : form === '剧情' ? '固定机位+运镜跟随' : '近距离特写+慢动作抓拍';
    var bgm = emotion === '搞笑娱乐' ? '搞笑音效/卡点BGM' : emotion === '治愈解压' ? '治愈系纯音乐' : emotion === '种草带货' ? '科技感/轻快' : '悬疑转场→温情';
    var tag = '#' + track + ' #萌宠日常 #宠物' + (emotion === '种草带货' ? ' #宠物好物' : '');

    // 5. 原视频分镜框架（按内容形式）
    var frameworkMap = {
      '剧情': [{ t: '0-3s', c: '悬念开头：它（等待/守护）的画面' }, { t: '3-15s', c: '铺垫：起因（捡到/生病/走丢）' }, { t: '15-40s', c: '过程：照顾/陪伴真实记录' }, { t: '40-55s', c: '反转：温情爆点（报恩/康复/认家）' }, { t: '55-60s', c: '结尾：升华+引导关注' }],
      '科普': [{ t: '0-3s', c: '痛点钩子：你家猫也__？' }, { t: '3-20s', c: '原理：字幕+实拍讲清楚' }, { t: '20-45s', c: '举例：具体表现与应对' }, { t: '45-60s', c: '养宠建议+收藏引导' }],
      '好物': [{ t: '0-3s', c: '结论先行：别再交智商税' }, { t: '3-20s', c: '横评：红榜/黑榜对比' }, { t: '20-45s', c: '推荐：平价黑马实测' }, { t: '45-60s', c: '购买建议+链接' }],
      '穿搭': [{ t: '0-3s', c: '痛点：这样穿太可爱' }, { t: '3-20s', c: '搭配公式：3套风格' }, { t: '20-45s', c: '同款示范：多角度展示' }, { t: '45-60s', c: '清单+购买' }],
      '日常': [{ t: '0-3s', c: '反差钩子：__反应名场面' }, { t: '3-40s', c: '真实记录：抓拍自然反应' }, { t: '40-60s', c: '治愈/搞笑收尾' }]
    };
    var framework = frameworkMap[form] || frameworkMap['日常'];

    // ===== 给你的猫咪账号：选题 + 重新生成脚本（猫咪专属）=====
    var catTopicMap = {
      '剧情': '猫咪报恩/守护/走丢被找回的温情剧情——用你自家猫的真实瞬间拍',
      '科普': '猫咪冷知识/养猫误区（如：猫为什么半夜跑酷、为什么踩奶）',
      '好物': '平价猫粮/猫砂/猫玩具红黑榜实测（出镜主角换成你家猫）',
      '穿搭': '猫咪秋冬毛衣/项圈穿搭（注意猫咪接受度，别强制）',
      '日常': '猫咪一天 vlog（清晨醒神 / 午后晒太阳 / 夜晚跑酷）'
    };
    var catTopic = catTopicMap[form] || catTopicMap['日常'];

    var catFramework = [
      { t: '0-3s', c: '钩子：镜头怼猫咪脸，抓它最魔性的表情/动作特写' },
      { t: '3-15s', c: '铺垫：交代情境（新玩具 / 新食物 / 新家 / 新成员）' },
      { t: '15-40s', c: '主体：真实记录你家猫的反应，抓拍不强迫、不摆拍' },
      { t: '40-55s', c: '高潮：最萌 / 最搞笑 / 最温情的瞬间' },
      { t: '55-60s', c: '结尾：互动引导「喜欢小猫咪点个赞关注我～」' }
    ];

    // ③ 重新生成脚本（猫咪账号 · 口播稿）
    var script = '【开场 0-3s】反差钩子：镜头直接怼猫咪脸，抓它最魔性的表情/动作，配一句"没想到我家猫居然__"。\n'
      + '【正文 3-40s】围绕「' + emotion + '」情绪线展开：真实记录你家猫的__反应，用' + visual + '的拍法把情绪拉满；不摆拍、不强迫，等它自然流露最打动人。\n'
      + '【结尾 40-60s】' + twist + '，口播收尾："喜欢这只小猫咪，记得点赞关注我呀～"';

    // 猫咪向标题备选
    var titles = [
      '我家猫第一次__的反应，笑不活了🐱',
      '养猫人才懂的__瞬间｜治愈日常',
      '没想到猫咪还能这样__｜建议收藏',
      hook.replace(/"/g, '') + '，猫咪版也太萌了'
    ];

    // ④ 可借鉴的「我能做的视频文案」+ 拍摄清单（猫咪专属）
    var body = (form === '好物' ? '先说坑再上你家猫在用的平价好物，边用边讲' : form === '剧情' ? '从铺垫到温情反转，用你家猫的真实瞬间' : form === '科普' ? '现象→原理→建议，字幕辅助' : form === '穿搭' ? '搭配公式+同款多角度' : '真实记录你家猫的__反应，抓最自然的瞬间');
    var actionable = '🐱 你的猫咪账号可直接拍的同款脚本：\n\n'
      + '【0-3s 黄金开头】' + hook.replace(/"/g, '') + '——画面直接放猫咪最萌的表情/动作特写，前3秒不留废话。\n'
      + '【3-40s 内容主体】用「' + emotion + '」情绪串起来：' + body + '。\n'
      + '【40-60s 结尾】' + twist + '，加口播"喜欢小猫咪记得点赞关注～"\n\n'
      + '【拍摄清单】' + visual + '；BGM 用' + bgm + '；发布带 ' + '#猫咪 #萌宠日常 #' + emotion + '。\n'
      + '【核心提醒】真实 > 摆拍，用你自家猫做主角，复制爆款的"结构"而非"内容"。';

    return {
      track: track, hook: hook, emotion: emotion, twist: twist, visual: visual, bgm: bgm, tag: tag,
      framework: framework, catTopic: catTopic, catFramework: catFramework,
      script: script, titles: titles, actionable: actionable
    };
  }

  function kvBlock(title, pairs) {
    var c = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface)' });
    c.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px;margin-bottom:8px', text: title }));
    pairs.forEach(function (pr) {
      var r = U.el('div', { style: 'margin-bottom:6px' });
      r.appendChild(U.el('span', { style: 'color:var(--brand);font-weight:600;font-size:13px', text: pr[0] + '：' }));
      r.appendChild(U.el('span', { style: 'font-size:13px', text: pr[1] }));
      c.appendChild(r);
    });
    return c;
  }
  function txtBlock(title, txt) {
    var c = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface)' });
    c.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px;margin-bottom:8px', text: title }));
    c.appendChild(U.el('div', { style: 'font-size:13px;white-space:pre-wrap;line-height:1.6', text: txt }));
    return c;
  }

  function renderAnalysis(p, input) {
    U.clear(aResult);
    var card = U.el('div', { class: 'card', style: 'margin-top:12px;background:var(--surface-2)' });
    card.appendChild(U.el('div', { class: 'card-title', html: '🔍 解析结果 · <span class="tag">猫咪账号专属</span> <span class="tag">' + p.emotion + '</span>' }));

    // ① 标题 / 口播文案（原视频）
    card.appendChild(kvBlock('① 标题 / 口播文案（原视频）', [
      ['标题', input.title || '—'],
      ['口播文案（来源）', input.desc || '（未自动获取，可展开「手动补充」粘贴你看到的台词/字幕）']
    ]));

    // ② 选题（给你的猫咪账号）
    card.appendChild(kvBlock('② 选题 · 给你的猫咪账号', [
      ['可拍选题', p.catTopic],
      ['原视频参考', '赛道：' + p.track + ' ｜ 情绪：' + p.emotion]
    ]));

    // ③ 重新生成脚本（猫咪账号 · 口播稿）
    card.appendChild(txtBlock('③ 重新生成脚本（猫咪账号专属 · 口播稿）', p.script));
    var fw = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface)' });
    fw.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px;margin-bottom:8px', text: '分镜框架（猫咪账号）' }));
    p.catFramework.forEach(function (s) {
      fw.appendChild(U.el('div', { style: 'margin-bottom:6px' }, [
        U.el('span', { style: 'color:var(--brand);font-weight:600;font-size:13px', text: s.t + '：' }),
        U.el('span', { style: 'font-size:13px', text: s.c })
      ]));
    });
    card.appendChild(fw);

    // ④ 可借鉴文案 + 拍摄清单
    var ac = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface)' });
    ac.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px;margin-bottom:8px', text: '④ 可借鉴文案 + 拍摄清单' }));
    ac.appendChild(U.el('div', { style: 'font-size:13px;white-space:pre-wrap;line-height:1.6', text: p.actionable }));
    ac.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: '📋 复制可借鉴文案', onclick: function () { copyText(p.actionable); U.toast('已复制到剪贴板'); } }));
    card.appendChild(ac);

    // 原视频爆火拆解（参考，放后面）
    card.appendChild(kvBlock('原视频爆火拆解（参考）', [['开头钩子', p.hook], ['反转设计', p.twist], ['视觉画面', p.visual], ['BGM', p.bgm], ['话题标签', p.tag]]));

    // 猫咪向标题备选
    var tt = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface)' });
    tt.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px;margin-bottom:8px', text: '猫咪向标题备选' }));
    p.titles.forEach(function (t) { tt.appendChild(U.el('div', { style: 'font-size:13px;margin-bottom:4px', text: '· ' + t })); });
    card.appendChild(tt);

    card.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:10px', text: '💾 保存为爆款素材', onclick: function () { saveParsedAsMaterial(p, input); } }));
    aResult.appendChild(card);
  }

  function saveParsedAsMaterial(p, input) {
    var v = S.getVideos();
    var platform = /xiaohongshu|xhs/i.test(input.link) ? 'xhs' : 'douyin';
    v.manual.unshift({
      id: U.uid(), platform: platform, track: p.track, title: input.title || '解析素材',
      url: input.link || (platform === 'douyin' ? 'https://www.douyin.com/' : 'https://www.xiaohongshu.com/'),
      hot: 0, date: S.todayStr(), source: 'parsed',
      reason: { hook: p.hook, emotion: p.emotion, twist: p.twist, visual: p.visual, copy: p.copy, bgm: p.bgm, tag: p.tag },
      inspire: { script: p.script, shoot: p.visual, copyTpl: p.titles[1] || '', topic: p.track },
      starred: false, archived: false, tags: [p.track], note: p.actionable, img: '', fileName: ''
    });
    S.saveVideos(v); U.toast('已保存为素材，可在下方素材库查看/收藏'); render();
  }

  /* ===================== 发给豆包深度解析（不接 API，复制提示词去豆包 App） ===================== */
  function prepareDoubaoPrompt() {
    var link = aLink.value.trim();
    var title = aTitle.value.trim();
    var desc = aDesc.value.trim();
    if (!link && !title) { U.toast('请先粘贴链接，或展开「手动补充」填标题'); aLink.focus(); return; }
    if (link && !title) {
      U.$('#vvParseStatus').textContent = '正在提取标题用于生成提示词…';
      fetchVideoMeta(link).then(function (meta) {
        if (meta && meta.ok && meta.title) { title = meta.title; aTitle.value = title; desc = desc || (meta.desc || ''); aDesc.value = desc; }
        renderDoubaoPrompt(link, title, desc);
      }).catch(function () { renderDoubaoPrompt(link, title, desc); });
    } else {
      renderDoubaoPrompt(link, title, desc);
    }
  }
  function renderDoubaoPrompt(link, title, desc) {
    U.clear(aDoubao);
    var prompt = buildDoubaoPrompt(link, title, desc);
    var card = U.el('div', { class: 'card', style: 'margin-top:12px;background:var(--surface-2)' });
    card.appendChild(U.el('div', { class: 'card-title', html: '🫧 发给豆包深度解析 <span class="src-tag">复制后去豆包 App 粘贴 + 发视频</span>' }));
    card.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:8px', text: '豆包是字节的多模态模型，能真正「看懂」视频画面。复制下面提示词 → 打开豆包 App → 把视频（或链接）发给它 → 再粘贴这段提示词，它会按结构输出深度拆解。注：豆包视频理解暂不支持音频，若它无法还原口播，请把你听到的台词粘进「我已知的文案」里再发。' }));
    var ta = U.el('textarea', { class: 'textarea', readonly: true, style: 'width:100%;min-height:200px;font-size:12px;line-height:1.55' });
    ta.value = prompt;
    card.appendChild(ta);
    var row = U.el('div', { class: 'row', style: 'margin-top:8px' });
    row.appendChild(U.el('button', { class: 'btn sm', text: '📋 复制提示词', onclick: function () { copyText(prompt); U.toast('已复制，去豆包粘贴'); } }));
    row.appendChild(U.el('button', { class: 'btn ghost sm', text: '📖 使用说明', onclick: showDoubaoGuide }));
    card.appendChild(row);
    aDoubao.appendChild(card);
  }
  function buildDoubaoPrompt(link, title, desc) {
    return [
      '你是一个短视频爆款拆解专家。我发给你一个宠物（抖音/小红书）视频，请帮我深度解析，并严格按下面结构用中文输出：',
      '',
      '【原视频信息】',
      '标题：' + (title || '（请豆包看视频后补全）'),
      '链接：' + (link || '（无）'),
      '我已知的文案/字幕：' + (desc || '（无，请豆包看视频尽量还原）'),
      '',
      '【请按以下结构输出】',
      '1. 标题 / 口播文案：尽量逐字还原视频的标题与口播台词。',
      '2. 选题拆解：这条为什么火？受众是谁？情绪钩子 / 痛点在哪里？',
      '3. 分镜框架：按时间线（0-3s / 3-15s / 15-40s / 40-60s）拆解画面内容、运镜、景别、转场。',
      '4. 拍摄手法：机位、光线、剪辑节奏、BGM、字幕 / 花字风格。',
      '5. 可借鉴点：我能复制的「结构」而不是「内容」——哪些手法可迁移。',
      '',
      '【重要背景 · 我是做猫咪宠物账号的】',
      '请在上面解析之后，额外输出一版【猫咪账号专属】方案：',
      '- 可拍选题：把主角换成我家猫，保留爆款结构（不要照搬原内容）。',
      '- 重新生成的口播稿：猫咪视角、口语化、带分镜时间线（0-3s / 3-40s / 40-60s）。',
      '- 拍摄清单：机位建议、BGM 类型、发布标签（#猫咪 #萌宠日常 等）。',
      '',
      '直接输出，不要寒暄。'
    ].join('\n');
  }
  function showDoubaoGuide() {
    U.modal({
      title: '用豆包深度解析视频',
      body: U.el('div', { class: 'muted', html:
        '1. 在 App 里点「🫧 豆包解析提示词」，复制生成的提示词。<br>' +
        '2. 打开<strong>豆包 App</strong>（抖音同款字节出品，能看视频）。<br>' +
        '3. 把你要拆解的视频（或抖音/小红书链接）发给豆包。<br>' +
        '4. 把复制的提示词粘贴进去发送。<br>' +
        '5. 豆包会按结构输出：标题/口播 → 选题拆解 → 分镜 → 拍摄手法 → 可借鉴点，并额外给你一版<strong>猫咪账号专属</strong>的选题/口播稿/拍摄清单。<br><br>' +
        '⚠️ 豆包视频理解暂不支持音频，若它没还原出口播台词，你把自己听到的台词粘进提示词「我已知的文案」再发一次即可。<br><br>' +
        '拿回结果后，回到我们 App 的「一键解析」里手动补充标题/口播，就能把爆款存进素材库。'
      }),
      actions: [{ label: '知道了', primary: true }]
    });
  }

  function copyText(txt) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt); return; } } catch (e) {}
    var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  ensureCollected();
  render();
  loadLive();
};
