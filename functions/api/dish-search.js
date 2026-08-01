// Cloudflare Pages Function：按菜名实时获取真实做法
// POST { name } -> { ok, name, ingredients:[], steps:[] } 或 { ok:false, error }
//
// 主数据源（推荐）：智谱 GLM（OpenAI 兼容接口）直接生成菜谱
//   - 环境变量 ZHIPU_API_KEY 必填；ZHIPU_MODEL 可选（默认 glm-4-flash，免费）
//   - API endpoint 全球可达，不受"海外 IP 被国内菜谱站拦截"影响
//   - key 仅存服务端环境变量，前端/用户无感知（仍免登录）
// 兜底（仅当智谱未配置 key 或失败时）：依次试 下厨房/豆果(搜狗找直链)/搜狗/360 爬网页
// 全部失败返回 ok:false，前端回退模板做法（不白屏）。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Accept': 'text/html,application/xhtml+xml' };
const TIMEOUT = 8000;
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const cache = new Map(); // 同名缓存，减少重复调用

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

// ---------- 主数据源：智谱 GLM ----------
async function tryZhipu(name, env) {
  const key = env && env.ZHIPU_API_KEY;
  if (!key) throw new Error('未配置 ZHIPU_API_KEY');
  const model = (env && env.ZHIPU_MODEL) || 'glm-4-flash';
  const system = '你是一位精通中餐的专业菜谱助手。用户给出一道菜名，你必须只返回一个 JSON 对象，不要任何额外文字、不要 markdown 代码块。JSON 结构严格为：{"ingredients": ["食材1 用量", "食材2 用量", ...], "steps": ["步骤1", "步骤2", ...]}。食材用量要具体（如"豆腐 300克"），步骤要清晰有序、每步一条、不要编号前缀。';
  const user = '请生成菜谱：「' + name + '」';

  const ctrl = new AbortController();
  const tid = setTimeout(function () { ctrl.abort(); }, 12000);
  let data;
  try {
    const r = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const t = await r.text().catch(function () { return ''; });
      throw new Error('智谱 HTTP ' + r.status + ' ' + t.slice(0, 80));
    }
    data = await r.json();
  } finally {
    clearTimeout(tid);
  }

  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('智谱返回为空');
  return parseZhipuContent(content, name);
}

// 解析模型输出：容错提取 JSON（支持可能被 markdown 包裹或夹带文字）
function parseZhipuContent(content, name) {
  let obj = null;
  // 1) 直接解析
  try { obj = JSON.parse(content); } catch (e) { /* 走正则 */ }
  // 2) 提取首个 {...}
  if (!obj) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { obj = JSON.parse(m[0]); } catch (e2) { /* ignore */ } }
  }
  if (!obj || !Array.isArray(obj.ingredients) || !Array.isArray(obj.steps)) {
    throw new Error('智谱输出结构异常');
  }
  const ingredients = obj.ingredients
    .map(function (s) { return String(s).replace(/^[-•·\d.、)）\s]+/, '').trim(); })
    .filter(function (s) { return s.length >= 2 && s.length <= 40; })
    .slice(0, 24);
  const steps = obj.steps
    .map(function (s) { return String(s).replace(/^\s*第?\s*\d+\s*[.、步]?\s*/, '').trim(); })
    .filter(function (s) { return s.length >= 4; })
    .slice(0, 16);
  if (!ingredients.length && !steps.length) throw new Error('智谱未生成有效内容');
  return { ok: true, name: name, ingredients: ingredients, steps: steps };
}

// ---------- 兜底：爬网页（海外节点大多被拦，仅作补充） ----------
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
async function tryXiaochufang(name) {
  const searchUrl = 'https://www.xiachufang.com/search/?keyword=' + encodeURIComponent(name);
  const html = await fetchText(searchUrl, 'https://www.xiachufang.com/');
  const m = html.match(/\/recipe\/\d+/);
  if (!m) throw new Error('未找到菜谱');
  const dhtml = await fetchText('https://www.xiachufang.com' + m[0] + '/printable/', 'https://www.xiachufang.com/');
  return parseRecipe(dhtml, name);
}
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

export async function onRequestPost(context) {
  const request = context.request || context;
  const env = context.env || {};
  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const name = (body && body.name || '').trim();
  if (!name) return json({ ok: false, error: '缺少菜名 name' }, 400);
  if (cache.has(name)) return json(cache.get(name));

  // 主：智谱 GLM；兜底：爬网页链
  const sources = [
    function () { return tryZhipu(name, env); },
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
  return json({ ok: false, error: '各来源均未获取到做法：' + lastErr });
}
