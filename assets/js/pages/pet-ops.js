/* =========================================================
   页面 6（新增）：宠物运营中心
   面向宠物自媒体博主，含 4 个子版块：
   ① 每日数据复盘  —— 自己账号播放/点赞/评论/涨粉/互动率，手动录入 + 趋势图
   ② 对标博主监控  —— 竞品观察记录（同行在发什么）
   ③ 内容日历      —— 发布排期（日期/平台/主题/状态）
   ④ 联网热点选题  —— fetch 公开热榜筛宠物词（真实联网，失败降级不造假）
   数据：Store 通用 bucket 'pet_ops'。
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

App.pages['pet-ops'] = function (root) {
  var U = App.U, S = App.Store;
  U.clear(root);

  function load() { return S.get('pet_ops') || { reviews: [], rivals: [], calendar: [], topics: [] }; }
  function save(d) { S.set('pet_ops', d); }

  var sub = 'review'; // review | rival | calendar | hot

  // 顶部子 tab
  var tabBar = U.el('div', { class: 'filter-bar', id: 'petTabs' });
  [['review', '每日数据复盘'], ['rival', '对标博主'], ['calendar', '内容日历'], ['hot', '联网热点选题']].forEach(function (t) {
    tabBar.appendChild(U.el('span', { class: 'tag' + (sub === t[0] ? ' active' : ''), text: t[1], onclick: function () { sub = t[0]; renderTabs(); box.innerHTML = ''; renderView(); } }));
  });
  root.appendChild(tabBar);
  var box = U.el('div', { id: 'petBox' });
  root.appendChild(box);

  function renderTabs() {
    U.clear(tabBar);
    [['review', '每日数据复盘'], ['rival', '对标博主'], ['calendar', '内容日历'], ['hot', '联网热点选题']].forEach(function (t) {
      tabBar.appendChild(U.el('span', { class: 'tag' + (sub === t[0] ? ' active' : ''), text: t[1], onclick: function () { sub = t[0]; renderTabs(); box.innerHTML = ''; renderView(); } }));
    });
  }
  function renderView() {
    if (sub === 'review') renderReview(box);
    else if (sub === 'rival') renderRival(box);
    else if (sub === 'calendar') renderCalendar(box);
    else renderHot(box);
  }
  renderView();

  /* ============ ① 每日数据复盘 ============ */
  function renderReview(root) {
    var d = load();
    var card = U.el('div', { class: 'card' });
    card.appendChild(U.el('div', { class: 'card-title', text: '录入今日数据' }));
    var grid = U.el('div', { class: 'grid c2' });
    var dateI = U.el('input', { class: 'input', type: 'date', value: S.todayStr() });
    var platI = U.el('select', { class: 'input' }, [U.el('option', { value: 'douyin', text: '抖音' }), U.el('option', { value: 'xhs', text: '小红书' }), U.el('option', { value: 'both', text: '双平台' })]);
    var viewsI = numInput('播放量');
    var likesI = numInput('点赞');
    var commentsI = numInput('评论');
    var fansI = numInput('涨粉');
    var sharesI = numInput('转发');
    grid.appendChild(field('日期', dateI)); grid.appendChild(field('平台', platI));
    grid.appendChild(field('播放量', viewsI)); grid.appendChild(field('点赞', likesI));
    grid.appendChild(field('评论', commentsI)); grid.appendChild(field('涨粉', fansI));
    grid.appendChild(field('转发', sharesI));
    card.appendChild(grid);
    card.appendChild(U.el('button', { class: 'btn', style: 'margin-top:10px', text: '保存今日复盘', onclick: function () {
      var rec = { id: U.uid(), date: dateI.value || S.todayStr(), platform: platI.value,
        views: +viewsI.value || 0, likes: +likesI.value || 0, comments: +commentsI.value || 0,
        fans: +fansI.value || 0, shares: +sharesI.value || 0 };
      d.reviews.unshift(rec); save(d); U.toast('已保存复盘'); renderReview(box);
    } }));
    root.appendChild(card);

    // 趋势图
    if (d.reviews.length) {
      var rev = d.reviews.slice().sort(function (a, b) { return a.date > b.date ? 1 : -1; });
      var trend = U.el('div', { class: 'card' });
      trend.appendChild(U.el('div', { class: 'card-title', text: '近 ' + Math.min(rev.length, 14) + ' 天趋势' }));
      trend.appendChild(lineChart(rev.slice(-14).map(function (x) { return x.views; }), '播放量', '#5b7cfa'));
      trend.appendChild(lineChart(rev.slice(-14).map(function (x) { return x.fans; }), '涨粉', '#2fae66'));
      root.appendChild(trend);
    }

    // 列表
    var list = U.el('div', { class: 'card' });
    list.appendChild(U.el('div', { class: 'card-title', text: '历史复盘（倒序）' }));
    if (!d.reviews.length) list.appendChild(U.el('div', { class: 'empty', text: '暂无记录，上方录入第一条' }));
    d.reviews.slice(0, 20).forEach(function (r) {
      var rate = r.views ? ((r.likes + r.comments) / r.views * 100).toFixed(2) : '0.00';
      var row = U.el('div', { class: 'quote-row' });
      row.appendChild(U.el('div', {}, [U.el('div', { text: r.date + ' · ' + platName(r.platform), style: 'font-weight:600' }),
        U.el('div', { class: 'muted', text: '播放 ' + r.views + ' / 赞 ' + r.likes + ' / 评 ' + r.comments + ' / 涨粉 ' + r.fans })]));
      row.appendChild(U.el('div', { style: 'text-align:right' }, [
        U.el('div', { class: 'up', style: 'font-weight:700', text: '互动率 ' + rate + '%' }),
        U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { d.reviews = d.reviews.filter(function (x) { return x.id !== r.id; }); save(d); renderReview(box); } })
      ]));
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  /* ============ ② 对标博主监控 ============ */
  function renderRival(root) {
    var d = load();
    var card = U.el('div', { class: 'card' });
    card.appendChild(U.el('div', { class: 'card-title', text: '添加对标博主观察' }));
    var grid = U.el('div', { class: 'grid c2' });
    var nameI = U.el('input', { class: 'input', placeholder: '博主名/账号' });
    var platI = U.el('select', { class: 'input' }, [U.el('option', { value: 'douyin', text: '抖音' }), U.el('option', { value: 'xhs', text: '小红书' }), U.el('option', { value: 'both', text: '双平台' })]);
    var dateI = U.el('input', { class: 'input', type: 'date', value: S.todayStr() });
    grid.appendChild(field('博主', nameI)); grid.appendChild(field('平台', platI)); grid.appendChild(field('日期', dateI));
    card.appendChild(grid);
    var noteI = U.el('textarea', { class: 'textarea', placeholder: '观察：在发什么选题 / 爆款方向 / 文案钩子 / 可借鉴点…' });
    card.appendChild(field('观察笔记', noteI));
    card.appendChild(U.el('button', { class: 'btn', style: 'margin-top:10px', text: '保存观察', onclick: function () {
      if (!nameI.value.trim()) return U.toast('请填博主名');
      d.rivals.unshift({ id: U.uid(), name: nameI.value.trim(), platform: platI.value, date: dateI.value || S.todayStr(), note: noteI.value.trim() });
      save(d); U.toast('已记录'); renderRival(box);
    } }));
    root.appendChild(card);

    var list = U.el('div', { class: 'card' });
    list.appendChild(U.el('div', { class: 'card-title', text: '对标观察记录' }));
    if (!d.rivals.length) list.appendChild(U.el('div', { class: 'empty', text: '暂无，添加你常看的同行博主' }));
    d.rivals.slice(0, 30).forEach(function (r) {
      var row = U.el('div', { class: 'card', style: 'margin-bottom:10px;background:var(--surface-2)' });
      row.appendChild(U.el('div', { style: 'font-weight:600', text: r.name + ' · ' + platName(r.platform) + ' · ' + r.date }));
      if (r.note) row.appendChild(U.el('div', { class: 'muted', style: 'margin-top:6px;white-space:pre-wrap', text: r.note }));
      row.appendChild(U.el('button', { class: 'icon-btn', style: 'float:right;margin-top:-26px', html: '🗑', onclick: function () { d.rivals = d.rivals.filter(function (x) { return x.id !== r.id; }); save(d); renderRival(box); } }));
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  /* ============ ③ 内容日历 ============ */
  function renderCalendar(root) {
    var d = load();
    var card = U.el('div', { class: 'card' });
    card.appendChild(U.el('div', { class: 'card-title', text: '排期发布' }));
    var grid = U.el('div', { class: 'grid c2' });
    var dateI = U.el('input', { class: 'input', type: 'date', value: S.todayStr() });
    var platI = U.el('select', { class: 'input' }, [U.el('option', { value: 'douyin', text: '抖音' }), U.el('option', { value: 'xhs', text: '小红书' }), U.el('option', { value: 'both', text: '双平台' })]);
    var topicI = U.el('input', { class: 'input', placeholder: '主题 / 选题' });
    var statusI = U.el('select', { class: 'input' }, [U.el('option', { value: 'plan', text: '计划中' }), U.el('option', { value: 'posted', text: '已发布' }), U.el('option', { value: 'hot', text: '爆了🔥' })]);
    grid.appendChild(field('日期', dateI)); grid.appendChild(field('平台', platI));
    card.appendChild(grid);
    card.appendChild(field('主题', topicI));
    card.appendChild(field('状态', statusI));
    card.appendChild(U.el('button', { class: 'btn', style: 'margin-top:10px', text: '加入日历', onclick: function () {
      if (!topicI.value.trim()) return U.toast('请填主题');
      d.calendar.unshift({ id: U.uid(), date: dateI.value || S.todayStr(), platform: platI.value, topic: topicI.value.trim(), status: statusI.value });
      save(d); U.toast('已加入日历'); renderCalendar(box);
    } }));
    root.appendChild(card);

    var list = U.el('div', { class: 'card' });
    list.appendChild(U.el('div', { class: 'card-title', text: '发布日历' }));
    if (!d.calendar.length) list.appendChild(U.el('div', { class: 'empty', text: '暂无排期' }));
    d.calendar.slice().sort(function (a, b) { return a.date > b.date ? -1 : 1; }).slice(0, 40).forEach(function (c) {
      var row = U.el('div', { class: 'quote-row' });
      row.appendChild(U.el('div', {}, [U.el('div', { text: c.date + ' · ' + platName(c.platform), style: 'font-weight:600' }),
        U.el('div', { text: c.topic })]));
      row.appendChild(U.el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        U.el('span', { class: 'tag ' + statusCls(c.status), text: statusText(c.status) }),
        U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { d.calendar = d.calendar.filter(function (x) { return x.id !== c.id; }); save(d); renderCalendar(box); } })
      ]));
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  /* ============ ④ 联网热点选题 ============ */
  function renderHot(root) {
    var d = load();
    var card = U.el('div', { class: 'card' });
    card.appendChild(U.el('div', { class: 'card-title', html: '联网热点选题 <span class="src-tag" id="hotSrc"></span>' }));
    card.appendChild(U.el('div', { class: 'muted', text: '实时抓取公开热榜，自动筛宠物相关话题（猫/狗/萌宠/养宠等）。非抖音/小红书原爆款，仅供参考选题方向。' }));
    var refreshBtn = U.el('button', { class: 'btn sm', style: 'margin:10px 0', text: '🔄 刷新联网热点', onclick: loadHot });
    card.appendChild(refreshBtn);
    var listBox = U.el('div', { id: 'hotList' });
    card.appendChild(listBox);
    root.appendChild(card);

    // 我的选题池
    var pool = U.el('div', { class: 'card' });
    pool.appendChild(U.el('div', { class: 'card-title', text: '我的选题池（从热点加入 / 手动添加）' }));
    var addRow = U.el('div', { class: 'row' });
    var addI = U.el('input', { class: 'input', placeholder: '手动添加选题灵感' });
    addRow.appendChild(addI);
    addRow.appendChild(U.el('button', { class: 'btn ghost sm', text: '添加', onclick: function () { if (addI.value.trim()) { d.topics.unshift({ id: U.uid(), text: addI.value.trim(), date: S.todayStr() }); save(d); addI.value = ''; renderPool(); } } }));
    pool.appendChild(addRow);
    var poolBox = U.el('div', { id: 'topicPool' }); pool.appendChild(poolBox);
    root.appendChild(pool);
    function renderPool() {
      U.clear(poolBox);
      if (!d.topics.length) poolBox.appendChild(U.el('div', { class: 'empty', text: '暂无，从热点点「加入选题」或手动添加' }));
      d.topics.forEach(function (t) {
        var row = U.el('div', { class: 'quote-row' });
        row.appendChild(U.el('div', {}, [U.el('div', { text: t.text }), U.el('div', { class: 'muted', text: t.date })]));
        row.appendChild(U.el('button', { class: 'icon-btn', html: '🗑', onclick: function () { d.topics = d.topics.filter(function (x) { return x.id !== t.id; }); save(d); renderPool(); } }));
        poolBox.appendChild(row);
      });
    }
    renderPool();

    function loadHot() {
      U.$('#hotSrc').innerHTML = '<span class="live-dot wait"></span> 抓取中…';
      U.clear(listBox); listBox.appendChild(U.el('div', { class: 'muted', text: '联网抓取中…' }));
      U.fetchJSON('https://api.vvhan.com/api/hotlist/wbHot', 9000)
        .then(function (j) {
          var arr = parseHot(j);
          var pet = arr.filter(function (x) { return isPet(x.title); });
          if (!pet.length) { U.$('#hotSrc').innerHTML = '<span class="live-dot on"></span> 实时'; U.clear(listBox); listBox.appendChild(U.el('div', { class: 'empty', text: '当前热榜无宠物相关话题，稍后刷新或手动添加' })); return; }
          U.$('#hotSrc').innerHTML = '<span class="live-dot on"></span> 实时 · 共 ' + pet.length + ' 条';
          U.clear(listBox);
          pet.forEach(function (x) {
            var row = U.el('div', { class: 'quote-row' });
            row.appendChild(U.el('div', {}, [U.el('div', { text: x.title }), U.el('div', { class: 'muted', text: '热度 ' + fmtHot(x.hot) })]));
            var right = U.el('div', { style: 'display:flex;gap:6px' });
            if (x.url) right.appendChild(U.el('button', { class: 'btn ghost xs', text: '看原帖', onclick: function () { window.open(x.url, '_blank'); } }));
            right.appendChild(U.el('button', { class: 'btn ghost xs', text: '加入选题', onclick: function () { d.topics.unshift({ id: U.uid(), text: x.title, date: S.todayStr() }); save(d); renderPool(); U.toast('已加入选题池'); } }));
            row.appendChild(right);
            listBox.appendChild(row);
          });
        })
        .catch(function () {
          U.$('#hotSrc').innerHTML = '<span class="live-dot off"></span> 获取失败';
          U.clear(listBox);
          listBox.appendChild(U.el('div', { class: 'empty', text: '联网获取失败（接口受限或网络问题）。可手动在下方「我的选题池」添加，或稍后点刷新重试。' }));
        });
    }
    loadHot();
  }

  /* ---------- 工具 ---------- */
  function parseHot(j) {
    if (!j) return [];
    var list = j.data || j.result || j.list;
    if (list && list.data && Array.isArray(list.data)) list = list.data;
    if (!Array.isArray(list)) return [];
    return list.map(function (x) { return { title: x.title || x.word || '', hot: x.hot || x.num || 0, url: x.url || x.mblink || x.link || '' }; }).filter(function (x) { return x.title; });
  }
  var PET_KW = ['猫', '狗', '宠物', '萌宠', '铲屎', '猫粮', '狗粮', '养宠', '撸猫', '遛狗', '宠物医院', '疫苗', '绝育', '品种', '布偶', '金毛', '柯基', '柴犬', '橘猫', '二哈', '哈士奇', '泰迪', '比熊', '仓鼠', '兔子', '龟', '鹦鹉', '异宠', '毛孩子', '喵', '汪'];
  function isPet(t) { t = (t || '').toLowerCase(); return PET_KW.some(function (k) { return t.indexOf(k.toLowerCase()) > -1; }); }
  function platName(p) { return p === 'douyin' ? '抖音' : p === 'xhs' ? '小红书' : '双平台'; }
  function statusText(s) { return s === 'posted' ? '已发布' : s === 'hot' ? '爆了🔥' : '计划中'; }
  function statusCls(s) { return s === 'hot' ? 'hot' : s === 'posted' ? 'done' : ''; }
  function fmtHot(n) { n = +n || 0; return n > 10000 ? (n / 10000).toFixed(1) + 'w' : '' + n; }
  function numInput(ph) { return U.el('input', { class: 'input', type: 'number', placeholder: ph, min: '0' }); }
  function field(label, node) { var f = U.el('div', { class: 'field' }); f.appendChild(U.el('label', { text: label })); f.appendChild(node); return f; }
  function lineChart(vals, label, color) {
    var w = 600, h = 120, pad = 10;
    var max = Math.max.apply(null, vals.concat([1]));
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="margin-top:10px">';
    svg += '<text x="' + pad + '" y="14" font-size="12" fill="' + color + '">' + label + '</text>';
    if (vals.length > 1) {
      var cw = (w - pad * 2) / (vals.length - 1);
      var pts = vals.map(function (v, i) { var x = pad + i * cw; var y = h - pad - (v / max) * (h - pad * 2); return x + ',' + y; }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
      vals.forEach(function (v, i) { var x = pad + i * cw; var y = h - pad - (v / max) * (h - pad * 2); svg += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + color + '"/>'; });
    }
    svg += '</svg>';
    var wrap = U.el('div'); wrap.innerHTML = svg; return wrap.firstChild;
  }
};
