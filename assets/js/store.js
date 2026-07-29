/* =========================================================
   全局存储引擎 —— 本地留存 + 双存储模式（每日重置 / 永久累计）
   所有数据仅存于浏览器 localStorage，不上传任何服务器。
   ========================================================= */
window.App = window.App || {};

App.Store = (function () {
  var PREFIX = 'ws_';

  function lsGet(k) {
    try { var v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { console.warn('存储写入失败', e); }
  }
  function lsDel(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) {} }

  function todayStr(d) {
    d = d || new Date();
    var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  /* ---- 存储模式 ---- */
  function getMode() { return lsGet('mode') || 'daily'; } // 默认每日重置
  function setMode(m) { lsSet('mode', m); }

  /* ---- 通用读写 ---- */
  function get(key, def) { var v = lsGet(key); return v === null ? (def !== undefined ? def : null) : v; }

  // 同步上推（防抖）：仅登录且已配置时生效
  var pushTimers = {};
  function schedulePush(key, val) {
    if (!(App.Sync && App.Sync.ENABLED && App.Sync.isLoggedIn())) return;
    if (pushTimers[key]) clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(function () {
      delete pushTimers[key];
      App.Sync.pushBucket(key, val).catch(function (e) { console.warn('同步上推失败', key, e); });
    }, 600);
  }
  function set(key, val, opts) {
    opts = opts || {};
    lsSet(key, val);
    if (!opts.silent) schedulePush(key, val);
  }
  function del(key) {
    lsDel(key);
    if (App.Sync && App.Sync.ENABLED && App.Sync.isLoggedIn()) {
      App.Sync.deleteBucket(key).catch(function (e) { console.warn('同步删除失败', key, e); });
    }
  }

  // 云端数据写回本地（silent，避免回环上推）；map: {bucket:{value,updated_at}}
  function applyRemote(map) {
    if (!map) return;
    Object.keys(map).forEach(function (bucket) {
      var v = map[bucket] ? map[bucket].value : null;
      if (pushTimers[bucket]) { clearTimeout(pushTimers[bucket]); delete pushTimers[bucket]; }
      lsSet(bucket, v);
    });
  }

  /* ---- 每日计划预设任务 ---- */
  var PRESET_TASKS = [
    { id: 'p_pdd', name: '拼多多打卡', preset: true, pri: 'mid', remind: '', tag: '生活自律' },
    { id: 'p_read', name: '阅读', preset: true, pri: 'mid', remind: '', tag: '生活自律' },
    { id: 'p_dy', name: '抖音/小红书浏览学习', preset: true, pri: 'low', remind: '', tag: '自媒体' },
    { id: 'p_exercise', name: '运动 30 分钟', preset: true, pri: 'low', remind: '', tag: '生活自律' }
  ];

  function freshPresets() {
    return PRESET_TASKS.map(function (t) {
      return { id: t.id + '_' + todayStr(), name: t.name, preset: true, pri: t.pri, remind: t.remind, tag: t.tag, done: false };
    });
  }

  function getDailyPlan() {
    var dp = get('dp');
    var td = todayStr();
    if (!dp || dp.date !== td) {
      // 跨天：归档昨日 + 重置（仅每日重置模式清空自定义，永久模式保留自定义）
      if (dp && dp.date) {
        var hist = get('dp_hist', {});
        hist[dp.date] = dp.tasks;
        set('dp_hist', hist);
      }
      dp = { date: td, tasks: freshPresets() };
      // 永久模式：若有历史自定义未完成，不恢复（按需求：永久累计保存全部打卡历史，但当日清单仍每日刷新预设）
      set('dp', dp);
    }
    return dp;
  }
  function saveDailyPlan(dp) { set('dp', dp); }
  function archiveDailyPlan() {
    var dp = get('dp');
    if (dp && dp.date) {
      var hist = get('dp_hist', {});
      hist[dp.date] = dp.tasks;
      set('dp_hist', hist);
      set('dp', { date: todayStr(), tasks: freshPresets() });
    }
  }
  function getDailyPlanHistory() { return get('dp_hist', {}); }

  /* ---- 爆款视频 ---- */
  function getVideos() {
    var v = get('videos');
    if (!v) {
      v = { dailyCollected: { date: todayStr(), items: [] }, favorites: [], manual: [] };
      set('videos', v);
    }
    return v;
  }
  function saveVideos(v) { set('videos', v); }

  /* ---- 灵感 ---- */
  function getInspirations() { return get('insp', []); }
  function saveInspirations(a) { set('insp', a); }
  function getDraft() { return get('insp_draft', ''); }
  function setDraft(t) { set('insp_draft', t); }

  /* ---- 金融热点 ---- */
  function getFinNews() { return get('fin_news', []); }
  function setFinNews(a) { set('fin_news', a); }
  function getFinScreen() { return get('fin_screen', { lastDate: '', results: {} }); }
  function setFinScreen(o) { set('fin_screen', o); }
  function getFinQueryHistory() { return get('fin_query_hist', []); }
  function setFinQueryHistory(a) { set('fin_query_hist', a); }

  /* ---- 打卡计划 ---- */
  function getCheckins() {
    var c = get('checkin');
    if (!c) { c = { reading: [], pdd: [], custom: [] }; set('checkin', c); }
    // 确保子结构存在
    if (!c.reading) c.reading = [];
    if (!c.pdd) c.pdd = [];
    if (!c.custom) c.custom = [];
    return c;
  }
  function saveCheckins(c) { set('checkin', c); }

  /* ---- 标签 ---- */
  function getTags(bucket) { return get('tags_' + bucket, []); }
  function saveTags(bucket, arr) { set('tags_' + bucket, arr); }

  /* ---- 每日重置核心（每日零点 / 跨天触发） ---- */
  function ensureDailyReset() {
    var mode = getMode();
    var last = get('lastReset');
    var td = todayStr();
    if (last === td) return false; // 今天已处理

    if (mode === 'daily') {
      // 1) 归档昨日每日计划 → 历史，并重置为仅预设
      var dp = get('dp');
      if (dp && dp.date && dp.date !== td) {
        var hist = get('dp_hist', {});
        hist[dp.date] = dp.tasks;
        set('dp_hist', hist);
      }
      set('dp', { date: td, tasks: freshPresets() });

      // 2) 爆款视频：清空当日自动采集榜（保留收藏与手动录入）
      var v = getVideos();
      v.dailyCollected = { date: td, items: [] };
      saveVideos(v);

      // 3) 灵感草稿清空（已保存灵感永久保留）
      set('insp_draft', '');
    } else {
      // 永久模式：仍保证每日计划日期正确（预设刷新），但不清空自定义
      var dp2 = get('dp');
      if (!dp2 || dp2.date !== td) {
        if (dp2 && dp2.date) {
          var hist2 = get('dp_hist', {});
          hist2[dp2.date] = dp2.tasks;
          set('dp_hist', hist2);
        }
        // 永久模式：保留自定义任务，仅补充缺失的预设
        var tasks = dp2 ? dp2.tasks.filter(function (t) { return !t.preset; }) : [];
        var existingPresetIds = tasks.map(function (t) { return t.name; });
        freshPresets().forEach(function (p) {
          if (existingPresetIds.indexOf(p.name) === -1) tasks.unshift(p);
        });
        set('dp', { date: td, tasks: tasks });
      }
    }
    set('lastReset', td);
    return true;
  }

  /* 手动强制重置（调试/演示用） */
  function forceReset() { set('lastReset', ''); ensureDailyReset(); }

  /* 存储统计 */
  function stats() {
    var keys = ['dp', 'dp_hist', 'videos', 'insp', 'fin_news', 'fin_screen', 'fin_query_hist', 'checkin'];
    var total = 0;
    keys.forEach(function (k) { var v = localStorage.getItem(PREFIX + k); if (v) total += v.length; });
    return { mode: getMode(), bytes: total, kb: (total / 1024).toFixed(1) };
  }

  return {
    todayStr: todayStr, getMode: getMode, setMode: setMode,
    get: get, set: set, del: del, applyRemote: applyRemote,
    getDailyPlan: getDailyPlan, saveDailyPlan: saveDailyPlan, getDailyPlanHistory: getDailyPlanHistory, archiveDailyPlan: archiveDailyPlan,
    freshPresets: freshPresets,
    getVideos: getVideos, saveVideos: saveVideos,
    getInspirations: getInspirations, saveInspirations: saveInspirations, getDraft: getDraft, setDraft: setDraft,
    getFinNews: getFinNews, setFinNews: setFinNews, getFinScreen: getFinScreen, setFinScreen: setFinScreen,
    getFinQueryHistory: getFinQueryHistory, setFinQueryHistory: setFinQueryHistory,
    getCheckins: getCheckins, saveCheckins: saveCheckins,
    getTags: getTags, saveTags: saveTags,
    ensureDailyReset: ensureDailyReset, forceReset: forceReset, stats: stats
  };
})();
