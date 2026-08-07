import { ReadingService } from "@tarot/runtime";
import { contentBundle } from "./content";
import { browserEnv } from "./environment";
import { WebReadingRepository } from "./repository";
import { R2Client, resolveR2Endpoint } from "./r2-client";
import { MobileR2SyncService } from "./r2-sync";
import {
  getSecretAccessKey,
  isR2Configured,
  loadR2Settings,
} from "./credentials";

// 组合根：把浏览器端口注入平台无关的 ReadingService。
// UI 只依赖这个单例，不直接接触仓储 / 内容 / 环境细节。
export const repository = new WebReadingRepository();
export const readingService = new ReadingService(repository, contentBundle, browserEnv);

/**
 * 按需构建 R2 同步服务（直连 R2 版）。未配置则返回 null。
 * 每次调用都新建，开销极小；配置变化时能自动拿到最新设置。
 */
export function createR2Sync(): MobileR2SyncService | null {
  if (!isR2Configured()) return null;
  const settings = loadR2Settings();
  const secret = getSecretAccessKey();
  if (!secret) return null;
  try {
    const endpoint = resolveR2Endpoint({
      accountId: settings.accountId,
      endpoint: settings.endpoint,
    });
    const client = new R2Client({
      endpoint,
      accessKeyId: settings.accessKeyId,
      secretAccessKey: secret,
      bucketName: settings.bucketName,
      region: settings.region,
    });
    return new MobileR2SyncService(client, repository);
  } catch {
    return null;
  }
}

/** 用当前已保存的设置测试 R2 直连连通性（供「测试连接」按钮调用）。 */
export async function testR2Connection(): Promise<{ ok: boolean; message: string }> {
  if (!isR2Configured()) {
    return { ok: false, message: "尚未配置 Account ID / Access Key / Secret / Bucket" };
  }
  const settings = loadR2Settings();
  const secret = getSecretAccessKey();
  if (!secret) return { ok: false, message: "尚未配置 Secret Access Key" };
  try {
    const endpoint = resolveR2Endpoint({
      accountId: settings.accountId,
      endpoint: settings.endpoint,
    });
    const client = new R2Client({
      endpoint,
      accessKeyId: settings.accessKeyId,
      secretAccessKey: secret,
      bucketName: settings.bucketName,
      region: settings.region,
    });
    return client.testConnection();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "连接失败" };
  }
}
