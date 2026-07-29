/* =========================================================
   工具函数：DOM、弹窗、提醒、导出、时间等
   ========================================================= */
window.App = window.App || {};

App.U = (function () {
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function fmtDate(d) {
    d = d || new Date();
    return App.Store.todayStr(d);
  }
  function fmtTime(d) {
    d = d || new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- Toast ---- */
  function toast(msg, ms) {
    var root = $('#toastRoot');
    var t = el('div', { class: 'toast', text: msg });
    root.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(function () { t.remove(); }, 300); }, ms || 2200);
  }

  /* ---- 应用内重要提醒弹窗 ---- */
  function notify(title, body, opts) {
    opts = opts || {};
    var root = $('#notifyRoot');
    var card = el('div', { class: 'notify' + (opts.warn ? ' warn' : '') });
    var actions = el('div', { class: 'row' });
    card.appendChild(el('h4', { text: title }));
    if (body) card.appendChild(el('p', { text: body }));
    if (opts.actions && opts.actions.length) {
      opts.actions.forEach(function (a) {
        actions.appendChild(el('button', { class: 'btn sm ' + (a.primary ? '' : 'ghost'), text: a.label, onclick: function () {
          try { a.onClick && a.onClick(); } finally { card.remove(); }
        } }));
      });
      card.appendChild(actions);
    } else {
      var ok = el('button', { class: 'btn sm ghost', text: '知道了', onclick: function () { card.remove(); } });
      actions.appendChild(ok); card.appendChild(actions);
    }
    root.appendChild(card);
    if (opts.autoClose) setTimeout(function () { card.remove(); }, opts.autoClose);
    // 同时尝试系统通知
    try {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification(title, { body: body || '' });
      }
    } catch (e) {}
  }

  /* ---- 通用模态框 ---- */
  function modal(opts) {
    // opts: { title, body(node|string), actions:[{label,primary,onClick}], onClose }
    var mask = el('div', { class: 'modal-mask' });
    var box = el('div', { class: 'modal' });
    box.appendChild(el('h3', { text: opts.title || '' }));
    if (typeof opts.body === 'string') box.appendChild(el('div', { html: opts.body }));
    else if (opts.body) box.appendChild(opts.body);
    var act = el('div', { class: 'modal-actions' });
    (opts.actions || []).forEach(function (a) {
      act.appendChild(el('button', { class: 'btn ' + (a.primary ? '' : 'ghost'), text: a.label, onclick: function () {
        var r = a.onClick && a.onClick();
        if (r !== false) close();
      } }));
    });
    if (opts.actions && opts.actions.length) box.appendChild(act);
    mask.appendChild(box);
    function close() { mask.remove(); opts.onClose && opts.onClose(); }
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    $('#modalRoot').appendChild(mask);
    return { close: close, box: box };
  }

  /* ---- 导出文件（本地存档） ---- */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
  }
  function exportJSON(filename, obj) { download(filename, JSON.stringify(obj, null, 2), 'application/json'); }

  /* ---- 提醒调度（基于 setInterval 本地轮询；应用打开时生效） ---- */
  var reminderTimers = [];
  function scheduleCheck(fn, everyMs) {
    reminderTimers.push(setInterval(fn, everyMs || 30000));
  }
  function clearTimers() { reminderTimers.forEach(function (t) { clearInterval(t); }); reminderTimers = []; }

  function requestNotifyPermission() {
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  }

  /* ---- 简易 fetch JSON（带超时） ---- */
  function fetchJSON(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms || 8000);
      fetch(url, { mode: 'cors' }).then(function (r) { return r.text(); }).then(function (t) {
        if (done) return; done = true; clearTimeout(timer);
        try { resolve(JSON.parse(t)); } catch (e) { reject(e); }
      }).catch(function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
  }

  return {
    el: el, $: $, $all: $all, clear: clear, uid: uid,
    fmtDate: fmtDate, fmtTime: fmtTime, esc: esc,
    toast: toast, notify: notify, modal: modal,
    download: download, exportJSON: exportJSON,
    scheduleCheck: scheduleCheck, clearTimers: clearTimers, requestNotifyPermission: requestNotifyPermission,
    fetchJSON: fetchJSON
  };
})();
