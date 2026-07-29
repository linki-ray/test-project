/* =========================================================
   云端同步配置（Supabase）
   - 把 Supabase 后台拿到的两项填进来即开启跨设备同步；
   - 两项都为空时，自动退回「纯本地模式」（功能照常，只是不跨设备）。
   - anon public key 本就设计为可公开，放前端安全（真正的安全由 RLS 规则保证）。
   ========================================================= */
window.APP_CONFIG = {
  SUPABASE_URL: '',        // 例：https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: ''    // Project Settings → API → anon / public key
};
