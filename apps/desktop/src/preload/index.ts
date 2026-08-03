import { contextBridge, ipcRenderer } from "electron";

const api = {
  bootstrap: () => ipcRenderer.invoke("tarot:bootstrap"),
  saveSettings: (input: { apiKey?: string; model?: string; baseUrl?: string }) => ipcRenderer.invoke("tarot:save-settings", input),
  createReading: (input: { question: string; mode: "manual" | "random" }) => ipcRenderer.invoke("tarot:create-reading", input),
  confirmReading: (input: { id: string; selectedIndexes?: number[] }) => ipcRenderer.invoke("tarot:confirm-reading", input),
  interpret: (id: string) => ipcRenderer.invoke("tarot:interpret", id),
  history: () => ipcRenderer.invoke("tarot:history"),
};

contextBridge.exposeInMainWorld("tarot", api);

export type TarotDesktopApi = typeof api;
