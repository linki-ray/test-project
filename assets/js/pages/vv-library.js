/* ============================================================
   爆款素材库（重构为 5 个 Tab）
   - 爆款雷达：今日爆款雷达 + 实时联网热榜（选题方向）
   - 素材：我的爆款素材（一键刷新 / 手动新增 / 收藏 / 批量 / 导出 / 分类拍摄指南）
   - 选题：今日热点选题 + 赛道选题库
   - 数据：素材统计看板 + 赛道分布 + 实时热榜抓取
   - 我的：收藏 / 归档
   复用 viral-videos.js 中的全局函数（collect / filtered / videoCard /
   renderTracks / openManual / export* / loadLive / POOL / CATS 等）。
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};
  var VV_LIB_TAB = 'radar'; // 跨重绘保持当前 Tab：radar / materials / topics / data / mine
  var MAT_STATE = null;     // 素材 Tab 筛选/视图/批量状态持久化（避免 App.renderCurrent 后重置）
(function () {
  var U = App.U;

  function getDaily() { return window.__DAILY__ || null; }

  /* ---------- 分类拍摄指南（复用全局 POOL / CATS） ---------- */
  function renderGuide(state, box) {
    U.clear(box);
    var tracks;
    if (state.track !== 'all') tracks = [state.track];
    else if (state.catGroup !== 'all') { var g = CATS.filter(function (c) { return c.id === state.catGroup; })[0]; tracks = g ? g.tracks : []; }
    else tracks = null;
    if (!tracks) {
      box.appendChild(U.el('div', { class: 'card', style: 'margin-top:14px' }, [
        U.el('div', { class: 'card-title', text: '📸 分类拍摄指南' }),
        U.el('div', { class: 'muted', text: '点击上方「宠物大类」或「二级类目」标签，这里会给出该类的景别 / 运镜 / 文案 / BGM / 标签 拍摄要点。' })
      ]));
      return;
    }
    var items = POOL.filter(function (p) { return tracks.indexOf(p.track) > -1; });
    if (!items.length) { U.clear(box); return; }
    function uniq(arr) { var s = {}, out = []; arr.forEach(function (x) { if (x && !s[x]) { s[x] = 1; out.push(x); } }); return out; }
    var visual = uniq(items.map(function (p) { return p.reason.visual; }));
    var shoot = uniq(items.map(function (p) { return p.inspire.shoot; }));
    var copy = uniq(items.map(function (p) { return p.reason.copy; }));
    var bgm = uniq(items.map(function (p) { return p.reason.bgm; }));
    var tag = uniq(items.map(function (p) { return p.reason.tag; }));
    var topic = uniq(items.map(function (p) { return p.inspire.topic; }));
    var title = state.track !== 'all' ? state.track : (CATS.filter(function (c) { return c.id === state.catGroup; })[0].name);
    var card = U.el('div', { class: 'card', style: 'margin-top:14px' });
    card.appendChild(U.el('div', { class: 'card-title', text: '📸 ' + title + ' · 分类拍摄指南' }));
    var rows = [
      ['🎥 景别 / 运镜', visual.concat(shoot)],
      ['✍ 文案话术', copy],
      ['🎵 热门 BGM', bgm],
      ['🏷 流量标签', tag],
      ['💡 选题方向', topic]
    ];
    rows.forEach(function (rw) {
      if (!rw[1].length) return;
      card.appendChild(U.el('div', { class: 'card-sub', style: 'margin:8px 0 4px', text: rw[0] }));
      card.appendChild(U.el('div', { style: 'font-size:13px;line-height:1.6', text: rw[1].join(' / ') }));
    });
    box.appendChild(card);
  }

  function liveTabsBar(idPrefix) {
    var bar = U.el('div', { class: 'filter-bar', id: idPrefix + 'Tabs' });
    [['douyin', '抖音热榜'], ['weibo', '微博热搜']].forEach(function (t) {
      bar.appendChild(U.el('span', { class: 'tag' + (liveType === t[0] ? ' active' : ''), text: t[1], onclick: function () {
        liveType = t[0]; U.$all('#' + idPrefix + 'Tabs .tag').forEach(function (x) { x.classList.toggle('active', x.textContent === t[1]); });
        loadLive(U.$('#' + idPrefix + 'Box'), U.$('#' + idPrefix + 'Src'));
      } }));
    });
    return bar;
  }

  /* ---------- Tab 1：爆款雷达 ---------- */
  function renderRadar(root) {
    var d = getDaily();
    if (d && d.hot && d.hot.length) {
      var hot = U.el('div', { class: 'card' });
      hot.appendChild(U.el('div', { class: 'card-title', text: '🔥 今日爆款雷达（更新于 ' + (d.date || '') + '）' }));
      d.hot.forEach(function (h) {
        var item = U.el('div', { class: 'hot-item' });
        item.appendChild(U.el('div', { class: 'hot-tag', text: '# ' + (h.tag || '') }));
        if (h.note) item.appendChild(U.el('div', { class: 'hot-note', text: h.note }));
        if (h.angle && h.angle.length) item.appendChild(U.el('div', { class: 'hot-angle muted', text: '可拍角度：' + h.angle.join(' / ') }));
        hot.appendChild(item);
      });
      root.appendChild(hot);
    }
    var liveCard = U.el('div', { class: 'card' });
    liveCard.appendChild(U.el('div', { class: 'card-title', html: '实时热榜 <span class="src-tag" id="vvLibLiveSrc"></span>' }));
    liveCard.appendChild(U.el('div', { class: 'muted', text: '真实联网抓取抖音/微博热榜，选题方向直接来自当下热点（非平台原视频，仅供方向参考）。' }));
    liveCard.appendChild(liveTabsBar('vvLibLive'));
    liveCard.appendChild(U.el('button', { class: 'btn sm', style: 'margin:10px 0', text: '🔄 刷新实时热榜', onclick: function () { loadLive(U.$('#vvLibLiveBox'), U.$('#vvLibLiveSrc')); } }));
    var liveBox = U.el('div', { id: 'vvLibLiveBox' });
    liveCard.appendChild(liveBox);
    root.appendChild(liveCard);
    loadLive(liveBox, U.$('#vvLibLiveSrc'));
  }

  /* ---------- Tab 2：素材 ---------- */
  function renderMaterials(root) {
    if (!MAT_STATE) MAT_STATE = { platform: 'all', catGroup: 'all', track: 'all', starred: 'all', dateFrom: '', dateTo: '', view: 'all', selected: {}, batchMode: false };
    var state = MAT_STATE;

    var opCard = U.el('div', { class: 'card' });
    opCard.appendChild(U.el('div', { class: 'card-title', html: '爆款素材库 <span class="demo-badge">参考模板</span>' }));
    var opRow = U.el('div', { class: 'row wrap' });
    opRow.appendChild(U.el('button', { class: 'btn sm', text: '一键刷新榜单', onclick: function () { collect(true); } }));
    opRow.appendChild(U.el('button', { class: 'btn ghost sm', text: '手动新增素材', onclick: openManual }));
    var favBtn = U.el('button', { class: 'btn ghost sm', text: '我的收藏', onclick: function () { state.view = state.view === 'favorites' ? 'all' : 'favorites'; App.renderCurrent(); } });
    opRow.appendChild(favBtn);
    var batchBtn = U.el('button', { class: 'btn ghost sm', text: '批量模式', onclick: function () { toggleBatch(state); } });
    opRow.appendChild(batchBtn);
    var arcBtn = U.el('button', { class: 'btn ghost sm', text: '批量归档', style: 'display:none', onclick: function () { batchArchive(state); } });
    opRow.appendChild(arcBtn);
    var delBtn = U.el('button', { class: 'btn danger sm', text: '批量删除', style: 'display:none', onclick: function () { batchDelete(state); } });
    opRow.appendChild(delBtn);
    var expBtn = U.el('button', { class: 'btn ghost sm', text: '导出选中', style: 'display:none', onclick: function () { exportSelected(state); } });
    opRow.appendChild(expBtn);
    opCard.appendChild(opRow);
    root.appendChild(opCard);

    var fCard = U.el('div', { class: 'card' });
    fCard.appendChild(U.el('div', { class: 'card-title', text: '筛选 / 分类' }));
    var fBar = U.el('div', { class: 'filter-bar' });
    var platSel = U.el('select', { class: 'input', onchange: function () { state.platform = this.value; App.renderCurrent(); } },
      [U.el('option', { value: 'all', text: '全部平台' }), U.el('option', { value: 'douyin', text: '抖音' }), U.el('option', { value: 'xhs', text: '小红书' })]);
    fBar.appendChild(platSel);
    fCard.appendChild(fBar);
    var catGroupBar = U.el('div', { class: 'filter-bar', id: 'vvLibCatGroups', style: 'margin-top:10px' });
    fCard.appendChild(catGroupBar);
    var trackChips = U.el('div', { class: 'filter-bar', id: 'vvLibTracks', style: 'margin-top:8px' });
    fCard.appendChild(trackChips);
    root.appendChild(fCard);

    var listBox = U.el('div', { id: 'vvLibList' });
    root.appendChild(listBox);

    function render() {
      favBtn.textContent = state.view === 'favorites' ? '全部素材' : '我的收藏';
      favBtn.classList.toggle('active', state.view === 'favorites');
      batchBtn.textContent = state.batchMode ? '退出批量' : '批量模式';
      arcBtn.style.display = state.batchMode ? '' : 'none';
      delBtn.style.display = state.batchMode ? '' : 'none';
      expBtn.style.display = state.batchMode ? '' : 'none';
      renderTracks(state, catGroupBar, trackChips);
      var guideBox = U.$('#vvLibGuide');
      if (!guideBox) { guideBox = U.el('div', { id: 'vvLibGuide' }); root.insertBefore(guideBox, listBox); }
      renderGuide(state, guideBox);
      U.clear(listBox);
      var arr = filtered(state);
      if (!arr.length) { listBox.appendChild(U.el('div', { class: 'empty', text: '暂无素材，点击「一键刷新榜单」或「手动新增」' })); return; }
      arr.forEach(function (it) { listBox.appendChild(videoCard(it, state)); });
    }

    ensureCollected();
    render();
  }

  /* ---------- Tab 3：选题 ---------- */
  function renderTopics(root) {
    var d = getDaily();
    if (d && d.hot && d.hot.length) {
      var card = U.el('div', { class: 'card' });
      card.appendChild(U.el('div', { class: 'card-title', text: '🔥 今日热点选题（来自爆款雷达）' }));
      d.hot.forEach(function (h) {
        var item = U.el('div', { style: 'margin-bottom:10px' });
        item.appendChild(U.el('div', { style: 'font-weight:700', text: '# ' + (h.tag || '') }));
        if (h.note) item.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px', text: h.note }));
        if (h.angle && h.angle.length) {
          var ang = U.el('div', { style: 'font-size:13px;margin-top:2px' });
          ang.appendChild(U.el('span', { style: 'color:var(--brand);font-weight:600', text: '可拍角度：' }));
          h.angle.forEach(function (a) { ang.appendChild(U.el('span', { class: 'tag xs', text: a, style: 'margin-left:4px' })); });
          item.appendChild(ang);
        }
        card.appendChild(item);
      });
      root.appendChild(card);
    }
    var poolCard = U.el('div', { class: 'card' });
    poolCard.appendChild(U.el('div', { class: 'card-title', text: '📚 赛道选题库（按内容形式）' }));
    var byTrack = {};
    POOL.forEach(function (p) { (byTrack[p.track] = byTrack[p.track] || []).push(p); });
    Object.keys(byTrack).forEach(function (track) {
      var items = byTrack[track];
      var topics = [];
      items.forEach(function (p) { if (p.inspire && p.inspire.topic && topics.indexOf(p.inspire.topic) < 0) topics.push(p.inspire.topic); });
      var row = U.el('div', { style: 'margin:6px 0' });
      row.appendChild(U.el('div', { style: 'font-weight:600;font-size:13px', text: track }));
      row.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px', text: topics.join(' / ') }));
      poolCard.appendChild(row);
    });
    root.appendChild(poolCard);
  }

  /* ---------- Tab 4：数据 ---------- */
  function renderData(root) {
    var all = allItems();
    var byPlat = { douyin: 0, xhs: 0 };
    var byTrack = {};
    var starred = 0, archived = 0;
    all.forEach(function (x) {
      if (x.platform === 'douyin') byPlat.douyin++; else if (x.platform === 'xhs') byPlat.xhs++;
      byTrack[x.track] = (byTrack[x.track] || 0) + 1;
      if (x.starred) starred++;
      if (x.archived) archived++;
    });
    var stat = U.el('div', { class: 'card' });
    stat.appendChild(U.el('div', { class: 'card-title', text: '📊 我的素材数据' }));
    var grid = U.el('div', { class: 'grid c3', style: 'gap:8px' });
    function sc(label, val) {
      var c = U.el('div', { style: 'background:var(--surface);border-radius:10px;padding:10px;text-align:center' });
      c.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px', text: label }));
      c.appendChild(U.el('div', { style: 'font-size:20px;font-weight:800', text: val }));
      return c;
    }
    grid.appendChild(sc('素材总数', all.length));
    grid.appendChild(sc('抖音', byPlat.douyin));
    grid.appendChild(sc('小红书', byPlat.xhs));
    grid.appendChild(sc('收藏', starred));
    grid.appendChild(sc('归档', archived));
    grid.appendChild(sc('赛道数', Object.keys(byTrack).length));
    stat.appendChild(grid);
    root.appendChild(stat);

    if (Object.keys(byTrack).length) {
      var tcard = U.el('div', { class: 'card' });
      tcard.appendChild(U.el('div', { class: 'card-title', text: '🗂 赛道分布' }));
      Object.keys(byTrack).forEach(function (t) {
        tcard.appendChild(U.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;margin:3px 0' }, [
          U.el('span', { text: t }), U.el('span', { class: 'muted', text: byTrack[t] + ' 条' })
        ]));
      });
      root.appendChild(tcard);
    }

    var liveCard = U.el('div', { class: 'card' });
    liveCard.appendChild(U.el('div', { class: 'card-title', html: '实时热榜抓取 <span class="src-tag" id="vvLibDataSrc"></span>' }));
    liveCard.appendChild(U.el('div', { class: 'muted', text: '真实联网抓取抖音/微博热榜，下面是当下热点条目（数据看板）。' }));
    liveCard.appendChild(liveTabsBar('vvLibData'));
    var liveBox = U.el('div', { id: 'vvLibDataBox' });
    liveCard.appendChild(liveBox);
    root.appendChild(liveCard);
    loadLive(liveBox, U.$('#vvLibDataSrc'));
  }

  /* ---------- Tab 5：我的 ---------- */
  function renderMine(root) {
    var all = allItems();
    var starred = all.filter(function (x) { return x.starred; });
    var archived = all.filter(function (x) { return x.archived; });
    var stat = U.el('div', { class: 'card' });
    stat.appendChild(U.el('div', { class: 'card-title', text: '👤 我的' }));
    stat.appendChild(U.el('div', { class: 'muted', text: '收藏 ' + starred.length + ' 条 · 归档 ' + archived.length + ' 条' }));
    root.appendChild(stat);

    if (starred.length) {
      var sc2 = U.el('div', { class: 'card' });
      sc2.appendChild(U.el('div', { class: 'card-title', text: '⭐ 我的收藏' }));
      var sl = U.el('div', { id: 'vvLibStarList' });
      starred.forEach(function (it) { sl.appendChild(videoCard(it, { batchMode: false })); });
      sc2.appendChild(sl);
      root.appendChild(sc2);
    } else {
      root.appendChild(U.el('div', { class: 'card' }, [U.el('div', { class: 'muted', text: '还没有收藏，去「素材」Tab 点 ☆ 收藏喜欢的爆款。' })]));
    }
    if (archived.length) {
      var ac = U.el('div', { class: 'card' });
      ac.appendChild(U.el('div', { class: 'card-title', text: '📦 已归档' }));
      var al = U.el('div', { id: 'vvLibArcList' });
      archived.forEach(function (it) { al.appendChild(videoCard(it, { batchMode: false })); });
      ac.appendChild(al);
      root.appendChild(ac);
    }
  }

  /* ---------- 页面（5 Tab） ---------- */
  App.pages['vv-library'] = function (root) {
    U.clear(root);
    var tabs = [
      { id: 'radar', label: '🔥 爆款雷达' },
      { id: 'materials', label: '📦 素材' },
      { id: 'topics', label: '💡 选题' },
      { id: 'data', label: '📊 数据' },
      { id: 'mine', label: '👤 我的' }
    ];
    var tabBar = U.el('div', { class: 'filter-bar', id: 'vvLibTabs', style: 'position:sticky;top:0;background:var(--bg);z-index:6;padding:6px 0' });
    var tabEls = {};
    tabs.forEach(function (t) {
      var el = U.el('button', { class: 'tag' + (VV_LIB_TAB === t.id ? ' active' : ''), text: t.label, onclick: function () { VV_LIB_TAB = t.id; syncTabs(); renderView(); } });
      tabEls[t.id] = el; tabBar.appendChild(el);
    });
    root.appendChild(tabBar);
    function syncTabs() { tabs.forEach(function (t) { tabEls[t.id].classList.toggle('active', VV_LIB_TAB === t.id); }); }

    var viewRoot = U.el('div');
    root.appendChild(viewRoot);
    function renderView() {
      U.clear(viewRoot);
      if (VV_LIB_TAB === 'radar') renderRadar(viewRoot);
      else if (VV_LIB_TAB === 'materials') renderMaterials(viewRoot);
      else if (VV_LIB_TAB === 'topics') renderTopics(viewRoot);
      else if (VV_LIB_TAB === 'data') renderData(viewRoot);
      else renderMine(viewRoot);
    }
    renderView();
  };
})();
