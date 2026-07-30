/* =========================================================
   应用配置
   - CLOUD_SYNC_ENABLED: 是否启用云端同步（跨设备）。
       false = 纯本地模式，打开即用、无需登录，数据仅存当前设备浏览器。
       true  = 启用 Supabase 跨设备同步（需登录）。
   - 当前为纯本地模式，已将登录页彻底移除。
   ========================================================= */
window.APP_CONFIG = {
  // 云端同步总开关（改为 true 可重新启用跨设备同步，但会重新要求登录）
  CLOUD_SYNC_ENABLED: false,
  // 以下为 Supabase 配置，仅在 CLOUD_SYNC_ENABLED=true 时生效
  SUPABASE_URL: 'https://jzrmreqbbxshekvvuhkb.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_p_-STPaJnFGnkPfTjl_tBA_yp8xYKP_',
  // 联网热榜接口：由 Cloudflare Pages 服务端函数 /api/trending 提供真实数据。
  // 使用完整地址，保证 github.io / 本地调试 / PWA 桌面模式都能调用。
  TRENDING_API: 'https://test-project-ek2.pages.dev/api/trending',
  // 个股K线接口：由 Cloudflare Pages 服务端函数 /api/kline 代理新浪财经（绕开浏览器跨域），
  // 大盘/个股行情/板块龙头直接走腾讯自选股 qt.gtimg.cn（浏览器 JSONP）。均非东方财富。
  KLINE_API: 'https://test-project-ek2.pages.dev/api/kline'
};
