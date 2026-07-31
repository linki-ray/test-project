// Cloudflare Pages Function：按菜名实时联网搜下厨房，返回食材与步骤
// POST { name } -> { ok, name, ingredients:[], steps:[] } 或 { ok:false, error }
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Accept': 'text/html,application/xhtml+xml',
  'Referer': 'https://www.xiachufang.com/'
};
const cache = new Map(); // 同名缓存，减少重复抓取

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const name = (body && body.name || '').trim();
  if (!name) return json({ ok: false, error: '缺少菜名 name' }, 400);

  if (cache.has(name)) return json(cache.get(name));

  try {
    const result = await searchXiaochufang(name);
    cache.set(name, result);
    return json(result);
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) });
  }
}

async function searchXiaochufang(name) {
  const kw = encodeURIComponent(name);
  const searchUrl = 'https://www.xiachufang.com/search/?keyword=' + kw;
  const html = await fetch(searchUrl, { headers: HEADERS }).then(function (r) {
    if (!r.ok) throw new Error('搜索页 ' + r.status);
    return r.text();
  });
  const m = html.match(/\/recipe\/\d+/);
  if (!m) throw new Error('未找到匹配菜谱');
  const detailUrl = 'https://www.xiachufang.com' + m[0] + '/printable/';
  const dhtml = await fetch(detailUrl, { headers: HEADERS }).then(function (r) {
    if (!r.ok) throw new Error('详情页 ' + r.status);
    return r.text();
  });
  return parseXCF(dhtml, name);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseXCF(html, name) {
  const text = stripHtml(html);
  // 切分「用料」与「做法」
  const ingMatch = text.match(/用料([\s\S]*?)(做法|步骤|制作)/);
  const stepMatch = text.match(/(做法|步骤|制作)([\s\S]*)$/);
  const ingRaw = ingMatch ? ingMatch[1] : '';
  const stepRaw = stepMatch ? stepMatch[2] : '';

  // 食材：去 #分组标记，按空白/换行拆分
  const ingredients = ingRaw
    .replace(/#/g, ' ')
    .split(/[\s,，、;；]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length >= 2 && s.length <= 30; })
    .slice(0, 24);

  // 步骤：按 步骤N / 句号 / 分号 / 换行 拆分
  let steps = stepRaw
    .split(/步骤\s*\d+[.、]?|；|;|。|\n+/)
    .map(function (s) { return s.replace(/^[.、)\s]+/, '').trim(); })
    .filter(function (s) { return s.length >= 4; })
    .slice(0, 16);
  if (!steps.length) {
    steps = stepRaw.split(/(?<=[。；;])/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 4; }).slice(0, 16);
  }

  if (!ingredients.length && !steps.length) throw new Error('解析失败');
  return { ok: true, name: name, ingredients: ingredients, steps: steps };
}
