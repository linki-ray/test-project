/* ============================================================
   阅读读书 —— 本地电子书阅读器
   - 支持导入 TXT 电子书（后续可扩展 EPUB/PDF）
   - 自动记录阅读时长、滚动进度、退出时自动保存书签
   - 下次进入恢复到上次离开位置
   - 说明：微信读书受版权保护，无法直接在本应用内阅读其内容；
     此处可导入用户自有 TXT 文件，数据完全本地存储。
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};
(function () {
  var U = App.U, S = App.Store;
  var BOOKS_KEY = 'reading_books';
  var CURRENT_KEY = 'reading_current';
  var readingTimer = null;

  function getBooks() { return S.get(BOOKS_KEY, []); }
  function setBooks(books) { S.set(BOOKS_KEY, books); }
  function getCurrentId() { return S.get(CURRENT_KEY, null); }
  function setCurrentId(id) { S.set(CURRENT_KEY, id); }

  function formatTime(seconds) {
    if (!seconds || seconds < 60) return seconds + '秒';
    var m = Math.floor(seconds / 60);
    if (m < 60) return m + '分钟';
    var h = Math.floor(m / 60), rm = m % 60;
    return h + '小时' + (rm ? rm + '分钟' : '');
  }
  function formatDate(iso) {
    if (!iso) return '未读';
    var d = new Date(iso);
    var now = new Date();
    if (d.toDateString() === now.toDateString()) return '今天 ' + U.fmtTime(d);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + U.fmtTime(d);
  }
  function makeId() { return 'book_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

  App.pages['reading'] = function (root) {
    U.clear(root);
    var currentId = getCurrentId();
    if (currentId) {
      var book = getBooks().find(function (b) { return b.id === currentId; });
      if (book) { openBook(root, book); return; }
      setCurrentId(null);
    }
    renderLibrary(root);
  };

  function renderLibrary(root) {
    var books = getBooks();
    var wrap = U.el('div');

    // 顶部操作栏
    var head = U.el('div', { class: 'card' });
    head.appendChild(U.el('div', { class: 'card-title', text: '我的书架' }));
    var row = U.el('div', { class: 'row' });
    var fileInput = U.el('input', {
      type: 'file', accept: '.txt', style: 'display:none',
      onchange: function () { importTxt(this.files[0]); this.value = ''; }
    });
    row.appendChild(U.el('button', { class: 'btn', text: '+ 导入 TXT 书籍', onclick: function () { fileInput.click(); } }));
    row.appendChild(U.el('button', { class: 'btn ghost', text: '微信读书说明', onclick: showWeReadInfo }));
    head.appendChild(row);
    head.appendChild(fileInput);
    wrap.appendChild(head);

    // 统计
    var totalSec = books.reduce(function (a, b) { return a + (b.stats && b.stats.totalSeconds || 0); }, 0);
    var totalBooks = books.length;
    var finished = books.filter(function (b) { return b.progress && b.progress.percent >= 99; }).length;
    var statCard = U.el('div', { class: 'card' });
    statCard.appendChild(U.el('div', { class: 'card-title', text: '阅读统计' }));
    var grid = U.el('div', { class: 'grid c3' });
    grid.appendChild(statBox('藏书', totalBooks + '本'));
    grid.appendChild(statBox('累计时长', formatTime(totalSec)));
    grid.appendChild(statBox('已读完', finished + '本'));
    statCard.appendChild(grid);
    wrap.appendChild(statCard);

    // 书籍列表
    if (!books.length) {
      var empty = U.el('div', { class: 'card' });
      empty.appendChild(U.el('div', { class: 'empty', text: '书架为空，点击上方「导入 TXT 书籍」开始阅读' }));
      wrap.appendChild(empty);
    } else {
      var list = U.el('div', { class: 'grid c1' });
      books.forEach(function (b) {
        var pct = b.progress && b.progress.percent ? Math.round(b.progress.percent) : 0;
        var c = U.el('div', { class: 'card', style: 'cursor:pointer', onclick: function () { openBook(root, b); } });
        var top = U.el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' });
        top.appendChild(U.el('div', { style: 'font-weight:700;font-size:16px', text: b.title || '未命名书籍' }));
        top.appendChild(U.el('button', {
          class: 'icon-btn', html: '🗑', style: 'margin:-6px -6px 0 0',
          onclick: function (e) { e.stopPropagation(); deleteBook(b.id); renderLibrary(root); }
        }));
        c.appendChild(top);
        c.appendChild(U.el('div', { class: 'muted', style: 'margin:4px 0', text: (b.author || '未知作者') + ' · ' + formatSize(b.size) + ' · 已读 ' + formatTime(b.stats && b.stats.totalSeconds || 0) }));
        // 进度条
        var barWrap = U.el('div', { style: 'background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden;margin:8px 0' });
        var bar = U.el('div', { style: 'background:var(--brand);height:100%;width:' + pct + '%' });
        barWrap.appendChild(bar);
        c.appendChild(barWrap);
        c.appendChild(U.el('div', { style: 'display:flex;justify-content:space-between;font-size:12px', text: '进度 ' + pct + '% · 上次 ' + formatDate(b.stats && b.stats.lastReadAt) }));
        list.appendChild(c);
      });
      wrap.appendChild(list);
    }
    root.appendChild(wrap);
  }

  function statBox(label, val) {
    var d = U.el('div', { style: 'background:var(--surface-2);border-radius:10px;padding:12px;text-align:center' });
    d.appendChild(U.el('div', { style: 'font-size:20px;font-weight:800', text: val }));
    d.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px', text: label }));
    return d;
  }
  function formatSize(bytes) {
    if (!bytes) return '0B';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(2) + 'MB';
  }

  function importTxt(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { U.toast('文件过大，请先压缩或拆分（当前限制 5MB）'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      // 简单编码探测：若含乱码特征，尝试用 TextDecoder 重新解码 GBK
      var title = file.name.replace(/\.txt$/i, '');
      var book = {
        id: makeId(), title: title, author: guessAuthor(text), type: 'txt',
        size: file.size, content: text,
        progress: { scrollTop: 0, scrollHeight: 0, percent: 0 },
        stats: { totalSeconds: 0, lastReadAt: null },
        createdAt: new Date().toISOString()
      };
      var books = getBooks(); books.unshift(book); setBooks(books);
      U.toast('已导入《' + title + '》');
      // 重新渲染当前页面
      var root = U.$('#pageRoot');
      if (root) renderLibrary(root);
    };
    reader.readAsText(file);
  }
  function guessAuthor(text) {
    // 尝试从文本开头匹配 作者：xxx / 作者:xxx
    var m = text.slice(0, 500).match(/[作者|著者|编者][：:]\s*([^\n\r]{1,20})/);
    return m ? m[1].trim() : '未知作者';
  }
  function deleteBook(id) {
    if (!confirm('确定从书架删除这本书？阅读进度也将被清除。')) return;
    var books = getBooks().filter(function (b) { return b.id !== id; });
    setBooks(books);
    if (getCurrentId() === id) setCurrentId(null);
    U.toast('已删除');
  }

  function openBook(root, book) {
    setCurrentId(book.id);
    U.clear(root);
    stopTimer();

    var wrap = U.el('div', { class: 'reader-fullscreen' });
    // 顶部工具栏
    var header = U.el('div', { class: 'card', style: 'margin:0;border-radius:0;padding:10px 12px;flex:0 0 auto' });
    var hRow = U.el('div', { style: 'display:flex;justify-content:space-between;align-items:center' });
    hRow.appendChild(U.el('button', {
      class: 'btn ghost xs', text: '← 返回书架',
      onclick: function () { saveProgress(); stopTimer(); setCurrentId(null); App.pages['reading'](root); }
    }));
    hRow.appendChild(U.el('div', { style: 'font-weight:700;text-align:center;flex:1;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: book.title }));
    var timerEl = U.el('div', { style: 'font-size:12px;color:var(--muted);min-width:70px;text-align:right', text: '00:00' });
    hRow.appendChild(timerEl);
    header.appendChild(hRow);

    // 进度条
    var progWrap = U.el('div', { style: 'background:var(--surface-2);border-radius:6px;height:6px;overflow:hidden;margin-top:10px' });
    var progBar = U.el('div', { style: 'background:var(--brand);height:100%;width:0%' });
    progWrap.appendChild(progBar);
    header.appendChild(progWrap);
    wrap.appendChild(header);

    // 阅读区
    var scroller = U.el('div', {
      style: 'flex:1 1 auto;overflow-y:auto;padding:16px 24px 40px;line-height:1.9;font-size:17px;-webkit-overflow-scrolling:touch',
      id: 'readerScroller'
    });
    var contentEl = U.el('div', { style: 'max-width:720px;margin:0 auto;white-space:pre-wrap;word-break:break-word' });
    contentEl.textContent = book.content;
    scroller.appendChild(contentEl);
    wrap.appendChild(scroller);

    // 底部提示
    var footer = U.el('div', { class: 'card', style: 'margin:0;border-radius:0;padding:8px 12px;flex:0 0 auto;font-size:12px;color:var(--muted);text-align:center' });
    var pctEl = U.el('span');
    footer.appendChild(pctEl);
    wrap.appendChild(footer);

    root.appendChild(wrap);

    // 恢复进度
    function restore() {
      var p = book.progress || {};
      if (p.scrollTop && scroller.scrollHeight) {
        scroller.scrollTop = Math.min(p.scrollTop, scroller.scrollHeight - scroller.clientHeight);
      }
      updateProgressUI();
    }
    // 等待渲染完成
    setTimeout(restore, 50);

    // 进度/时间更新
    function updateProgressUI() {
      var sh = scroller.scrollHeight || 1;
      var st = scroller.scrollTop || 0;
      var ch = scroller.clientHeight || 1;
      var pct = Math.min(100, Math.max(0, (st / (sh - ch)) * 100));
      progBar.style.width = pct + '%';
      pctEl.textContent = '已读 ' + pct.toFixed(1) + '% · 自动保存进度';
      return { scrollTop: st, scrollHeight: sh, percent: pct };
    }
    function saveProgress() {
      var p = updateProgressUI();
      flushTime();
      var books = getBooks();
      var idx = books.findIndex(function (b) { return b.id === book.id; });
      if (idx > -1) {
        books[idx].progress = p;
        books[idx].stats = books[idx].stats || {};
        books[idx].stats.lastReadAt = new Date().toISOString();
        setBooks(books);
      }
    }
    function flushTime() {
      var remain = sessionSeconds - persistedSeconds;
      if (remain > 0) persistSeconds(remain);
    }

    // 滚动监听（防抖保存）
    var saveTimer = null;
    scroller.addEventListener('scroll', function () {
      updateProgressUI();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveProgress, 500);
    });

    // 阅读计时（页面可见且处于阅读页时累计）
    var sessionSeconds = 0, persistedSeconds = 0;
    function tick() {
      sessionSeconds++;
      timerEl.textContent = fmtMMSS(sessionSeconds);
      // 每 10 秒持久化一次，避免每秒写 localStorage
      if (sessionSeconds - persistedSeconds >= 10) persistSeconds(10);
    }
    readingTimer = setInterval(tick, 1000);
    timerEl.textContent = fmtMMSS(0);
    function persistSeconds(n) {
      persistedSeconds += n;
      var books = getBooks();
      var idx = books.findIndex(function (b) { return b.id === book.id; });
      if (idx > -1) {
        books[idx].stats = books[idx].stats || {};
        books[idx].stats.totalSeconds = (books[idx].stats.totalSeconds || 0) + n;
        books[idx].stats.lastReadAt = new Date().toISOString();
        setBooks(books);
      }
    }

    // 页面隐藏/关闭时保存
    function onHide() {
      if (document.hidden) saveProgress();
    }
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', saveProgress);

    // 清理函数：当页面被替换时停止计时并移除监听（本应用切换页面前会清空 root，这里用 MutationObserver 兜底）
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (Array.from(m.removedNodes).indexOf(wrap) > -1) {
          stopTimer(); saveProgress();
          document.removeEventListener('visibilitychange', onHide);
          window.removeEventListener('beforeunload', saveProgress);
          observer.disconnect();
        }
      });
    });
    observer.observe(root, { childList: true, subtree: false });
  }

  function stopTimer() {
    if (readingTimer) { clearInterval(readingTimer); readingTimer = null; }
  }
  function fmtMMSS(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function showWeReadInfo() {
    U.modal({
      title: '关于微信读书',
      body: U.el('div', {}, [
        U.el('p', { text: '微信读书 App 内的正版书籍受 DRM 版权保护，微信读书并未提供公开接口让第三方应用直接读取书籍正文。因此本应用无法直接打开你在微信读书收藏的书。' }),
        U.el('p', { text: '当前支持的阅读方式：' }),
        U.el('ul', {}, [
          U.el('li', { text: '导入你自己拥有的 TXT 电子书文件' }),
          U.el('li', { text: '自动记录阅读时长、百分比进度、退出书签' }),
          U.el('li', { text: '下次进入「阅读读书」自动回到上次离开的位置' })
        ]),
        U.el('p', { class: 'muted', style: 'margin-top:10px;font-size:12px', text: '后续可考虑接入微信读书官方 Skills API（需用户自行申请 API Key）同步书架元数据，但书籍正文仍需在微信读书 App 内阅读。' })
      ])
    });
  }
})();
