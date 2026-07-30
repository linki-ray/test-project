/**
 * Cloudflare Pages Function —— 市场资讯代理
 *
 * 数据源：新浪财经 feed API（pageid=153&lid=2516，全球财经/美股快讯）
 * 浏览器直连新浪会被 CORS 拦截，故由本服务端函数代理，
 * 返回统一 JSON：{ ok:true, source:'sina', items:[{title,url,time,tag}] }
 *
 * 前端调用：/api/news?num=20
 */
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    status: status || 200
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const num = parseInt(url.searchParams.get('num') || '20', 10);
  const r = Math.random().toString(36).slice(2);
  const feedUrl = 'https://feed.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=' + num + '&page=1&r=' + r;
  try {
    const resp = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.sina.com.cn/'
      }
    });
    if (!resp.ok) throw new Error('http ' + resp.status);
    const data = await resp.json();
    const list = (data && data.result && data.result.data) || [];
    const items = list.map(function (it) {
      // 新浪 ctime 为北京时间（UTC+8）Unix 秒时间戳；Cloudflare 边缘节点可能为 UTC，
      // 所以先加 8 小时再用 UTC 读取，保证显示北京时间 HH:MM。
      const t = parseInt(it.ctime || it.intime || '0', 10) * 1000;
      const d = t ? new Date(t + 8 * 60 * 60 * 1000) : new Date();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return {
        title: String(it.title || '').trim(),
        url: String(it.url || it.wapurl || '').trim(),
        time: hh + ':' + mm,
        tag: '财经'
      };
    }).filter(function (it) { return it.title && it.url; });
    return json({ ok: true, source: 'sina', items: items });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
