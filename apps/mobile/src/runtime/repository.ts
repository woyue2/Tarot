import type { FolderRepository, ReadingFolder, ReadingRepository, StoredReading } from "@tarot/runtime";

const READINGS_KEY = "tarot.mobile.readings.v1";
const FOLDERS_KEY = "tarot.mobile.folders.v1";

/**
 * localStorage 版仓储，实现 runtime 的 ReadingRepository + FolderRepository 端口。
 *
 * 对应桌面端的 SqliteReadingRepository：接口签名完全一致，因此 ReadingService
 * 无需关心底层是 SQLite 还是 localStorage。
 *
 * 注意（已知 Gap）：localStorage 有 ~5MB 上限且同步阻塞，适合 MVP / PWA 验证；
 * 走 Capacitor 后应替换为 SQLite / IndexedDB 实现同一组端口。
 */
export class WebReadingRepository implements ReadingRepository, FolderRepository {
  private onReadingSaved: ((reading: StoredReading) => void) | undefined;
  private onFolderSaved: ((folder: ReadingFolder) => void) | undefined;

  setSyncHooks(hooks: {
    onReadingSaved?: (reading: StoredReading) => void;
    onFolderSaved?: (folder: ReadingFolder) => void;
  }): void {
    this.onReadingSaved = hooks.onReadingSaved;
    this.onFolderSaved = hooks.onFolderSaved;
  }

  private readReadings(): Record<string, StoredReading> {
    try {
      return JSON.parse(localStorage.getItem(READINGS_KEY) ?? "{}") as Record<string, StoredReading>;
    } catch {
      return {};
    }
  }

  private writeReadings(map: Record<string, StoredReading>): void {
    localStorage.setItem(READINGS_KEY, JSON.stringify(map));
  }

  private readFolders(): Record<string, ReadingFolder> {
    try {
      return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "{}") as Record<string, ReadingFolder>;
    } catch {
      return {};
    }
  }

  private writeFolders(map: Record<string, ReadingFolder>): void {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(map));
  }

  // ---- ReadingRepository ----

  save(reading: StoredReading): void {
    const map = this.readReadings();
    map[reading.id] = reading;
    this.writeReadings(map);
    this.onReadingSaved?.(reading);
  }

  saveReadings(readings: StoredReading[]): void {
    if (readings.length === 0) return;
    const map = this.readReadings();
    for (const reading of readings) map[reading.id] = reading;
    this.writeReadings(map);
  }

  find(id: string): StoredReading | undefined {
    return this.readReadings()[id];
  }

  list(limit = 100): StoredReading[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    return Object.values(this.readReadings())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, safeLimit);
  }

  deleteReading(id: string): boolean {
    const map = this.readReadings();
    if (!(id in map)) return false;
    delete map[id];
    this.writeReadings(map);
    return true;
  }

  // ---- FolderRepository ----

  listFolders(): ReadingFolder[] {
    return Object.values(this.readFolders()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  findFolder(id: string): ReadingFolder | undefined {
    return this.readFolders()[id];
  }

  saveFolder(folder: ReadingFolder): void {
    const map = this.readFolders();
    map[folder.id] = folder;
    this.writeFolders(map);
    this.onFolderSaved?.(folder);
  }

  saveFolders(folders: ReadingFolder[]): void {
    if (folders.length === 0) return;
    const map = this.readFolders();
    for (const folder of folders) map[folder.id] = folder;
    this.writeFolders(map);
  }

  renameFolder(id: string, name: string): ReadingFolder | undefined {
    const map = this.readFolders();
    const folder = map[id];
    if (!folder) return undefined;
    const updated: ReadingFolder = { ...folder, name, updatedAt: new Date().toISOString() };
    map[id] = updated;
    this.writeFolders(map);
    this.onFolderSaved?.(updated);
    return updated;
  }

  deleteFolder(id: string): boolean {
    const folders = this.readFolders();
    if (!(id in folders)) return false;
    delete folders[id];
    this.writeFolders(folders);
    // 浏览器等价于 SQL 的 ON DELETE SET NULL：把该分组下的解读解绑为未分组
    const readings = this.readReadings();
    let changed = false;
    for (const key of Object.keys(readings)) {
      const reading = readings[key];
      if (reading && reading.folderId === id) {
        const { folderId: _folderId, ...rest } = reading;
        readings[key] = rest as StoredReading;
        changed = true;
      }
    }
    if (changed) this.writeReadings(readings);
    return true;
  }
}
