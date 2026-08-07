/**
 * 星径 · 塔罗 —— 手机端 R2 同步代理（Cloudflare Worker）
 *
 * 作用：浏览器/PWA 没有安全的密钥存放位置，直接把 R2 的 Access Key / Secret
 * 暴露在前端是危险的。这个 Worker 作为「中间人」保管密钥：
 *   - 持有 R2_BUCKET 绑定（原生访问，无需 AWS SDK）
 *   - 持有 SYNC_TOKEN 密钥（secret，不进代码仓库）
 *   - 浏览器端只调你自己的 Worker 域名，用 Bearer 令牌鉴权
 *   - 所有响应带 CORS 头，允许浏览器跨域 fetch
 *
 * 对象键布局与桌面端完全一致（共用一个桶即可互相识别）：
 *   readings/<id>.json
 *   folders/<id>.json
 *
 * 部署：见同目录 README.md
 */

// CORS 头：允许任意来源（个人同步用，可按需收紧为具体域名）
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsify(response) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

function json(data, status = 200) {
  return corsify(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS 预检请求：直接放行
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 健康检查 / 连接测试
    if (url.pathname === "/health") {
      return json({ ok: true, service: "tarot-r2-sync" });
    }

    // 仅接受 /objects 端点
    if (url.pathname !== "/objects") {
      return json({ ok: false, message: "Not Found" }, 404);
    }

    // Bearer 令牌鉴权
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
      return json({ ok: false, message: "未授权：请检查同步令牌" }, 401);
    }

    const key = url.searchParams.get("key");
    const prefix = url.searchParams.get("prefix");

    // 写入（PUT / POST）
    if (request.method === "PUT" || request.method === "POST") {
      if (!key) return json({ ok: false, message: "缺少 key 参数" }, 400);
      const body = await request.text();
      await env.R2_BUCKET.put(key, body, {
        httpMetadata: { contentType: "application/json" },
      });
      return json({ ok: true });
    }

    // 删除
    if (request.method === "DELETE") {
      if (!key) return json({ ok: false, message: "缺少 key 参数" }, 400);
      await env.R2_BUCKET.delete(key);
      return json({ ok: true });
    }

    // 读取（GET）
    if (request.method === "GET") {
      if (key) {
        const obj = await env.R2_BUCKET.get(key);
        if (!obj) return new Response("Not Found", { status: 404, headers: { ...CORS_HEADERS } });
        const text = await obj.text();
        return corsify(
          new Response(text, {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      const listPrefix = prefix || "";
      const listed = await env.R2_BUCKET.list(
        listPrefix ? { prefix: listPrefix } : {},
      );
      const items = listed.objects.map((o) => ({
        key: o.key,
        lastModified: (o.uploaded ? o.uploaded.toISOString() : new Date().toISOString()),
      }));
      return json(items);
    }

    return json({ ok: false, message: "Method Not Allowed" }, 405);
  },
};
