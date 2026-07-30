/* =========================================================
   Cloudflare Pages Function：尝试从视频分享链接提取标题/文案
   说明：抖音/小红书等平台对服务端抓取有反爬与登录墙，
   本函数尽力而为（带浏览器 UA + 跟随跳转 + 解析 og/meta），
   拿不到则返回 ok:false，由前端优雅降级（引导手动补充 / 发我深度解析）。
   ========================================================= */
function pickMeta(html, key) {
  let m = html.match(new RegExp('<meta[^>]+(?:property|name)="' + key + '"[^>]+content="([^"]*)"', 'i'));
  if (!m) m = html.match(new RegExp('<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="' + key + '"', 'i'));
  return m ? m[1] : '';
}
function unescapeHtml(s) {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const target = (url.searchParams.get('url') || '').trim();
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response(JSON.stringify({ ok: false, reason: '缺少有效链接' }), { headers, status: 400 });
  }
  // 仅放行常见视频/内容平台，避免被当作通用代理滥用
  const allow = /(douyin\.com|tiktok\.com|xiaohongshu\.com|xhslink\.com|weibo\.com|kuaishou\.com|bilibili\.com|haokan\.baidu\.com|ixigua\.com)/i;
  if (!allow.test(target)) {
    return new Response(JSON.stringify({ ok: false, reason: '仅支持抖音/小红书/微博/快手/B站等平台链接' }), { headers, status: 400 });
  }
  try {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
    const r = await fetch(target, {
      headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      redirect: 'follow'
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const html = await r.text();
    const title = pickMeta(html, 'og:title') || pickMeta(html, 'title') || '';
    const desc = pickMeta(html, 'og:description') || pickMeta(html, 'description') || '';
    const t = unescapeHtml(title), d = unescapeHtml(desc);
    if (!t && !d) {
      return new Response(JSON.stringify({ ok: false, reason: '平台限制了外链抓取（未返回公开标题/文案）', fetched: true }), { headers });
    }
    return new Response(JSON.stringify({ ok: true, title: t, desc: d }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: String(e && e.message || e) }), { headers });
  }
}
