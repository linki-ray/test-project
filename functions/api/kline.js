/**
 * Cloudflare Pages Function —— 个股 K 线代理
 *
 * 数据源：新浪财经 K 线接口（非东方财富）
 *   https://money.finance.sina.com.cn/.../CN_MarketData.getKLineData
 *
 * 浏览器直连新浪会被 CORS 拦截，故由本服务端函数代理，
 * 返回统一 JSON：{ ok:true, items:[{date,open,close,high,low,vol}] }
 *
 * 前端调用：/api/kline?symbol=sh600519&scale=240&datalen=120
 *   scale: 240=日线
 */
const SINA = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData';

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    status: status || 200
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const symbol = (url.searchParams.get('symbol') || 'sh600519');
  const scale = (url.searchParams.get('scale') || '240');
  const datalen = (url.searchParams.get('datalen') || '120');
  const api = SINA + '?symbol=' + encodeURIComponent(symbol) +
    '&scale=' + encodeURIComponent(scale) + '&ma=5&datalen=' + encodeURIComponent(datalen);
  try {
    const r = await fetch(api, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/' }
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) throw new Error('empty');
    const items = arr.map(function (d) {
      return { date: d.day, open: +d.open, close: +d.close, high: +d.high, low: +d.low, vol: +d.volume };
    });
    return json({ ok: true, items: items });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
