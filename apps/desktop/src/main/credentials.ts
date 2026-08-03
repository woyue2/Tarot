import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { safeStorage } from "electron";
import type { CredentialStore } from "@tarot/runtime";

export class ElectronCredentialStore implements CredentialStore {
  constructor(private readonly path: string) {}

  get(name: string): string | undefined {
    const values = this.readAll();
    const encrypted = values[name];
    if (!encrypted || !safeStorage.isEncryptionAvailable()) return undefined;
    try { return safeStorage.decryptString(Buffer.from(encrypted, "base64")); } catch { return undefined; }
  }

  set(name: string, value: string): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows 凭据加密当前不可用");
    const values = this.readAll();
    values[name] = safeStorage.encryptString(value).toString("base64");
    this.writeAll(values);
  }

  delete(name: string): void {
    const values = this.readAll();
    delete values[name];
    this.writeAll(values);
  }

  private readAll(): Record<string, string> {
    if (!existsSync(this.path)) return {};
    try { return JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>; } catch { return {}; }
  }

  private writeAll(values: Record<string, string>): void {
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(values), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, this.path);
  }
}
