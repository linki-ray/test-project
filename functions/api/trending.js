/**
 * Cloudflare Pages Function —— 联网热榜代理
 * 由服务器抓取真实热榜（规避浏览器跨域 / 网络限制），返回规范化 JSON。
 * 部署：把整个仓库连到 Cloudflare Pages 后，此文件自动生效，前端调用 /api/trending?type=douyin
 *
 * type 支持：douyin | weibo | zhihu | baidu
 */
const SOURCES = {
  douyin: [
    'https://api.pearktrue.cn/api/douyinhot/',
    'https://api.oioweb.cn/api/common/HotList?type=douyin'
  ],
  weibo: [
    'https://api.oioweb.cn/api/common/HotList?type=weibo',
    'https://tenapi.cn/v2/weibohot',
    'https://api.vvhan.com/api/hotlist/wbHot'
  ],
  zhihu: ['https://api.oioweb.cn/api/common/HotList?type=zhihu'],
  baidu: ['https://api.oioweb.cn/api/common/HotList?type=baidu']
};

function normalize(j) {
  if (!j || typeof j !== 'object') return [];
  let list = j;
  if (j.items && Array.isArray(j.items)) return j.items;
  if (j.data) list = j.data;
  if (list && list.data && Array.isArray(list.data)) list = list.data;
  if (list && list.list && Array.isArray(list.list)) list = list.list;
  if (list && list.result && Array.isArray(list.result)) list = list.result;
  if (!Array.isArray(list)) return [];
  return list.map((x) => {
    if (x && typeof x === 'object' && (x.title || x.word || x.name || x.query)) {
      return {
        title: String(x.title || x.word || x.name || x.query || ''),
        hot: Number(x.hot || x.num || x.score || x.heat || 0),
        url: x.url || x.mblink || x.link || x.mobileUrl || ''
      };
    }
    return null;
  }).filter((x) => x && x.title);
}

async function fetchOne(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkbenchTrending/1.0)' }
  });
  if (!r.ok) throw new Error('http ' + r.status);
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch (e) { throw new Error('not json'); }
  const items = normalize(j);
  if (!items.length) throw new Error('empty');
  return items;
}

export async function onRequestGet(context) {
  const type = (context.request.query.get('type') || 'douyin').toLowerCase();
  const sources = SOURCES[type] || SOURCES.douyin;
  let lastErr = '';
  for (const url of sources) {
    try {
      const items = await fetchOne(url);
      return new Response(JSON.stringify({ ok: true, type, source: 'server', live: true, updated_at: new Date().toISOString(), items }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=120'
        }
      });
    } catch (e) { lastErr = e.message; }
  }
  return new Response(JSON.stringify({ ok: false, type, source: 'server', live: false, error: lastErr, items: [] }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    status: 502
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
}
