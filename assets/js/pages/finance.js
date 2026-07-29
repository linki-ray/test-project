/* =========================================================
   页面 4：全球金融热点（A股）
   4.1 大盘 / 板块 / 资讯 + 收藏 + 历史缓存
   4.2 两套筛选策略（资金主力 / 明哥策略）
   4.3 个股综合分析查询（行情 / K线 / MACD / 支撑压力 / 星级 / 建议）
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
  function isExcluded(code) {
    // 排除 科创板(688) / 北交所(8xxxx,4xxxx) / ST
    if (/^688/.test(code)) return '科创板';
    if (/^[84]/.test(code)) return '北交所';
    return null;
  }
  function isST(name) { return /ST|\*ST/i.test(name || ''); }

  function emJSON(url) {
    return U.fetchJSON(url, 9000).then(function (j) { return j; });
  }

  /* ---------- 指标计算 ---------- */
  function closes(klines) { return klines.map(function (k) { return k.close; }); }
  function MA(arr, n) {
    var out = []; for (var i = 0; i < arr.length; i++) { if (i < n - 1) { out.push(null); continue; } var s = 0; for (var j = 0; j < n; j++) s += arr[i - j]; out.push(s / n); } return out;
  }
  function angleDeg(maArr, idx) {
    // idx 处 MA 斜率角度（基于 idx 与 idx-1）
    if (!maArr[idx] || !maArr[idx - 1]) return null;
    var d = (maArr[idx] - maArr[idx - 1]) / maArr[idx - 1];
    return Math.atan(d) * 180 / Math.PI;
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
  var DEMO_SCREEN = [
    { code: '600519', name: '贵州茅台', price: 1685, chgPct: 1.2, mainNet: 6.8e8, mainRatio: 0.4, industry: '酿酒', ma5a: 6.2, ma10a: 5.6, preClosePressure: 1660, prevPressure: 1645, close: 1685, low: 1672, rev: 1.2e11, np: 4.5e10, deduct: 4.4e10, control: 31, ma10: 1655, pass: true },
    { code: '000725', name: '京东方A', price: 4.2, chgPct: 2.4, mainNet: 5.6e8, mainRatio: 0.6, industry: '光学光电子', ma5a: 7.1, ma10a: 6.0, preClosePressure: 4.1, prevPressure: 4.0, close: 4.2, low: 4.12, rev: 1.4e10, np: 2.0e9, deduct: 1.8e9, control: 28, ma10: 4.05, pass: true },
    { code: '300750', name: '宁德时代', price: 198, chgPct: 1.8, mainNet: 9.1e8, mainRatio: 0.9, industry: '电池', ma5a: 6.5, ma10a: 5.8, preClosePressure: 195, prevPressure: 192, close: 198, low: 194, rev: 3.6e10, np: 4.4e9, deduct: 4.0e9, control: 33, ma10: 193, pass: true }
  ];

  /* ============================================================
     主渲染
     ============================================================ */
  App.pages['finance'] = function (root) {
    U.clear(root);
    var view = 'hot'; // hot | strategy | stock

    var tabBar = U.el('div', { class: 'filter-bar', id: 'finTabs' });
    [['hot', 'A股股票热点'], ['strategy', '自动筛选策略'], ['stock', '个股分析查询']].forEach(function (t) {
      tabBar.appendChild(U.el('span', { class: 'tag' + (view === t[0] ? ' active' : ''), text: t[1], onclick: function () { view = t[0]; renderTabs(); box.innerHTML = ''; renderView(); } }));
    });
    root.appendChild(tabBar);
    var box = U.el('div', { id: 'finBox' });
    root.appendChild(box);

    function renderTabs() {
      U.$all('#finTabs .tag').forEach(function (t) { /* active managed by text match */ });
      U.clear(tabBar);
      [['hot', 'A股股票热点'], ['strategy', '自动筛选策略'], ['stock', '个股分析查询']].forEach(function (t) {
        tabBar.appendChild(U.el('span', { class: 'tag' + (view === t[0] ? ' active' : ''), text: t[1], onclick: function () { view = t[0]; renderTabs(); box.innerHTML = ''; renderView(); } }));
      });
    }
    function renderView() {
      if (view === 'hot') renderHot(box);
      else if (view === 'strategy') renderStrategy(box);
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
    idxCard.appendChild(U.el('div', { class: 'card-title', html: '当日大盘 <span class="card-sub" id="idxSrc"></span>' }));
    var idxBox = U.el('div'); idxCard.appendChild(idxBox);
    wrap.appendChild(idxCard);

    // 板块题材
    var secCard = U.el('div', { class: 'card' });
    secCard.appendChild(U.el('div', { class: 'card-title', html: '板块题材 <span class="card-sub" id="secSrc"></span>' }));
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

    // 收藏列表
    function favBar() {
      var f = S.getTags('fin_fav') && JSON.parse(localStorage.getItem('ws_fin_fav') || '[]');
      return f || [];
    }
    function addFav(item) {
      var f = favBar(); f.push(item); localStorage.setItem('ws_fin_fav', JSON.stringify(f)); U.toast('已收藏：' + item.name);
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

    // 拉取数据
    // 大盘
    var secids = '1.000001,0.399001,0.399006,1.000688';
    emJSON('https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=' + secids + '&fields=f12,f13,f14,f43,f168,f169,f170,f116')
      .then(function (j) {
        var list = (j.data && j.data.diff || []).map(function (d) { return { code: d.f12, name: d.f14, price: d.f43, chgPct: d.f168, chg: d.f169 }; });
        U.$('#idxSrc').textContent = '· 实时'; showIdx(list); saveSnap('indices', list);
      }).catch(function () { U.$('#idxSrc').textContent = '· 示例'; showIdx(DEMO_INDICES); saveSnap('indices', DEMO_INDICES); });

    // 板块
    emJSON('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=12&po=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f3')
      .then(function (j) {
        var list = (j.data && j.data.diff || []).map(function (d) { return { code: d.f12, name: d.f14, chgPct: d.f3 }; });
        U.$('#secSrc').textContent = '· 实时'; showSectors(list); saveSnap('sectors', list);
      }).catch(function () { U.$('#secSrc').textContent = '· 示例'; showSectors(DEMO_SECTORS); saveSnap('sectors', DEMO_SECTORS); });

    // 资讯（示例，标注清晰）
    showNews(DEMO_NEWS); saveSnap('news', DEMO_NEWS);

    function saveSnap(key, val) {
      var snap = S.get('fin_snap_' + S.todayStr()) || {}; snap[key] = val; S.set('fin_snap_' + S.todayStr(), snap);
    }
  }

  /* ------------------- 4.2 筛选策略 ------------------- */
  function renderStrategy(root) {
    var wrap = U.el('div');
    var intro = U.el('div', { class: 'card' });
    intro.appendChild(U.el('div', { class: 'card-title', html: 'A股自动筛选策略 <span class="demo-badge" id="strSrc">示例数据</span>' }));
    intro.appendChild(U.el('div', { class: 'muted', text: '数据源：东方财富行情（实时优先，不可用时回退示例）。所有策略仅作客观筛选展示，不构成投资建议。' }));
    var btnRow = U.el('div', { class: 'row wrap', style: 'margin-top:10px' });
    btnRow.appendChild(U.el('button', { class: 'btn sm', text: '① 资金主力筛选', onclick: function () { runFund(); } }));
    btnRow.appendChild(U.el('button', { class: 'btn sm', text: '② 明哥策略', onclick: function () { runMing(); } }));
    intro.appendChild(btnRow);
    wrap.appendChild(intro);

    var resultBox = U.el('div', { id: 'strResult' });
    wrap.appendChild(resultBox);
    root.appendChild(wrap);

    function loading(msg) { U.clear(resultBox); resultBox.appendChild(U.el('div', { class: 'empty', text: msg })); }

    /* 资金主力筛选：东方财富主力净流入榜 */
    function runFund() {
      loading('正在拉取主力资金净流入榜…');
      var url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=60&po=1&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f62,f184,f3,f100';
      emJSON(url).then(function (j) {
        var rows = (j.data && j.data.diff || []).map(function (d) {
          return { code: d.f12, name: d.f14, mainNet: (d.f62 || 0), mainRatio: (d.f184 || 0), chgPct: (d.f3 || 0), industry: d.f100 || '—' };
        }).filter(function (x) {
          if (isST(x.name)) return false;
          if (isExcluded(x.code)) return false;
          if (x.mainNet > 50000000 && x.mainRatio > 0.1) return true;
          return false;
        });
        U.$('#strSrc').textContent = '· 实时';
        renderFund(rows);
      }).catch(function () { U.$('#strSrc').textContent = '· 示例'; renderFund(DEMO_SCREEN.filter(function (x) { return x.mainNet > 50000000 && x.mainRatio > 0.1; })); });
    }
    function renderFund(rows) {
      U.clear(resultBox);
      if (!rows.length) { resultBox.appendChild(U.el('div', { class: 'empty', text: '当前无满足条件个股' })); return; }
      resultBox.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:8px', text: '硬性条件：近1日主力净额＞5000万 且 主力净量占流通盘＞0.1%；已剔除 ST / 科创板 / 北交所。命中 ' + rows.length + ' 只' }));
      rows.forEach(function (x) {
        var c = U.el('div', { class: 'card' });
        c.appendChild(U.el('div', { style: 'font-weight:700', text: x.name + ' (' + x.code + ')' }));
        var g = U.el('div', { class: 'grid c3', style: 'margin-top:8px' });
        g.appendChild(metric('主力净额', (x.mainNet / 1e8).toFixed(2) + ' 亿', 'up'));
        g.appendChild(metric('主力净占比', x.mainRatio.toFixed(2) + '%', 'up'));
        g.appendChild(metric('涨跌幅', (x.chgPct >= 0 ? '+' : '') + x.chgPct.toFixed(2) + '%', x.chgPct >= 0 ? 'up' : 'down'));
        g.appendChild(metric('所属行业', x.industry, ''));
        c.appendChild(g);
        resultBox.appendChild(c);
      });
    }

    /* 明哥策略：全硬性筛选 */
    function runMing() {
      loading('正在按明哥策略筛选（需行情+K线+财务）…');
      // 候选池：先用主力榜拿到一批主板/创业板标的，再逐个校验技术条件
      var url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=80&po=1&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f62';
      emJSON(url).then(function (j) {
        var cands = (j.data && j.data.diff || []).map(function (d) { return { code: d.f12, name: d.f14 }; })
          .filter(function (x) { return !isST(x.name) && !isExcluded(x.code); });
        verifyMing(cands, false);
      }).catch(function () { verifyMing(DEMO_SCREEN.map(function (x) { return { code: x.code, name: x.name }; }), true); });
    }

    function verifyMing(cands, demo) {
      var results = [], pending = cands.slice(0, demo ? cands.length : 40), done = 0;
      if (demo) { U.$('#strSrc').textContent = '· 示例'; renderMing(DEMO_SCREEN); return; }
      U.$('#strSrc').textContent = '· 实时';
      if (!pending.length) { renderMing([]); return; }
      pending.forEach(function (c) {
        var secid = toSecid(c.code);
        Promise.all([fetchKline(secid, 101, 60), fetchQuote(secid)]).then(function (res) {
          var kl = res[0], q = res[1];
          var r = evaluateMing(kl, q, c);
          if (r.pass) results.push(r);
        }).catch(function () { /* skip */ }).then(function () {
          done++; if (done === pending.length) renderMing(results);
        });
      });
    }

    function evaluateMing(kl, q, c) {
      var cl = closes(kl);
      var ma5 = MA(cl, 5), ma10 = MA(cl, 10);
      var last = cl.length - 1;
      // 昨日(索引 last-1) 的 MA 角度
      var ma5a = angleDeg(ma5, last - 1), ma10a = angleDeg(ma10, last - 1);
      // 压力位：昨日压力位 = 前日最高(last-2)，前日压力位 = 大前日最高(last-3)
      var preClosePressure = kl[last - 2] ? kl[last - 2].high : null;
      var prevPressure = kl[last - 3] ? kl[last - 3].high : null;
      var close = q.price, low = q.low, ma10v = ma10[last];
      var ratio1 = (preClosePressure ? close / preClosePressure : null);
      var ratio2 = (preClosePressure && prevPressure ? (close / preClosePressure) - (close / prevPressure) : null);
      // 财务（示例/实时占位；东方财富个股财务需额外接口，暂用实时报价估算标记）
      var rev = q.amount ? q.amount * 240 : null; // 估算占位
      var np = null, deduct = null, control = null;
      var conditions = {
        c1: false, c2: (ma5a !== null && ma5a > 5) && (ma10a !== null && ma10a > 5),
        c3: false, c4: (ma10v !== null && low > ma10v), c5: false, c6: (ratio1 !== null && ratio1 > 1 && ratio1 < 1.2),
        c7: true, c8: true
      };
      // pass 仅基于可计算的技术条件 + 标记财务待补
      var pass = conditions.c2 && conditions.c4 && conditions.c6;
      return {
        code: c.code, name: c.name, price: close, ma5a: ma5a, ma10a: ma10a,
        rev: rev, np: np, deduct: deduct, control: control, ma10: ma10v,
        preClosePressure: preClosePressure, prevPressure: prevPressure,
        ratio1: ratio1, ratio2: ratio2, low: low, conditions: conditions, pass: pass, live: true
      };
    }

    function renderMing(rows) {
      U.clear(resultBox);
      resultBox.appendChild(U.el('div', { class: 'card' }));
      var head = U.el('div', { class: 'card-title', text: '明哥策略 · 全硬性筛选结果' });
      resultBox.appendChild(head);
      if (!rows.length) { resultBox.appendChild(U.el('div', { class: 'empty', text: '当前无完全命中个股（技术条件较苛刻）' })); return; }
      resultBox.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:8px', text: '命中 ' + rows.length + ' 只。财务/控盘字段标注「待数据源」者，需接入付费行情终端方可精确计算。' }));
      rows.forEach(function (x) {
        var c = U.el('div', { class: 'card' });
        c.appendChild(U.el('div', { style: 'font-weight:700', text: x.name + ' (' + x.code + ')' }));
        var g = U.el('div', { class: 'grid c2', style: 'margin-top:8px' });
        g.appendChild(metric('现价', x.price.toFixed(2), ''));
        g.appendChild(metric('昨日MA5角度', x.ma5a != null ? x.ma5a.toFixed(2) + '°' : '—', x.ma5a > 5 ? 'up' : ''));
        g.appendChild(metric('昨日MA10角度', x.ma10a != null ? x.ma10a.toFixed(2) + '°' : '—', x.ma10a > 5 ? 'up' : ''));
        g.appendChild(metric('当日最低>MA10', x.ma10 != null ? ('最低' + x.low.toFixed(2) + ' / MA10 ' + x.ma10.toFixed(2)) : '—', 'up'));
        g.appendChild(metric('昨日压力位(前日高)', x.preClosePressure != null ? x.preClosePressure.toFixed(2) : '—', ''));
        g.appendChild(metric('收盘价/昨日压力位', x.ratio1 != null ? x.ratio1.toFixed(3) : '—', (x.ratio1 > 1 && x.ratio1 < 1.2) ? 'up' : ''));
        g.appendChild(metric('比值差(今-前日压力)', x.ratio2 != null ? x.ratio2.toFixed(3) : '—', ''));
        g.appendChild(metric('营业总收入', '待数据源', ''));
        g.appendChild(metric('归母净利润', '待数据源', ''));
        g.appendChild(metric('扣非净利润', '待数据源', ''));
        g.appendChild(metric('主力控盘比例', '待数据源', ''));
        c.appendChild(g);
        c.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '硬性条件：价格突破昨日压力位 ✓ · MA角度>5° ✓ · 最低>MA10 ✓ · 比值∈(1,1.2) ✓ · 财务/控盘待补' }));
        resultBox.appendChild(c);
      });
    }

    function metric(label, val, cls) {
      var d = U.el('div', { style: 'background:var(--surface-2);border-radius:10px;padding:10px' });
      d.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px', text: label }));
      d.appendChild(U.el('div', { class: cls === 'up' ? 'up' : cls === 'down' ? 'down' : '', style: 'font-weight:700;font-size:15px', text: val }));
      return d;
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
