import { ReadingService } from "@tarot/runtime";
import { contentBundle } from "./content";
import { browserEnv } from "./environment";
import { WebReadingRepository } from "./repository";
import { WorkerR2Client } from "./r2-client";
import { MobileR2SyncService } from "./r2-sync";
import {
  getSyncToken,
  isR2Configured,
  loadR2Settings,
} from "./credentials";

// 组合根：把浏览器端口注入平台无关的 ReadingService。
// UI 只依赖这个单例，不直接接触仓储 / 内容 / 环境细节。
export const repository = new WebReadingRepository();
export const readingService = new ReadingService(repository, contentBundle, browserEnv);

/**
 * 按需构建 R2 同步服务（Worker 代理版）。未配置则返回 null。
 * 每次调用都新建，开销极小；配置变化时能自动拿到最新设置。
 */
export function createR2Sync(): MobileR2SyncService | null {
  if (!isR2Configured()) return null;
  const settings = loadR2Settings();
  const token = getSyncToken();
  if (!token) return null;
  const client = new WorkerR2Client({ workerUrl: settings.workerUrl, syncToken: token });
  return new MobileR2SyncService(client, repository);
}

/** 用当前已保存的设置测试 Worker 代理连通性（供「测试连接」按钮调用）。 */
export async function testR2Connection(): Promise<{ ok: boolean; message: string }> {
  if (!isR2Configured()) {
    return { ok: false, message: "尚未配置 Worker URL / Bucket / 同步令牌" };
  }
  const settings = loadR2Settings();
  const token = getSyncToken();
  if (!token) return { ok: false, message: "尚未配置同步令牌" };
  const client = new WorkerR2Client({ workerUrl: settings.workerUrl, syncToken: token });
  return client.testConnection();
}
