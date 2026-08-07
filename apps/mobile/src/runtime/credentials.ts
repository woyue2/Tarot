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
  /** 是否启用流式输出（SSE 渐进式解读）。默认开启。 */
  streaming: boolean;
}

/** R2 同步模式：direct = 浏览器直连 R2（SigV4 签名），worker = 走 Cloudflare Worker 代理（Bearer 令牌）。 */
export type R2Mode = "direct" | "worker";

/**
 * R2 同步设置（非机密部分）。
 * - direct 模式字段对齐桌面端 R2Preferences，Secret Access Key 单独用 *SecretAccessKey 函数存储。
 * - worker 模式用 workerUrl + syncToken（Sync Token 单独用 *SyncToken 函数存储）。
 */
export interface R2Settings {
  enabled: boolean;
  mode: R2Mode;
  // direct 模式
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  bucketName: string;
  region: string;
  // worker 模式
  workerUrl: string;
}

const SETTINGS_KEY = "tarot.mobile.settings.v1";
const APIKEY_KEY = "tarot.mobile.apikey.v1";
// v3：支持 direct / worker 双模式。workerUrl 进 settings，syncToken 单独存。
// v2 的 direct 字段保留兼容；新增 mode/workerUrl 字段。
const R2_SETTINGS_KEY = "tarot.mobile.r2.v3";
const R2_SECRET_KEY = "tarot.mobile.r2.secret.v3";
const R2_SYNC_TOKEN_KEY = "tarot.mobile.r2.synctoken.v3";

export const defaultSettings: MobileSettings = {
  providerType: "openai",
  model: "gpt-5-mini",
  baseUrl: "https://api.openai.com/v1",
  streaming: true,
};

export const defaultR2Settings: R2Settings = {
  enabled: false,
  mode: "direct",
  accountId: "",
  endpoint: "",
  accessKeyId: "",
  bucketName: "",
  region: "auto",
  workerUrl: "",
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
      streaming: parsed.streaming ?? defaultSettings.streaming,
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
      mode: parsed.mode ?? defaultR2Settings.mode,
      accountId: parsed.accountId ?? defaultR2Settings.accountId,
      endpoint: parsed.endpoint ?? defaultR2Settings.endpoint,
      accessKeyId: parsed.accessKeyId ?? defaultR2Settings.accessKeyId,
      bucketName: parsed.bucketName ?? defaultR2Settings.bucketName,
      region: parsed.region ?? defaultR2Settings.region,
      workerUrl: parsed.workerUrl ?? defaultR2Settings.workerUrl,
    };
  } catch {
    return { ...defaultR2Settings };
  }
}

export function saveR2Settings(settings: R2Settings): void {
  localStorage.setItem(R2_SETTINGS_KEY, JSON.stringify(settings));
}

export function getSecretAccessKey(): string | undefined {
  return localStorage.getItem(R2_SECRET_KEY) ?? undefined;
}

export function setSecretAccessKey(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(R2_SECRET_KEY, trimmed);
}

export function clearSecretAccessKey(): void {
  localStorage.removeItem(R2_SECRET_KEY);
}

// ---- Worker 代理模式的 Sync Token ----

export function getSyncToken(): string | undefined {
  return localStorage.getItem(R2_SYNC_TOKEN_KEY) ?? undefined;
}

export function setSyncToken(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(R2_SYNC_TOKEN_KEY, trimmed);
}

export function clearSyncToken(): void {
  localStorage.removeItem(R2_SYNC_TOKEN_KEY);
}

export function isR2Configured(): boolean {
  const settings = loadR2Settings();
  if (settings.mode === "worker") {
    return Boolean(settings.workerUrl.trim() && getSyncToken());
  }
  return Boolean(
    settings.accountId.trim() &&
      settings.accessKeyId.trim() &&
      settings.bucketName.trim() &&
      getSecretAccessKey(),
  );
}
