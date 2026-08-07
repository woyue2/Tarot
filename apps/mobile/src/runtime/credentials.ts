/**
 * 手机端模型连接设置与凭据存储。
 *
 * ⚠️ 已知安全 Gap：Web/PWA 环境没有系统级安全存储，这里 API Token 暂存 localStorage，
 * 明文可被同源脚本读取。仅用于 MVP / 本地验证。走 Capacitor 后应替换为
 * @capacitor/preferences + 原生 Keychain / Keystore（接口保持不变）。
 */

export interface MobileSettings {
  providerType: string;
  model: string;
  baseUrl: string;
}

/** R2 同步设置（非机密部分）。Sync Token 单独用 *Token 函数存储。 */
export interface R2Settings {
  enabled: boolean;
  workerUrl: string;
  bucketName: string;
}

const SETTINGS_KEY = "tarot.mobile.settings.v1";
const APIKEY_KEY = "tarot.mobile.apikey.v1";
const R2_SETTINGS_KEY = "tarot.mobile.r2.v1";
const R2_TOKEN_KEY = "tarot.mobile.r2.token.v1";

export const defaultSettings: MobileSettings = {
  providerType: "openai",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
};

export const defaultR2Settings: R2Settings = {
  enabled: false,
  workerUrl: "",
  bucketName: "",
};

export function loadSettings(): MobileSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<MobileSettings>;
    return {
      providerType: parsed.providerType ?? defaultSettings.providerType,
      model: parsed.model ?? defaultSettings.model,
      baseUrl: parsed.baseUrl ?? defaultSettings.baseUrl,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: MobileSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getApiKey(): string | undefined {
  return localStorage.getItem(APIKEY_KEY) ?? undefined;
}

export function setApiKey(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(APIKEY_KEY, trimmed);
}

export function clearApiKey(): void {
  localStorage.removeItem(APIKEY_KEY);
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}

// ---- Cloudflare R2 同步设置 ----

export function loadR2Settings(): R2Settings {
  try {
    const raw = localStorage.getItem(R2_SETTINGS_KEY);
    if (!raw) return { ...defaultR2Settings };
    const parsed = JSON.parse(raw) as Partial<R2Settings>;
    return {
      enabled: parsed.enabled ?? defaultR2Settings.enabled,
      workerUrl: parsed.workerUrl ?? defaultR2Settings.workerUrl,
      bucketName: parsed.bucketName ?? defaultR2Settings.bucketName,
    };
  } catch {
    return { ...defaultR2Settings };
  }
}

export function saveR2Settings(settings: R2Settings): void {
  localStorage.setItem(R2_SETTINGS_KEY, JSON.stringify(settings));
}

export function getSyncToken(): string | undefined {
  return localStorage.getItem(R2_TOKEN_KEY) ?? undefined;
}

export function setSyncToken(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(R2_TOKEN_KEY, trimmed);
}

export function clearSyncToken(): void {
  localStorage.removeItem(R2_TOKEN_KEY);
}

export function isR2Configured(): boolean {
  const settings = loadR2Settings();
  return Boolean(settings.workerUrl.trim() && settings.bucketName.trim() && getSyncToken());
}
