import { contextBridge, ipcRenderer } from "electron";

const api = {
  platform: process.platform,
  bootstrap: () => ipcRenderer.invoke("tarot:bootstrap"),
  createFolder: (name: string) => ipcRenderer.invoke("tarot:create-folder", name),
  renameFolder: (input: { id: string; name: string }) => ipcRenderer.invoke("tarot:rename-folder", input),
  deleteFolder: (id: string) => ipcRenderer.invoke("tarot:delete-folder", id),
  moveReading: (input: { id: string; folderId: string | null }) => ipcRenderer.invoke("tarot:move-reading", input),
  updateNotes: (input: { id: string; notes: string }) => ipcRenderer.invoke("tarot:update-notes", input),
  deleteReading: (id: string) => ipcRenderer.invoke("tarot:delete-reading", id),
  saveSettings: (input: { apiKey?: string; clearApiKey?: boolean; providerType?: string; model?: string; baseUrl?: string; r2?: { enabled?: boolean; accountId?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; region?: string } }) => ipcRenderer.invoke("tarot:save-settings", input),
  getAppPreferences: () => ipcRenderer.invoke("tarot:get-app-preferences"),
  setAppPreferences: (value: { enableStreaming?: boolean; hideModelUi?: boolean }) => ipcRenderer.invoke("tarot:set-app-preferences", value),
  createReading: (input: { question: string; mode: "manual" | "random"; spreadId?: string; scoring?: boolean; energyFlow?: boolean; folderId?: string }) => ipcRenderer.invoke("tarot:create-reading", input),
  confirmReading: (input: { id: string; selectedIndexes?: number[] }) => ipcRenderer.invoke("tarot:confirm-reading", input),
  updateSelection: (input: { id: string; selectedIndexes: number[] }) => ipcRenderer.invoke("tarot:update-selection", input),
  reshuffleReading: (input: { id: string }) => ipcRenderer.invoke("tarot:reshuffle-reading", input),
  interpret: (id: string) => ipcRenderer.invoke("tarot:interpret", id),
  history: () => ipcRenderer.invoke("tarot:history"),
  listPresetProviders: () => ipcRenderer.invoke("tarot:list-preset-providers"),
  testConnection: (opts?: { apiKey?: string | undefined; model?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }) => ipcRenderer.invoke("tarot:test-connection", opts),
  fetchModels: (opts?: { apiKey?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }) => ipcRenderer.invoke("tarot:fetch-models", opts),
  testR2Connection: (input: { accountId?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; region?: string }) => ipcRenderer.invoke("tarot:test-r2-connection", input),
  syncNow: () => ipcRenderer.invoke("tarot:sync-now"),
  r2Status: () => ipcRenderer.invoke("tarot:r2-status"),
  onInterpretProgress: (callback: (data: { id: string; delta: string; reasoning: string }) => void) => {
    const handler = (_event: unknown, data: { id: string; delta: string; reasoning: string }) => callback(data);
    ipcRenderer.on("tarot:interpret-progress", handler);
    return () => ipcRenderer.removeListener("tarot:interpret-progress", handler);
  },
  onAppPreferencesChanged: (callback: (data: { enableStreaming: boolean; hideModelUi: boolean }) => void) => {
    const handler = (_event: unknown, data: { enableStreaming: boolean; hideModelUi: boolean }) => callback(data);
    ipcRenderer.on("tarot:app-preferences-changed", handler);
    return () => ipcRenderer.removeListener("tarot:app-preferences-changed", handler);
  },
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("tarot:open-settings", handler);
    return () => ipcRenderer.removeListener("tarot:open-settings", handler);
  },
};

contextBridge.exposeInMainWorld("tarot", api);

export type TarotDesktopApi = typeof api;
