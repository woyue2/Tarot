import { contextBridge, ipcRenderer } from "electron";

const api = {
  bootstrap: () => ipcRenderer.invoke("tarot:bootstrap"),
  createFolder: (name: string) => ipcRenderer.invoke("tarot:create-folder", name),
  renameFolder: (input: { id: string; name: string }) => ipcRenderer.invoke("tarot:rename-folder", input),
  deleteFolder: (id: string) => ipcRenderer.invoke("tarot:delete-folder", id),
  moveReading: (input: { id: string; folderId: string | null }) => ipcRenderer.invoke("tarot:move-reading", input),
  deleteReading: (id: string) => ipcRenderer.invoke("tarot:delete-reading", id),
  saveSettings: (input: { apiKey?: string; clearApiKey?: boolean; providerType?: string; model?: string; baseUrl?: string }) => ipcRenderer.invoke("tarot:save-settings", input),
  createReading: (input: { question: string; mode: "manual" | "random"; folderId?: string }) => ipcRenderer.invoke("tarot:create-reading", input),
  confirmReading: (input: { id: string; selectedIndexes?: number[] }) => ipcRenderer.invoke("tarot:confirm-reading", input),
  interpret: (id: string) => ipcRenderer.invoke("tarot:interpret", id),
  history: () => ipcRenderer.invoke("tarot:history"),
  listPresetProviders: () => ipcRenderer.invoke("tarot:list-preset-providers"),
  testConnection: (opts?: { apiKey?: string | undefined; model?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }) => ipcRenderer.invoke("tarot:test-connection", opts),
  fetchModels: (opts?: { apiKey?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }) => ipcRenderer.invoke("tarot:fetch-models", opts),
  onInterpretProgress: (callback: (data: { id: string; delta: string; reasoning: string }) => void) => {
    const handler = (_event: unknown, data: { id: string; delta: string; reasoning: string }) => callback(data);
    ipcRenderer.on("tarot:interpret-progress", handler);
    return () => ipcRenderer.removeListener("tarot:interpret-progress", handler);
  },
};

contextBridge.exposeInMainWorld("tarot", api);

export type TarotDesktopApi = typeof api;
