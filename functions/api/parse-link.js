/* =========================================================
   Cloudflare Pages Function：解析小红书 / 抖音 分享链接
   - 接收 POST { url }
   - 服务端代理抓取，规避浏览器跨域 / 登录墙（尽力而为）
   - 提取 标题 / 正文文案 / 封面图，返回 JSON
   - 小红书与抖音都会把标题+封面 SSR 出来；正文在 og:description；
     视频流有强签名无法直链，故不返回可播视频，只给原链接跳转。
   ========================================================= */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: CORS });
}

function detectPlatform(url) {
  if (/xiaohongshu\.com|xhslink\.cn|xhslink\.com/i.test(url)) return 'xiaohongshu';
  if (/douyin\.com|iesdouyin\.com|tiktok\.com/i.test(url)) return 'douyin';
  return 'unknown';
}

function unescapeHtml(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMeta(html, key) {
  var re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + escapeRe(key) + '["\'][^>]*?content=["\']([^"\']*)["\']', 'i');
  var m = html.match(re1);
  if (m) return unescapeHtml(m[1]);
  var re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + escapeRe(key) + '["\']', 'i');
  m = html.match(re2);
  if (m) return unescapeHtml(m[1]);
  return '';
}

function getTitle(html) {
  var m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? unescapeHtml(m[1].trim()) : '';
}

function cleanTitle(t, platform) {
  if (!t) return '';
  if (platform === 'xiaohongshu') t = t.replace(/\s*-\s*小红书\s*$/, '');
  if (platform === 'douyin') t = t.replace(/\s*-\s*抖音\s*$/, '').replace(/\s*-\s*Douyin\s*$/, '');
  return t.trim();
}

function extractXHS(html) {
  // 小红书正文在 window.__INITIAL_STATE__ 的 JSON 里（og:description 只是站点通用描述）
  try {
    var m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?)<\/script>/);
    if (!m) return null;
    var str = m[1].replace(/;\s*$/, '');
    var obj = null;
    try {
      // 该 JSON 偶含 undefined（非法 JSON），先做容错替换再解析
      str = str.replace(/:\s*undefined\b/g, ':null').replace(/,\s*undefined\b/g, ',null');
      obj = JSON.parse(str);
    } catch (e1) {
      // 兜底：直接从原始串抓 desc 字符串
      var dm = str.match(/"desc":"((?:[^"\\]|\\.)*)"/);
      if (dm) { try { return { desc: JSON.parse('"' + dm[1] + '"') }; } catch (e2) {} }
      return null;
    }
    var noteMap = obj.note && obj.note.noteDetailMap;
    if (!noteMap) return null;
    var entry = Object.values(noteMap)[0];
    var note = entry && entry.note;
    if (!note) return null;
    var images = [];
    (note.imageList || []).forEach(function (im) {
      var u = (im && im.infoList && im.infoList[0] && im.infoList[0].url) || (im && im.url);
      if (u) images.push(u.indexOf('//') === 0 ? 'https:' + u : u);
    });
    return { title: note.title, desc: note.desc, images: images };
  } catch (e) { return null; }
}

function extract(html, platform, url) {
  var title = cleanTitle(getMeta(html, 'og:title') || getTitle(html), platform);
  var desc = getMeta(html, 'og:description') || getMeta(html, 'description');

  var images = [];
  var ogImg = getMeta(html, 'og:image');
  if (ogImg) images.push(ogImg);

  if (platform === 'xiaohongshu') {
    var x = extractXHS(html);
    if (x) {
      if (x.title) title = cleanTitle(x.title, platform) || title;
      if (x.desc && x.desc.length > (desc || '').length) desc = x.desc;
      if (x.images && x.images.length) x.images.forEach(function (u) { if (images.indexOf(u) === -1) images.push(u); });
    }
  }

  // 收集正文中的封面图（xiaohongshu 的 picasso-static / douyin 的 douyinpic）
  var imgRe = /https?:\/\/[^\s"']*(?:picasso-static\.xiaohongshu\.com|xiaohongshu\.com|douyinpic\.com|p\d+-sign\.douyinpic\.com)[^\s"']*\.(?:jpg|jpeg|png|webp)/gi;
  var mm;
  while ((mm = imgRe.exec(html)) !== null && images.length < 8) {
    if (images.indexOf(mm[0]) === -1) images.push(mm[0]);
  }

  // XHS 的 og:description 常含 #话题 与多余符号，做轻度清洗
  if (desc) {
    desc = desc.replace(/\s*#\S+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  return { title: title, text: desc, images: images, sourceUrl: url };
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: '仅支持 POST' }, 405);
  }

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ ok: false, error: '请求体不是合法 JSON' }, 400); }

  var url = (body && body.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return json({ ok: false, error: '请提供有效的 http(s) 链接' }, 400);
  }

    var platform = detectPlatform(url);
    // UA 按平台区分：抖音桌面端返回 App 引导页（无标题），必须用移动端 UA；
    // 小红书桌面端 SSR 更完整（含 __INITIAL_STATE__ 笔记正文），用桌面端 UA。
    var DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    var MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    var UA = platform === 'douyin' ? MOBILE_UA : DESKTOP_UA;
    try {
      var resp = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        redirect: 'follow'
      });
    if (!resp.ok) {
      return json({ ok: false, error: '目标站点返回 ' + resp.status + '（可能需要登录或已被拦截）', platform: platform }, 502);
    }
    var html = await resp.text();
    if (!html || html.length < 200) {
      return json({ ok: false, error: '抓取内容为空（可能被登录墙拦截）', platform: platform }, 502);
    }
    var result = extract(html, platform, url);
    if (!result.title && !result.text) {
      return json({ ok: false, error: '未能提取到标题/正文（页面结构变化或被拦截）', platform: platform }, 200);
    }
    return json({ ok: true, platform: platform, title: result.title, text: result.text, images: result.images, sourceUrl: result.sourceUrl }, 200);
  } catch (e) {
    return json({ ok: false, error: '服务端抓取失败：' + (e && e.message ? e.message : e), platform: platform }, 502);
  }
}
