/**
 * 手机端 R2 客户端：浏览器侧通过 fetch 调用 Cloudflare Worker 代理，
 * 而非直连 R2 —— 这样 Secret 永远不进前端。
 *
 * API 表面刻意对齐桌面端 r2-client.ts（putJson / getJson / list / delete /
 * testConnection），方便后续把同步逻辑在两端共享。
 */

export interface WorkerR2ClientConfig {
  workerUrl: string;
  syncToken: string;
}

function buildObjectsUrl(workerUrl: string, params: Record<string, string>): string {
  const base = workerUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/objects`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export class WorkerR2Client {
  constructor(private readonly config: WorkerR2ClientConfig) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.syncToken}`,
    };
  }

  async putJson(key: string, data: unknown): Promise<void> {
    const res = await fetch(buildObjectsUrl(this.config.workerUrl, { key }), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(data, null, 2),
    });
    if (!res.ok) throw new Error(`推送到 R2 失败（${res.status}）`);
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const res = await fetch(buildObjectsUrl(this.config.workerUrl, { key }), {
      headers: this.headers(),
    });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`从 R2 读取失败（${res.status}）`);
    return (await res.json()) as T;
  }

  async list(prefix: string): Promise<Array<{ key: string; lastModified: Date }>> {
    const res = await fetch(buildObjectsUrl(this.config.workerUrl, { prefix }), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`列出 R2 对象失败（${res.status}）`);
    const data = (await res.json()) as Array<{ key: string; lastModified: string }>;
    return data.map((item) => ({ key: item.key, lastModified: new Date(item.lastModified) }));
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(buildObjectsUrl(this.config.workerUrl, { key }), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`删除 R2 对象失败（${res.status}）`);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(buildObjectsUrl(this.config.workerUrl, { prefix: "readings/" }), {
        headers: this.headers(),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 401) return { ok: false, message: "授权失败：请检查同步令牌" };
      if (res.status === 404) {
        // Worker 存在但桶里还没有 readings/ 前缀，也算连通
        return { ok: true, message: "连接成功 ✅" };
      }
      if (!res.ok) return { ok: false, message: `连接失败（${res.status}）` };
      return { ok: true, message: "连接成功 ✅" };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "连接失败" };
    }
  }
}
