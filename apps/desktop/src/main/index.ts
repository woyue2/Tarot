import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { type TarotCard } from "@tarot/core";
import { ReadingService, type ContentBundle, type RuntimeEnv } from "@tarot/runtime";
import cardsData from "../../../../resources/cards.json";
import manifest from "../../../../resources/content-manifest.json";
import methodology from "../../../../resources/methodology.json";
import { AppPreferencesStore } from "./app-preferences";
import { ElectronCredentialStore } from "./credentials";
import { createModelProvider, fetchProviderModels, type ProviderType } from "./model";
import { ModelPreferencesStore, type ModelPreferences } from "./preferences";
import { SqliteReadingRepository } from "./storage";
import { PROVIDER_PRESETS, classifyModelError } from "./provider-registry";
import { R2Client, resolveR2Endpoint } from "./r2-client";
import { R2SyncService, type SyncReport } from "./r2-sync";

const cards = cardsData.cards as TarotCard[];
let repository: SqliteReadingRepository;
let credentials: ElectronCredentialStore;
let preferences: ModelPreferencesStore;
let settings: ModelPreferences = { providerType: "openai" as ProviderType, model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1", r2: { enabled: false, accountId: "", endpoint: "", accessKeyId: "", bucketName: "", region: "auto" } };
let r2Sync: R2SyncService | null = null;
let appPrefs = { enableStreaming: false, hideModelUi: true };
let appPreferences: AppPreferencesStore;
let mainWindow: BrowserWindow | null = null;
let readingService: ReadingService;

// 内容资源包与运行时环境：复用 resources/*.json，隔离 node:crypto，注入共享 ReadingService
const content: ContentBundle = {
  cards,
  contentVersion: cardsData.contentVersion,
  scoreTableVersion: cardsData.scoreTableVersion,
  methodologyVersion: manifest.methodologyVersion,
  methodologyStyle: methodology.principles.join("；"),
};

const nodeEnv: RuntimeEnv = {
  uuid: () => randomUUID(),
  seed: () => randomBytes(24).toString("hex"),
  now: () => new Date().toISOString(),
};

function createWindow(): void {
  const isMac = process.platform === "darwin";
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: "#08070d",
    titleBarStyle: "hidden",
    ...(isMac ? {} : { titleBarOverlay: { color: "#f3f4f6", symbolColor: "#27282b" } }),
    icon: join(__dirname, "../../build/icon.png"),
    webPreferences: { preload: join(__dirname, "../preload/index.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow = window;
  window.on("closed", () => { mainWindow = null; });
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, "../renderer/index.html"));
}

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "Config",
      submenu: [
        {
          label: "流式输出",
          type: "checkbox",
          checked: appPrefs.enableStreaming,
          click: () => {
            appPrefs = appPreferences.set({ ...appPrefs, enableStreaming: !appPrefs.enableStreaming });
            mainWindow?.webContents.send("tarot:app-preferences-changed", appPrefs);
            buildAppMenu();
          },
        },
        {
          label: "隐藏模型选择 UI",
          type: "checkbox",
          checked: appPrefs.hideModelUi,
          click: () => {
            appPrefs = appPreferences.set({ ...appPrefs, hideModelUi: !appPrefs.hideModelUi });
            mainWindow?.webContents.send("tarot:app-preferences-changed", appPrefs);
            buildAppMenu();
          },
        },
        { type: "separator" },
        {
          label: "打开设置",
          click: () => {
            mainWindow?.webContents.send("tarot:open-settings");
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc(): void {
  ipcMain.handle("tarot:bootstrap", () => ({
    folders: repository.listFolders(),
    history: readingService.history(),
    settings: { ...settings, hasApiKey: Boolean(credentials.get("apiKey")) },
    appPreferences: appPrefs,
    r2Configured: isR2Configured(),
    presetProviders: Object.entries(PROVIDER_PRESETS).map(([type, preset]) => ({
      type,
      label: preset.label,
      description: preset.description,
      category: preset.category,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
      recommendedModels: preset.recommendedModels,
      signupUrl: preset.signupUrl,
    })),
  }));

  ipcMain.handle("tarot:list-preset-providers", () =>
    Object.entries(PROVIDER_PRESETS).map(([type, preset]) => ({
      type,
      label: preset.label,
      description: preset.description,
      category: preset.category,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
      recommendedModels: preset.recommendedModels,
      signupUrl: preset.signupUrl,
    })),
  );

  ipcMain.handle("tarot:create-folder", (_event, rawName: string) => {
    const name = rawName?.trim();
    if (!name || name.length > 60) throw new Error("Folder 名称需为 1–60 个字符");
    const now = new Date().toISOString();
    const folder = { id: randomUUID(), name, createdAt: now, updatedAt: now };
    repository.saveFolder(folder);
    return folder;
  });
  ipcMain.handle("tarot:rename-folder", (_event, input: { id: string; name: string }) => {
    const name = input.name?.trim();
    if (!name || name.length > 60) throw new Error("Folder 名称需为 1–60 个字符");
    const folder = repository.renameFolder(input.id, name);
    if (!folder) throw new Error("没有找到这个 Folder");
    return folder;
  });
  ipcMain.handle("tarot:move-reading", (_event, input: { id: string; folderId: string | null }) => {
    return readingService.moveReading(input.id, input.folderId);
  });
  ipcMain.handle("tarot:update-notes", (_event, input: { id: string; notes: string }) => {
    return readingService.updateNotes(input.id, input.notes);
  });
  ipcMain.handle("tarot:delete-folder", (_event, id: string) => {
    if (!repository.deleteFolder(id)) throw new Error("删除分组失败");
    return { ok: true };
  });
  ipcMain.handle("tarot:delete-reading", (_event, id: string) => {
    readingService.deleteReading(id);
    return { ok: true };
  });
  ipcMain.handle("tarot:save-settings", (_event, input: { apiKey?: string; clearApiKey?: boolean; providerType?: string; model?: string; baseUrl?: string; r2?: { enabled?: boolean; accountId?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; region?: string } }) => {
    if (input.apiKey?.trim()) credentials.set("apiKey", input.apiKey.trim());
    if (input.clearApiKey) credentials.delete("apiKey");

    const nextR2: ModelPreferences["r2"] = input.r2 ? {
      enabled: input.r2.enabled ?? settings.r2.enabled,
      accountId: input.r2.accountId?.trim() ?? settings.r2.accountId,
      endpoint: input.r2.endpoint?.trim() ?? settings.r2.endpoint,
      accessKeyId: input.r2.accessKeyId?.trim() ?? settings.r2.accessKeyId,
      bucketName: input.r2.bucketName?.trim() ?? settings.r2.bucketName,
      region: input.r2.region?.trim() ?? settings.r2.region,
    } : settings.r2;

    if (input.r2?.secretAccessKey?.trim()) {
      credentials.set("r2SecretAccessKey", input.r2.secretAccessKey.trim());
    }

    settings = preferences.set({
      providerType: (input.providerType as ProviderType) || settings.providerType,
      model: input.model?.trim() || settings.model,
      baseUrl: input.baseUrl?.trim() || settings.baseUrl,
      r2: nextR2,
    });

    reinitializeR2Sync();

    return { ...settings, hasApiKey: Boolean(credentials.get("apiKey")) };
  });
  ipcMain.handle("tarot:get-app-preferences", () => appPrefs);
  ipcMain.handle("tarot:set-app-preferences", (_event, value: { enableStreaming?: boolean; hideModelUi?: boolean }) => {
    appPrefs = appPreferences.set({
      enableStreaming: value.enableStreaming ?? appPrefs.enableStreaming,
      hideModelUi: value.hideModelUi ?? appPrefs.hideModelUi,
    });
    mainWindow?.webContents.send("tarot:app-preferences-changed", appPrefs);
    buildAppMenu();
    return appPrefs;
  });
  ipcMain.handle("tarot:create-reading", (_event, input: { question: string; mode: "manual" | "random"; folderId?: string }) => {
    return readingService.createReading({ question: input.question, mode: input.mode, ...(input.folderId ? { folderId: input.folderId } : {}) });
  });
  ipcMain.handle("tarot:confirm-reading", (_event, input: { id: string; selectedIndexes?: number[] }) => {
    return readingService.confirmReading({ id: input.id, selectedIndexes: input.selectedIndexes });
  });
  ipcMain.handle("tarot:update-selection", (_event, input: { id: string; selectedIndexes: number[] }) => {
    return readingService.updateSelection({ id: input.id, selectedIndexes: input.selectedIndexes });
  });
  ipcMain.handle("tarot:reshuffle-reading", (_event, input: { id: string }) => {
    return readingService.reshuffle({ id: input.id });
  });
  ipcMain.handle("tarot:interpret", async (event, id: string) => {
    const apiKey = credentials.get("apiKey");
    if (!apiKey) throw new Error("尚未配置模型 API Key；牌阵已保存在本地，可稍后解读");
    const provider = createModelProvider({ apiKey, ...settings });
    try {
      // 复用共享 ReadingService：流式优先（经 onProgress 推 IPC），失败回退非流式，异常标记 failed
      return await readingService.interpret(id, provider, {
        stream: appPrefs.enableStreaming,
        onProgress: (delta, reasoning) => {
          event.sender.send("tarot:interpret-progress", { id, delta, reasoning });
        },
      });
    } catch (error) {
      const classified = classifyModelError(error);
      throw new Error(classified.userMessage);
    }
  });
  // 从 maka-agent 的 connection-model-discovery.ts 抄的：拉取可用模型列表
  ipcMain.handle("tarot:fetch-models", async (_event, opts?: { apiKey?: string; baseUrl?: string; providerType?: string }) => {
    const apiKey = opts?.apiKey || credentials.get("apiKey");
    if (!apiKey) return { ok: false, models: [], userMessage: "尚未配置 API Key" };
    const baseUrl = opts?.baseUrl || settings.baseUrl;
    const providerType = opts?.providerType || settings.providerType;
    try {
      const models = await fetchProviderModels(baseUrl, apiKey, providerType);
      return { ok: true, models, userMessage: `找到 ${models.length} 个模型` };
    } catch (error) {
      return { ok: false, models: [], userMessage: error instanceof Error ? error.message : "拉取失败" };
    }
  });
  // 从 maka-agent 的 connections:test IPC handler 抄来的测试连接
  ipcMain.handle("tarot:test-connection", async (_event, opts?: { apiKey?: string; model?: string; baseUrl?: string; providerType?: string }) => {
    const apiKey = opts?.apiKey || credentials.get("apiKey");
    if (!apiKey) return { ok: false, userMessage: "尚未配置 API Key" };
    const model = opts?.model || settings.model;
    const rawUrl = (opts?.baseUrl || settings.baseUrl).replace(/\/$/, "");
    try {
      // 所有 MiniMax 平台都走标准 OpenAI 兼容的 /chat/completions 端点
      const url = `${rawUrl}/chat/completions`;
      const body = JSON.stringify({ model, messages: [{ role: "user", content: "reply with ok" }], max_tokens: 10, temperature: 0 });
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
        const classified = classifyModelError(new Error(payload.error?.message ?? `HTTP ${response.status}`));
        return { ok: false, userMessage: `${classified.userMessage}（${response.status}）`, statusCode: response.status };
      }
      return { ok: true, userMessage: "连接成功 ✅" };
    } catch (error) {
      const classified = classifyModelError(error);
      return { ok: false, userMessage: classified.userMessage };
    }
  });
  ipcMain.handle("tarot:history", () => readingService.history());

  ipcMain.handle("tarot:test-r2-connection", async (_event, input: { accountId?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; region?: string }) => {
    const endpoint = resolveR2Endpoint({ accountId: input.accountId ?? "", endpoint: input.endpoint });
    const client = new R2Client({
      endpoint,
      accessKeyId: input.accessKeyId ?? "",
      secretAccessKey: input.secretAccessKey ?? "",
      bucketName: input.bucketName ?? "",
      region: input.region ?? "auto",
    });
    return await client.testConnection();
  });

  ipcMain.handle("tarot:sync-now", async () => {
    if (!r2Sync) throw new Error("R2 同步尚未配置或未启用");
    return await r2Sync.sync();
  });

  ipcMain.handle("tarot:r2-status", () => ({
    configured: isR2Configured(),
    enabled: Boolean(settings.r2.enabled && credentials.get("r2SecretAccessKey")),
  }));
}

function isR2Configured(): boolean {
  const r2 = settings.r2;
  const secretAccessKey = credentials.get("r2SecretAccessKey");
  if (!secretAccessKey || !r2.accessKeyId || !r2.bucketName) return false;
  if (r2.endpoint?.trim()) return true;
  return Boolean(r2.accountId?.trim());
}

function reinitializeR2Sync(): void {
  r2Sync = null;
  if (!isR2Configured()) return;
  const r2 = settings.r2;
  const secretAccessKey = credentials.get("r2SecretAccessKey")!;
  try {
    const endpoint = resolveR2Endpoint({ accountId: r2.accountId, endpoint: r2.endpoint });
    const client = new R2Client({ endpoint, accessKeyId: r2.accessKeyId, secretAccessKey, bucketName: r2.bucketName, region: r2.region });
    r2Sync = new R2SyncService(client, repository);
  } catch (error) {
    console.error("初始化 R2 同步失败：", error instanceof Error ? error.message : String(error));
  }
}

function attachRepositorySyncHooks(): void {
  repository.onDidSave = (type, id) => {
    if (!r2Sync || !settings.r2.enabled) return;
    if (type === "reading") {
      const reading = repository.find(id);
      if (reading) r2Sync.pushReading(reading).catch(() => {});
    } else {
      const folder = repository.findFolder(id);
      if (folder) r2Sync.pushFolder(folder).catch(() => {});
    }
  };
  repository.onDidDelete = (type, id) => {
    if (!r2Sync || !settings.r2.enabled) return;
    if (type === "reading") r2Sync.deleteReading(id).catch(() => {});
    else r2Sync.deleteFolder(id).catch(() => {});
  };
}

app.whenReady().then(() => {
  repository = new SqliteReadingRepository(join(app.getPath("userData"), "tarot.sqlite"));
  readingService = new ReadingService(repository, content, nodeEnv);
  credentials = new ElectronCredentialStore(join(app.getPath("userData"), "credentials.json"));
  preferences = new ModelPreferencesStore(join(app.getPath("userData"), "settings.json"));
  appPreferences = new AppPreferencesStore(join(app.getPath("userData"), "app-preferences.json"));
  settings = preferences.get();
  appPrefs = appPreferences.get();
  attachRepositorySyncHooks();
  reinitializeR2Sync();
  registerIpc();
  createWindow();
  buildAppMenu();

  // 启动 10s 后自动同步一次
  setTimeout(() => {
    if (r2Sync && settings.r2.enabled) {
      r2Sync.sync().then((report: SyncReport) => {
        console.log(`R2 自动同步完成：拉取 ${report.pulled}，推送 ${report.pushed}，错误 ${report.errors.length}`);
      }).catch((error: unknown) => {
        console.error("R2 自动同步失败：", error instanceof Error ? error.message : String(error));
      });
    }
  }, 10_000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      buildAppMenu();
    }
  });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
