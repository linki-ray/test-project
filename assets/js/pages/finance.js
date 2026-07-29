/* =========================================================
   页面 4：全球金融热点（A股）
   4.1 大盘 / 板块 / 资讯 + 收藏 + 历史缓存
   4.3 个股综合分析查询（行情 / K线 / MACD / 支撑压力 / 星级 / 建议）
   注：原 4.2 自动筛选策略为私有策略，
       已从公开代码中移除，不随本仓库分发。
   数据源：东方财富公开行情接口（浏览器跨域可用）；
   接口不可用时自动回退【示例数据】，页面会明确标注。
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  var U = App.U, S = App.Store;

  /* ---------- 工具：东方财富 secid ---------- */
  function toSecid(code) {
    code = String(code).toLowerCase();
    var m = code.match(/^([sh|sz|bk]{2})(\d+)$/);
    if (m) { var pre = m[1], num = m[2]; return (pre === 'sh' ? '1.' : '0.') + num; }
    if (/^\d{6}$/.test(code)) { return (code[0] === '6' ? '1.' : '0.') + code; }
    return null;
  }

  function emJSON(url) {
    return U.fetchJSON(url, 9000).then(function (j) { return j; });
  }

  /* ---------- 指标计算 ---------- */
  function closes(klines) { return klines.map(function (k) { return k.close; }); }
  function MA(arr, n) {
    var out = []; for (var i = 0; i < arr.length; i++) { if (i < n - 1) { out.push(null); continue; } var s = 0; for (var j = 0; j < n; j++) s += arr[i - j]; out.push(s / n); } return out;
  }
  function EMA(arr, n) {
    var k = 2 / (n + 1), out = [], prev = arr[0];
    for (var i = 0; i < arr.length; i++) { prev = i === 0 ? arr[0] : arr[i] * k + prev * (1 - k); out.push(prev); }
    return out;
  }
  function MACD(closesArr) {
    var e12 = EMA(closesArr, 12), e26 = EMA(closesArr, 26);
    var dif = closesArr.map(function (c, i) { return c - e26[i]; });
    var dea = EMA(dif, 9);
    var macd = dif.map(function (d, i) { return (d - dea[i]) * 2; });
    return { dif: dif, dea: dea, macd: macd };
  }

  /* ---------- 东方财富 K线解析 ---------- */
  function fetchKline(secid, klt, lmt) {
    var url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secid +
      '&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=' + klt + '&fqt=1&end=20500101&lmt=' + lmt;
    return emJSON(url).then(function (j) {
      if (!j || !j.data || !j.data.klines) throw new Error('no kline');
      return j.data.klines.map(function (s) {
        var p = s.split(',');
        return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], vol: +p[5] };
      });
    });
  }
  function fetchQuote(secid) {
    var url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=' + secid +
      '&fields=f12,f13,f14,f43,f44,f45,f46,f47,f48,f57,f58,f60,f116,f117,f161,f168,f169,f170,f171';
    return emJSON(url).then(function (j) {
      if (!j || !j.data) throw new Error('no quote');
      var d = j.data;
      return {
        code: d.f57, name: d.f58, price: d.f43, high: d.f44, low: d.f45, open: d.f46,
        vol: d.f47, amount: d.f48, prevClose: d.f60, mv: d.f116, floatMv: d.f117,
        turnover: d.f161, chgPct: d.f168, chg: d.f169, amplitude: d.f170, volumeRatio: d.f171
      };
    });
  }
  function searchStock(kw) {
    var url = 'https://smartbox.gtimg.cn/s3/?t=all&q=' + encodeURIComponent(kw) + '&cb=__cb__';
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      window.__cb__ = function (r) {
        var out = [];
        try {
          var items = (r && r.data || []);
          items.forEach(function (g) { (g.item || []).forEach(function (it) { if (it[0] === 'stock') out.push({ code: it[1], name: it[2], market: it[4] }); }); });
        } catch (e) {}
        resolve(out.slice(0, 12));
        s.remove();
      };
      s.src = url.replace('__cb__', 'window.__cb__');
      s.onerror = function () { resolve([]); s.remove(); };
      document.body.appendChild(s);
    });
  }

  /* ---------- 示例回退数据 ---------- */
  var DEMO_INDICES = [
    { code: '000001', name: '上证指数', price: 3210.45, chgPct: 0.62, chg: 19.8, turnover: 0.8, amount: 3.2e11 },
    { code: '399001', name: '深证成指', price: 10120.33, chgPct: 0.91, chg: 91.2, turnover: 1.4, amount: 4.1e11 },
    { code: '399006', name: '创业板指', price: 2056.77, chgPct: 1.35, chg: 27.4, turnover: 2.1, amount: 1.5e11 }
  ];
  var DEMO_SECTORS = [
    { code: 'BK0735', name: '半导体', chgPct: 3.2 }, { code: 'BK0473', name: '酿酒行业', chgPct: 2.1 },
    { code: 'BK0481', name: '银行', chgPct: -0.4 }, { code: 'BK1036', name: '光伏设备', chgPct: 2.8 },
    { code: 'BK0437', name: '汽车整车', chgPct: 1.6 }, { code: 'BK0501', name: '家电行业', chgPct: 0.9 },
    { code: 'BK0448', name: '钢铁行业', chgPct: -1.2 }, { code: 'BK0701', name: '软件开发', chgPct: 1.1 }
  ];
  var DEMO_NEWS = [
    { title: '央行公开市场净投放，流动性边际宽松', time: '09:15', tag: '宏观' },
    { title: '半导体板块获主力资金大幅流入', time: '10:02', tag: '题材' },
    { title: '新能源车企公布月度交付数据，环比回暖', time: '11:20', tag: '行业' },
    { title: '北向资金今日净买入超 50 亿元', time: '14:30', tag: '资金' },
    { title: '多家券商看好三季度消费复苏', time: '15:10', tag: '研报' }
  ];

  /* ============================================================
     主渲染
     ============================================================ */
  App.pages['finance'] = function (root) {
    U.clear(root);
    var view = 'hot'; // hot | stock

    var tabBar = U.el('div', { class: 'filter-bar', id: 'finTabs' });
    [['hot', 'A股股票热点'], ['stock', '个股分析查询']].forEach(function (t) {
      tabBar.appendChild(U.el('span', { class: 'tag' + (view === t[0] ? ' active' : ''), text: t[1], onclick: function () { view = t[0]; renderTabs(); box.innerHTML = ''; renderView(); } }));
    });
    root.appendChild(tabBar);
    var box = U.el('div', { id: 'finBox' });
    root.appendChild(box);

    function renderTabs() {
      U.$all('#finTabs .tag').forEach(function (t) { /* active managed by text match */ });
      U.clear(tabBar);
      [['hot', 'A股股票热点'], ['stock', '个股分析查询']].forEach(function (t) {
        tabBar.appendChild(U.el('span', { class: 'tag' + (view === t[0] ? ' active' : ''), text: t[1], onclick: function () { view = t[0]; renderTabs(); box.innerHTML = ''; renderView(); } }));
      });
    }
    function renderView() {
      if (view === 'hot') renderHot(box);
      else renderStock(box);
    }
    renderView();
  };

  /* ------------------- 4.1 热点 ------------------- */
  function renderHot(root) {
    var demo = false;
    var wrap = U.el('div');

    // 大盘
    var idxCard = U.el('div', { class: 'card' });
    idxCard.appendChild(U.el('div', { class: 'card-title' }, [
      document.createTextNode('当日大盘 '),
      U.el('span', { class: 'src-tag', id: 'idxSrc' }),
      U.el('button', { class: 'btn ghost xs', style: 'float:right;margin-top:-2px', text: '🔄 刷新', onclick: function () { loadIndices(true); } })
    ]));
    var idxBox = U.el('div'); idxCard.appendChild(idxBox);
    wrap.appendChild(idxCard);

    // 板块题材
    var secCard = U.el('div', { class: 'card' });
    secCard.appendChild(U.el('div', { class: 'card-title' }, [
      document.createTextNode('板块题材 '),
      U.el('span', { class: 'src-tag', id: 'secSrc' }),
      U.el('button', { class: 'btn ghost xs', style: 'float:right;margin-top:-2px', text: '🔄 刷新', onclick: function () { loadSectors(true); } })
    ]));
    var secBox = U.el('div', { class: 'grid c2', id: 'secBox' }); secCard.appendChild(secBox);
    wrap.appendChild(secCard);

    // 资讯
    var newsCard = U.el('div', { class: 'card' });
    newsCard.appendChild(U.el('div', { class: 'card-title', html: '市场资讯 <span class="demo-badge">示例</span> <button class="btn ghost sm" style="margin-left:8px" id="newsFavTip">收藏说明</button>' }));
    var newsBox = U.el('div'); newsCard.appendChild(newsBox);
    wrap.appendChild(newsCard);

    // 历史缓存
    var histCard = U.el('div', { class: 'card' });
    histCard.appendChild(U.el('div', { class: 'card-title', text: '历史缓存（按日期回溯）' }));
    var histDate = U.el('input', { class: 'input', type: 'date', style: 'max-width:200px', value: S.todayStr(), onchange: function () { showHist(this.value); } });
    histCard.appendChild(U.el('div', { class: 'row', style: 'margin-bottom:8px' }, [histDate]));
    var histBox = U.el('div', { id: 'finHistBox' }); histCard.appendChild(histBox);
    wrap.appendChild(histCard);

    root.appendChild(wrap);

    // 收藏列表（走 Store，自动云端同步）
    function favBar() {
      return S.get('fin_fav', []);
    }
    function addFav(item) {
      var f = favBar(); f.push(item); S.set('fin_fav', f); U.toast('已收藏：' + item.name);
    }

    // 渲染大盘
    function showIdx(list) {
      U.clear(idxBox);
      list.forEach(function (x) {
        var up = x.chgPct >= 0;
        var r = U.el('div', { class: 'quote-row' });
        r.appendChild(U.el('div', {}, [U.el('div', { text: x.name, style: 'font-weight:600' }), U.el('div', { class: 'muted', text: x.code })]));
        var right = U.el('div', { style: 'text-align:right' });
        right.appendChild(U.el('div', { class: up ? 'up' : 'down', style: 'font-weight:700', text: x.price.toFixed(2) }));
        right.appendChild(U.el('div', { class: up ? 'up' : 'down', text: (up ? '+' : '') + x.chgPct.toFixed(2) + '%' }));
        r.appendChild(right);
        r.appendChild(U.el('button', { class: 'icon-btn', html: '☆', title: '收藏', onclick: function () { addFav({ type: 'index', name: x.name, code: x.code, price: x.price, chgPct: x.chgPct }); } }));
        idxBox.appendChild(r);
      });
    }
    function showSectors(list) {
      U.clear(secBox);
      list.forEach(function (x) {
        var up = x.chgPct >= 0;
        var c = U.el('div', { class: 'card', style: 'margin-bottom:0;background:var(--surface-2);padding:12px' });
        c.appendChild(U.el('div', { style: 'font-weight:600', text: x.name }));
        c.appendChild(U.el('div', { class: up ? 'up' : 'down', style: 'font-weight:700', text: (up ? '+' : '') + x.chgPct.toFixed(2) + '%' }));
        c.appendChild(U.el('button', { class: 'icon-btn', html: '☆', style: 'float:right;margin-top:-28px', onclick: function () { addFav({ type: 'sector', name: x.name, code: x.code, chgPct: x.chgPct }); } }));
        secBox.appendChild(c);
      });
    }
    function showNews(list) {
      U.clear(newsBox);
      list.forEach(function (n) {
        var r = U.el('div', { class: 'quote-row' });
        r.appendChild(U.el('div', {}, [U.el('div', { text: n.title }), U.el('div', { class: 'muted', text: n.time + ' · ' + (n.tag || '') })]));
        r.appendChild(U.el('button', { class: 'icon-btn', html: '☆', onclick: function () { addFav({ type: 'news', name: n.title, time: n.time }); } }));
        newsBox.appendChild(r);
      });
    }
    function showHist(d) {
      U.clear(histBox);
      var snap = S.get('fin_snap_' + d);
      if (!snap) { histBox.appendChild(U.el('div', { class: 'empty', text: '该日期暂无缓存快照' })); return; }
      showIdx(snap.indices || []);
      showSectors(snap.sectors || []);
      showNews(snap.news || []);
    }

    U.$('#newsFavTip').addEventListener('click', function () {
      U.modal({ title: '收藏说明', body: '点击任意条目右侧 ☆ 即可收藏到本地。收藏与历史快照均永久留存，不受存储模式影响。' });
    });

    // 拉取数据（联网实时）
    function loadIndices(manual) {
      if (manual) U.$('#idxSrc').innerHTML = '<span class="live-dot wait"></span> 刷新中…';
      var secids = '1.000001,0.399001,0.399006,1.000688';
      emJSON('https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=' + secids + '&fields=f12,f13,f14,f43,f168,f169,f170,f116')
        .then(function (j) {
          var list = (j.data && j.data.diff || []).map(function (d) { return { code: d.f12, name: d.f14, price: d.f43, chgPct: d.f168, chg: d.f169 }; });
          U.$('#idxSrc').innerHTML = '<span class="live-dot on"></span> 实时'; showIdx(list); saveSnap('indices', list);
        }).catch(function () { U.$('#idxSrc').innerHTML = '<span class="live-dot off"></span> 示例'; showIdx(DEMO_INDICES); saveSnap('indices', DEMO_INDICES); });
    }
    function loadSectors(manual) {
      if (manual) U.$('#secSrc').innerHTML = '<span class="live-dot wait"></span> 刷新中…';
      emJSON('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=12&po=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f3')
        .then(function (j) {
          var list = (j.data && j.data.diff || []).map(function (d) { return { code: d.f12, name: d.f14, chgPct: d.f3 }; });
          U.$('#secSrc').innerHTML = '<span class="live-dot on"></span> 实时'; showSectors(list); saveSnap('sectors', list);
        }).catch(function () { U.$('#secSrc').innerHTML = '<span class="live-dot off"></span> 示例'; showSectors(DEMO_SECTORS); saveSnap('sectors', DEMO_SECTORS); });
    }
    loadIndices(); loadSectors();
    // 资讯（示例，标注清晰）
    showNews(DEMO_NEWS); saveSnap('news', DEMO_NEWS);

    function saveSnap(key, val) {
      var snap = S.get('fin_snap_' + S.todayStr()) || {}; snap[key] = val; S.set('fin_snap_' + S.todayStr(), snap);
    }
  }

  /* ------------------- 4.3 个股分析查询 ------------------- */
  function renderStock(root) {
    var wrap = U.el('div');
    var searchCard = U.el('div', { class: 'card' });
    searchCard.appendChild(U.el('div', { class: 'card-title', text: '检索标的（代码 / 名称模糊搜索）' }));
    var row = U.el('div', { class: 'row' });
    var input = U.el('input', { class: 'input', placeholder: '输入代码或名称，如 600519 / 贵州茅台', id: 'stockQ' });
    var btn = U.el('button', { class: 'btn', text: '查询', onclick: doSearch });
    row.appendChild(input); row.appendChild(btn);
    searchCard.appendChild(row);
    var suggest = U.el('div', { id: 'stockSuggest', style: 'margin-top:8px' });
    searchCard.appendChild(suggest);
    wrap.appendChild(searchCard);

    var reportBox = U.el('div', { id: 'stockReport' });
    wrap.appendChild(reportBox);

    // 历史查询
    var histCard = U.el('div', { class: 'card' });
    histCard.appendChild(U.el('div', { class: 'card-title', text: '历史查询回溯' }));
    var histBox = U.el('div', { id: 'stockHist' }); histCard.appendChild(histBox);
    wrap.appendChild(histCard);
    root.appendChild(wrap);

    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

    function doSearch() {
      var kw = input.value.trim(); if (!kw) return;
      U.clear(suggest); suggest.appendChild(U.el('div', { class: 'muted', text: '搜索中…' }));
      searchStock(kw).then(function (list) {
        U.clear(suggest);
        if (!list.length) { suggest.appendChild(U.el('div', { class: 'empty', text: '未找到，可直接输入6位代码查询' })); return; }
        list.forEach(function (it) {
          var b = U.el('button', { class: 'btn ghost sm', style: 'margin:0 6px 6px 0', text: it.name + '(' + it.code + ')', onclick: function () { input.value = it.code; analyze(it.code); } });
          suggest.appendChild(b);
        });
      });
    }

    function analyze(code) {
      code = String(code).replace(/^(sh|sz)/i, '');
      var secid = toSecid(code);
      if (!secid) { U.toast('代码格式不正确'); return; }
      U.clear(reportBox); reportBox.appendChild(U.el('div', { class: 'empty', text: '加载行情与分析中…' }));
      Promise.all([fetchQuote(secid), fetchKline(secid, 101, 120), fetchKline(secid, 102, 60)])
        .then(function (res) { buildReport(res[0], res[1], res[2], code); saveHist(code, res[0].name); })
        .catch(function () { reportBox.innerHTML = ''; reportBox.appendChild(U.el('div', { class: 'empty', text: '行情接口暂不可用，请稍后重试（需联网）' })); });
    }

    function buildReport(q, daily, weekly, code) {
      U.clear(reportBox);
      var cl = closes(daily);
      var ma5 = MA(cl, 5), ma10 = MA(cl, 10), ma20 = MA(cl, 20);
      var macd = MACD(cl);
      var last = cl.length - 1;
      var support = Math.min.apply(null, daily.slice(-20).map(function (k) { return k.low; }));
      var resist = Math.max.apply(null, daily.slice(-20).map(function (k) { return k.high; }));
      // 评分
      var score = computeScore(q, cl, ma5, ma10, ma20, macd, last);
      // 建议
      var advice = adviceOf(score, q, ma20[last]);

      // 头部
      var head = U.el('div', { class: 'card' });
      head.appendChild(U.el('div', { class: 'card-title', text: q.name + ' (' + q.code + ')' }));
      var hg = U.el('div', { class: 'grid c3' });
      hg.appendChild(metric('现价', q.price.toFixed(2), ''));
      hg.appendChild(metric('涨跌幅', (q.chgPct >= 0 ? '+' : '') + q.chgPct.toFixed(2) + '%', q.chgPct >= 0 ? 'up' : 'down'));
      hg.appendChild(metric('换手率', (q.turnover || 0).toFixed(2) + '%', ''));
      hg.appendChild(metric('量比', (q.volumeRatio || 0).toFixed(2), ''));
      hg.appendChild(metric('成交额', (q.amount / 1e8).toFixed(2) + ' 亿', ''));
      hg.appendChild(metric('总市值', (q.mv / 1e8).toFixed(2) + ' 亿', ''));
      head.appendChild(hg);
      reportBox.appendChild(head);

      // 星级评分
      var scoreCard = U.el('div', { class: 'card' });
      scoreCard.appendChild(U.el('div', { class: 'card-title', text: '综合评分（多维度加权）' }));
      var stars = U.el('div', { style: 'font-size:28px;color:var(--yellow);letter-spacing:4px' });
      var full = Math.round(score / 20);
      stars.textContent = '★'.repeat(full) + '☆'.repeat(5 - full);
      scoreCard.appendChild(stars);
      scoreCard.appendChild(U.el('div', { class: 'muted', text: score.toFixed(0) + ' / 100 分' }));
      reportBox.appendChild(scoreCard);

      // 技术
      var tech = U.el('div', { class: 'card' });
      tech.appendChild(U.el('div', { class: 'card-title', text: '技术指标与走势' }));
      var tg = U.el('div', { class: 'grid c2' });
      tg.appendChild(metric('MA5', ma5[last].toFixed(2), ''));
      tg.appendChild(metric('MA10', ma10[last].toFixed(2), ''));
      tg.appendChild(metric('MA20', ma20[last].toFixed(2), ''));
      tg.appendChild(metric('MACD(DIF)', macd.dif[last].toFixed(3), macd.dif[last] > 0 ? 'up' : 'down'));
      tg.appendChild(metric('MACD(DEA)', macd.dea[last].toFixed(3), ''));
      tg.appendChild(metric('MACD柱', macd.macd[last].toFixed(3), macd.macd[last] > 0 ? 'up' : 'down'));
      tech.appendChild(tg);
      // K线简易走势（SVG）
      tech.appendChild(klineSvg(daily.slice(-30)));
      reportBox.appendChild(tech);

      // 支撑压力
      var sr = U.el('div', { class: 'card' });
      sr.appendChild(U.el('div', { class: 'card-title', text: '短期支撑位与压力位测算（近20日）' }));
      var sg = U.el('div', { class: 'grid c2' });
      sg.appendChild(metric('支撑位', support.toFixed(2), 'down'));
      sg.appendChild(metric('压力位', resist.toFixed(2), 'up'));
      sg.appendChild(metric('参考买入区间', (support * 1.0).toFixed(2) + ' ~ ' + (support * 1.02).toFixed(2), ''));
      sg.appendChild(metric('参考止盈区间', (resist * 0.98).toFixed(2) + ' ~ ' + resist.toFixed(2), ''));
      sr.appendChild(sg);
      reportBox.appendChild(sr);

      // 固定结论
      var concl = U.el('div', { class: 'card' });
      concl.appendChild(U.el('div', { class: 'card-title', text: '分析结论与持仓建议' }));
      var buy = (support * 1.0).toFixed(2) + ' ~ ' + (support * 1.02).toFixed(2);
      var sell = (resist * 0.98).toFixed(2) + ' ~ ' + resist.toFixed(2);
      concl.appendChild(U.el('div', { style: 'padding:10px;background:var(--brand-soft);border-radius:10px;font-weight:600', text: '持仓建议：' + advice }));
      concl.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '参考买入价位区间：' + buy }));
      concl.appendChild(U.el('div', { class: 'muted', text: '参考止盈卖出价位区间：' + sell }));
      concl.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '免责声明：本分析由公开行情数据自动生成，仅供研究参考，不构成任何投资建议。' }));
      reportBox.appendChild(concl);
    }

    function computeScore(q, cl, ma5, ma10, ma20, macd, last) {
      var s = 0;
      if (cl[last] > ma20[last]) s += 25;
      if (ma5[last] > ma10[last] && ma10[last] > ma20[last]) s += 20;
      if (macd.macd[last] > 0) s += 20;
      if (q.chgPct >= 0) s += 15; else s += 5;
      if ((q.turnover || 0) > 1 && (q.turnover || 0) < 8) s += 10;
      if ((q.volumeRatio || 0) > 1) s += 10;
      return Math.max(0, Math.min(100, s));
    }
    function adviceOf(score, q, ma20) {
      if (score >= 75) return '持有 / 逢低加仓';
      if (score >= 55) return '持有 / 观望';
      if (score >= 35) return '观望 / 减仓';
      return '空仓 / 规避';
    }
    function metric(label, val, cls) {
      var d = U.el('div', { style: 'background:var(--surface-2);border-radius:10px;padding:10px' });
      d.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px', text: label }));
      d.appendChild(U.el('div', { class: cls === 'up' ? 'up' : cls === 'down' ? 'down' : '', style: 'font-weight:700;font-size:15px', text: val }));
      return d;
    }
    function klineSvg(daily) {
      var w = 600, h = 160, pad = 10;
      var lows = daily.map(function (k) { return k.low; }), highs = daily.map(function (k) { return k.high; });
      var min = Math.min.apply(null, lows), max = Math.max.apply(null, highs);
      var cw = (w - pad * 2) / daily.length;
      var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="margin-top:10px">';
      daily.forEach(function (k, i) {
        var x = pad + i * cw + cw / 2;
        var yO = h - pad - (k.open - min) / (max - min) * (h - pad * 2);
        var yC = h - pad - (k.close - min) / (max - min) * (h - pad * 2);
        var yH = h - pad - (k.high - min) / (max - min) * (h - pad * 2);
        var yL = h - pad - (k.low - min) / (max - min) * (h - pad * 2);
        var col = k.close >= k.open ? '#f5222d' : '#16a34a';
        svg += '<line x1="' + x + '" y1="' + yH + '" x2="' + x + '" y2="' + yL + '" stroke="' + col + '" stroke-width="1"/>';
        svg += '<rect x="' + (x - cw * 0.3) + '" y="' + Math.min(yO, yC) + '" width="' + (cw * 0.6) + '" height="' + Math.abs(yC - yO) + '" fill="' + col + '"/>';
      });
      // MA20 线
      svg += '</svg>';
      var wrapSvg = U.el('div');
      wrapSvg.innerHTML = svg;
      return wrapSvg.firstChild;
    }

    function saveHist(code, name) {
      var h = S.getFinQueryHistory();
      if (!h.some(function (x) { return x.code === code; })) { h.unshift({ code: code, name: name, date: S.todayStr() }); S.setFinQueryHistory(h.slice(0, 30)); }
      renderHist();
    }
    function renderHist() {
      U.clear(histBox);
      var h = S.getFinQueryHistory();
      if (!h.length) { histBox.appendChild(U.el('div', { class: 'empty', text: '暂无历史查询' })); return; }
      h.forEach(function (x) {
        histBox.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin:0 6px 6px 0', text: x.name + '(' + x.code + ')', onclick: function () { input.value = x.code; analyze(x.code); } }));
      });
    }
    renderHist();
  }
})();
