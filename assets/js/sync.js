/* =========================================================
   云端同步引擎（Supabase，原生 fetch，零依赖）
   - 登录/注册（邮箱+密码）
   - 写入即上推（防抖）、打开即拉取、轻量轮询实时刷新（替代 WebSocket）
   - 离线兜底：无网时本地照常，恢复后自动补传
   - 状态回调：offline / syncing / idle / error
   ========================================================= */
window.App = window.App || {};

App.Sync = (function () {
  var CFG = window.APP_CONFIG || {};
  var URL = (CFG.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  var KEY = CFG.SUPABASE_ANON_KEY || '';
  var ENABLED = !!(URL && KEY);

  var SESSION_KEY = 'ws_sync_session';
  var session = null;
  var statusCb = null;
  var pollTimer = null;
  var localVersions = {};        // bucket -> updated_at（轮询变更检测）
  var lastStatus = 'offline';

  /* ---------- 基础工具 ---------- */
  function emit(s) { lastStatus = s; if (statusCb) statusCb(s); }
  function setStatusCb(cb) { statusCb = cb; if (cb) cb(lastStatus); }

  function hdrs(extra) {
    var h = { 'apikey': KEY, 'Content-Type': 'application/json' };
    if (session && session.access_token) h['Authorization'] = 'Bearer ' + session.access_token;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function req(path, opts) {
    opts = opts || {};
    opts.headers = hdrs(opts.headers);
    return fetch(URL + path, opts);
  }
  function parse(r) { return r.json().catch(function () { return {}; }); }

  /* ---------- 会话持久化 ---------- */
  function loadSession() {
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }
    return !!session;
  }
  function saveSession() { try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {} }
  function clearSession() { session = null; try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function isLoggedIn() { return !!(session && session.access_token); }
  function userId() { return session && session.user ? session.user.id : null; }

  /* ---------- 认证 ---------- */
  async function signUp(email, password) {
    var r = await req('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    var j = await parse(r);
    if (!r.ok) {
      var m = j.msg || j.error_description || '注册失败';
      if (j.error_code === 'email_exists') m = '该邮箱已注册，请直接登录';
      throw new Error(m);
    }
    if (j.access_token) { session = { access_token: j.access_token, refresh_token: j.refresh_token, user: j.user }; saveSession(); }
    else throw new Error('注册成功，但需先到邮箱点击验证链接（或到 Supabase 后台关闭 Email Confirmation）');
    return j;
  }

  async function signIn(email, password) {
    var r = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    var j = await parse(r);
    if (!r.ok) {
      var m = j.msg || j.error_description || '登录失败';
      if (j.error_code === 'email_not_confirmed') m = '邮箱未验证：请到邮箱点击验证链接，或到 Supabase 后台 Authentication → Providers → Email 关闭 Confirm email';
      throw new Error(m);
    }
    session = { access_token: j.access_token, refresh_token: j.refresh_token, user: j.user };
    saveSession();
    return j;
  }

  function logout() { clearSession(); stopPolling(); emit('offline'); }

  // 刷新 access_token（避免 1 小时过期后被迫重登）
  async function refresh() {
    if (!session || !session.refresh_token) return false;
    try {
      var r = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
      var j = await parse(r);
      if (r.ok && j.access_token) {
        session = { access_token: j.access_token, refresh_token: j.refresh_token || session.refresh_token, user: j.user || session.user };
        saveSession();
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---------- 数据拉取 ---------- */
  // 返回 { bucket: {value, updated_at} }
  async function pullAll() {
    if (!isLoggedIn()) return {};
    emit('syncing');
    try {
      var r = await req('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(userId()) + '&select=bucket,value,updated_at');
      if (!r.ok) { var t = await r.text(); throw new Error('拉取失败: ' + t); }
      var rows = await r.json();
      var map = {};
      (rows || []).forEach(function (row) { map[row.bucket] = { value: row.value, updated_at: row.updated_at }; });
      emit('idle');
      return map;
    } catch (e) { emit('error'); throw e; }
  }

  // 上推单个 bucket（upsert on user_id+bucket）
  async function pushBucket(bucket, value) {
    if (!isLoggedIn()) return;
    emit('syncing');
    try {
      var body = {
        user_id: userId(),
        bucket: bucket,
        value: value,
        updated_at: new Date().toISOString()
      };
      var r = await req('/rest/v1/user_data?on_conflict=user_id,bucket', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(body)
      });
      if (!r.ok) { var t = await r.text(); throw new Error('上推失败: ' + t); }
      emit('idle');
    } catch (e) { emit('error'); throw e; }
  }

  /* ---------- 轮询（轻量实时刷新） ---------- */
  async function poll(onChange) {
    if (!isLoggedIn()) return;
    try {
      var map = await pullAll();
      var changed = false;
      Object.keys(map).forEach(function (b) {
        if (localVersions[b] !== map[b].updated_at) { localVersions[b] = map[b].updated_at; changed = true; }
      });
      if (changed && onChange) onChange(map);
    } catch (e) { /* 状态已置 error，等待下次轮询重试 */ }
  }

  function startPolling(onChange, intervalMs) {
    stopPolling();
    pollTimer = setInterval(function () { poll(onChange); }, intervalMs || 20000);
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  // 记录本地版本（初次拉取后调用，避免立即误判变更）
  function seedVersions(map) { localVersions = {}; Object.keys(map || {}).forEach(function (b) { localVersions[b] = map[b].updated_at; }); }

  async function deleteBucket(bucket) {
    if (!isLoggedIn()) return;
    emit('syncing');
    try {
      var r = await req('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(userId()) + '&bucket=eq.' + encodeURIComponent(bucket), { method: 'DELETE' });
      if (!r.ok) { var t = await r.text(); throw new Error('删除同步失败: ' + t); }
      emit('idle');
    } catch (e) { emit('error'); throw e; }
  }

  return {
    ENABLED: ENABLED, URL: URL, KEY: KEY,
    loadSession: loadSession, isLoggedIn: isLoggedIn, userId: userId,
    signUp: signUp, signIn: signIn, logout: logout,
    pullAll: pullAll, pushBucket: pushBucket, deleteBucket: deleteBucket, refresh: refresh,
    startPolling: startPolling, stopPolling: stopPolling, seedVersions: seedVersions,
    setStatusCb: setStatusCb, getStatus: function () { return lastStatus; },
    getSession: function () { return session; }
  };
})();
