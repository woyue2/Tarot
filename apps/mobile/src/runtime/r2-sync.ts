/**
 * 手机端 R2 双向同步服务。
 *
 * 逻辑平移自桌面端 r2-sync.ts（相同的后写覆盖 last-write-wins 策略、
 * 相同的对象键布局 readings/<id>.json、folders/<id>.json），只是把
 * R2Client 换成 WorkerR2Client，把仓储换成浏览器的 WebReadingRepository。
 *
 * 这样手机端与桌面端可以向同一个 R2 桶读写，互不冲突。
 */
import type { ReadingFolder, ReadingRepository, StoredReading } from "@tarot/runtime";
import type { WorkerR2Client } from "./r2-client";

export interface SyncReport {
  pulled: number;
  pushed: number;
  errors: string[];
}

type SyncRepository = ReadingRepository & {
  listFolders(): ReadingFolder[];
  findFolder(id: string): ReadingFolder | undefined;
  saveFolder(folder: ReadingFolder): void;
};

export class MobileR2SyncService {
  private readonly client: WorkerR2Client;
  private readonly repository: SyncRepository;
  private busy = false;

  constructor(client: WorkerR2Client, repository: SyncRepository) {
    this.client = client;
    this.repository = repository;
  }

  async pushReading(reading: StoredReading): Promise<void> {
    await this.client.putJson(`readings/${reading.id}.json`, reading);
  }

  async pushFolder(folder: ReadingFolder): Promise<void> {
    await this.client.putJson(`folders/${folder.id}.json`, folder);
  }

  async deleteReading(id: string): Promise<void> {
    await this.client.delete(`readings/${id}.json`);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.client.delete(`folders/${id}.json`);
  }

  async sync(): Promise<SyncReport> {
    if (this.busy) return { pulled: 0, pushed: 0, errors: ["同步正在进行中"] };
    this.busy = true;
    const report: SyncReport = { pulled: 0, pushed: 0, errors: [] };
    try {
      await this.syncReadings(report);
      await this.syncFolders(report);
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
    }
    return report;
  }

  private async syncReadings(report: SyncReport): Promise<void> {
    const [remoteList, localReadings] = await Promise.all([
      this.client.list("readings/"),
      this.repository.list(500),
    ]);

    const localMap = new Map(localReadings.map((r) => [r.id, r]));
    const remoteMap = new Map(
      remoteList
        .filter((item) => item.key.endsWith(".json"))
        .map((item) => {
          const id = item.key.replace("readings/", "").replace(".json", "");
          return [id, item] as const;
        }),
    );

    for (const [id, remoteItem] of remoteMap) {
      const local = localMap.get(id);
      const remote = await this.client.getJson<StoredReading>(remoteItem.key);
      if (!remote) continue;
      if (!local || remote.updatedAt > local.updatedAt) {
        try {
          this.repository.save(remote);
          report.pulled++;
          localMap.set(id, remote);
        } catch (error) {
          report.errors.push(`拉取 reading ${id} 失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    for (const [id, local] of localMap) {
      const remote = remoteMap.get(id);
      if (!remote || local.updatedAt > remote.lastModified.toISOString()) {
        try {
          await this.client.putJson(`readings/${id}.json`, local);
          report.pushed++;
        } catch (error) {
          report.errors.push(`推送 reading ${id} 失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  private async syncFolders(report: SyncReport): Promise<void> {
    const [remoteList, localFolders] = await Promise.all([
      this.client.list("folders/"),
      this.repository.listFolders(),
    ]);

    const localMap = new Map(localFolders.map((f) => [f.id, f]));
    const remoteMap = new Map(
      remoteList
        .filter((item) => item.key.endsWith(".json"))
        .map((item) => {
          const id = item.key.replace("folders/", "").replace(".json", "");
          return [id, item] as const;
        }),
    );

    for (const [id, remoteItem] of remoteMap) {
      const local = localMap.get(id);
      const remote = await this.client.getJson<ReadingFolder>(remoteItem.key);
      if (!remote) continue;
      if (!local || remote.updatedAt > local.updatedAt) {
        try {
          this.repository.saveFolder(remote);
          report.pulled++;
          localMap.set(id, remote);
        } catch (error) {
          report.errors.push(`拉取 folder ${id} 失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    for (const [id, local] of localMap) {
      const remote = remoteMap.get(id);
      if (!remote || local.updatedAt > remote.lastModified.toISOString()) {
        try {
          await this.client.putJson(`folders/${id}.json`, local);
          report.pushed++;
        } catch (error) {
          report.errors.push(`推送 folder ${id} 失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
}
