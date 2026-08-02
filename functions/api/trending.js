/**
 * Cloudflare Pages Function —— 联网热榜代理
 * 由服务器抓取真实热榜（规避浏览器跨域 / 网络限制），返回规范化 JSON。
 * 部署：把整个仓库连到 Cloudflare Pages 后，此文件自动生效，前端调用 /api/trending?type=douyin
 *
 * type 支持：douyin | weibo | zhihu | baidu
 */
const SOURCES = {
  douyin: [
    'https://60s.viki.moe/v2/douyin',
    'https://uapis.cn/api/v1/misc/hotboard?type=douyin',
    'https://api-hot.imsyy.top/douyin',
    'https://api.vvhan.com/api/hotlist/douyin',
    'https://api.pearktrue.cn/api/douyinhot/'
  ],
  weibo: [
    'https://60s.viki.moe/v2/weibo',
    'https://uapis.cn/api/v1/misc/hotboard?type=weibo'
  ],
  zhihu: [
    'https://60s.viki.moe/v2/zhihu',
    'https://uapis.cn/api/v1/misc/hotboard?type=zhihu'
  ],
  baidu: [
    'https://60s.viki.moe/v2/baidu',
    'https://uapis.cn/api/v1/misc/hotboard?type=baidu'
  ]
};

function normalize(j) {
  if (!j || typeof j !== 'object') return [];

  // 1) uapis.cn: { type, update_time, list: [{index, title, url, hot_value}] }
  if (j.list && Array.isArray(j.list)) {
    return j.list.map((x) => ({
      title: String(x.title || ''),
      hot: Number(x.hot_value || x.hot || 0),
      url: x.url || ''
    })).filter((x) => x.title);
  }

  // 2) 60s.viki.moe: { code: 200, data: [{title, hot_value, link}] }
  if (j.code === 200 && j.data && Array.isArray(j.data)) {
    return j.data.map((x) => ({
      title: String(x.title || ''),
      hot: Number(x.hot_value || x.hot || 0),
      url: x.link || x.url || ''
    })).filter((x) => x.title);
  }

  // 3) 旧格式兜底
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
        hot: Number(x.hot || x.num || x.score || x.heat || x.hot_value || 0),
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
  const url = new URL(context.request.url);
  const type = (url.searchParams.get('type') || 'douyin').toLowerCase();
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
