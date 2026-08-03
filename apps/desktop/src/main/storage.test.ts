import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteReadingRepository } from "./storage";

const temporaryDirectories: string[] = [];
const repositories: SqliteReadingRepository[] = [];

function temporaryDatabase(): string {
  const directory = mkdtempSync(join(tmpdir(), "tarot-folders-"));
  temporaryDirectories.push(directory);
  return join(directory, "test.sqlite");
}

function openRepository(path: string): SqliteReadingRepository {
  const repository = new SqliteReadingRepository(path);
  repositories.push(repository);
  return repository;
}

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("reading folders", () => {
  it("persists a folder and assigns multiple readings to it", () => {
    const repository = openRepository(temporaryDatabase());
    const now = new Date().toISOString();
    repository.saveFolder({ id: "person-1", name: "小林", createdAt: now, updatedAt: now });
    for (const id of ["reading-1", "reading-2"]) {
      repository.save({ id, folderId: "person-1", question: `${id} 的问题`, mode: "manual", status: "selecting", shuffleSeed: id, deck: [], selectedIndexes: [], createdAt: now, updatedAt: now });
    }
    expect(repository.listFolders()).toHaveLength(1);
    expect(repository.list().filter((reading) => reading.folderId === "person-1")).toHaveLength(2);
  });

  it("migrates a legacy readings table without losing its rows", () => {
    const path = temporaryDatabase();
    const database = new DatabaseSync(path);
    database.exec(`CREATE TABLE readings (
      id TEXT PRIMARY KEY, question TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL,
      shuffle_seed TEXT NOT NULL, deck_json TEXT NOT NULL, selected_indexes_json TEXT NOT NULL,
      revealed_json TEXT, calculation_json TEXT, interpretation_input_json TEXT,
      interpretation_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    const now = new Date().toISOString();
    database.prepare("INSERT INTO readings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("legacy", "旧问题", "manual", "completed", "seed", "[]", "[]", null, null, null, null, now, now);
    database.close();
    const repository = openRepository(path);
    expect(repository.find("legacy")?.question).toBe("旧问题");
    expect(repository.find("legacy")?.folderId).toBeUndefined();
  });
});