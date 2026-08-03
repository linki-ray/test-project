/* =========================================================
   燃烧卡路里 · 一级目录（六大模块）
   ① 基础信息  ② 饮食记录  ③ 运动消耗  ④ 每日仪表盘  ⑤ 数据统计复盘
   约束：所有记录永久保存，不提供删除；生/熟区分（熟食靠原料拆分计算）。
   数据源：window.BURN_DATA（《中国食物成分表 第6版》生鲜值）。
   ========================================================= */
(function () {
  var U = App.U, S = App.Store;
  var D = window.BURN_DATA;
  if (!D) { console.error('BURN_DATA 未加载'); return; }

  App.pages['burn'] = function (root) {
    U.clear(root);

    /* ---------- 存储键 ---------- */
    var K_PROFILE = 'burn_profile', K_WEIGHT = 'burn_weight', K_DIET = 'burn_diet', K_EX = 'burn_ex', K_FAV = 'burn_fav';
    var today = S.todayStr();

    var profile = S.get(K_PROFILE, null);
    if (!profile) profile = { sex: '女', height: 161, initW: 62, curW: 60, goalW: 55, age: 28, act: 1.375, deficit: 500 };
    var weight = S.get(K_WEIGHT, []);
    var diet = S.get(K_DIET, {});
    var ex = S.get(K_EX, {});
    var fav = S.get(K_FAV, []);

    function saveProfile() { S.set(K_PROFILE, profile); }
    function saveWeight() { S.set(K_WEIGHT, weight); }
    function saveDiet() { S.set(K_DIET, diet); }
    function saveEx() { S.set(K_EX, ex); }
    function saveFav() { S.set(K_FAV, fav); }

    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function round(x) { return Math.round(x); }
    function kcalPCF(p, c, f) { return p * 4 + c * 4 + f * 9; }
    function resolve(name) {
      var n = (name || '').trim();
      if (D.FOODS[n]) return D.FOODS[n];
      if (D.ALIAS[n] && D.FOODS[D.ALIAS[n]]) return D.FOODS[D.ALIAS[n]];
      return null;
    }

    /* ---------- 生理计算 ---------- */
    function bmr() { return Math.round(10 * profile.curW + 6.25 * profile.height - 5 * profile.age + (profile.sex === '男' ? 5 : -161)); }
    function tdee() { return Math.round(bmr() * profile.act); }
    function target() { return Math.round(tdee() - profile.deficit); }

    function dayDiet(d) { return diet[d] || []; }
    function dayEx(d) { return ex[d] || []; }
    function sumK(arr) { return arr.reduce(function (s, x) { return s + (x.kcal || 0); }, 0); }
    function sumP(arr) { return arr.reduce(function (s, x) { return s + (x.p || 0); }, 0); }
    function sumC(arr) { return arr.reduce(function (s, x) { return s + (x.c || 0); }, 0); }
    function sumF(arr) { return arr.reduce(function (s, x) { return s + (x.f || 0); }, 0); }

    function pushDiet(entry) { entry.id = uid(); if (!diet[today]) diet[today] = []; diet[today].push(entry); saveDiet(); }
    function pushEx(entry) { entry.id = uid(); if (!ex[today]) ex[today] = []; ex[today].push(entry); saveEx(); }

    /* ---------- 顶部 tab 栏 ---------- */
    var TABS = [['dash', '仪表盘'], ['base', '基础信息'], ['diet', '饮食记录'], ['ex', '运动记录'], ['stat', '数据统计']];
    var cur = 'dash';
    var bar = U.el('div', { class: 'sub-nav', style: 'margin-bottom:12px' });
    TABS.forEach(function (t) {
      var b = U.el('button', { class: 'sub-nav-item' + (t[0] === cur ? ' active' : ''), text: t[1] });
      b.onclick = function () { cur = t[0]; U.$all('.sub-nav-item', bar).forEach(function (x) { x.classList.toggle('active', x.textContent === t[1]); }); render(); };
      bar.appendChild(b);
    });
    root.appendChild(bar);
    var panel = U.el('div');
    root.appendChild(panel);

    function render() { U.clear(panel); if (cur === 'dash') panel.appendChild(renderDash()); else if (cur === 'base') panel.appendChild(renderBase()); else if (cur === 'diet') panel.appendChild(renderDiet()); else if (cur === 'ex') panel.appendChild(renderEx()); else panel.appendChild(renderStat()); }

    /* ===== ④ 每日仪表盘 ===== */
    function renderDash() {
      var wrap = U.el('div');
      var dArr = dayDiet(today), eArr = dayEx(today);
      var inK = sumK(dArr), exK = sumK(eArr);
      var tgt = target();
      var remain = tgt + exK - inK;
      var net = (tgt - inK) + exK; // 净热量缺口（正=在减脂）

      var mg = U.el('div', { class: 'grid c3', style: 'gap:10px' });
      mg.appendChild(statCard('今日摄入', inK, 'kcal'));
      mg.appendChild(statCard('今日运动消耗', exK, 'kcal'));
      mg.appendChild(statCard('净热量缺口', net, 'kcal'));
      wrap.appendChild(mg);

      var bar2 = U.el('div', { class: 'card' });
      bar2.appendChild(U.el('div', { class: 'card-sub', text: '剩余可摄入热量' }));
      var track = U.el('div', { style: 'height:10px;background:var(--surface-3);border-radius:6px;overflow:hidden;margin:8px 0' });
      var fill = U.el('i', { style: 'display:block;height:100%;background:var(--ok);width:' + Math.max(0, Math.min(100, inK / (tgt + exK || 1) * 100)) + '%' });
      track.appendChild(fill); bar2.appendChild(track);
      bar2.appendChild(U.el('div', { class: 'muted', text: '已摄入 ' + inK + ' / 可摄入 ' + (tgt + exK) + ' kcal（含运动+' + exK + '）' + (remain < 0 ? ' · 已超出 ' + Math.abs(remain) : '') }));
      wrap.appendChild(bar2);

      var wCard = U.el('div', { class: 'card' });
      wCard.appendChild(U.el('div', { class: 'card-sub', text: '今日体重' }));
      var wToday = lastWeight(today);
      wCard.appendChild(U.el('div', { style: 'font-size:15px;margin-top:4px', text: wToday ? (wToday + ' kg') : '未记录（去「基础信息」记录）' }));
      wrap.appendChild(wCard);

      wrap.appendChild(listCard('当日饮食清单', dArr.map(function (x) { return x.meal + ' · ' + x.name + ' · ' + x.kcal + ' kcal'; })));
      wrap.appendChild(listCard('当日运动清单', eArr.map(function (x) { return x.name + ' · ' + x.kcal + ' kcal'; })));
      return wrap;
    }

    /* ===== ① 基础信息 ===== */
    function renderBase() {
      var wrap = U.el('div');

      var form = U.el('div', { class: 'card' });
      form.appendChild(U.el('div', { class: 'card-title', text: '个人身体档案' }));
      function numField(label, key, step) {
        var f = U.el('div', { class: 'field' });
        f.appendChild(U.el('label', { class: 'muted', style: 'font-size:12px;display:block', text: label }));
        var i = U.el('input', { class: 'input', type: 'number', step: step || 1, value: profile[key] });
        i.oninput = function () { profile[key] = parseFloat(i.value) || 0; saveProfile(); upCalc(); };
        f.appendChild(i); return f;
      }
      var row1 = U.el('div', { class: 'row' });
      var sxF = U.el('div', { class: 'field' }); sxF.appendChild(U.el('label', { class: 'muted', style: 'font-size:12px;display:block', text: '性别' }));
      var sx = U.el('select', { class: 'input' }, [U.el('option', { value: '女', text: '女' }), U.el('option', { value: '男', text: '男' })]); sx.value = profile.sex;
      sx.onchange = function () { profile.sex = sx.value; saveProfile(); upCalc(); }; sxF.appendChild(sx);
      row1.appendChild(numField('身高 (cm)', 'height')); row1.appendChild(numField('年龄', 'age'));
      var row2 = U.el('div', { class: 'row' });
      row2.appendChild(numField('初始体重 (kg)', 'initW', 0.1)); row2.appendChild(numField('当前体重 (kg)', 'curW', 0.1));
      var row3 = U.el('div', { class: 'row' });
      row3.appendChild(numField('目标体重 (kg)', 'goalW', 0.1)); row3.appendChild(sxF);
      var actF = U.el('div', { class: 'field' }); actF.appendChild(U.el('label', { class: 'muted', style: 'font-size:12px;display:block', text: '活动水平' }));
      var act = U.el('select', { class: 'input' });
      [{ v: 1.2, t: '久坐 (1.2)' }, { v: 1.375, t: '轻度 (1.375)' }, { v: 1.55, t: '中度 (1.55)' }, { v: 1.725, t: '高强度 (1.725)' }].forEach(function (o) { var op = U.el('option', { value: o.v, text: o.t }); act.appendChild(op); });
      act.value = profile.act; act.onchange = function () { profile.act = parseFloat(act.value); saveProfile(); upCalc(); }; actF.appendChild(act);
      var defF = U.el('div', { class: 'field' }); defF.appendChild(U.el('label', { class: 'muted', style: 'font-size:12px;display:block', text: '目标热量缺口/天' }));
      var def = U.el('select', { class: 'input' });
      [{ v: 300, t: '300 kcal（温和）' }, { v: 500, t: '500 kcal（标准）' }, { v: 750, t: '750 kcal（积极）' }].forEach(function (o) { var op = U.el('option', { value: o.v, text: o.t }); def.appendChild(op); });
      def.value = profile.deficit; def.onchange = function () { profile.deficit = parseFloat(def.value); saveProfile(); upCalc(); }; defF.appendChild(def);
      var row4 = U.el('div', { class: 'row' }); row4.appendChild(actF); row4.appendChild(defF);
      form.appendChild(row1); form.appendChild(row2); form.appendChild(row3); form.appendChild(row4);
      wrap.appendChild(form);

      var calc = U.el('div', { class: 'card' }); calc.id = 'burnCalc'; wrap.appendChild(calc);
      function upCalc() {
        var c = U.$('#burnCalc'); if (!c) return; U.clear(c);
        c.appendChild(U.el('div', { class: 'card-title', text: '自动计算结果' }));
        var mg = U.el('div', { class: 'grid c3', style: 'gap:10px' });
        mg.appendChild(statCard('基础代谢 BMR', bmr(), 'kcal/天'));
        mg.appendChild(statCard('每日消耗 TDEE', tdee(), 'kcal/天'));
        mg.appendChild(statCard('每日建议摄入', target(), 'kcal/天'));
        c.appendChild(mg);
        var toGo = Math.max(0, round(profile.curW - profile.goalW));
        c.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '当前 ' + profile.curW + 'kg → 目标 ' + profile.goalW + 'kg，还需减约 ' + toGo + 'kg' }));
      }
      upCalc();

      // 体重记录 + 趋势
      var wCard = U.el('div', { class: 'card' });
      wCard.appendChild(U.el('div', { class: 'card-title', text: '体重记录与趋势' }));
      var wRow = U.el('div', { class: 'row', style: 'align-items:flex-end' });
      var wf = U.el('div', { class: 'field' }); wf.appendChild(U.el('label', { class: 'muted', style: 'font-size:12px;display:block', text: '今日体重 (kg)' }));
      var wI = U.el('input', { class: 'input', type: 'number', step: '0.1', value: profile.curW });
      wf.appendChild(wI);
      var wBtn = U.el('button', { class: 'btn sm', text: '记录今日体重', onclick: function () { var w = parseFloat(wI.value); if (!w) { U.toast('请输入体重'); return; } recordWeight(w); U.toast('已记录 ' + w + 'kg'); render(); } });
      wRow.appendChild(wf); wRow.appendChild(wBtn);
      wCard.appendChild(wRow);
      wCard.appendChild(weightSpark());
      wrap.appendChild(wCard);
      return wrap;
    }

    function recordWeight(w) {
      var found = false;
      weight.forEach(function (it) { if (it.date === today) { it.w = w; found = true; } });
      if (!found) weight.push({ date: today, w: w });
      saveWeight();
    }
    function lastWeight(d) {
      var r = null;
      weight.forEach(function (it) { if (it.date <= (d || today)) r = it.w; });
      // 取当天或最近一条
      var same = weight.filter(function (it) { return it.date === (d || today); });
      if (same.length) return same[same.length - 1].w;
      return r;
    }
    function weightSpark() {
      var box = U.el('div');
      if (!weight.length) { box.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px', text: '记录体重后生成趋势线' })); return box; }
      var arr = weight.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var ws = arr.map(function (x) { return x.w; });
      var max = Math.max.apply(null, ws), min = Math.min.apply(null, ws); var r = (max - min) || 1;
      var W = 320, H = 80;
      var pts = arr.map(function (x, i) { var px = W * (i / (arr.length - 1 || 1)); var py = H - ((x.w - min) / r) * (H - 20) - 10; return round(px) + ',' + round(py); }).join(' ');
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;display:block;margin-top:8px">' +
        '<polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2"/>' +
        '<circle cx="' + W + '" cy="' + (H - ((arr[arr.length - 1].w - min) / r) * (H - 20) - 10) + '" r="3" fill="var(--text)"/></svg>';
      box.innerHTML = svg;
      box.appendChild(U.el('div', { class: 'muted', style: 'margin-top:4px', text: '最新 ' + arr[arr.length - 1].w + 'kg（共 ' + arr.length + ' 条记录）' }));
      return box;
    }

    /* ===== ② 饮食记录 ===== */
    function renderDiet() {
      var wrap = U.el('div');
      var meal = '早餐';

      var mealCard = U.el('div', { class: 'card' });
      mealCard.appendChild(U.el('div', { class: 'card-sub', text: '餐次' }));
      var seg = U.el('div', { class: 'seg', style: 'display:flex;gap:0;margin-top:6px' });
      ['早餐', '午餐', '晚餐', '加餐'].forEach(function (m) {
        var b = U.el('button', { class: 'seg-btn' + (m === meal ? ' active' : ''), text: m });
        b.onclick = function () { meal = m; U.$all('.seg-btn', seg).forEach(function (x) { x.classList.toggle('active', x.textContent === m); }); };
        seg.appendChild(b);
      });
      mealCard.appendChild(seg);
      var chips = U.el('div', { style: 'margin-top:8px' });
      chips.appendChild(U.el('span', { class: 'muted', style: 'font-size:12px', text: '收藏常用：' }));
      (fav.length ? fav : ['鸡蛋', '黄瓜', '鸡胸肉', '米饭', '食用油']).forEach(function (fn) {
        var c = U.el('span', { class: 'chip', text: fn });
        c.onclick = function () { nameI.value = fn; fillAuto(); };
        chips.appendChild(c);
      });
      mealCard.appendChild(chips);
      wrap.appendChild(mealCard);

      // ① 单品食材
      var sCard = U.el('div', { class: 'card' });
      sCard.appendChild(U.el('div', { class: 'card-sub', text: '① 单品食材录入（生重优先）' }));
      var nameI = U.el('input', { class: 'input', placeholder: '食材名称，自动查表', style: 'margin-top:6px' });
      var wI = U.el('input', { class: 'input', type: 'number', placeholder: '重量 g', style: 'margin-top:6px' });
      var autoBox = U.el('div', { class: 'muted', style: 'margin-top:6px;font-size:12px' });
      var manualI = U.el('input', { class: 'input', type: 'number', placeholder: '未在表中？手动填热量 kcal', style: 'margin-top:6px;display:none' });
      nameI.oninput = fillAuto;
      function fillAuto() {
        var std = resolve(nameI.value);
        if (std) { autoBox.textContent = '每100g：蛋白 ' + std.p + 'g / 碳水 ' + std.c + 'g / 脂肪 ' + std.f + 'g → ' + round(kcalPCF(std.p, std.c, std.f)) + ' kcal'; manualI.style.display = 'none'; }
        else { autoBox.textContent = '未在表中，请在下方手动填热量（或去「基础信息」核对）'; manualI.style.display = ''; }
      }
      var addBtn = U.el('button', { class: 'btn', style: 'margin-top:10px', text: '添加这道食材', onclick: addSingle });
      function addSingle() {
        var n = nameI.value.trim(); if (!n) { U.toast('请输入食材名'); return; }
        var w = parseFloat(wI.value) || 0; if (!w) { U.toast('请输入重量'); return; }
        var std = resolve(n);
        var p, c, f, k, manual = false;
        if (std) { p = std.p * w / 100; c = std.c * w / 100; f = std.f * w / 100; k = kcalPCF(p, c, f); }
        else { var mk = parseFloat(manualI.value); if (!mk) { U.toast('该食材不在表中，请填热量'); return; } k = mk; p = c = f = 0; manual = true; }
        pushDiet({ name: n + ' ' + round(w) + 'g', w: w, p: round(p), c: round(c), f: round(f), kcal: round(k), manual: manual });
        nameI.value = ''; wI.value = ''; manualI.value = ''; autoBox.textContent = ''; U.toast('已记录'); render();
      }
      sCard.appendChild(nameI); sCard.appendChild(wI); sCard.appendChild(autoBox); sCard.appendChild(manualI); sCard.appendChild(addBtn);
      wrap.appendChild(sCard);

      // ② 家常菜拆分
      var dCard = U.el('div', { class: 'card' });
      dCard.appendChild(U.el('div', { class: 'card-sub', text: '② 家常菜拆分录入（每种原料分别称重）' }));
      var dishNameI = U.el('input', { class: 'input', placeholder: '菜名（如 黄瓜炒鸡蛋）', style: 'margin-top:6px' });
      var splitsBox = U.el('div', { style: 'margin-top:8px' });
      var splits = [{ name: '黄瓜', w: 150 }, { name: '鸡蛋', w: 100 }, { name: '食用油', w: 10 }];
      function renderSplits() {
        U.clear(splitsBox);
        splits.forEach(function (s, idx) {
          var row = U.el('div', { class: 'row', style: 'gap:6px;margin:6px 0;align-items:center' });
          var ni = U.el('input', { class: 'input', placeholder: '原料', value: s.name }); ni.oninput = function () { s.name = ni.value; recalcDish(); };
          var wi = U.el('input', { class: 'input', type: 'number', placeholder: 'g', value: s.w }); wi.oninput = function () { s.w = parseFloat(wi.value) || 0; recalcDish(); };
          row.appendChild(ni); row.appendChild(wi); splitsBox.appendChild(row);
        });
      }
      var oilCutI = U.el('input', { class: 'input', type: 'number', placeholder: '去汤汁扣油 kcal（默认0）', style: 'margin-top:8px' });
      var manualTotalI = U.el('input', { class: 'input', type: 'number', placeholder: '含未收录食材？填总热量 kcal', style: 'margin-top:6px' });
      var totBox = U.el('div', { class: 'muted', style: 'margin-top:8px' });
      function recalcDish() {
        var p = 0, c = 0, f = 0, kf = 0, unknown = false;
        splits.forEach(function (s) { var std = resolve(s.name); var w = s.w || 0; if (std) { var pp = std.p * w / 100, cc = std.c * w / 100, ff = std.f * w / 100; p += pp; c += cc; f += ff; kf += kcalPCF(pp, cc, ff); } else if (w) unknown = true; });
        var oilCut = parseFloat(oilCutI.value) || 0;
        totBox.textContent = '合计 ' + round(kf - oilCut) + ' kcal（蛋白 ' + round(p) + ' / 脂肪 ' + round(f) + '）' + (unknown ? ' · 含未收录原料，请填总热量' : '');
      }
      oilCutI.oninput = recalcDish; manualTotalI.oninput = recalcDish;
      var addSplitBtn = U.el('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: '＋ 加一行原料', onclick: function () { splits.push({ name: '', w: 0 }); renderSplits(); recalcDish(); } });
      var saveDishBtn = U.el('button', { class: 'btn', style: 'margin-top:10px', text: '保存这道菜到当前餐次', onclick: function () {
        var p = 0, c = 0, f = 0, kf = 0, unknown = false;
        splits.forEach(function (s) { var std = resolve(s.name); var w = s.w || 0; if (std) { var pp = std.p * w / 100, cc = std.c * w / 100, ff = std.f * w / 100; p += pp; c += cc; f += ff; kf += kcalPCF(pp, cc, ff); } else if (w) unknown = true; });
        var oilCut = parseFloat(oilCutI.value) || 0;
        var total = kf - oilCut;
        if (unknown && !manualTotalI.value) { U.toast('含未收录原料，请填总热量'); return; }
        if (manualTotalI.value) total = parseFloat(manualTotalI.value);
        if (!(total > 0)) { U.toast('热量为 0，请检查'); return; }
        pushDiet({ name: (dishNameI.value.trim() || '自定义菜') + '（拆分）', w: 0, p: round(p), c: round(c), f: round(f), kcal: round(total), manual: !!manualTotalI.value, split: true });
        U.toast('已记录 ' + round(total) + ' kcal'); render();
      } });
      renderSplits(); recalcDish();
      dCard.appendChild(dishNameI); dCard.appendChild(splitsBox); dCard.appendChild(addSplitBtn); dCard.appendChild(oilCutI); dCard.appendChild(manualTotalI); dCard.appendChild(totBox); dCard.appendChild(saveDishBtn);
      wrap.appendChild(dCard);

      // 今日汇总
      var sumCard = U.el('div', { class: 'card' });
      sumCard.appendChild(U.el('div', { class: 'card-sub', text: '今日饮食汇总' }));
      var dArr = dayDiet(today);
      var tot = U.el('div', { class: 'grid c4', style: 'gap:8px;margin:8px 0' });
      tot.appendChild(statCard('热量', sumK(dArr), 'kcal'));
      tot.appendChild(statCard('蛋白', sumP(dArr), 'g'));
      tot.appendChild(statCard('碳水', sumC(dArr), 'g'));
      tot.appendChild(statCard('脂肪', sumF(dArr), 'g'));
      sumCard.appendChild(tot);
      dArr.forEach(function (x) { sumCard.appendChild(dietRow(x)); });
      if (!dArr.length) sumCard.appendChild(U.el('div', { class: 'muted', text: '（暂无）' }));
      wrap.appendChild(sumCard);
      return wrap;
    }

    function dietRow(x) {
      var row = U.el('div', { class: 'row', style: 'justify-content:space-between;align-items:center;padding:8px 0;border-bottom:0.5px solid var(--border-3);font-size:13px' });
      row.appendChild(U.el('div', {}, [U.el('div', { text: x.meal + ' · ' + x.name }), U.el('div', { class: 'muted', style: 'font-size:12px', text: 'P' + x.p + ' C' + x.c + ' F' + x.f + (x.manual ? '（手动）' : '') })]));
      var right = U.el('div', { style: 'display:flex;align-items:center;gap:8px' });
      right.appendChild(U.el('span', { text: x.kcal + ' kcal' }));
      right.appendChild(U.el('button', { class: 'tag', text: '改', onclick: function () { editKcal(x); } }));
      row.appendChild(right);
      return row;
    }
    function editKcal(x) {
      var body = U.el('div');
      body.appendChild(U.el('div', { class: 'muted', text: x.name + ' · 当前 ' + x.kcal + ' kcal' }));
      var i = U.el('input', { class: 'input', type: 'number', value: x.kcal, style: 'margin-top:8px' });
      body.appendChild(i);
      U.modal({ title: '修改热量（适配煎制吸油等误差）', body: body, actions: [{ label: '保存', primary: true, onClick: function () { var v = parseFloat(i.value); if (v >= 0) { x.kcal = round(v); x.manual = true; saveDiet(); U.toast('已更新'); render(); } } }, { label: '取消', onClick: function () {} }] });
    }

    /* ===== ③ 运动消耗 ===== */
    function renderEx() {
      var wrap = U.el('div');
      var card = U.el('div', { class: 'card' });
      card.appendChild(U.el('div', { class: 'card-sub', text: '运动消耗记录（MET 公式）' }));
      var sel = U.el('select', { class: 'input', style: 'margin-top:6px' });
      Object.keys(D.METS).forEach(function (k) { sel.appendChild(U.el('option', { value: k, text: k + '（MET ' + D.METS[k] + '）' })); });
      var minI = U.el('input', { class: 'input', type: 'number', value: 30, style: 'margin-top:6px' });
      var autoBox = U.el('div', { class: 'muted', style: 'margin-top:6px;font-size:12px' });
      var manualI = U.el('input', { class: 'input', type: 'number', placeholder: '或手动填消耗 kcal', style: 'margin-top:6px' });
      function calcEx() { var k = round(D.METS[sel.value] * profile.curW * (parseFloat(minI.value) || 0) / 60); autoBox.textContent = '自动估算：MET ' + D.METS[sel.value] + ' × ' + profile.curW + 'kg × ' + (parseFloat(minI.value) || 0) + 'min = ' + k + ' kcal'; }
      sel.onchange = calcEx; minI.oninput = calcEx; calcEx();
      var addBtn = U.el('button', { class: 'btn', style: 'margin-top:10px', text: '记录运动', onclick: function () {
        var auto = round(D.METS[sel.value] * profile.curW * (parseFloat(minI.value) || 0) / 60);
        var mk = parseFloat(manualI.value); var k = mk ? mk : auto; if (!(k > 0)) { U.toast('请填写时长或消耗'); return; }
        pushEx({ name: sel.value + ' ' + (parseFloat(minI.value) || 0) + 'min', min: parseFloat(minI.value) || 0, kcal: round(k), manual: !!mk });
        U.toast('已记录 ' + round(k) + ' kcal'); render();
      } });
      card.appendChild(sel); card.appendChild(minI); card.appendChild(autoBox); card.appendChild(manualI); card.appendChild(addBtn);
      wrap.appendChild(card);

      var sumCard = U.el('div', { class: 'card' });
      var eArr = dayEx(today);
      sumCard.appendChild(U.el('div', { class: 'card-sub', text: '今日运动汇总' }));
      sumCard.appendChild(U.el('div', { style: 'font-size:15px;margin:6px 0', text: '总消耗 ' + sumK(eArr) + ' kcal' }));
      eArr.forEach(function (x) { sumCard.appendChild(U.el('div', { class: 'row', style: 'justify-content:space-between;padding:6px 0;font-size:13px' }, [U.el('span', { text: x.name }), U.el('span', { text: x.kcal + ' kcal' })])); });
      if (!eArr.length) sumCard.appendChild(U.el('div', { class: 'muted', text: '（暂无）' }));
      wrap.appendChild(sumCard);
      return wrap;
    }

    /* ===== ⑤ 数据统计与复盘 ===== */
    function renderStat() {
      var wrap = U.el('div');
      // 日期回溯
      var hCard = U.el('div', { class: 'card' });
      hCard.appendChild(U.el('div', { class: 'card-sub', text: '按日期回溯（只读）' }));
      var dateI = U.el('input', { class: 'input', type: 'date', value: today, style: 'margin-top:6px' });
      var histBox = U.el('div', { style: 'margin-top:8px' });
      function showHist() {
        U.clear(histBox);
        var d = dateI.value || today;
        var da = dayDiet(d), ea = dayEx(d);
        histBox.appendChild(U.el('div', { class: 'muted', text: d + ' · 摄入 ' + sumK(da) + ' / 运动 ' + sumK(ea) + ' kcal' }));
        if (da.length) histBox.appendChild(listCard('饮食', da.map(function (x) { return x.meal + ' · ' + x.name + ' · ' + x.kcal; })));
        if (ea.length) histBox.appendChild(listCard('运动', ea.map(function (x) { return x.name + ' · ' + x.kcal; })));
        if (!da.length && !ea.length) histBox.appendChild(U.el('div', { class: 'muted', text: '当天无记录' }));
      }
      dateI.onchange = showHist; showHist();
      hCard.appendChild(dateI); hCard.appendChild(histBox);
      wrap.appendChild(hCard);

      // 近 7 日
      var days = lastNDates(7);
      var deficits = [], exDays = 0, firstW = null, lastW = null;
      days.forEach(function (d) {
        var da = dayDiet(d), ea = dayEx(d);
        var inK = sumK(da), exK = sumK(ea);
        if (inK || exK) deficits.push((target() - inK) + exK);
        if (exK > 0) exDays++;
        var w = lastWeight(d);
        if (w != null) { if (firstW == null) firstW = w; lastW = w; }
      });
      var avgDef = deficits.length ? round(deficits.reduce(function (a, b) { return a + b; }, 0) / deficits.length) : 0;
      var wChg = (firstW != null && lastW != null) ? round(lastW - firstW) : 0;

      var sCard = U.el('div', { class: 'card' });
      sCard.appendChild(U.el('div', { class: 'card-title', text: '本周复盘（近 7 日）' }));
      var mg = U.el('div', { class: 'grid c3', style: 'gap:10px' });
      mg.appendChild(statCard('平均日缺口', avgDef, 'kcal'));
      mg.appendChild(statCard('体重变化', (wChg > 0 ? '+' : '') + wChg, 'kg'));
      mg.appendChild(statCard('运动天数', exDays, '/7'));
      sCard.appendChild(mg);
      sCard.appendChild(U.el('div', { class: 'muted', style: 'margin-top:10px', text: reviewText(avgDef, wChg, exDays) }));
      wrap.appendChild(sCard);
      return wrap;
    }
    function lastNDates(n) { var a = [], d = new Date(); for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); a.push(fmtDate(x)); } return a; }
    function fmtDate(d) { var m = d.getMonth() + 1, day = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day); }
    function reviewText(def, wchg, exDays) {
      var t = [];
      if (def > 0) t.push('本周平均处于热量缺口（' + def + ' kcal/天），方向正确，坚持住。');
      else t.push('本周平均未形成缺口，建议适当减少烹调油或增加有氧。');
      if (wchg < 0) t.push('体重下降 ' + Math.abs(wchg) + 'kg，减脂有效。');
      else if (wchg > 0) t.push('体重上升 ' + wchg + 'kg，注意是否盐分/水分或摄入偏多。');
      else t.push('体重基本持平。');
      if (exDays < 3) t.push('运动天数偏少（' + exDays + '/7），可加到 3-4 天。');
      else t.push('运动频次良好（' + exDays + '/7）。');
      return t.join(' ');
    }

    /* ---------- 通用小组件 ---------- */
    function statCard(label, val, unit) {
      var c = U.el('div', { style: 'background:var(--surface-2);border-radius:10px;padding:10px' });
      c.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px', text: label }));
      c.appendChild(U.el('div', { style: 'font-size:20px;font-weight:500;margin-top:2px', text: (val == null ? '0' : val) + (unit ? ' ' + unit : '') }));
      return c;
    }
    function listCard(title, items) {
      var c = U.el('div', { class: 'card' });
      c.appendChild(U.el('div', { class: 'card-sub', text: title }));
      if (!items.length) c.appendChild(U.el('div', { class: 'muted', text: '（暂无）' }));
      items.forEach(function (t) { c.appendChild(U.el('div', { class: 'row', style: 'justify-content:space-between;padding:6px 0;font-size:13px' }, [U.el('span', { text: t }), U.el('span', { class: 'muted', text: '' })])); });
      return c;
    }

    render();
  };
})();
