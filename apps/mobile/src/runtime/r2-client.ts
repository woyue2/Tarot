/**
 * 手机端 R2 客户端：直连 R2（与桌面端架构一致），用 fetch + WebCrypto 计算
 * AWS SigV4 签名，避免引入 @aws-sdk/client-s3 的 node 依赖与 polyfill。
 *
 * API 表面刻意对齐桌面端 r2-client.ts（putJson / getJson / list / delete /
 * testConnection），r2-sync.ts 因此可以在两端共享相同逻辑。
 *
 * ⚠️ 安全提示：浏览器/PWA 没有系统级安全存储，Secret Access Key 暂存
 * localStorage，明文可被同源脚本读取。仅适合个人/可信设备使用；走 Capacitor
 * 原生包装后应改用系统钥匙串（Keychain / Keystore）。
 */

import { Capacitor, CapacitorHttp, type HttpOptions } from "@capacitor/core";

export interface R2ClientConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region?: string;
}

function buildEndpoint(accountId: string): string {
  const id = accountId.trim();
  if (!id) throw new Error("Account ID 不能为空");
  return `https://${id}.r2.cloudflarestorage.com`;
}

export function resolveR2Endpoint(input: {
  accountId?: string | undefined;
  endpoint?: string | undefined;
}): string {
  if (input.endpoint?.trim()) return input.endpoint.trim();
  return buildEndpoint(input.accountId ?? "");
}

const encoder = new TextEncoder();

async function hmac(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function sha256Hex(message: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** RFC 3986 编码（query 值里 / 也要编码，path 里 / 不编码）。 */
function uriEncode(value: string, encodeSlash: boolean): string {
  let result = "";
  for (const char of value) {
    if (/[A-Za-z0-9_.~-]/.test(char)) {
      result += char;
    } else if (char === "/" && !encodeSlash) {
      result += char;
    } else {
      const bytes = encoder.encode(char);
      for (const b of bytes) result += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return result;
}

async function signRequest(opts: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const bodyHash = await sha256Hex(opts.body);
  const host = opts.url.host;

  // 合并并小写所有头
  const baseHeaders: Record<string, string> = {
    host,
    "x-amz-content-sha256": bodyHash,
    "x-amz-date": amzDate,
  };
  for (const [k, v] of Object.entries(opts.headers)) baseHeaders[k.toLowerCase()] = v;
  const sortedHeaderKeys = Object.keys(baseHeaders).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${baseHeaders[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  // 规范化查询串
  const sortedParams = Array.from(opts.url.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const canonicalQueryString = sortedParams
    .map(([k, v]) => `${uriEncode(k, true)}=${uriEncode(v, true)}`)
    .join("&");

  // path：R2 用 path-style（host/bucket/key），pathname 已经包含 bucket 与 key
  const canonicalRequest = [
    opts.method,
    opts.url.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${opts.region}/s3/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // 派生签名 key
  const kDate = await hmac(encoder.encode("AWS4" + opts.secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, opts.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");

  const signature = bufferToHex(await hmac(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...baseHeaders,
    Authorization: authorization,
  };
}

interface ListContents {
  key: string;
  lastModified: string;
}

function parseListResponse(xml: string): {
  contents: ListContents[];
  nextContinuationToken?: string;
} {
  const contents: ListContents[] = [];
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match: RegExpExecArray | null;
  while ((match = contentsRegex.exec(xml)) !== null) {
    const block = match[1];
    if (!block) continue;
    const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
    const lastModified = block.match(/<LastModified>([^<]*)<\/LastModified>/)?.[1];
    if (key && lastModified) contents.push({ key, lastModified });
  }
  const nextToken = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1];
  return nextToken ? { contents, nextContinuationToken: nextToken } : { contents };
}

export class R2Client {
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucket: string;
  private readonly region: string;

  constructor(config: R2ClientConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucket = config.bucketName;
    this.region = config.region ?? "auto";
  }

  private buildUrl(key: string, params?: Record<string, string>): URL {
    // path-style：endpoint/bucket/key
    const url = new URL(`${this.endpoint}/${this.bucket}/${key}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    return url;
  }

  private async signedFetch(
    url: URL,
    method: string,
    extraHeaders: Record<string, string>,
    body: string,
  ): Promise<Response> {
    const headers = await signRequest({
      method,
      url,
      headers: extraHeaders,
      body,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    });
    return fetch(url.toString(), { method, headers, body: body || null });
  }

  async putJson(key: string, data: unknown): Promise<void> {
    const body = JSON.stringify(data, null, 2);
    const url = this.buildUrl(key);
    const res = await this.signedFetch(url, "PUT", { "Content-Type": "application/json" }, body);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT ${key} 失败（${res.status}）：${text}`);
    }
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const url = this.buildUrl(key);
    const res = await this.signedFetch(url, "GET", {}, "");
    if (res.status === 404) return undefined;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GET ${key} 失败（${res.status}）：${text}`);
    }
    return (await res.json()) as T;
  }

  async list(prefix: string): Promise<Array<{ key: string; lastModified: Date }>> {
    const result: Array<{ key: string; lastModified: Date }> = [];
    let continuationToken: string | undefined;
    do {
      const params: Record<string, string> = { "list-type": "2", prefix };
      if (continuationToken) params["continuation-token"] = continuationToken;
      const url = this.buildUrl("", params);
      const res = await this.signedFetch(url, "GET", {}, "");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LIST ${prefix} 失败（${res.status}）：${text}`);
      }
      const xml = await res.text();
      const parsed = parseListResponse(xml);
      for (const obj of parsed.contents) {
        result.push({ key: obj.key, lastModified: new Date(obj.lastModified) });
      }
      continuationToken = parsed.nextContinuationToken;
    } while (continuationToken);
    return result;
  }

  async delete(key: string): Promise<void> {
    const url = this.buildUrl(key);
    const res = await this.signedFetch(url, "DELETE", {}, "");
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`DELETE ${key} 失败（${res.status}）：${text}`);
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      // R2 的 Object Read & Write access key 不支持 HeadBucket，用 ListObjects 测试
      const url = this.buildUrl("", {
        "list-type": "2",
        "max-keys": "1",
        prefix: "_sync/",
      });
      const res = await this.signedFetch(url, "GET", {}, "");
      if (res.ok) return { ok: true, message: "连接成功 ✅" };
      const text = await res.text().catch(() => "");
      if (res.status === 403)
        return { ok: false, message: "Access Key 或 Secret Key 不正确" };
      if (res.status === 404) return { ok: false, message: "Bucket 不存在" };
      return { ok: false, message: `连接失败（${res.status}）：${text}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        return { ok: false, message: "无法连接 R2 端点，请检查 Account ID 或 Endpoint" };
      }
      return { ok: false, message: `连接失败：${message}` };
    }
  }
}

// ---- 公共接口：直连 / Worker 两种实现都满足它 ----

/** R2 客户端抽象，R2Client（直连）和 WorkerR2Client（代理）都实现此接口。 */
export interface R2ClientLike {
  putJson(key: string, data: unknown): Promise<void>;
  getJson<T>(key: string): Promise<T | undefined>;
  list(prefix: string): Promise<Array<{ key: string; lastModified: Date }>>;
  delete(key: string): Promise<void>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

// ---- Worker 代理客户端 ----

/**
 * 走 Cloudflare Worker 代理的 R2 客户端。
 * 前端只持 Worker URL + Sync Token（Bearer 鉴权），R2 密钥由 Worker 服务端持有。
 * API 表面与直连 R2Client 一致，r2-sync.ts 可无差别复用。
 */
export class WorkerR2Client implements R2ClientLike {
  private readonly baseUrl: string;
  private readonly syncToken: string;

  constructor(config: { workerUrl: string; syncToken: string }) {
    this.baseUrl = config.workerUrl.replace(/\/+$/, "");
    this.syncToken = config.syncToken;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  private async request(
    path: string,
    method: string,
    params: Record<string, string>,
    body?: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    const url = this.buildUrl(path, params);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.syncToken}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    // Capacitor 原生环境下绕过 WebView fetch 的 localhost proxy，
    // 直接走 CapacitorHttp 原生 HTTP 层，避免真机上 proxy 拦截卡住导致超时。
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest(url, method, headers, body, signal);
    }

    const init: RequestInit = { method, headers, body: body ?? null };
    if (signal) init.signal = signal;
    return fetch(url, init);
  }

  private async nativeRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    if (signal?.aborted) {
      throw new Error("aborted");
    }

    const options: HttpOptions = {
      url,
      method,
      headers,
      connectTimeout: 8000,
      readTimeout: 8000,
    };
    if (body !== undefined) {
      options.data = body;
    }

    const res = await CapacitorHttp.request(options);

    // CapacitorHttp 会自动把 JSON 响应解析成对象，这里还原成字符串流供 Response 消费。
    const responseBody =
      res.data === undefined || res.data === null
        ? ""
        : typeof res.data === "string"
          ? res.data
          : JSON.stringify(res.data);

    return new Response(responseBody, {
      status: res.status,
      headers: res.headers,
    });
  }

  async putJson(key: string, data: unknown): Promise<void> {
    const body = JSON.stringify(data, null, 2);
    const res = await this.request("/objects", "PUT", { key }, body);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT ${key} 失败（${res.status}）：${text}`);
    }
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const res = await this.request("/objects", "GET", { key });
    if (res.status === 404) return undefined;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GET ${key} 失败（${res.status}）：${text}`);
    }
    return (await res.json()) as T;
  }

  async list(prefix: string): Promise<Array<{ key: string; lastModified: Date }>> {
    const res = await this.request("/objects", "GET", { prefix });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LIST ${prefix} 失败（${res.status}）：${text}`);
    }
    const items = (await res.json()) as Array<{ key: string; lastModified: string }>;
    return items.map((item) => ({
      key: item.key,
      lastModified: new Date(item.lastModified),
    }));
  }

  async delete(key: string): Promise<void> {
    const res = await this.request("/objects", "DELETE", { key });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`DELETE ${key} 失败（${res.status}）：${text}`);
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    // 8 秒超时：避免 Android WebView 网络问题导致长时间"测试中"
    const timeoutMs = 8000;
    try {
      // 先打 /health 确认 Worker 在线（走 request 以在 Capacitor 原生环境下绕过 WebView proxy）
      const healthController = new AbortController();
      const healthTimer = setTimeout(() => healthController.abort(), timeoutMs);
      const healthRes = await this.request("/health", "GET", {}, undefined, healthController.signal);
      clearTimeout(healthTimer);
      if (!healthRes.ok) {
        return { ok: false, message: `Worker 不可达（${healthRes.status}）` };
      }
      // 再打 /objects 验证 Sync Token
      const authController = new AbortController();
      const authTimer = setTimeout(() => authController.abort(), timeoutMs);
      const res = await this.request("/objects", "GET", { prefix: "_sync/" }, undefined, authController.signal);
      clearTimeout(authTimer);
      if (res.ok) return { ok: true, message: "连接成功 ✅" };
      if (res.status === 401) return { ok: false, message: "Sync Token 不正确" };
      const text = await res.text().catch(() => "");
      return { ok: false, message: `连接失败（${res.status}）：${text}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("aborted") || message.includes("AbortError") || message.includes("timeout")) {
        return { ok: false, message: `连接超时（${timeoutMs / 1000}s），可能网络不通或 URL 错误` };
      }
      // 显示原始错误信息便于诊断（不再掩盖为泛化提示）
      return { ok: false, message: `连接失败：${message}` };
    }
  }
}
