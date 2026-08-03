import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export interface ModelPreferences {
  model: string;
  baseUrl: string;
}

const defaults: ModelPreferences = {
  model: "gpt-5-mini",
  baseUrl: "https://api.openai.com/v1",
};

export class ModelPreferencesStore {
  constructor(private readonly path: string) {}

  get(): ModelPreferences {
    if (!existsSync(this.path)) return { ...defaults };
    try {
      const value = JSON.parse(readFileSync(this.path, "utf8")) as Partial<ModelPreferences>;
      return {
        model: value.model?.trim() || defaults.model,
        baseUrl: value.baseUrl?.trim() || defaults.baseUrl,
      };
    } catch {
      return { ...defaults };
    }
  }

  set(value: ModelPreferences): ModelPreferences {
    const url = new URL(value.baseUrl);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) {
      throw new Error("API 地址必须使用 HTTPS；本机模型可使用 localhost HTTP");
    }
    const next = { model: value.model.trim(), baseUrl: value.baseUrl.trim().replace(/\/$/, "") };
    if (!next.model) throw new Error("模型名称不能为空");
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, this.path);
    return next;
  }
}
