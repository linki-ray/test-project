/* =========================================================
   页面 4：全球金融热点（A股）
   4.1 大盘 / 板块 / 资讯 + 收藏 + 历史缓存
   4.3 个股综合分析查询（行情 / K线 / MACD / 支撑压力 / 星级 / 建议）
   注：原 4.2 自动筛选策略为私有策略，
       已从公开代码中移除，不随本仓库分发。
   数据源：
   - 大盘 / 个股行情 / 板块龙头：腾讯自选股行情 qt.gtimg.cn（浏览器 JSONP，GBK 原生解码，中文正常）
   - 个股 K线历史：新浪财经，经 Cloudflare 函数 /api/kline 代理（绕开浏览器跨域）
   - 字段映射（换手率/量比/总市值）已用通达信实时行情离线交叉校验，不作任何假数据回退。
   接口不可用时明确提示「获取失败」，不再回退假数据。
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  var U = App.U, S = App.Store;

  /* ---------- 腾讯行情（前端 JSONP 直连；浏览器原生解码 GBK，中文正常） ---------- */
  function tencentCode(code) {
    code = String(code).replace(/^(sh|sz|bj)/i, '').toLowerCase();
    if (/^\d{6}$/.test(code)) {
      // 6=沪市主板；5=沪市ETF/LOF；8/4=北交所；其余(0/2/3/1)=深市
      if (code[0] === '6' || code[0] === '5') return 'sh' + code;
      if (code[0] === '8' || code[0] === '4') return 'bj' + code;
      return 'sz' + code;
    }
    return code;
  }
  function parseTencentRaw(raw) {
    var p = raw.split('~');
    var amount = 0; if (p[35]) { var parts = p[35].split('/'); amount = parseFloat(parts[2]) || 0; }
    return {
      code: p[2] || '', name: p[1] || '',
      price: parseFloat(p[3]) || 0, prevClose: parseFloat(p[4]) || 0, open: parseFloat(p[5]) || 0,
      chg: parseFloat(p[31]) || 0, chgPct: parseFloat(p[32]) || 0,
      high: parseFloat(p[33]) || 0, low: parseFloat(p[34]) || 0,
      // 经通达信实时行情交叉校验（2026-07-30）：
      //   换手率 = p[38]（茅台 0.57% / 宁德 1.06%，与通达信 HSL 吻合）
      //   量比   = p[49]（茅台 1.66 / 宁德 1.21，与通达信 LB 吻合；p[43] 为其他技术指标，非量比）
      //   总市值 = p[45]（亿元，茅台 17023 亿 / 宁德 18594 亿，与通达信 ZSZ 吻合）
      //   成交额字符串在 p[35]，成交额(万) 在 p[37]
      turnover: parseFloat(p[38]) || 0, pe: parseFloat(p[39]) || 0,
      amount: amount, volumeRatio: parseFloat(p[49]) || 0,
      mv: parseFloat(p[45]) ? parseFloat(p[45]) * 1e8 : (parseFloat(p[44]) ? parseFloat(p[44]) * 1e8 : 0)
    };
  }
  function jsonpTencent(secids) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://qt.gtimg.cn/q=' + secids;
      s.onload = function () {
        var out = [];
        secids.split(',').forEach(function (code) {
          var raw = window['v_' + code];
          if (typeof raw === 'string' && raw.indexOf('~') > -1) {
            var item = parseTencentRaw(raw);
            item._code = code; // 保留原始带前缀代码，便于后续精确匹配
            out.push(item);
          }
        });
        resolve(out); s.remove();
      };
      s.onerror = function () { resolve([]); s.remove(); };
      document.body.appendChild(s);
    });
  }

  /* ---------- 工具：生成统一代码（sh600519 / sz300750 / bj...） ---------- */
  function marketCode(code) {
    code = String(code).replace(/\s/g, '').toLowerCase();
    if (/^(sh|sz|bj)\d{6}$/.test(code)) return code;
    if (/^\d{6}$/.test(code)) {
      // 6=沪市主板；5=沪市ETF/LOF；8/4=北交所；其余(0/2/3/1)=深市
      if (code[0] === '6' || code[0] === '5') return 'sh' + code;
      if (code[0] === '8' || code[0] === '4') return 'bj' + code;
      return 'sz' + code;
    }
    return code;
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

  /* ---------- 新浪 K线（经 Cloudflare /api/kline 代理，绕开浏览器跨域） ---------- */
  function fetchKline(symbol, scale, datalen) {
    var base = (window.APP_CONFIG && window.APP_CONFIG.KLINE_API) || '/api/kline';
    var url = base + '?symbol=' + encodeURIComponent(symbol) +
      '&scale=' + (scale || 240) + '&datalen=' + (datalen || 120);
    return U.fetchJSON(url, 12000).then(function (j) {
      if (!j || !j.ok || !j.items || !j.items.length) throw new Error('no kline');
      return j.items.map(function (d) {
        return { date: d.date, open: +d.open, close: +d.close, high: +d.high, low: +d.low, vol: +d.vol };
      });
    });
  }

  /* ---------- 通用可视化组件 ---------- */
  function metric(label, val, cls) {
    var d = U.el('div', { style: 'background:var(--surface-2);border-radius:10px;padding:10px' });
    d.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px', text: label }));
    d.appendChild(U.el('div', { class: cls === 'up' ? 'up' : cls === 'down' ? 'down' : '', style: 'font-weight:700;font-size:15px', text: val }));
    return d;
  }
  function klineSvg(daily, opts) {
    opts = opts || {};
    var w = opts.width || 600, h = opts.height || 160, pad = 10;
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
    svg += '</svg>';
    var wrapSvg = U.el('div');
    wrapSvg.innerHTML = svg;
    return wrapSvg.firstChild;
  }

  function searchStock(kw) {
    // 腾讯 smartbox 实际返回全局变量：v_hint="sh~600519~贵州茅台~gzmt~GP-A"
    // （部分旧接口返回 v_smartbox=[...] 数组，这里一并兼容）
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      var done = false;
      try { delete window.v_hint; } catch (e) {}
      try { delete window.v_smartbox; } catch (e) {}
      function finish() {
        if (done) return; done = true;
        var out = [];
        try {
          var raw = window.v_hint;
          if (typeof raw === 'string' && raw && raw !== 'N') {
            var parts = raw.split('~');
            var market = parts[0], code = parts[1], name = parts[2];
            if (code && name && /^\d{6}$/.test(code)) out.push({ code: code, name: name, market: market });
          }
          if (Array.isArray(window.v_smartbox)) {
            window.v_smartbox.forEach(function (g) {
              if (g && Array.isArray(g) && g[0] === 'stock' && g[1] && g[2]) out.push({ code: g[1], name: g[2], market: g[4] });
            });
          }
        } catch (e) {}
        resolve(out.slice(0, 12));
        try { s.remove(); } catch (e) {}
      }
      s.onload = finish;
      s.onerror = function () { resolve([]); try { s.remove(); } catch (e) {} };
      s.src = 'https://smartbox.gtimg.cn/s3/?t=all&q=' + encodeURIComponent(kw);
      document.body.appendChild(s);
      setTimeout(finish, 6000); // 兜底：避免脚本异常导致一直 pending
    });
  }

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
    newsCard.appendChild(U.el('div', { class: 'card-title' }, [
      document.createTextNode('市场资讯 '),
      U.el('span', { class: 'src-tag', id: 'newsSrc' }),
      U.el('button', { class: 'btn ghost xs', style: 'float:right;margin-top:-2px', text: '🔄 刷新', onclick: function () { loadNews(true); } }),
      U.el('button', { class: 'btn ghost xs', style: 'float:right;margin-top:-2px;margin-right:6px', text: '收藏说明', onclick: function () { U.modal({ title: '收藏说明', body: '点击任意条目右侧 ☆ 即可收藏到本地。收藏与历史快照均永久留存，不受存储模式影响。' }); } })
    ]));
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
      var grid = U.el('div', { class: 'grid c2' });
      list.forEach(function (x) {
        var up = x.chgPct >= 0;
        var c = U.el('div', { class: 'stat-card', style: 'position:relative;text-align:left' });
        var top = U.el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' });
        top.appendChild(U.el('div', { style: 'font-weight:700;font-size:14px', text: x.name }));
        top.appendChild(U.el('button', { class: 'icon-btn', html: '☆', title: '收藏', style: 'margin:-6px -6px 0 0', onclick: function () { addFav({ type: 'index', name: x.name, code: x.code, price: x.price, chgPct: x.chgPct }); } }));
        c.appendChild(top);
        c.appendChild(U.el('div', { style: 'font-size:22px;font-weight:800;margin:8px 0 4px;color:' + (up ? 'var(--red)' : 'var(--green)'), text: x.price.toFixed(2) }));
        c.appendChild(U.el('div', { style: 'font-size:13px;font-weight:700;color:' + (up ? 'var(--red)' : 'var(--green)'), text: (up ? '+' : '') + x.chgPct.toFixed(2) + '% · ' + (up ? '+' : '') + x.chg.toFixed(2) }));
        grid.appendChild(c);
      });
      idxBox.appendChild(grid);
    }
    function showSectors(list) {
      U.clear(secBox);
      list.forEach(function (x) {
        var up = x.chgPct >= 0;
        var c = U.el('div', {
          class: 'card',
          style: 'margin-bottom:0;background:var(--surface-2);padding:12px;cursor:pointer',
          onclick: function () { showSectorDetail(x.code, x.name, x.lead); }
        });
        c.appendChild(U.el('div', { style: 'font-weight:600', text: x.name + (x.lead ? ' · ' + x.lead : '') }));
        c.appendChild(U.el('div', { class: up ? 'up' : 'down', style: 'font-weight:700', text: (up ? '+' : '') + x.chgPct.toFixed(2) + '%' }));
        c.appendChild(U.el('button', {
          class: 'icon-btn', html: '☆', style: 'float:right;margin-top:-28px',
          onclick: function (e) { e.stopPropagation(); addFav({ type: 'sector', name: x.name, chgPct: x.chgPct }); }
        }));
        secBox.appendChild(c);
      });
    }
    function showSectorDetail(code, name, lead) {
      var body = U.el('div');
      body.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '加载 ' + (lead || code) + ' K线…' }));
      U.modal({ title: name + ' · 板块ETF走势', body: body });
      Promise.all([jsonpTencent(code), fetchKline(code, 240, 90)])
        .then(function (res) {
          var q = res[0] && res[0][0], daily = res[1];
          if (!q || !daily || !daily.length) throw new Error('empty');
          U.clear(body);
          var up = q.chgPct >= 0;
          var hg = U.el('div', { class: 'grid c3' });
          hg.appendChild(metric('现价', q.price.toFixed(2), ''));
          hg.appendChild(metric('涨跌幅', (up ? '+' : '') + q.chgPct.toFixed(2) + '%', up ? 'up' : 'down'));
          hg.appendChild(metric('成交额', (q.amount / 1e8).toFixed(2) + ' 亿', ''));
          body.appendChild(hg);
          body.appendChild(klineSvg(daily.slice(-40), { height: 180 }));
          body.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px;font-size:12px', text: '数据来源：新浪财经日K线，近 90 个交易日' }));
        }).catch(function () {
          U.clear(body);
          body.appendChild(U.el('div', { class: 'empty', text: 'K线加载失败，请检查网络或稍后重试' }));
        });
    }
    function showNews(list) {
      U.clear(newsBox);
      list.forEach(function (n) {
        var r = U.el('div', { class: 'quote-row' });
        var titleEl = U.el('div', { style: 'cursor:pointer', text: n.title, onclick: function () { if (n.url) window.open(n.url, '_blank'); } });
        r.appendChild(U.el('div', {}, [titleEl, U.el('div', { class: 'muted', text: n.time + ' · ' + (n.tag || '') })]));
        r.appendChild(U.el('button', { class: 'icon-btn', html: '☆', onclick: function () { addFav({ type: 'news', name: n.title, time: n.time, url: n.url }); } }));
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

    // 拉取数据（联网实时）
    function loadIndices(manual) {
      if (manual) U.$('#idxSrc').innerHTML = '<span class="live-dot wait"></span> 刷新中…';
      jsonpTencent('sh000001,sz399001,sz399006,sh000688')
        .then(function (list) {
          if (!list || !list.length) throw new Error('empty');
          showIdx(list); saveSnap('indices', list);
          U.$('#idxSrc').innerHTML = '<span class="live-dot on"></span> 实时';
        }).catch(function () {
          U.$('#idxSrc').innerHTML = '<span class="live-dot off"></span> 获取失败';
          if (!manual) U.toast('大盘数据获取失败，请检查网络或稍后重试');
        });
    }
    // 板块题材：用板块 ETF 直接跟踪各行业实时涨跌（腾讯自选股 qt.gtimg.cn）
    var SECTOR_ETFS = [
      { name: '酿酒', code: 'sh512690', lead: '酒ETF鹏华' },
      { name: '半导体', code: 'sh512480', lead: '半导体ETF国联安' },
      { name: '新能源', code: 'sh516160', lead: '新能源ETF南方' },
      { name: '银行', code: 'sh512800', lead: '银行ETF华宝' },
      { name: '券商', code: 'sh512000', lead: '券商ETF华宝' },
      { name: '医药', code: 'sh512010', lead: '医药ETF易方达' },
      { name: '地产', code: 'sh512200', lead: '房地产ETF南方' },
      { name: '家电', code: 'sz159996', lead: '家电ETF国泰' }
    ];
    function loadSectors(manual) {
      if (manual) U.$('#secSrc').innerHTML = '<span class="live-dot wait"></span> 刷新中…';
      var allCodes = SECTOR_ETFS.map(function (s) { return s.code; }).join(',');
      jsonpTencent(allCodes)
        .then(function (list) {
          if (!list || !list.length) throw new Error('empty');
          var byCode = {};
          // 优先用 jsonpTencent 返回的原始带前缀代码 _code 匹配；兜底用 marketCode
          list.forEach(function (x) { byCode[x._code || marketCode(x.code)] = x; });
          var out = SECTOR_ETFS.map(function (s) {
            var q = byCode[s.code];
            return { name: s.name, chgPct: q ? q.chgPct : 0, lead: s.lead, code: s.code };
          });
          out.sort(function (a, b) { return b.chgPct - a.chgPct; }); // 涨幅降序：涨的板块排前面
          showSectors(out); saveSnap('sectors', out);
          U.$('#secSrc').innerHTML = '<span class="live-dot on"></span> 腾讯实时';
        }).catch(function () {
          U.$('#secSrc').innerHTML = '<span class="live-dot off"></span> 获取失败';
        });
    }
    loadIndices(); loadSectors(); loadNews();

    // 市场资讯（新浪财经全球财经快讯，实时更新）
    function loadNews(manual) {
      if (manual) U.$('#newsSrc').innerHTML = '<span class="live-dot wait"></span> 刷新中…';
      var base = (window.APP_CONFIG && window.APP_CONFIG.NEWS_API) || '/api/news';
      U.fetchJSON(base + '?num=20', 12000)
        .then(function (j) {
          if (!j || !j.ok || !j.items || !j.items.length) throw new Error('empty');
          showNews(j.items); saveSnap('news', j.items);
          U.$('#newsSrc').innerHTML = '<span class="live-dot on"></span> 新浪财经';
        }).catch(function () {
          U.$('#newsSrc').innerHTML = '<span class="live-dot off"></span> 获取失败';
        });
    }

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
        if (list.length) {
          list.forEach(function (it) {
            var b = U.el('button', { class: 'btn ghost sm', style: 'margin:0 6px 6px 0', text: it.name + '(' + it.code + ')', onclick: function () { input.value = it.code; analyze(it.code); } });
            suggest.appendChild(b);
          });
          return;
        }
        // 搜索无结果：若输入为 6 位代码，直接分析（腾讯模糊匹配有时仅返回核心词）
        if (/^\d{6}$/.test(kw)) {
          suggest.appendChild(U.el('div', { class: 'muted', text: '未匹配到名称，已按代码 ' + kw + ' 直接查询 ↓' }));
          analyze(kw);
          return;
        }
        suggest.appendChild(U.el('div', { class: 'empty', text: '未找到，请输入 6 位代码（如 600519）或完整股票名（如 贵州茅台）' }));
      });
    }

    function analyze(code) {
      code = String(code).replace(/^(sh|sz|bj)/i, '');
      U.clear(reportBox); reportBox.appendChild(U.el('div', { class: 'empty', text: '加载行情与分析中…' }));
      var sym = marketCode(code);
      Promise.all([
        jsonpTencent(sym),
        fetchKline(sym, 240, 120)
      ]).then(function (res) {
        var qlist = res[0], daily = res[1];
        if (!qlist || !qlist.length) throw new Error('quote failed');
        var q = qlist[0];
        if (!daily || !daily.length) throw new Error('kline failed');
        buildReport(q, daily, [], code); saveHist(code, q.name);
      }).catch(function () {
        reportBox.innerHTML = ''; reportBox.appendChild(U.el('div', { class: 'empty', text: '行情接口暂不可用，请稍后重试（需联网）' }));
      });
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
