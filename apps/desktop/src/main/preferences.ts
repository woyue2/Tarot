import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { applyProviderPreset, type ProviderType } from "./provider-registry";

export { type ProviderType };

export interface ModelPreferences {
  providerType: ProviderType;
  model: string;
  baseUrl: string;
}

const defaults: ModelPreferences = {
  providerType: "openai",
  model: "gpt-5-mini",
  baseUrl: "https://api.openai.com/v1",
};

// 迁移：只修复真正不存在的假 URL（codex.minimaxi.com 是编造的）
// 注意：api.minimaxi.com 是合法的中国平台地址，不能迁移
const STALE_URL_FIXES: Record<string, string> = {
  "https://codex.minimaxi.com/v1": "https://api.minimax.io/v1",
};

function migrateBaseUrl(url: string): string {
  return STALE_URL_FIXES[url] ?? url;
}

export class ModelPreferencesStore {
  constructor(private readonly path: string) {}

  get(): ModelPreferences {
    if (!existsSync(this.path)) return { ...defaults };
    try {
      const value = JSON.parse(readFileSync(this.path, "utf8")) as Partial<ModelPreferences>;
      const rawBaseUrl = value.baseUrl?.trim() || defaults.baseUrl;
      // 自动修复旧版本遗留的错误 URL
      const baseUrl = migrateBaseUrl(rawBaseUrl);
      const result: ModelPreferences = {
        providerType: (value.providerType as ProviderType) || defaults.providerType,
        model: value.model?.trim() || defaults.model,
        baseUrl,
      };
      // 如果 URL 被迁移了，立即写回磁盘
      if (baseUrl !== rawBaseUrl) this.set(result);
      return result;
    } catch {
      return { ...defaults };
    }
  }

  set(value: ModelPreferences): ModelPreferences {
    const url = new URL(value.baseUrl);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) {
      throw new Error("API 地址必须使用 HTTPS；本机模型可使用 localhost HTTP");
    }
    const next = {
      providerType: value.providerType || defaults.providerType,
      model: value.model.trim(),
      baseUrl: value.baseUrl.trim().replace(/\/$/, ""),
    };
    if (!next.model) throw new Error("模型名称不能为空");
    // 切换 providerType 时自动填充预设值
    if (next.providerType !== "custom" && next.providerType !== "openai") {
      const preset = applyProviderPreset(next.providerType);
      if (preset.baseUrl) next.baseUrl = preset.baseUrl;
    }
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, this.path);
    return next;
  }
}
