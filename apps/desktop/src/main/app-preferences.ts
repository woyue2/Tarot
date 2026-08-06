import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export interface AppPreferences {
  enableStreaming: boolean;
  hideModelUi: boolean;
}

const defaults: AppPreferences = {
  enableStreaming: false,
  hideModelUi: true,
};

export class AppPreferencesStore {
  constructor(private readonly path: string) {}

  get(): AppPreferences {
    if (!existsSync(this.path)) return { ...defaults };
    try {
      const value = JSON.parse(readFileSync(this.path, "utf8")) as Partial<AppPreferences>;
      return {
        enableStreaming: typeof value.enableStreaming === "boolean" ? value.enableStreaming : defaults.enableStreaming,
        hideModelUi: typeof value.hideModelUi === "boolean" ? value.hideModelUi : defaults.hideModelUi,
      };
    } catch {
      return { ...defaults };
    }
  }

  set(value: AppPreferences): AppPreferences {
    const next = {
      enableStreaming: typeof value.enableStreaming === "boolean" ? value.enableStreaming : defaults.enableStreaming,
      hideModelUi: typeof value.hideModelUi === "boolean" ? value.hideModelUi : defaults.hideModelUi,
    };
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, this.path);
    return next;
  }
}
