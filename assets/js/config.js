/* =========================================================
   云端同步配置（Supabase）
   - 已填入真实配置，跨设备同步已开启；
   - 若两项留空，自动退回「纯本地模式」（功能照常，不跨设备）。
   - publishable / anon key 本就设计为可公开，放前端安全，
     真正的数据隔离由 Supabase 的 RLS 规则（auth.uid() = user_id）保证。
   ========================================================= */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://jzrmreqbbxshekvvuhkb.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_p_-STPaJnFGnkPfTjl_tBA_yp8xYKP_',
  // 联网热榜接口：由 Cloudflare Pages 服务端函数 /api/trending 提供真实数据。
  // 使用完整地址，保证 github.io / 本地调试 / PWA 桌面模式都能调用。
  TRENDING_API: 'https://test-project-ek2.pages.dev/api/trending'
};
