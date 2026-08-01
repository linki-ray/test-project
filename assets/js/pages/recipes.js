/* ============================================================
   今日菜谱 —— 分类浏览 / 今日吃什么转盘 / 一键做菜指南 / 导入菜单
   - 二级类目下拉选分类 → 菜品网格（一行 4 个、默认仅前 10 道）→ 点开看纯文字做法
   - 今日吃什么：肉菜 / 青菜 / 汤 三个独立转盘，各自多选预选，已选不重复抽取
   - 一键生成做菜指南：按 肉菜 / 青菜 / 汤 分组，每道单独罗列
   - 导入菜单：粘贴小红书/抖音链接经服务端解析（标题+正文+封面），或粘贴文字规则解析
   - 菜谱数据全部来自 菜单/*.docx 提取（真实菜名/食材/做法，缺内容的空条目不入库）
   - 纯文字卡片，无图片占位（无图源）
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};
(function () {
  var U = App.U, S = App.Store;
  var API = (window.APP_CONFIG && window.APP_CONFIG.PARSE_API) || 'https://test-project-ek2.pages.dev/api/parse-link';

  /* ---------- 分类体系（下拉用，type 复用其中 id） ---------- */
  var CATS = [
    { group: '菜系', items: [
      { id: 'guangdong', name: '广东菜' }, { id: 'hunan', name: '湖南菜' },
      { id: 'sichuan', name: '四川菜' }, { id: 'thai', name: '泰国菜' },
      { id: 'western', name: '西式' }, { id: 'dongbei', name: '东北菜' }
    ] },
    { group: '食材', items: [
      { id: 'seafood', name: '海鲜' }, { id: 'veg', name: '素菜' },
      { id: 'meat', name: '肉菜' }, { id: 'poultry', name: '禽蛋' }
    ] },
    { group: '做法', items: [
      { id: 'baking', name: '烘焙' }, { id: 'soup', name: '汤羹' }, { id: 'cold', name: '凉拌' }
    ] },
    { group: '餐别', items: [
      { id: 'breakfast', name: '早餐' }, { id: 'lunch', name: '午餐' },
      { id: 'dinner', name: '晚餐' }, { id: 'late', name: '宵夜' }
    ] }
  ];
  var catMap = {};
  CATS.forEach(function (g) { g.items.forEach(function (it) { catMap[it.id] = it.name; }); });

  /* 菜谱数据来自 菜单/*.docx 提取（scripts/gen_recipes.py 生成 recipes-extra.js），真实菜名/食材/做法 */
  var RECIPES = (window.__EXTRA_RECIPES__ || []).map(function (d) {
    return {
      id: d.id, name: d.name, type: d.type, cats: d.cats,
      hue: (d.hue == null ? 0 : d.hue),
      ingredients: d.ingredients || [], steps: d.steps || [], text: d.text || ''
    };
  });

  /* ---------- 存储 ---------- */
  var IMPORT_KEY = 'recipes_imported';
  var PRESELECT_KEY = 'recipes_preselect_v2'; // 2026-08-02：旧版 doc-1 跨文档重复，升级 key 弃用错乱旧数据
  function getImported() { return S.get(IMPORT_KEY, []); }
  function setImported(a) { S.set(IMPORT_KEY, a); }
  function getPreselect() { return S.get(PRESELECT_KEY, []); }
  function setPreselect(a) { S.set(PRESELECT_KEY, a); }

  function findDish(id) {
    var all = RECIPES.concat(getImported());
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function dishTags(d) {
    var out = [];
    (d.cats || []).forEach(function (c) { if (c === 'imported') out.push('导入'); else if (catMap[c]) out.push(catMap[c]); });
    if (d.platformLabel) out.push(d.platformLabel);
    return out;
  }

  /* ---------- 规则解析文字 → 结构化 ---------- */
  function parseText(raw) {
    var lines = String(raw || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var title = lines[0] || '未命名菜单';
    var ingredients = [], steps = [], mode = null;
    for (var i = 1; i < lines.length; i++) {
      var ln = lines[i];
      if (/^(食材|配料|原料|材料|用料)/.test(ln)) { mode = 'ing'; continue; }
      if (/^(做法|步骤|制作|工序|方法|操作)/.test(ln)) { mode = 'step'; continue; }
      var cleaned = ln.replace(/^[0-9]+[.、)]\s*/, '');
      if (mode === 'ing') ingredients.push(cleaned);
      else if (mode === 'step') steps.push(cleaned);
      else if (/^[0-9]+[.、)]/.test(ln)) steps.push(cleaned);
      else ingredients.push(cleaned);
    }
    return { title: title, ingredients: ingredients, steps: steps, text: raw };
  }

  /* ---------- 页面渲染 ---------- */
  App.pages['recipes'] = function (root) {
    U.clear(root);

    /* 顶部快速入口 */
    var quick = U.el('div', { class: 'filter-bar', style: 'position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0' });
    function mkQuick(label, targetId) {
      return U.el('button', { class: 'tag', text: label, onclick: function () {
        var el = U.$('#' + targetId); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } });
    }
    quick.appendChild(mkQuick('🍽 菜谱分类', 'sec-cats'));
    quick.appendChild(mkQuick('🎯 今日吃什么', 'sec-wheel'));
    quick.appendChild(mkQuick('📥 导入菜单', 'sec-import'));
    root.appendChild(quick);

    /* ===== 菜谱分类 ===== */
    var catsCard = U.el('div', { class: 'card', id: 'sec-cats' });
    catsCard.appendChild(U.el('div', { class: 'card-title', text: '🍽 菜谱分类' }));
    var sel = U.el('select', { class: 'input', style: 'max-width:240px;margin-bottom:14px', onchange: function () { renderGrid(sel.value, grid); } });
    sel.appendChild(U.el('option', { value: 'all', text: '全部菜品（' + RECIPES.length + '）' }));
    CATS.forEach(function (g) {
      var og = U.el('optgroup', { label: g.group });
      g.items.forEach(function (it) {
        var n = RECIPES.filter(function (d) { return (d.cats || []).indexOf(it.id) > -1; }).length;
        og.appendChild(U.el('option', { value: it.id, text: it.name + '（' + n + '）' }));
      });
      sel.appendChild(og);
    });
    catsCard.appendChild(sel);
    var grid = U.el('div', { class: 'grid c4' });
    catsCard.appendChild(grid);
    root.appendChild(catsCard);
    renderGrid('all', grid);

    /* ===== 今日吃什么 · 三个独立转盘 ===== */
    var wheelSection = U.el('div', { id: 'sec-wheel' });
    wheelSection.appendChild(U.el('div', { class: 'card-title', style: 'margin:14px 0 6px', text: '🎯 今日吃什么' }));
    wheelSection.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '三个转盘分别转肉菜 / 青菜 / 汤，每个可多次多选预选；已被预选的菜不会再被抽到。最后一键生成做菜指南。' }));

    var wheelCard = U.el('div', { class: 'card' });
    var preBox = U.el('div', { class: 'row wrap', id: 'preselectBox' });

    function addPreselect(id) { var a = getPreselect(); if (a.indexOf(id) > -1) return false; a.push(id); setPreselect(a); return true; }
    function removePre(id) { setPreselect(getPreselect().filter(function (x) { return x !== id; })); }

    // 通用转盘构造（当前批 K 道 + 刷新换批 + 预选补位；转动与扇区对齐）
    function makeWheel(type, label, hue) {
      var pool = RECIPES.filter(function (d) { return d.type === type; });
      var K = pool.length ? Math.min(12, Math.max(6, pool.length)) : 0;
      var sub = U.el('div', { style: 'border-top:1px solid var(--line);padding-top:12px;margin-top:12px' });
      var titleEl = U.el('div', { class: 'card-sub' });
      sub.appendChild(titleEl);
      var wrap = U.el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:10px' });
      var box = U.el('div', { style: 'position:relative;width:200px;height:200px' });
      wrap.appendChild(box);
      var resultBox = U.el('div', { style: 'min-height:18px;text-align:center' });
      wrap.appendChild(resultBox);
      var spinBtn = U.el('button', { class: 'btn sm', text: '🎯 开始转动', onclick: function () { spin(); } });
      var refreshBtn = U.el('button', { class: 'btn ghost sm', text: '🔄 换一批', onclick: function () { refresh(); } });
      var btnRow = U.el('div', { class: 'row' });
      btnRow.appendChild(spinBtn); btnRow.appendChild(refreshBtn);
      wrap.appendChild(btnRow);
      var preList = U.el('div', { class: 'row wrap', style: 'margin-top:6px;justify-content:center' });
      wrap.appendChild(preList);
      sub.appendChild(wrap);
      wheelCard.appendChild(sub);

      var rotG = null, wheelRot = 0, spinning = false, currentBatch = [];
      function sample(arr, n) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
        return a.slice(0, n);
      }
      function availAll() { var sel = getPreselect(); return pool.filter(function (d) { return sel.indexOf(d.id) < 0; }); }
      function renderWheel() {
        box.innerHTML = buildWheelSVG(currentBatch, hue);
        rotG = box.querySelector('.wheelRot');
        if (rotG) { rotG.style.transformBox = 'view-box'; rotG.style.transformOrigin = '100px 100px'; rotG.style.transform = 'rotate(' + wheelRot + 'deg)'; }
      }
      function updateTitle() {
        titleEl.textContent = label + '（本批 ' + currentBatch.length + ' / 池 ' + pool.length + ' · 已抽 ' + countSelected(pool) + '）';
      }
      function pickBatch(exclude) {
        var a = availAll();
        var ex = exclude || [];
        var fresh = a.filter(function (d) { return ex.indexOf(d.id) < 0; });
        var src = fresh.length >= K ? fresh : a;
        currentBatch = sample(src, Math.min(K, src.length));
        wheelRot = 0;
        renderWheel(); updateTitle();
      }
      function spin() {
        if (spinning) return;
        if (!currentBatch.length) { U.toast(label + ' 暂无可选，点「换一批」'); return; }
        spinning = true;
        var N = currentBatch.length, step = 360 / N, idx = Math.floor(Math.random() * N);
        var desired = (360 - (idx * step + step / 2)) % 360;
        var curMod = ((wheelRot % 360) + 360) % 360;
        var delta = (desired - curMod + 360) % 360;
        wheelRot += 360 * 5 + delta;
        if (rotG) { rotG.style.transition = 'transform 4s cubic-bezier(.17,.67,.3,1.15)'; rotG.style.transform = 'rotate(' + wheelRot + 'deg)'; }
        U.clear(resultBox); resultBox.appendChild(U.el('div', { class: 'muted', text: '转动中…' }));
        setTimeout(function () {
          spinning = false;
          var d = currentBatch[idx];
          U.clear(resultBox);
          var line = U.el('div', { style: 'font-weight:800;font-size:16px' });
          line.appendChild(U.el('span', { text: '转到：' }));
          line.appendChild(U.el('span', { style: 'color:var(--brand)', text: d.name }));
          resultBox.appendChild(line);
          resultBox.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:6px', text: '✓ 预选此菜', onclick: function () {
            if (addPreselect(d.id)) { U.toast('已预选：' + d.name); } else { U.toast('已在预选中'); }
            var cur = currentBatch.filter(function (x) { return x.id !== d.id; });
            var more = availAll().filter(function (x) { return cur.indexOf(x) < 0 && currentBatch.indexOf(x) < 0; });
            currentBatch = cur.concat(sample(more, 1));
            renderWheel(); updateTitle();
            renderGlobalPre(); refreshCounts();
          } }));
        }, 4100);
      }
      function refresh() {
        var cur = currentBatch.map(function (d) { return d.id; });
        pickBatch(cur);
        U.toast(label + ' 已换新一批');
      }
      function renderPre() {
        U.clear(preList);
        var sel = getPreselect();
        updateTitle();
        var any = false;
        pool.forEach(function (d) {
          if (sel.indexOf(d.id) > -1) {
            any = true;
            preList.appendChild(U.el('span', { class: 'tag removable', text: d.name, onclick: function () { removePre(d.id); renderPre(); renderGlobalPre(); refreshCounts(); } }));
          }
        });
        if (!any) preList.appendChild(U.el('span', { class: 'muted', text: '（尚未预选）' }));
      }
      renderPre();
      pickBatch();
      return { pool: pool, renderPre: renderPre };
    }
    function countSelected(pool) { var sel = getPreselect(); return pool.filter(function (d) { return sel.indexOf(d.id) > -1; }).length; }
    var wheels = [
      makeWheel('meat', '🍖 肉菜转盘', 8),
      makeWheel('veg', '🥬 青菜转盘', 125),
      makeWheel('soup', '🍲 汤转盘', 35)
    ];
    function refreshCounts() {
      wheels.forEach(function (w) { w.renderPre(); }); // 重绘各转盘标题里的“已抽”数
    }
    wheelSection.appendChild(wheelCard);

    // 总预选区
    var globalPreTitle = U.el('div', { class: 'card-sub global-pre-title', style: 'margin:14px 0 6px;border-top:1px solid var(--line);padding-top:12px', text: '🧺 预选清单（共 ' + getPreselect().length + ' 道）' });
    wheelCard.appendChild(globalPreTitle);
    wheelCard.appendChild(preBox);
    function renderGlobalPre() {
      U.clear(preBox);
      var arr = getPreselect();
      globalPreTitle.textContent = '🧺 预选清单（共 ' + arr.length + ' 道）';
      if (!arr.length) { preBox.appendChild(U.el('span', { class: 'muted', text: '还没有预选，去上面三个转盘转一转吧～' })); return; }
      arr.forEach(function (id) {
        var d = findDish(id); if (!d) return;
        preBox.appendChild(U.el('span', { class: 'tag removable', text: (d.type === 'meat' ? '🍖' : d.type === 'veg' ? '🥬' : '🍲') + d.name, onclick: function () { removePre(id); renderGlobalPre(); wheels.forEach(function (w) { w.renderPre(); }); refreshCounts(); } }));
      });
    }
    var genBtn = U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px', text: '📋 一键生成做菜指南', onclick: function () { generateGuide(); } });
    wheelCard.appendChild(genBtn);
    root.appendChild(wheelSection);
    renderGlobalPre();

    /* ===== 导入菜单 ===== */
    var impCard = U.el('div', { class: 'card', id: 'sec-import' });
    impCard.appendChild(U.el('div', { class: 'card-title', text: '📥 导入菜单' }));
    impCard.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '粘贴小红书 / 抖音分享链接，自动提取标题、正文与封面图（文字稳、图片可能过期，可用占位兜底）。也可以直接粘贴笔记文字。' }));

    var linkInput = U.el('input', { class: 'input', placeholder: '粘贴分享链接或整段分享文字，如 沉浸式做抹茶蛋糕… http://xhslink.cn/xxx', style: 'margin-bottom:8px' });
    impCard.appendChild(linkInput);
    var linkRow = U.el('div', { class: 'row' });
    linkRow.appendChild(U.el('button', { class: 'btn sm', text: '解析链接', onclick: function () { parseLink(linkInput.value, previewBox); } }));
    linkRow.appendChild(U.el('span', { class: 'muted', style: 'align-self:center', text: '或' }));
    impCard.appendChild(linkRow);

    var ta = U.el('textarea', { class: 'textarea', placeholder: '也可直接粘贴笔记文字（自动按 食材/做法 关键词切分）', style: 'margin-top:8px' });
    impCard.appendChild(ta);
    impCard.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: '解析文字', onclick: function () { parseTextInput(ta.value, previewBox); } }));

    var previewBox = U.el('div', { id: 'importPreview', style: 'margin-top:12px' });
    impCard.appendChild(previewBox);
    root.appendChild(impCard);

    /* ---------- 渲染函数 ---------- */
    /* 做法直接来自文档数据集，不再联网获取 */
    function renderGrid(catId, gridEl) {
      U.clear(gridEl);
      var imported = getImported();
      var total = RECIPES.length + imported.length;
      var list = RECIPES.concat(imported);
      if (catId && catId !== 'all') list = list.filter(function (d) { return (d.cats || []).indexOf(catId) > -1; });
      else list = list.slice(0, 10); // 默认只展示前 10 道，其余靠分类筛选
      if (!list.length) { gridEl.appendChild(U.el('div', { class: 'empty', text: '该分类暂无菜品' })); return; }
      list.forEach(function (d) {
        var card = U.el('div', { class: 'dish-card', onclick: function () { showDish(d); } });
        var info = U.el('div', { class: 'dish-info' });
        info.appendChild(U.el('div', { class: 'dish-name', text: d.name }));
        var tags = U.el('div', { class: 'dish-tags' });
        dishTags(d).slice(0, 3).forEach(function (t) { tags.appendChild(U.el('span', { class: 'tag xs', text: t })); });
        info.appendChild(tags);
        card.appendChild(info);
        gridEl.appendChild(card);
      });
      if ((!catId || catId === 'all') && total > 10) {
        gridEl.appendChild(U.el('div', { class: 'muted', style: 'grid-column:1/-1;margin-top:6px;font-size:12px', text: '仅展示前 10 道，选择上方分类可查看该分类全部 ' + total + ' 道菜品。' }));
      }
    }

    function showDish(d) {
      var body = U.el('div');
      var pics = (d.images && d.images.length) ? d.images.slice(0, 8) : (d.image ? [d.image] : []);
      pics.forEach(function (u) {
        body.appendChild(U.el('img', { src: u, style: 'width:100%;border-radius:12px;margin-bottom:10px;background:var(--surface-3)', onerror: function () { this.style.display = 'none'; } }));
      });
      var tags = U.el('div', { class: 'row wrap', style: 'margin-bottom:8px' });
      dishTags(d).forEach(function (t) { tags.appendChild(U.el('span', { class: 'tag xs', text: t })); });
      body.appendChild(tags);

      var methodBox = U.el('div');
      body.appendChild(methodBox);
      if (d.ingredients && d.ingredients.length) {
        methodBox.appendChild(U.el('div', { class: 'card-sub', style: 'margin:6px 0 4px', text: '🥬 食材' }));
        methodBox.appendChild(U.el('div', { text: d.ingredients.join('、') }));
      }
      if (d.steps && d.steps.length) {
        methodBox.appendChild(U.el('div', { class: 'card-sub', style: 'margin:10px 0 4px', text: '👩‍🍳 做法' }));
        d.steps.forEach(function (s, i) { methodBox.appendChild(U.el('div', { style: 'margin:4px 0', text: (i + 1) + '. ' + s })); });
      } else if (d.text) {
        methodBox.appendChild(U.el('div', { class: 'card-sub', style: 'margin:10px 0 4px', text: '📝 原文' }));
        methodBox.appendChild(U.el('div', { style: 'white-space:pre-wrap;line-height:1.6', text: d.text }));
      } else {
        methodBox.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '（暂无详细做法）' }));
      }
      if (d.video) body.appendChild(U.el('a', { class: 'btn sm', style: 'margin-top:12px;display:inline-block;text-decoration:none', href: d.video, target: '_blank', rel: 'noopener', text: '▶ 看视频' }));
      U.modal({
        title: d.name, body: body,
        actions: [
          { label: '加入预选', primary: true, onClick: function () { if (addPreselect(d.id)) { U.toast('已加入预选'); } else { U.toast('已在预选中'); } renderGlobalPre(); wheels.forEach(function (w) { w.renderPre(); }); } },
          { label: '关闭', onClick: function () {} }
        ]
      });
    }

    function generateGuide() {
      var arr = getPreselect();
      if (!arr.length) { U.toast('请先预选至少一道菜'); return; }
      var dishes = arr.map(findDish).filter(Boolean);
      var groups = [['meat', '🍖 肉菜'], ['veg', '🥬 青菜'], ['soup', '🍲 汤'], ['other', '📎 其他']];
      var body = U.el('div');
      var actions = U.el('div', { class: 'row', style: 'margin-bottom:10px' });
      actions.appendChild(U.el('button', { class: 'btn sm', text: '📋 复制全文', onclick: function () { copyText(buildGuideText(dishes)); } }));
      actions.appendChild(U.el('button', { class: 'btn ghost sm', text: '⬇ 下载TXT', onclick: function () { U.download('做菜指南_' + S.todayStr() + '.txt', buildGuideText(dishes), 'text/plain;charset=utf-8'); } }));
      actions.appendChild(U.el('button', { class: 'btn ghost sm', text: '⭐ 存到灵感', onclick: function () { saveToInspiration(dishes); } }));
      body.appendChild(actions);
      groups.forEach(function (g) {
        var list = dishes.filter(function (d) { return g[0] === 'other' ? (d.type !== 'meat' && d.type !== 'veg' && d.type !== 'soup') : d.type === g[0]; });
        if (!list.length) return;
        body.appendChild(U.el('div', { style: 'font-weight:800;font-size:15px;margin:14px 0 6px;border-top:1px solid var(--line);padding-top:10px', text: g[1] + '（' + list.length + '）' }));
        list.forEach(function (d, i) {
          var ing = d.ingredients || [];
          var st = d.steps || [];
          var txt = d.text || '';
          body.appendChild(U.el('div', { style: 'font-weight:700;font-size:14px;margin:8px 0 4px', text: (i + 1) + '. ' + d.name }));
          var pics = (d.images && d.images.length) ? d.images.slice(0, 8) : (d.image ? [d.image] : []);
          pics.forEach(function (u) {
            body.appendChild(U.el('img', { src: u, style: 'width:100%;border-radius:10px;margin-bottom:8px;background:var(--surface-3)', onerror: function () { this.style.display = 'none'; } }));
          });
          if (ing && ing.length) body.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px', text: '食材：' + ing.join('、') }));
          if (st && st.length) {
            st.forEach(function (s, k) { body.appendChild(U.el('div', { style: 'margin:3px 0', text: (k + 1) + ') ' + s })); });
          } else if (txt) {
            body.appendChild(U.el('div', { style: 'white-space:pre-wrap;line-height:1.6', text: txt }));
          }
          if (d.sourceUrl) body.appendChild(U.el('a', { class: 'muted', style: 'font-size:12px;display:block;margin-top:4px', href: d.sourceUrl, target: '_blank', rel: 'noopener', text: '🔗 原链接' }));
        });
      });
      U.modal({ title: '今日做菜指南', body: body, actions: [{ label: '关闭', primary: true, onClick: function () {} }] });
    }

    function buildGuideText(dishes) {
      var head = '今日做菜指南（生成于 ' + S.todayStr() + ' ' + U.fmtTime(new Date()) + '）\n' + '='.repeat(24) + '\n';
      var groups = [['meat', '肉菜'], ['veg', '青菜'], ['soup', '汤'], ['other', '其他']];
      var parts = groups.map(function (g) {
        var list = dishes.filter(function (d) { return g[0] === 'other' ? (d.type !== 'meat' && d.type !== 'veg' && d.type !== 'soup') : d.type === g[0]; });
        if (!list.length) return '';
        var block = '【' + g[1] + '】\n' + list.map(function (d, i) {
          var ing = d.ingredients || [];
          var st = d.steps || [];
          var txt = d.text || '';
          var lines = [(i + 1) + '. ' + d.name];
          if (ing && ing.length) lines.push('  食材：' + ing.join('、'));
          if (st && st.length) lines.push('  做法：\n' + st.map(function (s, k) { return '    ' + (k + 1) + ') ' + s; }).join('\n'));
          else if (txt) lines.push('  原文：\n' + txt);
          if (d.sourceUrl) lines.push('  原链接：' + d.sourceUrl);
          return lines.join('\n');
        }).join('\n');
        return block;
      }).filter(Boolean);
      return head + parts.join('\n' + '-'.repeat(24) + '\n');
    }

    function copyText(t) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { U.toast('已复制全文'); }, function () { fallbackCopy(t); });
      else fallbackCopy(t);
    }
    function fallbackCopy(t) {
      try { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); U.toast('已复制全文'); } catch (e) { U.toast('复制失败，请手动选择'); }
    }

    function saveToInspiration(dishes) {
      try {
        var arr = S.getInspirations ? S.getInspirations() : [];
        var d = new Date();
        arr.unshift({
          id: U.uid(), content: buildGuideText(dishes), tags: ['菜谱', '做菜指南'],
          date: S.todayStr(), time: U.fmtTime(d), pinned: false, starred: false, attachments: []
        });
        if (S.saveInspirations) S.saveInspirations(arr);
        U.toast('已存入灵感记录，可在「灵感记录」查看');
      } catch (e) { U.toast('保存失败：' + (e.message || e)); }
    }

    /* ---------- 导入逻辑 ---------- */
    function setPreview(kind, msg, node) {
      U.clear(previewBox);
      if (kind === 'loading') previewBox.appendChild(U.el('div', { class: 'muted', text: msg }));
      else if (kind === 'error') previewBox.appendChild(U.el('div', { style: 'color:var(--red);font-size:13px', text: '⚠ ' + msg }));
      else if (node) previewBox.appendChild(node);
    }

    function guessCat(name) {
      var n = (name || '');
      if (/汤|羹|煲/.test(n)) return 'soup';
      if (/凉拌|沙拉|蔬|青菜|白灼|拌|炝|灼/.test(n)) return 'veg';
      if (/炒|烧|炖|炸|煎|烤|煮|蒸|卤|焖|烩|肉|鸡|鱼|虾|牛|猪|羊|排|丸/.test(n)) return 'meat';
      return 'other';
    }
    function buildImportPreview(parsed, sourceUrl, platformLabel) {
      var node = U.el('div', { class: 'import-preview' });
      node.appendChild(U.el('div', { class: 'card-sub', text: '解析结果（' + (platformLabel || '链接') + '）' }));
      if (parsed.images && parsed.images.length) {
        var gal = U.el('div', { class: 'row wrap', style: 'gap:6px;margin:6px 0' });
        parsed.images.slice(0, 8).forEach(function (u) {
          gal.appendChild(U.el('img', { src: u, style: 'width:84px;height:84px;object-fit:cover;border-radius:8px;background:var(--surface-3)', onerror: function () { this.style.display = 'none'; } }));
        });
        node.appendChild(gal);
      } else if (parsed.image) {
        node.appendChild(U.el('img', { src: parsed.image, style: 'width:140px;border-radius:10px;margin:6px 0;background:var(--surface-3)', onerror: function () { this.style.display = 'none'; } }));
      }
      node.appendChild(U.el('div', { style: 'font-weight:800;font-size:15px', text: parsed.title || '未命名' }));
      var guess = guessCat(parsed.title || '');
      var catSel = U.el('select', { class: 'input', style: 'margin:6px 0;max-width:220px;display:block' });
      CATS.forEach(function (g) {
        var og = U.el('optgroup', { label: g.group });
        g.items.forEach(function (it) {
          var o = U.el('option', { value: it.id, text: it.name });
          if (it.id === guess) o.selected = true;
          og.appendChild(o);
        });
        catSel.appendChild(og);
      });
      node.appendChild(U.el('label', { class: 'muted', style: 'font-size:12px;display:block', text: '分类（归入菜谱分类 / 转盘）' }));
      node.appendChild(catSel);
      if (parsed.ingredients && parsed.ingredients.length) node.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px', text: '食材：' + parsed.ingredients.join('、') }));
      if (parsed.steps && parsed.steps.length) {
        node.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px', text: '做法：' + parsed.steps.length + ' 步' }));
      } else if (parsed.text) {
        node.appendChild(U.el('div', { style: 'white-space:pre-wrap;font-size:13px;margin-top:4px;max-height:160px;overflow:auto', text: parsed.text }));
      }
      node.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:8px', text: '💾 保存为我的菜单', onclick: function () {
        saveImported(parsed, sourceUrl, platformLabel, catSel.value);
      } }));
      return node;
    }

    function saveImported(parsed, sourceUrl, platformLabel, catId) {
      var imported = getImported();
      var type = (catId === 'meat' || catId === 'veg' || catId === 'soup') ? catId : 'other';
      var d = {
        id: 'imp-' + U.uid(), name: parsed.title || '未命名菜单', cats: ['imported'].concat(catId ? [catId] : []), type: type,
        image: parsed.image || '', images: parsed.images || [], ingredients: parsed.ingredients || [], steps: parsed.steps || [],
        text: parsed.text || '', video: sourceUrl || '', sourceUrl: sourceUrl || '',
        platformLabel: platformLabel || '', imported: true, hue: 20
      };
      imported.unshift(d); setImported(imported);
      U.toast('已保存到我的菜单（可在「菜谱分类」查看）');
      U.clear(previewBox);
      renderGrid(sel.value, grid);
    }

    function parseLink(raw, pbox) {
      raw = (raw || '').trim();
      // 从整段分享文字里自动抠出第一个 http(s) 链接（小红书/抖音分享常带标题前缀）
      var m = raw.match(/https?:\/\/[^\s"'<>\]]+/i);
      var url = m ? m[0].replace(/[。，,、.．]+$/, '') : raw;
      if (!url) { U.toast('请先粘贴链接'); return; }
      setPreview('loading', '解析中…');
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url }) }).then(function (resp) { return resp.json(); }).then(function (r) {
        if (!r || !r.ok) { setPreview('error', (r && r.error) ? r.error : '解析失败，请改用粘贴文字'); return; }
        var parsed = parseText(r.text || '');
        parsed.title = r.title || parsed.title;
        parsed.images = r.images || [];
        parsed.image = parsed.images[0] || '';
        parsed.text = r.text || '';
        var label = r.platform === 'xiaohongshu' ? '小红书' : (r.platform === 'douyin' ? '抖音' : '链接');
        setPreview('node', '', buildImportPreview(parsed, r.sourceUrl, label));
      }).catch(function (e) {
        setPreview('error', '请求失败：' + (e && e.message ? e.message : e) + '（可改用粘贴文字）');
      });
    }

    function parseTextInput(raw, pbox) {
      raw = (raw || '').trim();
      if (!raw) { U.toast('请先粘贴文字'); return; }
      var parsed = parseText(raw);
      setPreview('node', '', buildImportPreview(parsed, '', '文字'));
    }
  };

  /* ---------- 转盘 SVG 构建（接收菜品池） ---------- */
  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function sectorPath(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    var large = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + cx + ' ' + cy + ' L' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2)
      + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) + ' Z';
  }
  function buildWheelSVG(pool, hue) {
    var N = pool.length, step = 360 / N;
    var s = "<svg viewBox='0 0 200 200' width='200' height='200'>";
    s += "<g class='wheelRot'>";
    for (var i = 0; i < N; i++) {
      var a0 = i * step, a1 = (i + 1) * step;
      var light = 32 + (i % 3) * 9;
      s += "<path d='" + sectorPath(100, 100, 95, a0, a1) + "' fill='hsl(" + hue + ',55%,' + light + "%)' stroke='#fff' stroke-width='1'/>";
      var mid = a0 + step / 2, pos = polar(100, 100, 62, mid), nm = pool[i].name;
      if (nm.length > 4) nm = nm.slice(0, 4) + '…';
      s += "<text x='" + pos.x.toFixed(1) + "' y='" + pos.y.toFixed(1) + "' transform='rotate(" + mid + ' ' + pos.x.toFixed(1) + ' ' + pos.y.toFixed(1) + ")' font-size='8' fill='#fff' text-anchor='middle' dominant-baseline='middle'>" + nm + '</text>';
    }
    s += "</g>";
    s += "<circle cx='100' cy='100' r='14' fill='#fff' stroke='#e8ecf4' stroke-width='2'/>";
    s += "<path d='M100 4 L93 20 L107 20 Z' fill='#ef4848'/>";
    s += "</svg>";
    return s;
  }
})();
