import type { TarotInterpretation, TarotInterpretationInput } from "@tarot/core";

export interface StoredReading {
  id: string;
  folderId?: string | undefined;
  question: string;
  mode: "manual" | "random";
  status: string;
  shuffleSeed: string;
  deck: unknown[];
  selectedIndexes: number[];
  revealed?: unknown;
  calculation?: unknown;
  interpretationInput?: TarotInterpretationInput | undefined;
  interpretation?: TarotInterpretation | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingRepository {
  save(reading: StoredReading): void;
  find(id: string): StoredReading | undefined;
  list(limit?: number): StoredReading[];
}

export interface ReadingFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolderRepository {
  listFolders(): ReadingFolder[];
  findFolder(id: string): ReadingFolder | undefined;
  saveFolder(folder: ReadingFolder): void;
  renameFolder(id: string, name: string): ReadingFolder | undefined;
}

export interface CredentialStore {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
}

export interface ModelProvider {
  interpret(input: TarotInterpretationInput): Promise<TarotInterpretation>;
  interpretStream(
    input: TarotInterpretationInput,
    onProgress: (delta: string, reasoning: string) => void,
  ): Promise<TarotInterpretation>;
}