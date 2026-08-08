import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { AnimatePresence, motion } from "framer-motion";
import { CardRevealStage } from "./components/CardRevealStage";

type Stage = "home" | "select" | "result" | "settings";

// Keep this slightly longer than --shuffle-duration so the final card can settle.
const SHUFFLE_ANIMATION_MS = 2500;
const SHUFFLE_VISUAL_CARD_COUNT = 16;
const SPREAD_OPTIONS = [
  { id: "five_card_timeline_v1", name: "五张时间流", count: 5, supportsScoring: true },
  { id: "single", name: "单张牌", count: 1, supportsScoring: false },
  { id: "triple", name: "圣三角", count: 3, supportsScoring: false },
] as const;

// 笔记草稿缓存：未保存的笔记按 reading id 暂存到 localStorage，
// 关闭/切走后再回来可恢复；点「保存」才真正落库并清掉缓存。
const NOTES_DRAFT_PREFIX = "tarot.notes-draft.";
function loadNotesDraft(id: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(NOTES_DRAFT_PREFIX + id);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
}
function persistNotesDraft(id: string, text: string): void {
  try {
    localStorage.setItem(NOTES_DRAFT_PREFIX + id, text);
  } catch {
    /* localStorage 不可用时静默降级 */
  }
}
function clearNotesDraft(id: string): void {
  try {
    localStorage.removeItem(NOTES_DRAFT_PREFIX + id);
  } catch {
    /* localStorage 不可用时静默降级 */
  }
}

function ShuffleOverlay() {
  return createPortal(
    <div className="shuffle-overlay" role="status" aria-live="polite" aria-label="正在重新洗牌">
      <div className="shuffle-overlay-stage" aria-hidden="true">
        <div className="shuffle-overlay-deck">
          {Array.from({ length: SHUFFLE_VISUAL_CARD_COUNT }, (_, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const style = {
              "--shuffle-spread": `${(index - (SHUFFLE_VISUAL_CARD_COUNT - 1) / 2) * 38}px`,
              "--shuffle-fan": `${(index - (SHUFFLE_VISUAL_CARD_COUNT - 1) / 2) * 1.4}deg`,
              "--shuffle-cut": `${side * (70 + (index % 4) * 8)}px`,
              "--shuffle-lift": `${-28 + (index % 5) * 12}px`,
              "--shuffle-cross": `${-side * (38 + (index % 3) * 9)}px`,
              "--shuffle-cross-y": `${18 - (index % 4) * 11}px`,
              animationDelay: `${index * 7}ms`,
              zIndex: index + 1,
            } as CSSProperties;

            return <img key={index} src="/cards/card-back.webp" alt="" draggable={false} style={style} />;
          })}
        </div>
        <p>正在重新洗牌</p>
      </div>
    </div>,
    document.body,
  );
}

function StargateMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 160 160" fill="none" aria-hidden="true">
    <path d="M50 113V77c0-17 13-31 30-31s30 14 30 31v36" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M63 113V79c0-10 7-18 17-18s17 8 17 18v34" stroke="currentColor" strokeOpacity=".52" strokeWidth="3" strokeLinecap="round" />
    <path d="m80 67 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="currentColor" />
      <path d="M42 113h76" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

function FolderGlyph({ filled = false, className = "" }: { filled?: boolean; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 7.4c0-.77.63-1.4 1.4-1.4h3.9c.5 0 .98.22 1.3.6l1.1 1.3c.33.4.82.62 1.32.62h7.6c.77 0 1.4.63 1.4 1.4v8.3c0 .77-.63 1.4-1.4 1.4H4.4c-.77 0-1.4-.63-1.4-1.4V7.4Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      fill={filled ? "currentColor" : "none"}
    />
  </svg>;
}

function NewConversationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.5c5 0 8.5 3.2 8.5 7.6s-3.5 7.6-8.5 7.6c-1 0-2-.13-2.9-.4L5 20.5l.65-4.1A7.15 7.15 0 0 1 3.5 11.1C3.5 6.7 7 3.5 12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 7.8v6.4M8.8 11h6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark">(
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("xj-theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  }
  return (
    <button type="button" className="theme-switch" data-theme={theme} onClick={toggle} aria-label="切换浅色或星夜主题">
      <span className="theme-switch-track"><i /></span>
      <b>{theme === "dark" ? "星夜" : "浅色"}</b>
    </button>
  );
}

function GearIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.7" />
    <path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function HandPickIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M16 14.5a2.5 2.5 0 0 0-2.5-2.5H11V5.5a2.5 2.5 0 0 0-5 0v9.25l-1.6-1.45a1.5 1.5 0 1 0-2 2.1l4.1 4.6A2 2 0 0 0 8.5 21h6.25a2.5 2.5 0 0 0 2.5-2.5V14.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function DiceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="9" cy="9" r="1.4" fill="currentColor" />
    <circle cx="15" cy="15" r="1.4" fill="currentColor" />
  </svg>;
}

const stageTitles: Record<Stage, string> = {
  home: "新解读",
  select: "选择牌面",
  result: "解读详情",
  settings: "设置",
};

export function App() {
  const [stage, setStage] = useState<Stage>("home");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState<{ id: string; deckSize: number; spreadId: string; scoring: boolean; energyFlow: boolean }>();
  const [selection, setSelection] = useState<(number | null)[]>([]);
  const [reading, setReading] = useState<ReadingView>();
  const [history, setHistory] = useState<ReadingView[]>([]);
  const [folders, setFolders] = useState<ReadingFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>();
  const [settings, setSettings] = useState<TarotSettings>({ providerType: "openai", model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1", hasApiKey: false });
  const [appPreferences, setAppPreferences] = useState<AppPreferences>({ enableStreaming: false, hideModelUi: true });
  const [presetProviders, setPresetProviders] = useState<PresetProvider[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [pendingMode, setPendingMode] = useState<"manual" | "random" | null>(null);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [interpretProgress, setInterpretProgress] = useState(""); // 流式解读进度文本
  const [r2Configured, setR2Configured] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [spreadId, setSpreadId] = useState("five_card_timeline_v1");
  const [scoring, setScoring] = useState(false);
  const [energyFlow, setEnergyFlow] = useState(true);

  useEffect(() => {
    void window.tarot.bootstrap().then((data) => {
      setHistory(data.history);
      setFolders(data.folders);
      setSettings(data.settings);
      setAppPreferences(data.appPreferences);
      setR2Configured(data.r2Configured ?? false);
      setPresetProviders(data.presetProviders);
    }).catch(showError);
  }, []);

  // 监听主进程推送的配置变化和打开设置指令
  useEffect(() => {
    const unsubscribePrefs = window.tarot.onAppPreferencesChanged((data) => {
      setAppPreferences(data);
    });
    const unsubscribeOpenSettings = window.tarot.onOpenSettings(() => {
      setStage("settings");
      setSavedNotice("");
    });
    return () => {
      unsubscribePrefs();
      unsubscribeOpenSettings();
    };
  }, []);

  // 注册流式解读进度监听，收到 delta 时追加到 interpretProgress
  useEffect(() => {
    const unsubscribe = window.tarot.onInterpretProgress((data) => {
      if (reading?.id === data.id) {
        setInterpretProgress((prev) => prev + data.delta);
      }
    });
    return unsubscribe;
  }, [reading?.id]);

  function showError(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message.replace(/^Error invoking remote method '[^']+': Error: /, ""));
  }

  async function begin(mode: "manual" | "random") {
    setPendingMode(mode);
    setError("");
    setBusy(true);
    try {
      const created = await window.tarot.createReading({ question, mode, ...(advanced ? { spreadId, scoring, energyFlow } : {}), ...(activeFolderId ? { folderId: activeFolderId } : {}) });
      if (mode === "random") {
        const confirmed = await window.tarot.confirmReading({ id: created.id });
        setReading(confirmed);
        setStage("result");
      } else {
        setDraft(created);
        setSelection([]);
        setStage("select");
      }
      setHistory(await window.tarot.history());
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
      setPendingMode(null);
    }
  }

  function toggleCard(index: number) {
    const current = selection;
    const existingIndex = current.indexOf(index);
    let next: (number | null)[];
    if (existingIndex >= 0) {
      // 已选中：将该位置置为 null（保留空位），顺序角标前移
      next = current.map((item, i) => i === existingIndex ? null : item);
    } else {
      // 未选中：寻找第一个空位填入，否则追加（不超过 5 个位置）
      const firstNull = current.findIndex((item) => item === null);
      if (firstNull >= 0) {
        next = current.map((item, i) => i === firstNull ? index : item);
      } else if (current.length >= (draft ? SPREAD_OPTIONS.find((spread) => spread.id === draft.spreadId)?.count ?? 5 : 5)) {
        return;
      } else {
        next = [...current, index];
      }
    }
    setSelection(next);
    // 持久化部分选牌，使草稿恢复能还原选择状态
    if (draft) {
      const compact = next.filter((item): item is number => item !== null);
      void persistSelection(compact);
    }
  }

  async function persistSelection(indexes: number[]) {
    if (!draft) return;
    try {
      await window.tarot.updateSelection({ id: draft.id, selectedIndexes: indexes });
    } catch {
      // 草稿保存失败不影响选牌本身
    }
  }

  function clearSelection() {
    if (selectedCount === 0) return;
    setSelection([]);
    if (draft) void persistSelection([]);
  }

  async function reshuffle() {
    if (!draft || shuffling) return;
    setShuffling(true);
    setError("");
    try {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 20 : SHUFFLE_ANIMATION_MS));
      const result = await window.tarot.reshuffleReading({ id: draft.id });
      setDraft((current) => current ? { ...result, spreadId: current.spreadId, scoring: current.scoring, energyFlow: current.energyFlow } : undefined);
      setSelection([]);
      setHistory(await window.tarot.history());
    } catch (reason) {
      showError(reason);
    } finally {
      setShuffling(false);
    }
  }

  async function confirmSelection() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const selectedIndexes = selection.filter((item): item is number => item !== null);
      const confirmed = await window.tarot.confirmReading({ id: draft.id, selectedIndexes });
      setReading(confirmed);
      setStage("result");
      setHistory(await window.tarot.history());
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  function resumeDraft(item: ReadingView) {
    // 恢复未完成草稿：牌序来自库中原样保存的种子与牌堆，选择状态原样回填
    setDraft({ id: item.id, deckSize: 78, spreadId: item.spreadId, scoring: item.scoring, energyFlow: item.energyFlow });
    setSelection((item.selectedIndexes ?? []).slice());
    setQuestion(item.question);
    setActiveFolderId(item.folderId);
    setStage("select");
    setError("");
  }

  async function interpret() {
    if (!reading) return;
    if (!settings.hasApiKey) {
      setStage("settings");
      setError("请先配置 API Token。当前牌阵已经保存在本地。");
      return;
    }
    setBusy(true);
    setError("");
    setInterpretProgress(""); // 清空上一次的进度文本
    setReading({ ...reading, status: "interpreting" }); // 标记为解读中，触发流式预览
    try {
      const completed = await window.tarot.interpret(reading.id);
      setReading(completed);
      setHistory(await window.tarot.history());
    } catch (reason) {
      setReading(reading); // 出错时恢复到解读前的状态
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (!reading) return;
    setBusy(true);
    setError("");
    try {
      const updated = await window.tarot.updateNotes({ id: reading.id, notes: notesDraft });
      clearNotesDraft(reading.id);
      setReading(updated);
      setHistory(await window.tarot.history());
      setEditingNotes(false);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(clearApiKey = false) {
    setBusy(true);
    setSavedNotice("");
    try {
      const saved = await window.tarot.saveSettings({
        ...(apiKey ? { apiKey } : {}),
        ...(clearApiKey ? { clearApiKey: true } : {}),
        providerType: settings.providerType,
        model: settings.model,
        baseUrl: settings.baseUrl,
      });
      setSettings(saved);
      // 刷新 preset provider 列表（可能已过时但保底）
      if (presetProviders.length === 0) {
        setPresetProviders(await window.tarot.listPresetProviders());
      }
      setApiKey("");
      setError("");
      setSavedNotice(clearApiKey ? "Token 已清除" : "连接设置已保存");
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function saveR2Settings(secretAccessKey: string) {
    setBusy(true);
    setSavedNotice("");
    try {
      const r2Input: { enabled?: boolean; accountId?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; region?: string } = settings.r2 ? { ...settings.r2 } : {};
      if (secretAccessKey.trim()) r2Input.secretAccessKey = secretAccessKey.trim();
      const saved = await window.tarot.saveSettings({ r2: r2Input });
      setSettings(saved);
      const status = await window.tarot.r2Status();
      setR2Configured(status.configured);
      setError("");
      setSavedNotice("R2 配置已保存");
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  function handleProviderChange(type: string) {
    if (type === "custom") {
      setSettings((prev) => ({ ...prev, providerType: "custom" }));
      return;
    }
    const preset = presetProviders.find((p) => p.type === type);
    if (preset) {
      setSettings({
        ...settings,
        providerType: type,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
      });
    }
  }

  function handleModelChange(model: string) {
    setSettings({ ...settings, model });
  }

  function reset() {
    setStage("home");
    setActiveFolderId(undefined);
    setQuestion("");
    setDraft(undefined);
    setReading(undefined);
    setSelection([]);
    setError("");
  }

  function openHistory(item: ReadingView) {
    if (!item.revealed) return;
    setReading(item);
    setActiveFolderId(item.folderId);
    setQuestion(item.question);
    setStage("result");
    setError("");
  }

  async function deleteReading(id: string) {
    const item = history.find((h) => h.id === id);
    if (!item) return;
    if (!window.confirm("确定删除这条解读记录？此操作不可恢复。")) return;
    try {
      await window.tarot.deleteReading(id);
      clearNotesDraft(id);
      setHistory((current) => current.filter((h) => h.id !== id));
      if (reading?.id === id) {
        setReading(undefined);
        setStage("home");
        setQuestion("");
        setActiveFolderId(undefined);
      }
    } catch (reason) {
      showError(reason);
    }
  }

  function startInFolder(folderId: string) {
    setActiveFolderId(folderId);
    setStage("home");
    setQuestion("");
    setDraft(undefined);
    setReading(undefined);
    setSelection([]);
    setError("");
  }

  async function createFolder(name: string) {
    try {
      const folder = await window.tarot.createFolder(name);
      setFolders((current) => [folder, ...current]);
      startInFolder(folder.id);
    } catch (reason) {
      showError(reason);
    }
  }

  async function renameFolder(id: string, name: string) {
    try {
      const renamed = await window.tarot.renameFolder({ id, name });
      setFolders((current) => current.map((folder) => folder.id === id ? renamed : folder));
    } catch (reason) {
      showError(reason);
    }
  }

  async function deleteFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    if (!window.confirm(`确定删除分组「${folder.name}」？该分组下的解读将变为未分组。`)) return;
    try {
      await window.tarot.deleteFolder(id);
      setFolders((current) => current.filter((f) => f.id !== id));
      setHistory((current) => current.map((item) => {
        if (item.folderId !== id) return item;
        const { folderId: _folderId, ...rest } = item;
        return rest as ReadingView;
      }));
      if (activeFolderId === id) {
        setActiveFolderId(undefined);
        if (reading?.folderId === id) setReading((prev) => {
          if (!prev) return prev;
          const { folderId: _folderId, ...rest } = prev;
          return rest as ReadingView;
        });
      }
    } catch (reason) {
      showError(reason);
    }
  }

  async function moveReading(id: string, folderId?: string) {
    try {
      const moved = await window.tarot.moveReading({ id, folderId: folderId ?? null });
      setHistory((current) => current.map((item) => item.id === id ? moved : item));
      setReading((current) => current?.id === id ? moved : current);
      if (reading?.id === id) setActiveFolderId(folderId);
    } catch (reason) {
      showError(reason);
    }
  }
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const selectedCount = selection.filter((item) => item !== null).length;
  const targetCount = draft ? SPREAD_OPTIONS.find((spread) => spread.id === draft.spreadId)?.count ?? 5 : 5;
  const progressLabel = useMemo(
    () => selectedCount === targetCount ? `${targetCount} 张已选好，可以确认` : `已选择 ${selectedCount} / ${targetCount}`,
    [selectedCount, targetCount],
  );
  const currentPreset = presetProviders.find((p) => p.type === settings.providerType);
  const displayModel = currentPreset?.label
    ? `${currentPreset.label} · ${settings.model}`
    : settings.model;

  return <div className={`app-frame${shuffling ? " is-shuffling" : ""}`}>
    {shuffling && <ShuffleOverlay />}
    <Sidebar
      stage={stage}
      history={history}
      folders={folders}
      activeFolderId={activeFolderId}
      settings={settings}
      hideModelUi={appPreferences.hideModelUi}
      onNewReading={reset}
      onNewReadingInFolder={startInFolder}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveReading={moveReading}
      onDeleteReading={deleteReading}
      onOpenHistory={openHistory}
      onResumeDraft={resumeDraft}
      onOpenSettings={() => { setStage("settings"); setSavedNotice(""); }}
    />

    <section className={`content-shell${shuffling ? " is-shuffling" : ""}`}>
      <header className="content-titlebar">
        <div><span>星径</span><b>{stageTitles[stage]}</b></div>
        {!appPreferences.hideModelUi && (
          <button className="connection-chip" data-ready={settings.hasApiKey} onClick={() => setStage("settings")}>
            <i />{settings.hasApiKey ? displayModel : "配置模型"}
          </button>
        )}
      </header>

      <main className="content-scroll">
        <AnimatePresence mode="wait">
          {stage === "home" && <motion.section className="home" key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="hero-orbit" aria-hidden="true"><StargateMark /></div>
            <p className="eyebrow">A QUIET SPACE FOR REFLECTION</p>
            {activeFolder && <div className="active-folder-chip"><FolderGlyph className="chip-folder" /><b>{activeFolder.name}</b><small>新问题</small></div>}
            <h1>让五张牌，照见此刻的路径</h1>
            <p className="lead">在安静的空间里，和你的直觉对话。想清楚一个问题，剩下的交给牌。</p>
             <div className="question-panel astryx-surface">
              <TextArea label="你想探索什么？" value={question} onChange={setQuestion} placeholder="例如：未来三个月，我该如何调整工作方向？" rows={4} isRequired />
              <div className="question-footer"><span>{question.length} / 300</span><span>三个月内的问题</span></div>
             </div>
             <button type="button" className="btn ghost" onClick={() => setAdvanced((value) => !value)}>{advanced ? "收起高级解读" : "高级解读设置"}</button>
             {advanced && <div className="question-panel astryx-surface">
               <label>牌阵<select value={spreadId} onChange={(event) => { const next = event.target.value; setSpreadId(next); if (!(SPREAD_OPTIONS.find((spread) => spread.id === next)?.supportsScoring)) setScoring(false); }}>
                 {SPREAD_OPTIONS.map((spread) => <option key={spread.id} value={spread.id}>{spread.name}（{spread.count} 张）</option>)}
               </select></label>
               <label className="checkbox-label"><input type="checkbox" checked={energyFlow} onChange={(event) => setEnergyFlow(event.target.checked)} /><span>启用能量流整体阅读</span></label>
               <label className="checkbox-label"><input type="checkbox" checked={scoring} disabled={!SPREAD_OPTIONS.find((spread) => spread.id === spreadId)?.supportsScoring} onChange={(event) => setScoring(event.target.checked)} /><span>启用动量 / 价值评分</span></label>
             </div>}
            <div className="mode-actions">
              <button type="button" className="mode-card mode-card-primary" disabled={!question.trim() || busy} onClick={() => void begin("manual")}>
                <span className="mode-icon"><HandPickIcon /></span>
                <b>{advanced ? `自己选 ${SPREAD_OPTIONS.find((spread) => spread.id === spreadId)?.count ?? 5} 张` : "自己选五张"}</b>
                <span>凭直觉从牌列中逐一点选</span>
                {pendingMode === "manual" && <span className="mode-loading">准备中…</span>}
              </button>
              <button type="button" className="mode-card" disabled={!question.trim() || busy} onClick={() => void begin("random")}>
                <span className="mode-icon"><DiceIcon /></span>
                <b>{advanced ? `随机抽 ${SPREAD_OPTIONS.find((spread) => spread.id === spreadId)?.count ?? 5} 张` : "随机抽五张"}</b>
                <span>系统随机翻开五张牌</span>
                {pendingMode === "random" && <span className="mode-loading">准备中…</span>}
              </button>
            </div>
          </motion.section>}

          {stage === "select" && draft && <motion.section className="selection-view" key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="eyebrow">CHOOSE WITHOUT OVERTHINKING</p>
            <h1>凭直觉选出 {targetCount} 张牌</h1>
            <p className="lead compact">左右滑动牌列，依次点选。再次点击可撤回；确认以后才会揭晓牌面与正逆位。</p>
            <div className="selection-status"><span>{progressLabel}</span><div>{Array.from({ length: targetCount }, (_, index) => <i key={index} className={typeof selection[index] === "number" ? "filled" : ""}>{typeof selection[index] === "number" ? index + 1 : ""}</i>)}</div></div>
            <div className={`deck-scroller${shuffling ? " is-shuffling" : ""}`} role="listbox" aria-label="78 张背面朝上的塔罗牌" aria-multiselectable="true">
              {Array.from({ length: draft.deckSize }, (_, index) => {
                const order = selection.findIndex((item) => item === index);
                return <button
                  key={index}
                  className={`deck-card${order >= 0 ? " selected" : ""}`}
                  onClick={shuffling ? undefined : () => toggleCard(index)}
                  role="option"
                  aria-selected={order >= 0}
                  aria-label={`第 ${index + 1} 张牌${order >= 0 ? `，选择顺序 ${order + 1}` : ""}`}
                >
                  <img src="/cards/card-back.webp" alt="" draggable={false} />{order >= 0 && !shuffling && <span>{order + 1}</span>}
                </button>;
              })}
            </div>
            <div className="sticky-actions">
              <Button label="重新洗牌" variant="ghost" size="lg" isDisabled={shuffling || busy} isLoading={shuffling} onClick={() => void reshuffle()} />
              <Button label="清空选择" variant="ghost" size="lg" isDisabled={selectedCount === 0 || shuffling || busy} onClick={clearSelection} />
              <Button label={selectedCount === targetCount ? "确认并揭牌" : `还需选择 ${targetCount - selectedCount} 张`} variant="primary" size="lg" isDisabled={selectedCount !== targetCount || shuffling || busy} isLoading={busy} onClick={() => void confirmSelection()} />
            </div>
          </motion.section>}

          {stage === "result" && reading && <motion.section className="result-view" key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">{reading.spreadId === "single" ? "SINGLE CARD" : reading.spreadId === "triple" ? "THREE-CARD TRIANGLE" : "FIVE-CARD TIMELINE"}</p>
            <div className="result-actions">
              <button
                className="notes-trigger"
                data-active={editingNotes}
                onClick={() => {
                  const next = !editingNotes;
                  if (next) setNotesDraft(loadNotesDraft(reading.id, reading.notes ?? ""));
                  setEditingNotes(next);
                }}
              >
                {reading.notes ? "查看笔记" : "添加笔记"}
                {reading.notes && <span className="notes-dot" />}
              </button>
            </div>
            {editingNotes && (
              <div className="notes-editor">
                <textarea
                  value={notesDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setNotesDraft(next);
                    if (reading) persistNotesDraft(reading.id, next);
                  }}
                  placeholder="记录后续发生的事情，或此刻的感受…"
                  rows={5}
                  maxLength={2000}
                />
                <div className="notes-editor-actions">
                  <Button label="保存笔记" variant="primary" size="sm" isLoading={busy} isDisabled={busy} onClick={() => void saveNotes()} />
                  <Button label="取消" variant="ghost" size="sm" isDisabled={busy} onClick={() => setEditingNotes(false)} />
                </div>
              </div>
            )}
            <h1>{reading.interpretation?.headline ?? "牌阵已保存，等待解读"}</h1>
            <p className="lead compact">{reading.question}</p>
            {reading.drawnAt && <p className="drawn-at">抽卡于 {new Date(reading.drawnAt).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
            {reading.revealed && reading.revealed.length > 0 && (
              <CardRevealStage
                cards={reading.revealed}
                autoReveal
                key={reading.id}
                onComplete={() => { /* 动画完成后的可选回调 */ }}
              />
            )}
            {reading.calculation && <div className="metrics"><div><span>动量</span><b>{reading.calculation.momentum > 0 ? "+" : ""}{reading.calculation.momentum}</b><small>{reading.calculation.momentumLabel}</small></div><div><span>价值</span><b>{reading.calculation.value > 0 ? "+" : ""}{reading.calculation.value}</b><small>{reading.calculation.valueLabel}</small></div></div>}
            {!reading.interpretation ? <>
              <div className="interpret-cta"><p>可以现在调用模型，也可以关闭应用后稍后继续。牌、顺序和正逆位不会改变。</p><Button label="开始 AI 解读" variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={() => void interpret()} /></div>
              {reading.status === "interpreting" && interpretProgress && <div className="interpret-progress">{interpretProgress}</div>}
            </> : <ReadingContent reading={reading} />}
            <div className="end-actions"><Button label="开始新的探索" variant="secondary" size="lg" onClick={reset} /></div>
          </motion.section>}

          {stage === "settings" && <SettingsPage
            key="settings"
            settings={settings}
            appPreferences={appPreferences}
            apiKey={apiKey}
            busy={busy}
            savedNotice={savedNotice}
            r2Configured={r2Configured}
            presetProviders={presetProviders}
            onApiKeyChange={setApiKey}
            onSettingsChange={setSettings}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onSave={() => void saveSettings(false)}
            onClear={() => void saveSettings(true)}
            onSaveR2={(secretAccessKey: string) => void saveR2Settings(secretAccessKey)}
          />}
        </AnimatePresence>
      </main>
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="关闭">×</button></div>}
      <button
        type="button"
        className="fab-settings"
        onClick={() => { setStage("settings"); setSavedNotice(""); setError(""); }}
        aria-label="打开设置"
        title="设置"
      >
        <GearIcon />
      </button>
    </section>
  </div>;
}

function Sidebar({ stage, history, folders, activeFolderId, settings, hideModelUi, onNewReading, onNewReadingInFolder, onCreateFolder, onRenameFolder, onDeleteFolder, onMoveReading, onDeleteReading, onOpenHistory, onResumeDraft, onOpenSettings }: {
  stage: Stage;
  history: ReadingView[];
  folders: ReadingFolder[];
  activeFolderId?: string | undefined;
  settings: TarotSettings;
  hideModelUi: boolean;
  onNewReading(): void;
  onNewReadingInFolder(folderId: string): void;
  onCreateFolder(name: string): Promise<void>;
  onRenameFolder(id: string, name: string): Promise<void>;
  onDeleteFolder(id: string): Promise<void>;
  onMoveReading(id: string, folderId?: string): Promise<void>;
  onDeleteReading(id: string): Promise<void>;
  onOpenHistory(item: ReadingView): void;
  onResumeDraft(item: ReadingView): void;
  onOpenSettings(): void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [draggedReadingId, setDraggedReadingId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();

  async function submitFolder() {
    if (!folderName.trim()) return;
    await onCreateFolder(folderName.trim());
    setFolderName("");
    setCreatingFolder(false);
  }

  async function submitRename(id: string) {
    if (!renameValue.trim()) {
      setRenamingId(undefined);
      return;
    }
    await onRenameFolder(id, renameValue.trim());
    setRenamingId(undefined);
    setRenameValue("");
  }

  const visibleHistory = history.filter((item) => item.revealed);
  const ungroupedHistory = visibleHistory.filter((item) => !item.folderId);
  const draggedReading = visibleHistory.find((item) => item.id === draggedReadingId);
  const draftItems = history.filter((item) => item.status === "selecting");

  function canDropInto(folderId?: string) {
    return Boolean(draggedReading && draggedReading.folderId !== folderId);
  }

  async function dropReading(event: DragEvent, folderId?: string) {
    event.preventDefault();
    const readingId = draggedReadingId ?? event.dataTransfer.getData("text/plain");
    setDropTarget(undefined);
    setDraggedReadingId(undefined);
    if (!readingId || visibleHistory.find((item) => item.id === readingId)?.folderId === folderId) return;
    setCollapsed((current) => ({ ...current, [folderId ?? "ungrouped"]: false }));
    await onMoveReading(readingId, folderId);
  }

  const formatDrawnAt = (iso?: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const renderConversation = (item: ReadingView) => <div className="folder-conversation-wrap" key={item.id}>
    <button
      className="folder-conversation"
      draggable
      aria-grabbed={draggedReadingId === item.id}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        setDraggedReadingId(item.id);
      }}
      onDragEnd={() => { setDraggedReadingId(undefined); setDropTarget(undefined); }}
      onClick={() => onOpenHistory(item)}
    ><span>{item.status === "completed" ? "✦" : "○"}</span><div><b>{item.question}</b><small>{item.drawnAt ? formatDrawnAt(item.drawnAt) : new Date(item.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</small></div></button>
    <button className="conversation-delete" onClick={(event) => { event.stopPropagation(); void onDeleteReading(item.id); }} title="删除这条解读" aria-label={`删除 ${item.question}`}>×</button>
  </div>;

  return <aside className="sidebar">
    <div className="sidebar-brand"><span className="brand-mark"><StargateMark /></span><div><b>星径</b><small></small></div></div>
    <nav className="sidebar-nav" aria-label="主导航">
      <button data-active={stage !== "settings"} onClick={onNewReading}><span>✧</span><b>探索</b></button>
      {!hideModelUi && (
        <button data-active={stage === "settings"} onClick={onOpenSettings}><span>⌘</span><b>模型连接</b><i className={settings.hasApiKey ? "ready" : ""} /></button>
      )}
    </nav>
    <section className="sidebar-history folder-tree">
      <div className="sidebar-section-title"><span>最近记录</span><button className="add-folder-button" onClick={() => setCreatingFolder(true)} title="新建 Folder" aria-label="新建 Folder">＋</button></div>
      {draftItems.length > 0 && (
        <div className="draft-section">
          <div className="sidebar-section-title"><span>进行中</span></div>
          {draftItems.map((item) => (
            <div className="folder-conversation-wrap" key={item.id}>
              <button className="folder-conversation" onClick={() => onResumeDraft(item)} title="继续这个未完成的选择">
                <span>◌</span>
                <div>
                  <b>{item.question}</b>
                  <small>{item.selectedIndexes.length > 0 ? `已选 ${item.selectedIndexes.length} / 5，继续选择` : "选牌进行中"}</small>
                </div>
              </button>
              <button className="conversation-delete" onClick={(event) => { event.stopPropagation(); void onDeleteReading(item.id); }} title="删除这条草稿" aria-label={`删除 ${item.question}`}>×</button>
            </div>
          ))}
        </div>
      )}
      {!creatingFolder && folders.length === 0 && visibleHistory.length === 0 && (
        <div className="sidebar-empty">
          <p>还没有解读记录</p>
          <span>从「探索」开始第一次提问，或点 ＋ 建立分组。</span>
        </div>
      )}
      {creatingFolder && <div className="folder-create-row"><FolderGlyph className="create-folder-icon" /><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitFolder(); if (event.key === "Escape") setCreatingFolder(false); }} onBlur={() => { if (!folderName.trim()) setCreatingFolder(false); }} placeholder="Folder 名称" /><button onMouseDown={(event) => event.preventDefault()} onClick={() => void submitFolder()}>确认</button></div>}
      <div className="folder-list">
        {folders.map((folder) => {
          const items = visibleHistory.filter((item) => item.folderId === folder.id);
          const isCollapsed = collapsed[folder.id] === true;
          const isRenaming = renamingId === folder.id;
          return <div
            className="folder-group"
            key={folder.id}
            data-active={activeFolderId === folder.id}
            data-drop-target={dropTarget === folder.id}
            onDragEnter={() => setDropTarget(canDropInto(folder.id) ? folder.id : undefined)}
            onDragOver={(event) => { if (canDropInto(folder.id)) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
            onDrop={(event) => { if (canDropInto(folder.id)) void dropReading(event, folder.id); }}
          >
            <div className="folder-row">
              <button className="folder-toggle" data-collapsed={isCollapsed} onClick={() => setCollapsed((current) => ({ ...current, [folder.id]: !isCollapsed }))} aria-label={isCollapsed ? "展开" : "折叠"}>›</button>
              <span className="folder-icon"><FolderGlyph filled={activeFolderId === folder.id} /></span>
              {isRenaming ? <input className="folder-rename-input" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitRename(folder.id); if (event.key === "Escape") setRenamingId(undefined); }} onBlur={() => void submitRename(folder.id)} /> : <button className="folder-name" onDoubleClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }} onClick={() => setCollapsed((current) => ({ ...current, [folder.id]: false }))}>{folder.name}<small>{items.length}</small></button>}
              <button className="folder-rename" onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }} title="重命名 Folder" aria-label={`重命名 ${folder.name}`}>···</button>
              <button className="folder-compose" onClick={() => { setCollapsed((current) => ({ ...current, [folder.id]: false })); onNewReadingInFolder(folder.id); }} title="在此分组下新建对话" aria-label={`在 ${folder.name} 下新建对话`}><NewConversationIcon /></button>
              <button className="folder-delete" onClick={() => void onDeleteFolder(folder.id)} title="删除分组" aria-label={`删除分组 ${folder.name}`}>×</button>
            </div>
            <div className="folder-children-wrap" data-collapsed={isCollapsed}><div className="folder-children">{items.length > 0 ? items.map(renderConversation) : <button className="folder-empty" onClick={() => onNewReadingInFolder(folder.id)}>＋ 添加第一个问题</button>}</div></div>
          </div>;
        })}
        {(ungroupedHistory.length > 0 || draggedReadingId) && <div
          className="folder-group ungrouped"
          data-drop-target={dropTarget === "ungrouped"}
          onDragEnter={() => setDropTarget(canDropInto() ? "ungrouped" : undefined)}
          onDragOver={(event) => { if (canDropInto()) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
          onDrop={(event) => { if (canDropInto()) void dropReading(event); }}
        ><div className="folder-row"><button className="folder-toggle" data-collapsed={collapsed.ungrouped === true} onClick={() => setCollapsed((current) => ({ ...current, ungrouped: !current.ungrouped }))} aria-label={collapsed.ungrouped ? "展开" : "折叠"}>›</button><span className="folder-icon"><FolderGlyph /></span><button className="folder-name" onClick={() => setCollapsed((current) => ({ ...current, ungrouped: false }))}>未分组<small>{ungroupedHistory.length}</small></button></div><div className="folder-children-wrap" data-collapsed={collapsed.ungrouped === true}><div className="folder-children">{ungroupedHistory.map(renderConversation)}</div></div></div>}
      </div>
    </section>
    <footer className="sidebar-footer">
      {!hideModelUi && (
        <button onClick={onOpenSettings}><span className="model-status" data-ready={settings.hasApiKey} /><div><b>{settings.hasApiKey ? settings.model : "尚未连接模型"}</b><small>{settings.hasApiKey ? "API 已配置" : "设置 API 地址与 Token"}</small></div><span>›</span></button>
      )}
    </footer>
  </aside>;
}

function SettingsPage({ settings, appPreferences, apiKey, busy, savedNotice, r2Configured, presetProviders, onApiKeyChange, onSettingsChange, onProviderChange, onModelChange, onSave, onClear, onSaveR2 }: {
  settings: TarotSettings;
  appPreferences: AppPreferences;
  apiKey: string;
  busy: boolean;
  savedNotice: string;
  r2Configured: boolean;
  presetProviders: PresetProvider[];
  onApiKeyChange(value: string): void;
  onSettingsChange(value: TarotSettings): void;
  onProviderChange(type: string): void;
  onModelChange(model: string): void;
  onSave(): void;
  onClear(): void;
  onSaveR2(secretAccessKey: string): void;
}) {
  const currentPreset = presetProviders.find((p) => p.type === settings.providerType);
  const providerInitial = (currentPreset?.label ?? "AI").trim().charAt(0) || "AI";
  const recommendedModels = currentPreset?.recommendedModels ?? [];
  const [testResult, setTestResult] = useState<{ ok: boolean; userMessage: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<Array<{ id: string; displayName?: string }>>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // 按 category 分组
  const grouped = useMemo(() => {
    const groups: Record<string, PresetProvider[]> = {};
    for (const p of presetProviders) {
      (groups[p.category] ??= []).push(p);
    }
    return groups;
  }, [presetProviders]);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.tarot.testConnection({
        ...(apiKey ? { apiKey } : {}),
        model: settings.model,
        baseUrl: settings.baseUrl,
        providerType: settings.providerType,
      });
      setTestResult(result);
    } catch (reason) {
      setTestResult({ ok: false, userMessage: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setTesting(false);
    }
  }

  // 拉取可用模型列表
  async function fetchAvailableModels() {
    setFetchingModels(true);
    try {
      const result = await window.tarot.fetchModels({
        ...(apiKey ? { apiKey } : {}),
        baseUrl: settings.baseUrl,
        providerType: settings.providerType,
      });
      if (result.ok) {
        setFetchedModels(result.models);
      }
    } catch {
      // 拉取失败时保持现有列表不变
    } finally {
      setFetchingModels(false);
    }
  }

  const categoryOrder = ["domestic", "overseas", "local"];
  const categoryLabels: Record<string, string> = {
    domestic: "🇨🇳 国内模型",
    overseas: "🌐 海外模型",
    local: "💻 本地模型",
  };

  return <motion.section className="settings-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="settings-heading"><p className="eyebrow">SETTINGS</p><h1>设置</h1><p>配置模型连接与 Cloudflare R2 云同步。</p><ThemeSwitch /></div>
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="provider-logo">{providerInitial}</div>
        <div>
          <h2>{currentPreset?.label ?? "自定义 API"}</h2>
          <p>{currentPreset ? (currentPreset.category === "domestic" ? "国内模型" : currentPreset.category === "overseas" ? "海外模型" : "本地模型") : "OpenAI-compatible"}</p>
        </div>
        <span className="settings-status" data-ready={settings.hasApiKey}>{settings.hasApiKey ? "已连接" : "未配置"}</span>
      </div>
      <div className="settings-fields">
        {/* Provider 选择器 */}
        {!appPreferences.hideModelUi && (
          <label>
            <span>模型提供商</span>
            <small>切换后自动填入 API 地址和推荐模型</small>
            <select
              className="provider-select"
              value={settings.providerType}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              <optgroup label="━━ 推荐 ━━">
                {presetProviders.filter((p) => p.type === "openai" || p.type === "minimax" || p.type === "deepseek").map((p) => (
                  <option key={p.type} value={p.type}>{p.label}</option>
                ))}
              </optgroup>
              {categoryOrder.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                return (
                  <optgroup key={cat} label={categoryLabels[cat] ?? cat}>
                    {items.filter((p) => p.type !== "openai" && p.type !== "minimax" && p.type !== "deepseek").map((p) => (
                      <option key={p.type} value={p.type}>{p.label}</option>
                    ))}
                  </optgroup>
                );
              })}
              <optgroup label="━━ 自定义 ━━">
                <option value="custom">自定义 API</option>
              </optgroup>
            </select>
          </label>
        )}

        {/* 推荐模型下拉（仅当有推荐列表时） */}
        {!appPreferences.hideModelUi && recommendedModels.length > 0 && (
          <label>
            <span>推荐模型</span>
            <small>常用模型快捷选择</small>
            <select
              className="provider-select"
              value={settings.model}
              onChange={(e) => onModelChange(e.target.value)}
            >
              {recommendedModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              {fetchedModels.length > 0 && (
                <optgroup label="拉取的模型">
                  {fetchedModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName ?? m.id}</option>
                  ))}
                </optgroup>
              )}
              <option value={settings.model} disabled={recommendedModels.includes(settings.model) || fetchedModels.some((m) => m.id === settings.model)}>
                {recommendedModels.includes(settings.model) || fetchedModels.some((m) => m.id === settings.model) ? "" : `当前: ${settings.model}`}
              </option>
            </select>
            <button className="fetch-models-btn" disabled={fetchingModels || busy} onClick={() => void fetchAvailableModels()}>
              {fetchingModels ? "拉取中..." : "拉取可用模型"}
            </button>
          </label>
        )}

        {appPreferences.hideModelUi && (
          <div className="settings-readonly-model">
            <span>当前模型</span>
            <b>{currentPreset ? `${currentPreset.label} · ${settings.model}` : settings.model}</b>
            <small>模型选择已在 Config 中隐藏</small>
          </div>
        )}

        <label><span>API 地址</span><small>填写到版本路径，例如 https://api.openai.com/v1</small><input value={settings.baseUrl} disabled={appPreferences.hideModelUi} onChange={(event) => onSettingsChange({ ...settings, baseUrl: event.target.value })} spellCheck={false} /></label>
        <label><span>模型名称</span><small>服务端接受的实际 model ID</small><input value={settings.model} disabled={appPreferences.hideModelUi} onChange={(event) => onSettingsChange({ ...settings, model: event.target.value })} spellCheck={false} /></label>
        <label><span>API Token</span><small>{settings.hasApiKey ? "已加密保存在 Windows 安全存储；输入新值即可更换" : "Token 不会传给渲染界面或写入解读历史"}</small><input type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder={settings.hasApiKey ? "输入新的 Token 以替换现有值" : "sk-…"} autoComplete="off" /></label>
      </div>
      <div className="settings-actions">
        {settings.hasApiKey && <Button label="清除 Token" variant="ghost" size="lg" isDisabled={busy} onClick={onClear} />}
        <span>{savedNotice}</span>
        {currentPreset?.signupUrl && (
          <a className="signup-link" href={currentPreset.signupUrl} target="_blank" rel="noopener noreferrer">注册 {currentPreset.label} ›</a>
        )}
        <div className="test-connection-group">
          <button className="test-connection-btn" disabled={testing || busy} onClick={() => void testConnection()}>
            {testing ? "测试中..." : "测试连接"}
          </button>
          {testResult && (
            <span className={`test-result ${testResult.ok ? "success" : "failure"}`}>
              {testResult.ok ? "✓" : "✗"} {testResult.userMessage}
            </span>
          )}
        </div>
        <Button label={settings.hasApiKey ? "保存并更新连接" : "保存连接"} variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={onSave} />
      </div>
    </div>
    <R2SyncSettings settings={settings} r2Configured={r2Configured} savedNotice={savedNotice} busy={busy} onSettingsChange={onSettingsChange} onSaveR2={onSaveR2} />
    <div className="security-note"><span>⌁</span><div><b>本地安全边界</b><p>API 地址和模型名保存在本地设置文件；Token 使用 Electron safeStorage 调用 Windows DPAPI 加密。前端只能知道"是否已配置"，无法读取明文。</p></div></div>
  </motion.section>;
}

function R2SyncSettings({ settings, r2Configured, savedNotice, busy, onSettingsChange, onSaveR2 }: {
  settings: TarotSettings;
  r2Configured: boolean;
  savedNotice: string;
  busy: boolean;
  onSettingsChange(value: TarotSettings): void;
  onSaveR2(secretAccessKey: string): void;
}) {
  const r2 = settings.r2 ?? { enabled: false, accountId: "", endpoint: "", accessKeyId: "", bucketName: "", region: "auto" };
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pulled: number; pushed: number; errors: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);

  function updateR2(partial: Partial<R2Settings>) {
    onSettingsChange({ ...settings, r2: { ...r2, ...partial } });
  }

  async function testR2Connection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.tarot.testR2Connection({
        accountId: r2.accountId ?? undefined,
        endpoint: r2.endpoint || undefined,
        accessKeyId: r2.accessKeyId ?? undefined,
        secretAccessKey,
        bucketName: r2.bucketName ?? undefined,
        region: r2.region || undefined,
      });
      setTestResult(result);
    } catch (reason) {
      setTestResult({ ok: false, message: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setTesting(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.tarot.syncNow();
      setSyncResult(result);
    } catch (reason) {
      setSyncResult({ pulled: 0, pushed: 0, errors: [reason instanceof Error ? reason.message : String(reason)] });
    } finally {
      setSyncing(false);
    }
  }

  const hasRequiredFields = Boolean(r2.accountId && r2.accessKeyId && secretAccessKey && r2.bucketName);

  return <div className="settings-card r2-sync-card">
    <div className="settings-card-header">
      <div className="provider-logo">R2</div>
      <div>
        <h2>Cloudflare R2 云同步</h2>
        <p>每条记录以 JSON 文件同步到 R2，多设备共享</p>
      </div>
      <span className="settings-status" data-ready={r2Configured}>{r2Configured ? "已启用" : "未启用"}</span>
    </div>
    <div className="settings-fields">
      <label className="checkbox-label">
        <input type="checkbox" checked={r2.enabled ?? false} onChange={(event) => updateR2({ enabled: event.target.checked })} />
        <span>启用 R2 自动同步</span>
        <small>开启后每次写入会自动推送到 R2，启动 10 秒后自动双向同步</small>
      </label>
      <label><span>Account ID</span><input value={r2.accountId ?? ""} onChange={(event) => updateR2({ accountId: event.target.value })} spellCheck={false} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" /></label>
      <label><span>Endpoint（可选）</span><small>留空则使用 https://&lt;AccountID&gt;.r2.cloudflarestorage.com</small><input value={r2.endpoint ?? ""} onChange={(event) => updateR2({ endpoint: event.target.value })} spellCheck={false} placeholder="https://...r2.cloudflarestorage.com" /></label>
      <label><span>Access Key ID</span><small>R2 访问密钥 ID</small><input value={r2.accessKeyId ?? ""} onChange={(event) => updateR2({ accessKeyId: event.target.value })} spellCheck={false} /></label>
      <label><span>Secret Access Key</span><small>保存后将加密存储，渲染端不再显示明文</small><input type="password" value={secretAccessKey} onChange={(event) => setSecretAccessKey(event.target.value)} placeholder={r2Configured ? "已保存；输入新值以替换" : "..."} autoComplete="off" /></label>
      <label><span>Bucket 名称</span><small>R2 存储桶名称</small><input value={r2.bucketName ?? ""} onChange={(event) => updateR2({ bucketName: event.target.value })} spellCheck={false} /></label>
      <label><span>Region</span><small>通常保持 auto 即可</small><input value={r2.region ?? "auto"} onChange={(event) => updateR2({ region: event.target.value })} spellCheck={false} /></label>
    </div>
    <div className="settings-actions">
      <div className="test-connection-group">
        <button className="test-connection-btn" disabled={testing || !hasRequiredFields} onClick={() => void testR2Connection()}>
          {testing ? "测试中..." : "测试连接"}
        </button>
        {testResult && (
          <span className={`test-result ${testResult.ok ? "success" : "failure"}`}>
            {testResult.ok ? "✓" : "✗"} {testResult.message}
          </span>
        )}
      </div>
      <Button label="保存 R2 配置" variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={() => onSaveR2(secretAccessKey)} />
      {savedNotice && <span className="test-result success">{savedNotice}</span>}
      <button className="test-connection-btn sync-now-btn" disabled={syncing || !r2Configured} onClick={() => void syncNow()}>
        {syncing ? "同步中..." : "立即同步"}
      </button>
      {syncResult && (
        <span className={`test-result ${syncResult.errors.length === 0 ? "success" : "failure"}`}>
          {syncResult.errors.length === 0 ? "✓" : "✗"} 拉取 {syncResult.pulled}，推送 {syncResult.pushed}
          {syncResult.errors.length > 0 && <small>{syncResult.errors.join("；")}</small>}
        </span>
      )}
    </div>
  </div>;
}

function ReadingContent({ reading }: { reading: ReadingView }) {
  const result = reading.interpretation!;
  return <div className="reading-content">
    <section className="reading-hero"><span>整体脉络</span><p>{result.questionReflection}</p><p>{result.storyline}</p></section>
    <section><h2>牌面如何连接</h2><div className="card-readings">{result.cards.map((item, index) => <article key={item.cardId}><i>{index + 1}</i><div><h3>{reading.revealed?.[index]?.card.name}</h3><p>{item.meaning}</p><p className="connection">{item.connectionToQuestion}</p></div></article>)}</div></section>
    {result.momentumInterpretation && result.valueInterpretation && <section className="two-column"><article><span>动量提示</span><p>{result.momentumInterpretation}</p></article><article><span>价值提示</span><p>{result.valueInterpretation}</p></article></section>}
    {result.energyFlow && <section><h2>能量流与整体阅读</h2><p>{result.energyFlow}</p><h3>{result.overallTheme}</h3>{result.patterns && <ul>{result.patterns.map((pattern) => <li key={pattern}>{pattern}</li>)}</ul>}<p>{result.holisticReading}</p></section>}
    <section className="advice"><h2>带回现实的行动</h2><ol>{result.actionAdvice.map((advice) => <li key={advice}>{advice}</li>)}</ol><blockquote>{result.reflectionQuestion}</blockquote></section>
    <p className="disclaimer">{result.disclaimer}</p>
  </div>;
}
