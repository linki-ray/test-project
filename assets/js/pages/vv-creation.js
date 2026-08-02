/* ============================================================
   爆款二创 —— 粘贴爆款链接/文字 → 解析内容 → AI式分析 → 出脚本+二创
   流程：输入(链接/文字) → 解析(parse-link 或 直接文本) → 内容分析
        → 生成 3 个二创脚本(复刻 / 双猫互动 / 反转) → 复制/发给AI
   账号定位：猫咪双猫账号（奶黄 + 橘猫布丁），二创一律换成猫设视角
   ============================================================ */
(function () {
  var API = (window.APP_CONFIG && window.APP_CONFIG.PARSE_API) || '/api/parse-link';
  App.pages = App.pages || {};

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function extractUrl(raw) {
    var m = (raw || '').match(/https?:\/\/[^\s"'<>\]]+/i);
    return m ? m[0].replace(/[。，,、.．]+$/, '') : '';
  }

  /* ---------- 内容分析（基于解析出的真实标题/正文/图片） ---------- */
  var EMOTIONS = [
    { key: '搞笑', words: ['搞笑', '笑死', '逗', '沙雕', '翻车', '社死', '乌龙', '迷惑', '名场面', '哈哈', '笑不'] },
    { key: '治愈', words: ['治愈', '暖', '温柔', '安心', '解压', '陪伴', '舒服', '佛系', '治愈系'] },
    { key: '萌', words: ['萌', '可爱', '奶', '软', '圆', '胖', '乖', '甜', '萌宠', '呆'] },
    { key: '反转', words: ['反转', '没想到', '竟然', '居然', '结果', '翻脸', '反差', '意外', '万万'] },
    { key: '惊奇', words: ['震惊', '不敢相信', '离谱', '绝了', '神操作', '高手', '硬核'] },
    { key: '共鸣', words: ['真实', '破防', '泪目', '懂的都懂', '是我', '扎心', '太难了', '人间'] },
    { key: '美食', words: ['吃', '饭', '食欲', '香', '好吃', '做菜', '食谱', '投喂'] }
  ];
  var ACTIONS = [
    { re: /洗澡|洗护|沐浴|搓澡/, v: '洗澡' },
    { re: /干饭|吃饭|进食|喂食|零食|罐头|猫粮/, v: '干饭' },
    { re: /睡觉|午睡|打盹|呼噜/, v: '睡觉' },
    { re: /拆家|捣乱|搞破坏|咬|抓/, v: '拆家' },
    { re: /玩耍|玩球|逗猫|互动|追/, v: '玩耍' },
    { re: /看病|体检|打针|绝育|医院/, v: '看病' },
    { re: /外出|遛|出行|旅游|坐车/, v: '外出' },
    { re: /争宠|吃醋|抢饭|抢窝|打架/, v: '争宠' },
    { re: /才艺|握手|坐下|指令|训练|技能/, v: '才艺' }
  ];
  var EMOTION_ACTION = { '搞笑': '拆家', '治愈': '睡觉', '萌': '干饭', '反转': '争宠', '惊奇': '才艺', '共鸣': '陪伴', '美食': '干饭' };

  function analyze(c) {
    var title = c.title || '';
    var text = c.text || '';
    var all = title + '\n' + text;
    var scores = {};
    EMOTIONS.forEach(function (e) { scores[e.key] = 0; e.words.forEach(function (w) { if (all.indexOf(w) >= 0) scores[e.key]++; }); });
    var ranked = EMOTIONS.map(function (e) { return { key: e.key, n: scores[e.key] }; }).sort(function (a, b) { return b.n - a.n; });
    var top = ranked.filter(function (x) { return x.n > 0; }).slice(0, 2).map(function (x) { return x.key; });
    if (!top.length) top = ['萌'];

    var structure = '情绪记录';
    if (/第一步|1\.|2\.|3\.|教程|步骤|做法|配方|方法/.test(text)) structure = '教程/过程展示';
    else if (/vs|对比|和.*比|pk|挑战|测评/.test(text)) structure = '对比/挑战';
    else if (/反转|没想到|竟然|居然|结果|却/.test(text)) structure = '反转/反差';
    else if (/vlog|一天|日常|记录|跟拍/.test(text)) structure = '日常Vlog';

    var conflict = '';
    var cm = text.match(/(但是|然而|结果|没想到|竟然|居然|翻车|社死|翻脸|却)[^。！？\n]*[。！？]?/g);
    if (cm && cm.length) conflict = cm[0].replace(/^[\s，。、]+/, '').trim();

    var action = '日常';
    for (var i = 0; i < ACTIONS.length; i++) { if (ACTIONS[i].re.test(all)) { action = ACTIONS[i].v; break; } }
    if (action === '日常') action = EMOTION_ACTION[top[0]] || '陪伴';

    var visual = (c.images && c.images.length)
      ? ('博主发了 ' + c.images.length + ' 张图/视频帧，封面与关键帧即视觉记忆点，建议二创时同样保留"定格特写+字幕"格式')
      : '建议固定机位+大特写抓表情，单帧定格比长镜头更易传播';

    var platformLabel = c.platform === 'xiaohongshu' ? '小红书' : (c.platform === 'douyin' ? '抖音' : (c.platform || '链接'));
    var timeTip = '晚 19:00–22:00（睡前刷猫高峰）';
    if (top.indexOf('搞笑') >= 0) timeTip = '午休 12:00–13:00 / 晚 18:00–20:00';
    else if (top.indexOf('美食') >= 0) timeTip = '饭点 11:00–12:00 / 17:00–18:00';
    else if (top.indexOf('治愈') >= 0 || top.indexOf('萌') >= 0) timeTip = '晚 20:00–22:30（助眠治愈流）';

    return {
      title: title, text: text, emotions: top, structure: structure, conflict: conflict,
      action: action, visual: visual, platform: platformLabel, timeTip: timeTip, images: c.images || []
    };
  }

  /* ---------- 脚本生成 ---------- */
  function personaOf(version) {
    if (version === 'duocat') return '奶黄 vs 橘猫布丁';
    if (version === 'reverse') return '橘猫布丁';
    return '奶黄';
  }
  function hookOf(a, version) {
    var act = a.action;
    if (version === 'duocat') return '你以为只有一只猫？奶黄和橘猫布丁同框，' + act + '的反应完全不同';
    if (version === 'reverse') return '都说橘猫' + act + '闹腾，布丁这次却一反常态……';
    return '第一次拍' + act + '，奶黄的反应出乎意料';
  }
  function shotsOf(a, version) {
    var act = a.action;
    var base = [
      { j: '特写', p: '猫悠闲舔毛/趴着，毫无防备', t: '2s', l: '轻松BGM起' },
      { j: '近景', p: act + '正式开始，镜头推进', t: '2s', l: '鼓点/停顿音效' },
      { j: '特写', p: '猫的表情瞬间变化', t: '3s', l: '音效放大' },
      { j: '大特写', p: '名场面定格（字幕点题）', t: '4s', l: '搞笑/治愈音效' },
      { j: '中景', p: '收尾引导互动', t: '3s', l: '口播/字幕：你家猫也这样？' }
    ];
    if (version === 'duocat') {
      base[2] = { j: '分屏', p: '奶黄 vs 布丁同框：一个淡定一个炸毛', t: '3s', l: '对比音效' };
      base[3] = { j: '大特写', p: '双猫反差名场面定格', t: '4s', l: '卡点音效' };
      base[4] = { j: '中景', p: '收尾：两只猫抢镜', t: '3s', l: '口播：你站奶黄还是布丁？' };
    } else if (version === 'reverse') {
      base[2] = { j: '近景', p: '铺垫"应该会很闹"，结果异常淡定', t: '3s', l: '反转音效' };
      base[3] = { j: '大特写', p: '反转名场面：布丁安静得像小天使', t: '4s', l: '治愈BGM' };
      base[4] = { j: '中景', p: '收尾：评论区猜反了', t: '3s', l: '口播：你猜对了吗？' };
    }
    return base;
  }
  function copyOf(a, version) {
    var act = a.action, emo = a.emotions[0] || '萌', persona = personaOf(version);
    var lines = [];
    lines.push('【标题】' + (version === 'duocat' ? '双猫' : (version === 'reverse' ? '反转' : '奶黄')) + act + '名场面｜' + emo);
    lines.push('【黄金3秒】' + hookOf(a, version));
    lines.push('【分镜】');
    shotsOf(a, version).forEach(function (s, i) {
      lines.push('  ' + (i + 1) + '. ' + s.j + ' ' + s.t + '：' + s.p + '（' + s.l + '）');
    });
    lines.push('【文案】今天拍到' + persona + act + '，' + emo + '到不行，你们家猫' + act + '也这样吗？');
    lines.push('【标签】#猫咪日常 #' + (version === 'duocat' ? '双猫 ' : '') + '奶黄 #橘猫布丁 #' + act + ' #萌宠');
    lines.push('【BGM】' + (emo === '搞笑' ? '搞笑音效/卡点' : (emo === '治愈' || emo === '萌' ? '治愈轻音乐' : '情绪向BGM')));
    lines.push('【发布】' + a.timeTip + ' · 平台：' + a.platform);
    return lines.join('\n');
  }
  function buildScriptCard(a, version) {
    var card = U.el('div', { class: 'vv-card' });
    var name = version === 'duocat' ? '🐱 双猫互动版（奶黄+布丁）' : (version === 'reverse' ? '🔄 反转/反差版' : '📋 原结构复刻版');
    var badge = version === 'duocat' ? '你的核心优势' : (version === 'reverse' ? '反差流量' : '稳妥起号');
    card.appendChild(U.el('div', { class: 'vv-card-head' }, [
      U.el('span', { class: 'vv-card-title', text: name }),
      U.el('span', { class: 'vv-badge', text: badge })
    ]));
    card.appendChild(U.el('div', { class: 'vv-row', style: 'margin:6px 0', html:
      '<b>黄金3秒：</b>' + esc(hookOf(a, version)) }));
    // 分镜表
    var tbl = '<table class="shot-table"><thead><tr><th>#</th><th>景别</th><th>画面</th><th>时长</th><th>音效/台词</th></tr></thead><tbody>';
    shotsOf(a, version).forEach(function (s, i) {
      tbl += '<tr><td>' + (i + 1) + '</td><td>' + esc(s.j) + '</td><td>' + esc(s.p) + '</td><td>' + esc(s.t) + '</td><td>' + esc(s.l) + '</td></tr>';
    });
    tbl += '</tbody></table>';
    card.appendChild(U.el('div', { class: 'vv-row', html: '<b>分镜：</b>' }));
    card.appendChild(U.el('div', { html: tbl }));
    var emo = a.emotions[0] || '萌';
    card.appendChild(U.el('div', { class: 'vv-row', html:
      '<b>文案：</b>今天拍到' + esc(personaOf(version)) + esc(a.action) + '，' + esc(emo) + '到不行，你们家猫' + esc(a.action) + '也这样吗？' }));
    card.appendChild(U.el('div', { class: 'vv-row', html:
      '<b>标签：</b>' + esc('#猫咪日常 #' + (version === 'duocat' ? '双猫 ' : '') + '奶黄 #橘猫布丁 #' + a.action + ' #萌宠') }));
    card.appendChild(U.el('div', { class: 'vv-row', html:
      '<b>BGM：</b>' + esc(emo === '搞笑' ? '搞笑音效/卡点' : (emo === '治愈' || emo === '萌' ? '治愈轻音乐' : '情绪向BGM')) }));
    card.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: '📋 复制脚本', onclick: function () {
      var txt = copyOf(a, version);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { U.toast('已复制'); }, function () { fallbackCopy(txt); });
      else fallbackCopy(txt);
    } }));
    return card;
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); U.toast('已复制'); } catch (e) { U.toast('复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }

  function buildPrompt(a) {
    return '你是宠物短视频爆款策划。请基于下面这条爆款内容，做三件事：\n'
      + '1) 分析它为什么火（情绪点/结构/评论区槽点/视觉记忆点）；\n'
      + '2) 提供 3 个二创脚本（原结构复刻版 / 双猫互动版 / 反转版），每个含黄金3秒、分镜表、文案、标签、BGM；\n'
      + '3) 账号视角统一换成「猫咪双猫账号：奶黄 + 橘猫布丁」，双猫互动（抢窝/抢饭/争宠/性格反差）作为核心优势。\n\n'
      + '【爆款标题】' + a.title + '\n'
      + '【爆款平台】' + a.platform + '\n'
      + '【爆款正文】\n' + a.text + '\n'
      + '【已初步判断】情绪=' + a.emotions.join('/') + ' 结构=' + a.structure + ' 核心动作=' + a.action;
  }

  /* ---------- 页面 ---------- */
  App.pages['vv-creation'] = function (root) {
    root.innerHTML = '';
    var a = U.el('div', { class: 'page-pad' });

    a.appendChild(U.el('div', { class: 'card-title', text: '爆款二创 · 一条爆款 → 一套猫版脚本' }));
    a.appendChild(U.el('div', { class: 'muted', style: 'margin:4px 0 12px', text: '粘贴一条抖音/小红书爆款链接（或整段分享文字、或纯文案），自动解析内容 → 分析它为什么火 → 生成 3 个可直接拍的二创脚本。' }));

    // 输入区
    var box = U.el('div', { class: 'card' });
    var ta = U.el('textarea', { class: 'input', rows: '4', placeholder: '粘贴爆款链接，或整段分享文字，或直接粘贴文案……', style: 'width:100%;resize:vertical' });
    box.appendChild(ta);
    var row = U.el('div', { class: 'row', style: 'gap:8px;margin-top:8px' });
    var btnLink = U.el('button', { class: 'btn sm', text: '🔗 解析链接', onclick: function () { doParse(ta.value, 'link'); } });
    var btnText = U.el('button', { class: 'btn ghost sm', text: '📝 解析文字', onclick: function () { doParse(ta.value, 'text'); } });
    row.appendChild(btnLink); row.appendChild(btnText);
    box.appendChild(row);
    a.appendChild(box);

    var preview = U.el('div', { class: 'vv-preview', style: 'margin-top:12px' });
    a.appendChild(preview);
    var result = U.el('div', { style: 'margin-top:14px' });
    a.appendChild(result);

    var current = null;
    function doParse(raw, mode) {
      raw = (raw || '').trim();
      if (!raw) { U.toast('请先粘贴内容'); return; }
      if (mode === 'link') {
        var url = extractUrl(raw);
        if (!url) { U.toast('没找到链接，已自动改用文字解析'); return doParse(raw, 'text'); }
        preview.innerHTML = '<div class="muted">解析中…</div>';
        fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url }) }).then(function (r) { return r.json(); }).then(function (r) {
          if (!r || !r.ok) { preview.innerHTML = '<div class="muted">链接解析失败：' + esc((r && r.error) || '未知') + '，可改用「解析文字」手动粘贴文案。</div>'; return; }
          var c = { title: r.title || '', text: r.text || '', images: r.images || [], platform: r.platform || '' };
          current = c; renderPreview(c, r.sourceUrl);
        }).catch(function (e) { preview.innerHTML = '<div class="muted">请求失败：' + esc(e && e.message || e) + '，可改用「解析文字」。</div>'; });
      } else {
        var c2 = { title: '', text: raw, images: [], platform: '' };
        // 尝试从文字第一行当标题
        var lines = raw.split(/\n+/); if (lines[0] && lines[0].length < 40) c2.title = lines[0];
        current = c2; renderPreview(c2, '');
      }
    }
    function renderPreview(c, src) {
      preview.innerHTML = '';
      var card = U.el('div', { class: 'card' });
      card.appendChild(U.el('div', { class: 'card-sub', text: '解析结果' + (src ? '（' + (c.platform === 'xiaohongshu' ? '小红书' : (c.platform === 'douyin' ? '抖音' : '链接')) + '）' : '（文字）') }));
      if (c.images && c.images.length) {
        var gal = U.el('div', { class: 'row wrap', style: 'gap:6px;margin:6px 0' });
        c.images.slice(0, 8).forEach(function (u) { gal.appendChild(U.el('img', { src: u, style: 'width:84px;height:84px;object-fit:cover;border-radius:8px;background:var(--surface-3)', onerror: function () { this.style.display = 'none'; } })); });
        card.appendChild(gal);
      }
      if (c.title) card.appendChild(U.el('div', { style: 'font-weight:800;font-size:15px;margin-top:4px', text: c.title }));
      if (c.text) card.appendChild(U.el('div', { style: 'white-space:pre-wrap;font-size:13px;margin-top:6px;max-height:200px;overflow:auto;color:var(--text-2)', text: c.text }));
      card.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:10px', text: '🎬 生成二创方案', onclick: function () { gen(current); } }));
      // 也支持保存为素材（可选）
      card.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px;margin-left:8px', text: '💾 存为素材', onclick: function () { saveMaterial(c); } }));
      preview.appendChild(card);
    }
    function saveMaterial(c) {
      try {
        var arr = JSON.parse(localStorage.getItem('vv_materials') || '[]');
        arr.unshift({ title: c.title || '未命名爆款', text: c.text || '', images: c.images || [], platform: c.platform || '', ts: Date.now() });
        localStorage.setItem('vv_materials', JSON.stringify(arr.slice(0, 200)));
        U.toast('已存为素材（可在素材库查看）');
      } catch (e) { U.toast('保存失败'); }
    }
    function gen(c) {
      var an = analyze(c);
      result.innerHTML = '';
      // 分析卡
      var ac = U.el('div', { class: 'card vv-analysis' });
      ac.appendChild(U.el('div', { class: 'card-sub', text: '🔍 爆火分析（基于内容）' }));
      var rows = [
        ['情绪点', an.emotions.join(' / ')],
        ['可抄结构', an.structure],
        ['核心动作', an.action],
        ['评论区槽点/反转', an.conflict || '（文案未显式提及，建议拍时人为制造一个小反转/槽点）'],
        ['视觉记忆点', an.visual],
        ['适合平台/时间', an.platform + ' · ' + an.timeTip]
      ];
      var t = '<table class="shot-table vv-analysis-tbl"><tbody>';
      rows.forEach(function (r) { t += '<tr><td class="vv-k">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; });
      t += '</tbody></table>';
      ac.appendChild(U.el('div', { html: t }));
      result.appendChild(ac);
      // 3 脚本
      result.appendChild(U.el('div', { class: 'card-sub', style: 'margin:14px 0 6px', text: '🎬 三个二创脚本（点击复制）' }));
      var grid = U.el('div', { class: 'grid c1' });
      ['replica', 'duocat', 'reverse'].forEach(function (v) { grid.appendChild(buildScriptCard(an, v)); });
      result.appendChild(grid);
      // 发给AI
      var ai = U.el('div', { class: 'card', style: 'margin-top:14px' });
      ai.appendChild(U.el('div', { class: 'card-sub', text: '🤖 发给 AI 深度解析（复制后去豆包/通义/智谱粘贴）' }));
      var ptxt = buildPrompt(an);
      ai.appendChild(U.el('textarea', { class: 'input', rows: '6', readonly: 'readonly', value: ptxt, style: 'width:100%;resize:vertical;font-size:12px' }));
      ai.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: '📋 复制提示词', onclick: function () {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ptxt).then(function () { U.toast('已复制'); }, function () { fallbackCopy(ptxt); });
        else fallbackCopy(ptxt);
      } }));
      result.appendChild(ai);
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    root.appendChild(a);
  };
})();
