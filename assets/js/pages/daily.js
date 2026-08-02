/* ============================================================
   每日内容参谋（今日行动建议 / 爆款雷达 / 一键拍摄脚本）
   - 数据来自 assets/data/daily-data.js（window.__DAILY__）
   - 该文件由每日自动化任务（GitHub API 写文件 + push）覆盖更新，
     实现「不开电脑、手机随时刷站点即最新」。
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};
(function () {
  var U = App.U;

  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function getDaily() { return window.__DAILY__ || null; }

  App.pages['daily-advice'] = function (root) {
    U.clear(root);
    var d = getDaily();
    if (!d) {
      root.appendChild(U.el('div', { class: 'card', text: '暂无今日数据，请等待每日自动化任务更新，或检查 assets/data/daily-data.js。' }));
      return;
    }

    // 顶部情绪问候
    if (d.greeting) {
      root.appendChild(U.el('div', { class: 'daily-greeting', text: d.greeting }));
    }

    // 今日行动建议
    var advice = U.el('div', { class: 'card daily-advice' });
    advice.appendChild(U.el('div', { class: 'card-title', text: '📌 今日行动建议' }));
    if (d.advice && d.advice.title) {
      advice.appendChild(U.el('div', { class: 'advice-title', text: d.advice.title }));
    }
    var reasons = U.el('ul', { class: 'advice-reasons' });
    (d.advice && d.advice.reasons ? d.advice.reasons : []).forEach(function (r) {
      reasons.appendChild(U.el('li', { text: r }));
    });
    advice.appendChild(reasons);
    if (d.advice && d.advice.postTime) {
      advice.appendChild(U.el('div', { class: 'advice-meta', text: '⏰ ' + d.advice.postTime }));
    }
    if (d.advice && d.advice.platforms && d.advice.platforms.length) {
      advice.appendChild(U.el('div', { class: 'advice-meta', text: '📡 建议平台：' + d.advice.platforms.join(' / ') }));
    }
    root.appendChild(advice);

    // 爆款雷达
    if (d.hot && d.hot.length) {
      var hot = U.el('div', { class: 'card' });
      hot.appendChild(U.el('div', { class: 'card-title', text: '🔥 今日爆款雷达（更新于 ' + (d.date || '') + '）' }));
      d.hot.forEach(function (h) {
        var item = U.el('div', { class: 'hot-item' });
        item.appendChild(U.el('div', { class: 'hot-tag', text: '# ' + (h.tag || '') }));
        if (h.note) item.appendChild(U.el('div', { class: 'hot-note', text: h.note }));
        if (h.angle && h.angle.length) {
          item.appendChild(U.el('div', { class: 'hot-angle muted', text: '可拍角度：' + h.angle.join(' / ') }));
        }
        hot.appendChild(item);
      });
      root.appendChild(hot);
    }

    // 一键拍摄脚本
    if (d.script) {
      var sc = U.el('div', { class: 'card' });
      sc.appendChild(U.el('div', { class: 'card-title', text: '🎬 一键拍摄脚本' + (d.script.title ? '：' + d.script.title : '') }));
      if (d.script.hook) sc.appendChild(U.el('div', { class: 'script-line', text: '黄金3秒：' + d.script.hook }));
      (d.script.beats || []).forEach(function (b, i) {
        sc.appendChild(U.el('div', { class: 'script-line', text: (i + 1) + '. ' + b }));
      });
      if (d.script.tags && d.script.tags.length) {
        sc.appendChild(U.el('div', { class: 'script-tags', text: '标签：' + d.script.tags.join(' ') }));
      }
      if (d.script.bgm) sc.appendChild(U.el('div', { class: 'script-line muted', text: 'BGM：' + d.script.bgm }));
      sc.appendChild(U.el('button', {
        class: 'btn ghost sm', style: 'margin-top:10px', text: '复制脚本',
        onclick: function () {
          var lines = [];
          if (d.script.title) lines.push('【标题】' + d.script.title);
          if (d.script.hook) lines.push('黄金3秒：' + d.script.hook);
          (d.script.beats || []).forEach(function (b, i) { lines.push((i + 1) + '. ' + b); });
          if (d.script.tags && d.script.tags.length) lines.push('标签：' + d.script.tags.join(' '));
          if (d.script.bgm) lines.push('BGM：' + d.script.bgm);
          if (copyText(lines.join('\n'))) U.toast('脚本已复制到剪贴板');
          else U.toast('复制失败，请手动选择');
        }
      }));
      root.appendChild(sc);
    }

    // 更新时间
    root.appendChild(U.el('div', {
      class: 'muted daily-updated',
      text: '数据更新于 ' + (d.updatedAt || d.date || '未知') + ' · 由每日自动化任务刷新（无需开电脑）'
    }));
  };
})();
