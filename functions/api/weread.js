/**
 * Cloudflare Pages Function —— 微信读书（WeRead）代理
 *
 * 微信读书官方 Skills API（2026 新出）通过统一网关调用：
 *   POST https://i.weread.qq.com/api/agent/gateway
 *   鉴权：Authorization: Bearer <API Key>（格式 wrk-xxxxxxxx，绑定用户身份）
 *   请求体：{ api_name, skill_version, ...业务参数 }（参数平铺，勿包 params）
 *
 * 浏览器直连该网关会被 CORS 拦截，且 Key 不应出现在前端源码，
 * 故由本服务端函数代理转发。Key 来自前端请求体（前端存于本机浏览器 localStorage），
 * 服务端仅做转发，不持久化 Key。
 *
 * 前端调用：/api/weread  （与站点同域，无 CORS 问题）
 *   请求体示例：{ "key":"wrk-xxx", "api_name":"/shelf/sync", "skill_version":"1.0.3" }
 */
function json(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    },
    status: status || 200
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: '请求体不是合法 JSON' }, 400);
  }

  const key = (body && body.key ? String(body.key) : '').trim();
  const apiName = body && body.api_name ? String(body.api_name) : '';
  if (!key || !apiName) {
    return json({ ok: false, error: '缺少 key 或 api_name' }, 400);
  }

  // 透传业务参数 + 统一带上 skill_version
  const payload = Object.assign({}, body, {
    skill_version: body.skill_version || '1.0.3'
  });

  try {
    const upstream = await fetch('https://i.weread.qq.com/api/agent/gateway', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }
    // 透传微信读书返回（含 errcode / upgrade_info 等），由前端展示
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return json({ ok: false, error: '代理请求失败：' + (e && e.message ? e.message : e) }, 502);
  }
}

// 兜底：仅允许 POST / OPTIONS
export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'POST') return onRequestPost(context);
  if (method === 'OPTIONS') return onRequestOptions();
  return json({ ok: false, error: '仅支持 POST' }, 405);
}
