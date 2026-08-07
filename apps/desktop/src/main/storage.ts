import { DatabaseSync } from "node:sqlite";
import type { FolderRepository, ReadingFolder, ReadingRepository, StoredReading } from "@tarot/runtime";

type ReadingRow = Record<string, unknown>;

export class SqliteReadingRepository implements ReadingRepository, FolderRepository {
  private readonly database: DatabaseSync;
  onDidSave?: (type: "reading" | "folder", id: string) => void;
  onDidDelete?: (type: "reading" | "folder", id: string) => void;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS reading_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY,
        folder_id TEXT REFERENCES reading_folders(id) ON DELETE SET NULL,
        question TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        shuffle_seed TEXT NOT NULL,
        deck_json TEXT NOT NULL,
        selected_indexes_json TEXT NOT NULL,
        revealed_json TEXT,
        calculation_json TEXT,
        interpretation_input_json TEXT,
        interpretation_json TEXT,
        drawn_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS readings_updated_at ON readings(updated_at DESC);
    `);
    const columns = this.database.prepare("PRAGMA table_info(readings)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "folder_id")) {
      this.database.exec("ALTER TABLE readings ADD COLUMN folder_id TEXT REFERENCES reading_folders(id) ON DELETE SET NULL");
    }
    if (!columns.some((column) => column.name === "drawn_at")) {
      this.database.exec("ALTER TABLE readings ADD COLUMN drawn_at TEXT");
    }
    this.database.exec("CREATE INDEX IF NOT EXISTS readings_folder_id ON readings(folder_id, updated_at DESC)");
  }

  save(reading: StoredReading): void {
    this.database.prepare(`
      INSERT INTO readings (
        id, folder_id, question, mode, status, shuffle_seed, deck_json, selected_indexes_json,
        revealed_json, calculation_json, interpretation_input_json, interpretation_json,
        drawn_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        folder_id = excluded.folder_id,
        question = excluded.question,
        mode = excluded.mode,
        status = excluded.status,
        shuffle_seed = excluded.shuffle_seed,
        deck_json = excluded.deck_json,
        selected_indexes_json = excluded.selected_indexes_json,
        revealed_json = excluded.revealed_json,
        calculation_json = excluded.calculation_json,
        interpretation_input_json = excluded.interpretation_input_json,
        interpretation_json = excluded.interpretation_json,
        drawn_at = excluded.drawn_at,
        updated_at = excluded.updated_at
    `).run(
      reading.id, reading.folderId ?? null, reading.question, reading.mode, reading.status, reading.shuffleSeed,
      JSON.stringify(reading.deck), JSON.stringify(reading.selectedIndexes),
      reading.revealed ? JSON.stringify(reading.revealed) : null,
      reading.calculation ? JSON.stringify(reading.calculation) : null,
      reading.interpretationInput ? JSON.stringify(reading.interpretationInput) : null,
      reading.interpretation ? JSON.stringify(reading.interpretation) : null,
      reading.drawnAt ?? null,
      reading.createdAt, reading.updatedAt,
    );
    this.onDidSave?.("reading", reading.id);
  }

  find(id: string): StoredReading | undefined {
    const row = this.database.prepare("SELECT * FROM readings WHERE id = ?").get(id) as ReadingRow | undefined;
    return row ? this.deserialize(row) : undefined;
  }

  list(limit = 100): StoredReading[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    return (this.database.prepare("SELECT * FROM readings ORDER BY updated_at DESC LIMIT ?").all(safeLimit) as ReadingRow[])
      .map((row) => this.deserialize(row));
  }

  listFolders(): ReadingFolder[] {
    return (this.database.prepare("SELECT * FROM reading_folders ORDER BY updated_at DESC").all() as ReadingRow[])
      .map((row) => this.deserializeFolder(row));
  }

  findFolder(id: string): ReadingFolder | undefined {
    const row = this.database.prepare("SELECT * FROM reading_folders WHERE id = ?").get(id) as ReadingRow | undefined;
    return row ? this.deserializeFolder(row) : undefined;
  }

  saveFolder(folder: ReadingFolder): void {
    this.database.prepare(`
      INSERT INTO reading_folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
    `).run(folder.id, folder.name, folder.createdAt, folder.updatedAt);
    this.onDidSave?.("folder", folder.id);
  }

  renameFolder(id: string, name: string): ReadingFolder | undefined {
    const now = new Date().toISOString();
    const result = this.database.prepare("UPDATE reading_folders SET name = ?, updated_at = ? WHERE id = ?").run(name, now, id);
    return result.changes > 0 ? this.findFolder(id) : undefined;
  }

  deleteFolder(id: string): boolean {
    const result = this.database.prepare("DELETE FROM reading_folders WHERE id = ?").run(id);
    if (result.changes > 0) this.onDidDelete?.("folder", id);
    return result.changes > 0;
  }
  deleteReading(id: string): boolean {
    const result = this.database.prepare("DELETE FROM readings WHERE id = ?").run(id);
    if (result.changes > 0) this.onDidDelete?.("reading", id);
    return result.changes > 0;
  }

  close(): void {
    this.database.close();
  }

  private deserialize(row: ReadingRow): StoredReading {
    const parse = <T>(key: string): T | undefined => typeof row[key] === "string" ? JSON.parse(row[key] as string) as T : undefined;
    return {
      id: String(row.id),
      folderId: typeof row.folder_id === "string" ? row.folder_id : undefined,
      question: String(row.question),
      mode: row.mode === "random" ? "random" : "manual",
      status: String(row.status),
      shuffleSeed: String(row.shuffle_seed),
      deck: parse<unknown[]>("deck_json") ?? [],
      selectedIndexes: parse<number[]>("selected_indexes_json") ?? [],
      revealed: parse("revealed_json"),
      calculation: parse("calculation_json"),
      interpretationInput: parse("interpretation_input_json"),
      interpretation: parse("interpretation_json"),
      drawnAt: typeof row.drawn_at === "string" ? row.drawn_at : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private deserializeFolder(row: ReadingRow): ReadingFolder {
    return { id: String(row.id), name: String(row.name), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
  }
}
