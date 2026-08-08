import { ReadingService, R2SyncService } from "@tarot/runtime";
import { contentBundle } from "./content";
import { browserEnv } from "./environment";
import { WebReadingRepository } from "./repository";
import { R2Client, WorkerR2Client, resolveR2Endpoint, type R2ClientLike } from "./r2-client";
import {
  getSecretAccessKey,
  getSyncToken,
  isR2Configured,
  loadR2Settings,
} from "./credentials";

// 组合根：把浏览器端口注入平台无关的 ReadingService。
// UI 只依赖这个单例，不直接接触仓储 / 内容 / 环境细节。
export const repository = new WebReadingRepository();
export const readingService = new ReadingService(repository, contentBundle, browserEnv);

/**
 * 按当前已保存的设置构建 R2 客户端（直连或 Worker 代理）。
 * 未配置或配置不全返回 null。
 */
function buildR2Client(): R2ClientLike | null {
  const settings = loadR2Settings();
  if (settings.mode === "worker") {
    const token = getSyncToken();
    if (!settings.workerUrl.trim() || !token) return null;
    return new WorkerR2Client({
      workerUrl: settings.workerUrl.trim(),
      syncToken: token,
    });
  }
  // direct
  const secret = getSecretAccessKey();
  if (
    !settings.accountId.trim() ||
    !settings.accessKeyId.trim() ||
    !settings.bucketName.trim() ||
    !secret
  ) {
    return null;
  }
  try {
    const endpoint = resolveR2Endpoint({
      accountId: settings.accountId,
      endpoint: settings.endpoint,
    });
    return new R2Client({
      endpoint,
      accessKeyId: settings.accessKeyId,
      secretAccessKey: secret,
      bucketName: settings.bucketName,
      region: settings.region,
    });
  } catch {
    return null;
  }
}

/**
 * 按需构建 R2 同步服务。未配置则返回 null。
 * 每次调用都新建，开销极小；配置变化时能自动拿到最新设置。
 */
export function createR2Sync(): R2SyncService | null {
  if (!isR2Configured()) return null;
  const client = buildR2Client();
  if (!client) return null;
  return new R2SyncService(client, repository);
}

/** 用当前已保存的设置测试 R2 连通性（直连或 Worker 代理，供「测试连接」按钮调用）。 */
export async function testR2Connection(): Promise<{ ok: boolean; message: string }> {
  if (!isR2Configured()) {
    const settings = loadR2Settings();
    if (settings.mode === "worker") {
      return { ok: false, message: "尚未配置 Worker URL / Sync Token" };
    }
    return { ok: false, message: "尚未配置 Account ID / Access Key / Secret / Bucket" };
  }
  const client = buildR2Client();
  if (!client) {
    return { ok: false, message: "配置不完整，请检查 R2 设置" };
  }
  return client.testConnection();
}
