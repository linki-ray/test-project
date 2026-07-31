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
  // 大盘/个股行情/板块龙头直接走腾讯自选股 qt.gtimg.cn（浏览器 JSONP）；字段映射已用通达信实时行情离线校验。
  KLINE_API: 'https://test-project-ek2.pages.dev/api/kline',
  // 视频链接自动抓取：由 Cloudflare Pages 服务端函数 /api/fetch-video 尝试提取标题/文案。
  // 抖音/小红书会限制外链抓取，失败时前端会引导手动补充或把链接发我（对话里）深度解析。
  FETCH_VIDEO_API: 'https://test-project-ek2.pages.dev/api/fetch-video',
  // 市场资讯接口：由 Cloudflare Pages 服务端函数 /api/news 代理新浪财经全球财经快讯（绕开浏览器跨域）。
  NEWS_API: 'https://test-project-ek2.pages.dev/api/news',
  // 链接解析接口：由 Cloudflare Pages 服务端函数 /api/parse-link 代理抓取小红书/抖音分享链接，
  // 提取标题/正文/封面（文字稳、视频流拿不到、图片可能过期）。
  PARSE_API: 'https://test-project-ek2.pages.dev/api/parse-link'
};
