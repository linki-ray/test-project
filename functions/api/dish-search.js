// Cloudflare Pages Function：按菜名实时联网搜真实做法（多源兜底，免 key）
// POST { name } -> { ok, name, ingredients:[], steps:[] } 或 { ok:false, error }
//
// 数据源顺序（任一成功即返回）：
//   1) 下厨房 xiachufang.com  —— 服务端搜索 + /printable/ 纯文本详情
//   2) 豆果美食 douguo.com   —— 用搜狗搜出 cookbook 直链，抓详情页解析（详情页服务端渲染、可解析）
//   3) 搜狗通用 sogou.com    —— 搜索取首个菜谱站直链，通用解析
//   4) 360 搜索 so.com       —— 同上兜底
// 各源若被海外节点拦截则自动跳过，全部失败返回 ok:false，前端回退模板做法。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Accept': 'text/html,application/xhtml+xml' };
const TIMEOUT = 8000;

const cache = new Map(); // 同名缓存，减少重复抓取

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}
function withTimeout(p, ms) {
  return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
}
async function fetchText(url, ref) {
  const h = Object.assign({}, HEADERS);
  if (ref) h.Referer = ref;
  const r = await withTimeout(fetch(url, { headers: h }), TIMEOUT);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' @ ' + url);
  return r.text();
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

// 通用解析：适配 下厨房/豆果/香哈/美食天下/好豆 等多站结构
function parseRecipe(html, name) {
  const text = stripHtml(html);
  const ingMatch = text.match(/用料([\s\S]*?)(做法|步骤|制作|方法)/)
    || text.match(/(食材|原料|配料)([\s\S]*?)(做法|步骤|制作|方法)/);
  const stepMatch = text.match(/(做法|步骤|制作|方法)([\s\S]*)$/);
  const ingRaw = ingMatch ? ingMatch[1] : '';
  const stepRaw = stepMatch ? stepMatch[2] : '';

  const ingredients = ingRaw
    .replace(/#/g, ' ')
    .split(/[\s,，、;；]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length >= 2 && s.length <= 30; })
    .slice(0, 24);

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

// 搜索引擎取直链（只取已知菜谱站 host，过滤搜狗自有/广告页）
const RECIPE_HOSTS = ['douguo.com', 'xiangha.com', 'meishichina.com', 'xiachufang.com', 'xinshipu.com', 'haodou.com', 'meishij.net'];
function isRecipeUrl(u) { return RECIPE_HOSTS.some(function (h) { return u.indexOf(h) > -1; }); }
async function searchLinks(query, engine) {
  const url = engine === 'so' ? 'https://www.so.com/s?q=' + encodeURIComponent(query)
    : 'https://www.sogou.com/web?query=' + encodeURIComponent(query);
  const html = await fetchText(url, engine === 'so' ? 'https://www.so.com/' : 'https://www.sogou.com/');
  const urls = [];
  const re = /href="(https?:\/\/[^\"]+)"/g; let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (isRecipeUrl(u) && u.indexOf('sogou.com') < 0 && u.indexOf('fankui') < 0) urls.push(u);
  }
  return urls;
}

// 来源1：下厨房
async function tryXiaochufang(name) {
  const searchUrl = 'https://www.xiachufang.com/search/?keyword=' + encodeURIComponent(name);
  const html = await fetchText(searchUrl, 'https://www.xiachufang.com/');
  const m = html.match(/\/recipe\/\d+/);
  if (!m) throw new Error('未找到菜谱');
  const dhtml = await fetchText('https://www.xiachufang.com' + m[0] + '/printable/', 'https://www.xiachufang.com/');
  return parseRecipe(dhtml, name);
}

// 来源2：豆果（搜狗找 cookbook 直链）
async function tryDouguo(name) {
  const links = await searchLinks(name + ' 做法', 'sogou');
  const dg = links.filter(function (u) { return u.indexOf('douguo.com/cookbook') > -1; });
  const pool = dg.length ? dg : links;
  for (const u of pool) {
    try {
      const html = await fetchText(u, 'https://www.douguo.com/');
      return parseRecipe(html, name);
    } catch (e) { /* 试下一个 */ }
  }
  throw new Error('豆果未抓到');
}

// 来源3/4：搜狗 / 360 通用直链
async function trySearchEngine(name, engine) {
  const links = await searchLinks(name + ' 做法', engine);
  for (const u of links) {
    try {
      const html = await fetchText(u, engine === 'so' ? 'https://www.so.com/' : 'https://www.sogou.com/');
      return parseRecipe(html, name);
    } catch (e) { /* 试下一个 */ }
  }
  throw new Error(engine + ' 未抓到');
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const name = (body && body.name || '').trim();
  if (!name) return json({ ok: false, error: '缺少菜名 name' }, 400);
  if (cache.has(name)) return json(cache.get(name));

  const sources = [
    tryXiaochufang,
    function () { return tryDouguo(name); },
    function () { return trySearchEngine(name, 'sogou'); },
    function () { return trySearchEngine(name, 'so'); }
  ];
  let lastErr = '';
  for (const fn of sources) {
    try {
      const r = await fn();
      if (r && (r.ingredients.length || r.steps.length)) {
        cache.set(name, r);
        return json(r);
      }
    } catch (e) { lastErr = (e && e.message) || String(e); }
  }
  return json({ ok: false, error: '各来源均未抓到做法：' + lastErr });
}
