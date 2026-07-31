/* ============================================================
   阅读读书 —— 本地电子书阅读器 + 微信读书书架同步
   - 本地导入：TXT / EPUB（EPUB 二进制存 IndexedDB，元数据存 localStorage）
   - EPUB 阅读：目录 / 章节跳转 / 字体缩放 / 主题(亮/护眼/暗) / 进度(CFI)
   - 自动记录阅读时长、进度、退出时自动保存书签，下次进入恢复位置
   - 微信读书：绑定 API Key（存本机）→ 同步书架/进度 → 点开跳 App 续读
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};
(function () {
  var U = App.U, S = App.Store;
  var BOOKS_KEY = 'reading_books';
  var CURRENT_KEY = 'reading_current';
  var WEREAD_KEY = 'weread_key';
  var EPUB_DB = 'reading_epubs';
  var readingTimer = null;

  function getBooks() { return S.get(BOOKS_KEY, []); }
  function setBooks(books) { S.set(BOOKS_KEY, books); }
  function getCurrentId() { return S.get(CURRENT_KEY, null); }
  function setCurrentId(id) { S.set(CURRENT_KEY, id); }
  function getWereadKey() { return S.get(WEREAD_KEY, ''); }
  function setWereadKey(k) { S.set(WEREAD_KEY, k); }

  /* ---------- IndexedDB（存 EPUB 二进制） ---------- */
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(EPUB_DB, 1);
      req.onupgradeneeded = function (e) { e.target.result.createObjectStore('epubs'); };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }
  function idbPut(id, buf) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('epubs', 'readwrite');
        tx.objectStore('epubs').put(buf, id);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbGet(id) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var r = db.transaction('epubs', 'readonly').objectStore('epubs').get(id);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbDel(id) {
    return openDB().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction('epubs', 'readwrite');
        tx.objectStore('epubs').delete(id);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { res(); };
      });
    });
  }

  /* ---------- 工具 ---------- */
  function formatTime(seconds) {
    if (!seconds || seconds < 60) return seconds + '秒';
    var m = Math.floor(seconds / 60);
    if (m < 60) return m + '分钟';
    var h = Math.floor(m / 60), rm = m % 60;
    return h + '小时' + (rm ? rm + '分钟' : '');
  }
  function formatDate(iso) {
    if (!iso) return '未读';
    var d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString()) return '今天 ' + U.fmtTime(d);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + U.fmtTime(d);
  }
  function formatSize(bytes) {
    if (!bytes) return '0B';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(2) + 'MB';
  }
  function makeId() { return 'book_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }
  function fmtMMSS(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function stopTimer() { if (readingTimer) { clearInterval(readingTimer); readingTimer = null; } }

  /* 阅读计时会话：每秒刷新显示，每 10 秒持久化一次时长 */
  function startSession(bookId, timerEl) {
    var sessionSeconds = 0, persistedSeconds = 0;
    var timer = setInterval(function () {
      sessionSeconds++;
      timerEl.textContent = fmtMMSS(sessionSeconds);
      if (sessionSeconds - persistedSeconds >= 10) persist();
    }, 1000);
    function persist(n) {
      n = (n == null) ? (sessionSeconds - persistedSeconds) : n;
      if (n <= 0) return;
      persistedSeconds += n;
      var books = getBooks(), idx = books.findIndex(function (b) { return b.id === bookId; });
      if (idx > -1) {
        books[idx].stats = books[idx].stats || {};
        books[idx].stats.totalSeconds = (books[idx].stats.totalSeconds || 0) + n;
        books[idx].stats.lastReadAt = new Date().toISOString();
        setBooks(books);
      }
    }
    return {
      stop: function () { clearInterval(timer); },
      flush: function () { var remain = sessionSeconds - persistedSeconds; if (remain > 0) persist(remain); }
    };
  }

  /* =========================================================
     页面入口
     ========================================================= */
  App.pages['reading'] = function (root) {
    U.clear(root);
    var currentId = getCurrentId();
    if (currentId) {
      var book = getBooks().find(function (b) { return b.id === currentId; });
      if (book) {
        if (book.type === 'epub') openEpub(root, book);
        else openTxt(root, book);
        return;
      }
      setCurrentId(null);
    }
    renderLibrary(root);
  };

  /* =========================================================
     书架（图书馆）视图
     ========================================================= */
  function renderLibrary(root) {
    var books = getBooks();
    var wrap = U.el('div');

    // 微信读书卡片
    renderWereadCard(root, wrap);

    // 本地书架操作栏
    var head = U.el('div', { class: 'card' });
    head.appendChild(U.el('div', { class: 'card-title', text: '我的书架（本地）' }));
    var row = U.el('div', { class: 'row' });
    var fileInput = U.el('input', {
      type: 'file', accept: '.txt,.epub', style: 'display:none',
      onchange: function () { importFile(this.files[0]); this.value = ''; }
    });
    row.appendChild(U.el('button', { class: 'btn', text: '+ 导入书籍', onclick: function () { fileInput.click(); } }));
    row.appendChild(U.el('button', { class: 'btn ghost', text: '支持的格式：TXT / EPUB', onclick: function () { U.toast('TXT 与 EPUB 均可导入，EPUB 支持目录/字体/主题'); } }));
    head.appendChild(row);
    head.appendChild(fileInput);
    wrap.appendChild(head);

    // 统计
    var totalSec = books.reduce(function (a, b) { return a + (b.stats && b.stats.totalSeconds || 0); }, 0);
    var finished = books.filter(function (b) { return b.progress && b.progress.percent >= 99; }).length;
    var statCard = U.el('div', { class: 'card' });
    statCard.appendChild(U.el('div', { class: 'card-title', text: '阅读统计' }));
    var grid = U.el('div', { class: 'grid c3' });
    grid.appendChild(statBox('藏书', books.length + '本'));
    grid.appendChild(statBox('累计时长', formatTime(totalSec)));
    grid.appendChild(statBox('已读完', finished + '本'));
    statCard.appendChild(grid);
    wrap.appendChild(statCard);

    // 书籍列表
    if (!books.length) {
      var empty = U.el('div', { class: 'card' });
      empty.appendChild(U.el('div', { class: 'empty', text: '书架为空，点击上方「导入书籍」开始阅读（支持 TXT / EPUB）' }));
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
          onclick: function (e) { e.stopPropagation(); deleteBook(b); renderLibrary(root); }
        }));
        c.appendChild(top);
        c.appendChild(U.el('div', { class: 'muted', style: 'margin:4px 0', text: (b.author || '未知作者') + ' · ' + (b.type === 'epub' ? 'EPUB' : 'TXT') + ' · ' + formatSize(b.size) + ' · 已读 ' + formatTime(b.stats && b.stats.totalSeconds || 0) }));
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

  /* ---------- 导入分发 ---------- */
  function importFile(file) {
    if (!file) return;
    if (/\.epub$/i.test(file.name)) importEpub(file);
    else importTxt(file);
  }

  function importTxt(file) {
    if (file.size > 5 * 1024 * 1024) { U.toast('文件过大，请先压缩或拆分（当前限制 5MB）'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
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
      var root = U.$('#pageRoot'); if (root) renderLibrary(root);
    };
    reader.readAsText(file);
  }

  function importEpub(file) {
    var MAX = 40 * 1024 * 1024;
    if (file.size > MAX) { U.toast('EPUB 过大（上限 40MB）'); return; }
    if (typeof ePub === 'undefined') { U.toast('EPUB 引擎未加载，请刷新页面重试'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var buf = e.target.result;
      var id = makeId();
      idbPut(id, buf).then(function () {
        // 读取元数据以显示正确的书名/作者
        var title = file.name.replace(/\.epub$/i, '');
        var author = '未知作者';
        try {
          var ep = ePub(buf);
          ep.loaded.metadata.then(function (m) {
            finishEpubImport(id, file, (m && m.title) || title, (m && m.creator) || author);
            try { ep.destroy(); } catch (_) {}
          }).catch(function () {
            finishEpubImport(id, file, title, author);
          });
        } catch (err) {
          finishEpubImport(id, file, title, author);
        }
      }).catch(function () {
        U.toast('保存 EPUB 失败（浏览器存储不足？）');
      });
    };
    reader.readAsArrayBuffer(file);
  }
  function finishEpubImport(id, file, title, author) {
    var book = {
      id: id, title: title, author: author, type: 'epub', size: file.size,
      progress: { cfi: null, percent: 0 },
      stats: { totalSeconds: 0, lastReadAt: null },
      theme: 'light', fontSize: 100,
      createdAt: new Date().toISOString()
    };
    var books = getBooks(); books.unshift(book); setBooks(books);
    U.toast('已导入《' + title + '》');
    var root = U.$('#pageRoot'); if (root) renderLibrary(root);
  }

  function guessAuthor(text) {
    var m = text.slice(0, 500).match(/[作者|著者|编者][：:]\s*([^\n\r]{1,20})/);
    return m ? m[1].trim() : '未知作者';
  }

  function deleteBook(book) {
    if (!confirm('确定从书架删除这本书？阅读进度也将被清除。')) return;
    var books = getBooks().filter(function (b) { return b.id !== book.id; });
    setBooks(books);
    if (book.type === 'epub') idbDel(book.id);
    if (getCurrentId() === book.id) setCurrentId(null);
    U.toast('已删除');
  }

  function openBook(root, book) {
    if (book.type === 'epub') openEpub(root, book);
    else openTxt(root, book);
  }

  /* =========================================================
     TXT 阅读器
     ========================================================= */
  function openTxt(root, book) {
    setCurrentId(book.id);
    U.clear(root);
    stopTimer();

    var wrap = U.el('div', { class: 'reader-fullscreen' });
    var header = U.el('div', { class: 'card', style: 'margin:0;border-radius:0;padding:10px 12px;flex:0 0 auto' });
    var hRow = U.el('div', { style: 'display:flex;justify-content:space-between;align-items:center' });
    hRow.appendChild(U.el('button', { class: 'btn ghost xs', text: '← 返回书架', onclick: function () { saveProgress(); session.flush(); stopTimer(); setCurrentId(null); App.pages['reading'](root); } }));
    hRow.appendChild(U.el('div', { style: 'font-weight:700;text-align:center;flex:1;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: book.title }));
    var timerEl = U.el('div', { style: 'font-size:12px;color:var(--muted);min-width:70px;text-align:right', text: '00:00' });
    hRow.appendChild(timerEl);
    header.appendChild(hRow);
    var progWrap = U.el('div', { style: 'background:var(--surface-2);border-radius:6px;height:6px;overflow:hidden;margin-top:10px' });
    var progBar = U.el('div', { style: 'background:var(--brand);height:100%;width:0%' });
    progWrap.appendChild(progBar);
    header.appendChild(progWrap);
    wrap.appendChild(header);

    var scroller = U.el('div', { id: 'readerScroller', style: 'flex:1 1 auto;overflow-y:auto;padding:16px 24px 40px;line-height:1.9;font-size:17px;-webkit-overflow-scrolling:touch' });
    var contentEl = U.el('div', { style: 'max-width:720px;margin:0 auto;white-space:pre-wrap;word-break:break-word' });
    contentEl.textContent = book.content;
    scroller.appendChild(contentEl);
    wrap.appendChild(scroller);

    var footer = U.el('div', { class: 'card', style: 'margin:0;border-radius:0;padding:8px 12px;flex:0 0 auto;font-size:12px;color:var(--muted);text-align:center' });
    var pctEl = U.el('span');
    footer.appendChild(pctEl);
    wrap.appendChild(footer);
    root.appendChild(wrap);

    var session = startSession(book.id, timerEl);

    function restore() {
      var p = book.progress || {};
      if (p.scrollTop && scroller.scrollHeight) scroller.scrollTop = Math.min(p.scrollTop, scroller.scrollHeight - scroller.clientHeight);
      updateProgressUI();
    }
    setTimeout(restore, 50);

    function updateProgressUI() {
      var sh = scroller.scrollHeight || 1, st = scroller.scrollTop || 0, ch = scroller.clientHeight || 1;
      var pct = Math.min(100, Math.max(0, (st / (sh - ch)) * 100));
      progBar.style.width = pct + '%';
      pctEl.textContent = '已读 ' + pct.toFixed(1) + '% · 自动保存进度';
      return { scrollTop: st, scrollHeight: sh, percent: pct };
    }
    function saveProgress() {
      var p = updateProgressUI();
      session.flush();
      var books = getBooks(), idx = books.findIndex(function (b) { return b.id === book.id; });
      if (idx > -1) { books[idx].progress = p; setBooks(books); }
    }
    var saveTimer = null;
    scroller.addEventListener('scroll', function () {
      updateProgressUI();
      clearTimeout(saveTimer); saveTimer = setTimeout(saveProgress, 500);
    });

    bindLifecycle(wrap, root, function () { saveProgress(); session.flush(); stopTimer(); });
  }

  /* =========================================================
     EPUB 阅读器
     ========================================================= */
  function openEpub(root, book) {
    if (typeof ePub === 'undefined') { U.toast('EPUB 引擎未加载，请刷新页面重试'); App.pages['reading'](root); return; }
    setCurrentId(book.id);
    U.clear(root);
    stopTimer();

    var wrap = U.el('div', { class: 'reader-fullscreen' });

    // 顶部工具栏
    var header = U.el('div', { class: 'card', style: 'margin:0;border-radius:0;padding:10px 12px;flex:0 0 auto' });
    var hRow = U.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' });
    hRow.appendChild(U.el('button', { class: 'btn ghost xs', text: '← 书架', onclick: function () { saveProgress(); session.flush(); cleanup(); stopTimer(); setCurrentId(null); App.pages['reading'](root); } }));
    var titleEl = U.el('div', { style: 'font-weight:700;text-align:center;flex:1;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: book.title });
    hRow.appendChild(titleEl);
    var timerEl = U.el('div', { style: 'font-size:12px;color:var(--muted);min-width:70px;text-align:right', text: '00:00' });
    hRow.appendChild(timerEl);
    header.appendChild(hRow);

    // 控制条：上一页 / 目录 / 下一页 / 字体- / 字体+ / 主题
    var ctl = U.el('div', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap' });
    var prevBtn = U.el('button', { class: 'btn ghost xs', text: '‹ 上一页', onclick: function () { if (rendition) rendition.prev(); } });
    var tocBtn = U.el('button', { class: 'btn ghost xs', text: '☰ 目录', onclick: function () { showToc(); } });
    var nextBtn = U.el('button', { class: 'btn ghost xs', text: '下一页 ›', onclick: function () { if (rendition) rendition.next(); } });
    var fontDown = U.el('button', { class: 'btn ghost xs', text: 'A-', onclick: function () { changeFont(-10); } });
    var fontUp = U.el('button', { class: 'btn ghost xs', text: 'A+', onclick: function () { changeFont(10); } });
    var themeBtn = U.el('button', { class: 'btn ghost xs', text: '🌓 主题', onclick: function () { cycleTheme(); } });
    ctl.appendChild(prevBtn); ctl.appendChild(tocBtn); ctl.appendChild(nextBtn);
    ctl.appendChild(fontDown); ctl.appendChild(fontUp); ctl.appendChild(themeBtn);
    header.appendChild(ctl);

    var progWrap = U.el('div', { style: 'background:var(--surface-2);border-radius:6px;height:6px;overflow:hidden;margin-top:8px' });
    var progBar = U.el('div', { style: 'background:var(--brand);height:100%;width:0%' });
    progWrap.appendChild(progBar);
    header.appendChild(progWrap);
    wrap.appendChild(header);

    // 阅读区（EPUB.js 渲染目标）
    var viewer = U.el('div', { id: 'epubViewer', style: 'flex:1 1 auto;position:relative;background:#fff;overflow:hidden' });
    wrap.appendChild(viewer);

    var footer = U.el('div', { class: 'card', style: 'margin:0;border-radius:0;padding:8px 12px;flex:0 0 auto;font-size:12px;color:var(--muted);text-align:center' });
    var pctEl = U.el('span', { text: '加载中…' });
    footer.appendChild(pctEl);
    wrap.appendChild(footer);
    root.appendChild(wrap);

    var session = startSession(book.id, timerEl);
    var rendition = null, epubBook = null, locationsReady = null, tocItems = [];
    var THEMES = ['light', 'sepia', 'dark'];

    idbGet(book.id).then(function (buf) {
      if (!buf) { U.toast('本地 EPUB 文件丢失，请重新导入'); App.pages['reading'](root); return; }
      epubBook = ePub(buf);
      rendition = epubBook.renderTo(viewer, { width: '100%', height: '100%', spread: 'none', flow: 'paginated' });

      // 主题
      rendition.themes.register('light', { body: { background: '#ffffff', color: '#1f2430' } });
      rendition.themes.register('sepia', { body: { background: '#f4ecd8', color: '#5b4636' } });
      rendition.themes.register('dark', { body: { background: '#1a1d24', color: '#cfd3dc' }, 'p, li': { color: '#cfd3dc' }, 'a, a:visited': { color: '#7aa0ff' } });

      // 字体
      var fs = book.fontSize || 100;
      rendition.themes.fontSize(fs + '%');

      // 元数据
      epubBook.loaded.metadata.then(function (m) {
        if (m && m.title) { titleEl.textContent = m.title; saveMeta({ title: m.title }); }
        if (m && m.creator) saveMeta({ author: m.creator });
      }).catch(function () {});

      // 目录
      epubBook.loaded.navigation.then(function (nav) {
        tocItems = flattenToc(nav.toc || []);
      }).catch(function () {});

      // 进度位置生成（用于百分比）
      locationsReady = epubBook.locations.generate().catch(function () { return null; });

      // 恢复上次位置
      var startCfi = (book.progress && book.progress.cfi) || undefined;
      rendition.display(startCfi).catch(function () { rendition.display(); });

      // 应用主题
      applyTheme(book.theme || 'light');

      // 位置变化 → 保存进度
      rendition.on('relocated', function (loc) {
        if (!loc || !loc.start) return;
        var cfi = loc.start.cfi;
        function commit(pct) {
          saveProgress(cfi, pct);
        }
        if (loc.start.percentage != null) commit(Math.round(loc.start.percentage * 100));
        else locationsReady.then(function () {
          try { commit(Math.round(epubBook.locations.percentageFromCfi(cfi) * 100)); } catch (e) {}
        });
      });
    }).catch(function (e) {
      U.toast('打开 EPUB 失败：' + (e && e.message ? e.message : e));
    });

    function applyTheme(name) {
      if (!rendition) return;
      try { rendition.themes.select(name === 'light' ? 'light' : name); } catch (e) {}
      if (viewer) viewer.style.background = name === 'dark' ? '#1a1d24' : (name === 'sepia' ? '#f4ecd8' : '#ffffff');
    }
    function cycleTheme() {
      var cur = (book.theme || 'light');
      var idx = THEMES.indexOf(cur);
      var next = THEMES[(idx + 1) % THEMES.length];
      book.theme = next; saveMeta({ theme: next }); applyTheme(next);
      U.toast('主题：' + ({ light: '明亮', sepia: '护眼', dark: '暗夜' })[next]);
    }
    function changeFont(delta) {
      var fs = Math.max(70, Math.min(220, (book.fontSize || 100) + delta));
      book.fontSize = fs; saveMeta({ fontSize: fs });
      if (rendition) rendition.themes.fontSize(fs + '%');
    }
    function showToc() {
      if (!tocItems.length) { U.toast('暂无目录'); return; }
      var body = U.el('div');
      tocItems.slice(0, 200).forEach(function (it) {
        body.appendChild(U.el('div', {
          class: 'toc-item', text: it.label,
          onclick: function () { if (rendition) rendition.display(it.href); m.close(); }
        }));
      });
      var m = U.modal({ title: '目录', body: body });
    }
    function saveProgress(cfi, pct) {
      pct = Math.max(0, Math.min(100, pct || 0));
      progBar.style.width = pct + '%';
      pctEl.textContent = '已读 ' + pct.toFixed(1) + '% · 自动保存';
      var books = getBooks(), idx = books.findIndex(function (b) { return b.id === book.id; });
      if (idx > -1) {
        books[idx].progress = { cfi: cfi, percent: pct };
        books[idx].stats = books[idx].stats || {};
        books[idx].stats.lastReadAt = new Date().toISOString();
        setBooks(books);
      }
    }
    function saveMeta(patch) {
      var books = getBooks(), idx = books.findIndex(function (b) { return b.id === book.id; });
      if (idx > -1) { Object.assign(books[idx], patch); setBooks(books); }
    }
    function cleanup() {
      try { if (rendition) rendition.destroy(); } catch (e) {}
      try { if (epubBook) epubBook.destroy(); } catch (e) {}
    }

    // 生命周期：切页/隐藏/关闭时保存最新进度并清理
    var realSave = function () {
      var books = getBooks(), idx = books.findIndex(function (b) { return b.id === book.id; });
      var p = idx > -1 ? (books[idx].progress || {}) : {};
      saveProgress(p.cfi || null, p.percent || 0);
      session.flush(); cleanup(); stopTimer();
    };
    bindLifecycle(wrap, root, realSave);
  }

  function flattenToc(toc) {
    var out = [];
    (toc || []).forEach(function (it) {
      if (!it) return;
      out.push({ label: (it.label || '').replace(/\s+/g, ' ').trim(), href: it.href });
      if (it.subitems && it.subitems.length) out = out.concat(flattenToc(it.subitems));
    });
    return out;
  }

  /* 生命周期：页面被替换或隐藏/关闭时保存并清理 */
  function bindLifecycle(wrap, root, onExit, noop) {
    function onHide() { if (document.hidden) onExit(); }
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onExit);
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (Array.from(m.removedNodes).indexOf(wrap) > -1) {
          onExit();
          document.removeEventListener('visibilitychange', onHide);
          window.removeEventListener('beforeunload', onExit);
          observer.disconnect();
        }
      });
    });
    observer.observe(root, { childList: true, subtree: false });
  }

  /* =========================================================
     微信读书：绑定 + 书架同步
     ========================================================= */
  function renderWereadCard(root, wrap) {
    var key = getWereadKey();
    var card = U.el('div', { class: 'card weread-card' });
    card.appendChild(U.el('div', { class: 'card-title', text: '📚 微信读书 · 我的书架' }));

    if (!key) {
      card.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '绑定你的微信读书 API Key（wrk- 开头），即可同步书架与阅读进度。Key 仅保存在本机浏览器，不会写入代码或聊天。' }));
      var input = U.el('input', { class: 'input', type: 'password', placeholder: '粘贴 wrk- 开头的 API Key', style: 'margin-bottom:10px' });
      var row = U.el('div', { class: 'row' });
      row.appendChild(U.el('button', { class: 'btn', text: '保存并拉取书架', onclick: function () {
        var v = input.value.trim();
        if (!v) { U.toast('请输入 Key'); return; }
        setWereadKey(v); loadWereadShelf(root, wrap);
      } }));
      row.appendChild(U.el('button', { class: 'btn ghost', text: 'Key 怎么获取？', onclick: showWereadHelp }));
      card.appendChild(input);
      card.appendChild(row);
    } else {
      var row2 = U.el('div', { class: 'row', style: 'margin-bottom:10px' });
      row2.appendChild(U.el('button', { class: 'btn sm', text: '刷新书架', onclick: function () { loadWereadShelf(root, wrap); } }));
      row2.appendChild(U.el('button', { class: 'btn ghost sm', text: '解绑', onclick: function () {
        if (confirm('解绑后将清除本地保存的 Key，书架不再显示。')) { setWereadKey(''); renderLibrary(root); }
      } }));
      card.appendChild(row2);
      var shelfBox = U.el('div', { id: 'wereadShelf' });
      shelfBox.appendChild(U.el('div', { class: 'muted', text: '加载中…' }));
      card.appendChild(shelfBox);
      loadWereadShelf(root, wrap);
    }
    wrap.appendChild(card);
  }

  function fetchWeread(apiName, extra) {
    var key = getWereadKey();
    return fetch('/api/weread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ key: key, api_name: apiName, skill_version: '1.0.3' }, extra || {}))
    }).then(function (r) { return r.json(); });
  }

  function loadWereadShelf(root, wrap) {
    var box = U.$('#wereadShelf');
    if (!box) return;
    U.clear(box);
    box.appendChild(U.el('div', { class: 'muted', text: '加载中…' }));
    fetchWeread('/shelf/sync').then(function (j) {
      U.clear(box);
      if (!j || j.ok === false || j.errcode) {
        var msg = (j && (j.error || j.errmsg)) || '拉取失败';
        if (j && j.upgrade_info && j.upgrade_info.message) msg = j.upgrade_info.message;
        box.appendChild(U.el('div', { class: 'empty', text: '⚠ ' + msg + '（请检查 Key 是否正确，或在微信读书重新生成）' }));
        return;
      }
      var books = (j.books || []).map(function (b) {
        return { id: b.bookId, title: b.title, author: b.author, cover: b.cover, type: 'book' };
      });
      var albums = (j.albums || []).map(function (a) {
        var info = a.albumInfo || {};
        return { id: info.albumId, title: info.name, author: info.authorName, cover: info.cover, type: 'album' };
      });
      var items = books.concat(albums);
      if (!items.length) { box.appendChild(U.el('div', { class: 'empty', text: '书架为空' })); return; }
      var grid = U.el('div', { class: 'grid c2' });
      items.forEach(function (it) {
        var c = U.el('div', { class: 'weread-book', onclick: function () { openWereadWeb(it.id); } });
        c.appendChild(U.el('img', { class: 'weread-cover', src: it.cover || '', onerror: function () { this.style.visibility = 'hidden'; } }));
        var meta = U.el('div', { class: 'weread-meta' });
        meta.appendChild(U.el('div', { class: 'weread-title', text: it.title || '未命名' }));
        meta.appendChild(U.el('div', { class: 'muted', style: 'font-size:12px', text: (it.author || '') + (it.type === 'album' ? ' · 有声书' : '') }));
        c.appendChild(meta);
        var acts = U.el('div', { class: 'weread-actions' });
        acts.appendChild(U.el('button', { class: 'btn xs primary', text: '网页阅读', onclick: function (e) { e.stopPropagation(); openWereadWeb(it.id); } }));
        acts.appendChild(U.el('button', { class: 'btn xs', text: 'App', onclick: function (e) { e.stopPropagation(); openWereadApp(it.id); } }));
        c.appendChild(acts);
        grid.appendChild(c);
      });
      box.appendChild(grid);
      box.appendChild(U.el('div', { class: 'muted', style: 'margin-top:8px;font-size:12px', text: '「网页阅读」在任意浏览器打开微信读书网页版（无需 App，微信扫码登录即可读）；「App」仅尝试用手机唤起已安装的微信读书 App 续读。' }));
    }).catch(function (e) {
      U.clear(box);
      box.appendChild(U.el('div', { class: 'empty', text: '网络错误：' + (e && e.message ? e.message : e) }));
    });
  }

  function openWereadWeb(bookId) {
    // 网页版：任意浏览器可用，无需安装 App（微信扫码登录即可读）
    var url = 'https://weread.qq.com/web/bookDetail/' + encodeURIComponent(bookId);
    window.open(url, '_blank');
  }

  function openWereadApp(bookId) {
    // 仅装了微信读书 App 的手机可唤起
    var url = 'weread://reading?bId=' + bookId;
    try {
      var ifr = document.createElement('iframe');
      ifr.style.display = 'none';
      ifr.src = url;
      document.body.appendChild(ifr);
      setTimeout(function () { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); }, 1500);
    } catch (e) {}
    U.toast('已尝试唤起微信读书 App（请在手机上点击打开）');
  }

  function showWereadHelp() {
    U.modal({
      title: '如何获取微信读书 API Key',
      body: U.el('div', {}, [
        U.el('p', { text: '微信读书官方提供了 Skills API（只读），可同步书架、进度与笔记。获取步骤：' }),
        U.el('ol', {}, [
          U.el('li', { text: '用手机「微信读书 App」或网页 weread.qq.com 登录你的账号。' }),
          U.el('li', { text: '浏览器打开 weread.qq.com/r/weread-skills（需登录态）。' }),
          U.el('li', { text: '按页面提示「启用 / 安装 skill」，复制形如 wrk-xxxxxxxx 的 API Key。' })
        ]),
        U.el('p', { class: 'muted', style: 'margin-top:10px;font-size:12px', text: '说明：该 Key 绑定你的微信读书账号，仅用于拉取书架与进度，不能读取书籍正文（受 DRM 保护）。点「网页阅读」会在任意浏览器打开微信读书网页版（微信扫码登录即可读，无需 App）；点「App」则尝试唤起已安装的微信读书 App 续读。Key 仅存于本机浏览器，不会上传或写进代码。' })
      ])
    });
  }
})();
