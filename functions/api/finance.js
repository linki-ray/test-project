/**
 * Cloudflare Pages Function —— 金融数据代理（绕开浏览器跨域 CORS）
 *
 * 数据源：
 *  - 大盘指数 / 个股实时行情：腾讯自选股 qt.gtimg.cn（国内极稳，与 westock 同源）
 *  - 板块涨幅排行 / 个股 K线：东方财富公开接口
 *
 * 前端调用：
 *  /api/finance?type=indices
 *  /api/finance?type=sectors
 *  /api/finance?type=quote&code=600519
 *  /api/finance?type=kline&code=600519&klt=101&lmt=120
 */
const TENCENT_QT = 'https://qt.gtimg.cn/q=';
const EM_SECTOR = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f3';
const EM_KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&fqt=1&end=20500101&lmt=';

/* ---------- 代码前缀转换 ---------- */
function tencentSecid(code) {
  code = String(code).replace(/^(sh|sz|bj)/i, '').toLowerCase();
  if (/^\d{6}$/.test(code)) return (code[0] === '6' ? 'sh' : 'sz') + code;
  return code;
}
function emSecid(code) {
  code = String(code).replace(/^(sh|sz|bj)/i, '').toLowerCase();
  if (/^\d{6}$/.test(code)) return (['6', '8', '4'].indexOf(code[0]) > -1 ? '1.' : '0.') + code;
  return code;
}

/* ---------- 解析腾讯行情（v_xxx="1~名称~代码~现价~昨收~..."） ---------- */
function parseTencent(text) {
  const re = /v_(\w+)="([^"]*)"/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[2].split('~');
    const price = parseFloat(raw[3]);
    if (!raw[1] || isNaN(price)) continue;
    let amount = 0;
    if (raw[35]) { const parts = raw[35].split('/'); amount = parseFloat(parts[2]) || 0; }
    out.push({
      code: m[1],
      name: raw[1],
      price: price,
      prevClose: parseFloat(raw[4]) || 0,
      open: parseFloat(raw[5]) || 0,
      chg: parseFloat(raw[31]) || 0,
      chgPct: parseFloat(raw[32]) || 0,
      high: parseFloat(raw[33]) || 0,
      low: parseFloat(raw[34]) || 0,
      turnover: parseFloat(raw[37]) || 0,   // 换手率 %
      pe: parseFloat(raw[38]) || 0,
      amount: amount,                        // 成交额（元）
      volumeRatio: parseFloat(raw[46]) || 0,
      mv: parseFloat(raw[44]) ? parseFloat(raw[44]) * 1e8 : 0 // 总市值（元，约）
    });
  }
  return out;
}

/* ---------- 解析东方财富板块 ---------- */
function parseSector(j) {
  const diff = (j && j.data && j.data.diff) || {};
  const arr = Array.isArray(diff) ? diff : Object.values(diff);
  return arr.map(function (d) { return { code: d.f12, name: d.f14, chgPct: (d.f3 || 0) / 100 }; }).filter(function (x) { return x.name; });
}

/* ---------- 解析东方财富 K线 ---------- */
function parseKline(j) {
  const kl = (j && j.data && j.data.klines) || [];
  return kl.map(function (s) {
    const p = s.split(',');
    return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], vol: +p[5] };
  });
}

/* ---------- 抓取 ---------- */
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/' } });
  if (!r.ok) throw new Error('http ' + r.status);
  return await r.text();
}
async function fetchJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('http ' + r.status);
  return await r.json();
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60'
    },
    status: status || 200
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const type = (url.searchParams.get('type') || 'indices').toLowerCase();
  const code = (url.searchParams.get('code') || '').toLowerCase();
  try {
    if (type === 'indices') {
      const text = await fetchText(TENCENT_QT + 'sh000001,sz399001,sz399006,sh000688');
      const items = parseTencent(text);
      return json({ ok: true, type, source: 'server', live: true, updated_at: new Date().toISOString(), items: items });
    }
    if (type === 'sectors') {
      const j = await fetchJSON(EM_SECTOR);
      const items = parseSector(j);
      return json({ ok: true, type, source: 'server', live: true, updated_at: new Date().toISOString(), items: items });
    }
    if (type === 'quote') {
      if (!code) throw new Error('missing code');
      const text = await fetchText(TENCENT_QT + tencentSecid(code));
      const items = parseTencent(text);
      if (!items.length) throw new Error('empty');
      return json({ ok: true, type, source: 'server', live: true, updated_at: new Date().toISOString(), item: items[0] });
    }
    if (type === 'kline') {
      if (!code) throw new Error('missing code');
      const klt = url.searchParams.get('klt') || '101';
      const lmt = url.searchParams.get('lmt') || '120';
      const j = await fetchJSON(EM_KLINE + lmt + '&secid=' + emSecid(code) + '&klt=' + klt);
      const items = parseKline(j);
      return json({ ok: true, type, source: 'server', live: true, updated_at: new Date().toISOString(), items: items });
    }
    throw new Error('unknown type');
  } catch (e) {
    return json({ ok: false, type, source: 'server', live: false, error: e.message, items: [] }, 502);
  }
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
