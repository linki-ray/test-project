/**
 * Cloudflare Pages Function —— 盘前快讯代理（金十数据）
 *
 * 财联社旧接口（/v1/roll/get_roll_list）已加签名校验（errno:10012），直连不可用；
 * 改用金十数据 flash_newest.js（实时财经快讯，含政策/公告/突发），同样覆盖盘前需求。
 * 浏览器直连金十会被 CORS 拦截，故由本服务端函数代理，返回统一 JSON：
 *   { ok:true, source:'jin10', items:[{title,url,time,tag}] }
 *
 * 前端调用：/api/flash?num=40
 */
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    status: status || 200
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const num = parseInt(url.searchParams.get('num') || '40', 10);
  try {
    const resp = await fetch('https://www.jin10.com/flash_newest.js', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.jin10.com/'
      }
    });
    if (!resp.ok) throw new Error('http ' + resp.status);
    const text = await resp.text();
    // 形如：var newest = [ {...}, ... ]; 取第一个 [ 到最后一个 ] 之间的 JSON
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) throw new Error('parse');
    const arr = JSON.parse(text.slice(start, end + 1));
    const items = arr.slice(0, num).map(function (it) {
      const content = (it && it.data && (it.data.content || it.data.title)) || '';
      const t = (it && it.time) || '';
      const hhmm = t.length >= 16 ? t.slice(11, 16) : (t.length >= 5 ? t.slice(0, 5) : '');
      return { title: String(content).trim(), url: '', time: hhmm, tag: '金十' };
    }).filter(function (it) { return it.title; });
    return json({ ok: true, source: 'jin10', items: items });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
