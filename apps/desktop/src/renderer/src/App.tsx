import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { AnimatePresence, motion } from "framer-motion";

type Stage = "home" | "select" | "result" | "settings";

function StargateMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 160 160" fill="none" aria-hidden="true">
    <path d="M50 113V77c0-17 13-31 30-31s30 14 30 31v36" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M63 113V79c0-10 7-18 17-18s17 8 17 18v34" stroke="currentColor" strokeOpacity=".52" strokeWidth="3" strokeLinecap="round" />
    <path d="m80 67 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="currentColor" />
    <path d="M42 113h76" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

function NewConversationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.5c5 0 8.5 3.2 8.5 7.6s-3.5 7.6-8.5 7.6c-1 0-2-.13-2.9-.4L5 20.5l.65-4.1A7.15 7.15 0 0 1 3.5 11.1C3.5 6.7 7 3.5 12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 7.8v6.4M8.8 11h6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

const stageTitles: Record<Stage, string> = {
  home: "新解读",
  select: "选择牌面",
  result: "解读详情",
  settings: "模型连接",
};

export function App() {
  const [stage, setStage] = useState<Stage>("home");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState<{ id: string; deckSize: number }>();
  const [selection, setSelection] = useState<(number | null)[]>([]);
  const [reading, setReading] = useState<ReadingView>();
  const [history, setHistory] = useState<ReadingView[]>([]);
  const [folders, setFolders] = useState<ReadingFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>();
  const [settings, setSettings] = useState<TarotSettings>({ providerType: "openai", model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1", hasApiKey: false });
  const [presetProviders, setPresetProviders] = useState<PresetProvider[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [interpretProgress, setInterpretProgress] = useState(""); // 流式解读进度文本

  useEffect(() => {
    void window.tarot.bootstrap().then((data) => {
      setHistory(data.history);
      setFolders(data.folders);
      setSettings(data.settings);
      setPresetProviders(data.presetProviders);
    }).catch(showError);
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
    setError("");
    setBusy(true);
    try {
      const created = await window.tarot.createReading({ question, mode, ...(activeFolderId ? { folderId: activeFolderId } : {}) });
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
    }
  }

  function toggleCard(index: number) {
    setSelection((current) => {
      const existingIndex = current.indexOf(index);
      if (existingIndex >= 0) {
        // 已选中：将该位置置为 null（保留空位）
        return current.map((item, i) => i === existingIndex ? null : item);
      }
      // 未选中：寻找第一个空位填入，否则追加（不超过 5 个位置）
      const firstNull = current.findIndex((item) => item === null);
      if (firstNull >= 0) {
        return current.map((item, i) => i === firstNull ? index : item);
      }
      if (current.length >= 5) return current;
      return [...current, index];
    });
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
      setHistory((current) => current.map((item) => item.folderId === id ? { ...item, folderId: undefined } : item));
      if (activeFolderId === id) {
        setActiveFolderId(undefined);
        if (reading?.folderId === id) setReading((prev) => prev ? { ...prev, folderId: undefined } : prev);
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
  const progressLabel = useMemo(
    () => selectedCount === 5 ? "五张已选好，可以确认" : `已选择 ${selectedCount} / 5`,
    [selectedCount],
  );
  const currentPreset = presetProviders.find((p) => p.type === settings.providerType);
  const displayModel = currentPreset?.label
    ? `${currentPreset.label} · ${settings.model}`
    : settings.model;

  return <div className="app-frame">
    <Sidebar
      stage={stage}
      history={history}
      folders={folders}
      activeFolderId={activeFolderId}
      settings={settings}
      onNewReading={reset}
      onNewReadingInFolder={startInFolder}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveReading={moveReading}
      onDeleteReading={deleteReading}
      onOpenHistory={openHistory}
      onOpenSettings={() => { setStage("settings"); setSavedNotice(""); }}
    />

    <section className="content-shell">
      <header className="content-titlebar">
        <div><span>星径</span><b>{stageTitles[stage]}</b></div>
        <button className="connection-chip" data-ready={settings.hasApiKey} onClick={() => setStage("settings")}>
          <i />{settings.hasApiKey ? displayModel : "配置模型"}
        </button>
      </header>

      <main className="content-scroll">
        <AnimatePresence mode="wait">
          {stage === "home" && <motion.section className="home" key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="hero-orbit" aria-hidden="true"><StargateMark /></div>
            <p className="eyebrow">A QUIET SPACE FOR REFLECTION</p>
            {activeFolder && <div className="active-folder-chip"><span>▱</span><b>{activeFolder.name}</b><small>新问题</small></div>}
            <h1>让五张牌，照见此刻的路径</h1>
            <p className="lead"></p>
            <div className="question-panel astryx-surface">
              <TextArea label="你想探索什么？" value={question} onChange={setQuestion} placeholder="例如：未来三个月，我该如何调整工作方向？" rows={4} isRequired />
              <div className="question-footer"><span>{question.length} / 300</span><span>三个月内的问题</span></div>
            </div>
            <div className="mode-actions">
              <Button label="自己选五张" variant="primary" size="lg" width="100%" isDisabled={!question.trim() || busy} isLoading={busy} onClick={() => void begin("manual")} />
              <Button label="随机抽五张" variant="secondary" size="lg" width="100%" isDisabled={!question.trim() || busy} onClick={() => void begin("random")} />
            </div>
          </motion.section>}

          {stage === "select" && draft && <motion.section className="selection-view" key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="eyebrow">CHOOSE WITHOUT OVERTHINKING</p>
            <h1>凭直觉选出五张牌</h1>
            <p className="lead compact">左右滑动牌列，依次点选。再次点击可撤回；确认以后才会揭晓牌面与正逆位。</p>
            <div className="selection-status"><span>{progressLabel}</span><div>{Array.from({ length: 5 }, (_, index) => <i key={index} className={typeof selection[index] === "number" ? "filled" : ""}>{typeof selection[index] === "number" ? index + 1 : ""}</i>)}</div></div>
            <div className="deck-scroller" role="listbox" aria-label="78 张背面朝上的塔罗牌" aria-multiselectable="true">
              {Array.from({ length: draft.deckSize }, (_, index) => {
                const order = selection.findIndex((item) => item === index);
                return <motion.button whileTap={{ scale: .97 }} key={index} className={`deck-card ${order >= 0 ? "selected" : ""}`} onClick={() => toggleCard(index)} role="option" aria-selected={order >= 0} aria-label={`第 ${index + 1} 张牌${order >= 0 ? `，选择顺序 ${order + 1}` : ""}`}>
                  <img src="/cards/card-back.webp" alt="" draggable={false} />{order >= 0 && <span>{order + 1}</span>}
                </motion.button>;
              })}
            </div>
            <div className="sticky-actions"><Button label="取消重选" variant="ghost" size="lg" onClick={reset} /><Button label={selectedCount === 5 ? "确认并揭牌" : `还需选择 ${5 - selectedCount} 张`} variant="primary" size="lg" isDisabled={selectedCount !== 5 || busy} isLoading={busy} onClick={() => void confirmSelection()} /></div>
          </motion.section>}

          {stage === "result" && reading && <motion.section className="result-view" key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">YOUR FIVE-CARD TIMELINE</p>
            <h1>{reading.interpretation?.headline ?? "牌阵已保存，等待解读"}</h1>
            <p className="lead compact">{reading.question}</p>
            <div className="revealed-grid">{reading.revealed?.map((item) => <article className="revealed-card" key={item.cardId}><div className="card-image"><img src={`/${item.card.image}`} alt={item.card.name} className={item.orientation === "reversed" ? "reversed" : ""} /></div><span>{item.positionName}</span><h3>{item.card.name}</h3><small>{item.orientation === "upright" ? "正位" : "逆位"}</small></article>)}</div>
            {reading.calculation && <div className="metrics"><div><span>动量</span><b>{reading.calculation.momentum > 0 ? "+" : ""}{reading.calculation.momentum}</b><small>{reading.calculation.momentumLabel}</small></div><div><span>价值</span><b>{reading.calculation.value > 0 ? "+" : ""}{reading.calculation.value}</b><small>{reading.calculation.valueLabel}</small></div><p></p></div>}
            {!reading.interpretation ? <>
              <div className="interpret-cta"><p>可以现在调用模型，也可以关闭应用后稍后继续。牌、顺序和正逆位不会改变。</p><Button label="开始 AI 解读" variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={() => void interpret()} /></div>
              {reading.status === "interpreting" && interpretProgress && <div className="interpret-progress">{interpretProgress}</div>}
            </> : <ReadingContent reading={reading} />}
            <div className="end-actions"><Button label="开始新的探索" variant="secondary" size="lg" onClick={reset} /></div>
          </motion.section>}

          {stage === "settings" && <ModelSettings
            key="settings"
            settings={settings}
            apiKey={apiKey}
            busy={busy}
            savedNotice={savedNotice}
            presetProviders={presetProviders}
            onApiKeyChange={setApiKey}
            onSettingsChange={setSettings}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onSave={() => void saveSettings(false)}
            onClear={() => void saveSettings(true)}
          />}
        </AnimatePresence>
      </main>
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="关闭">×</button></div>}
    </section>
  </div>;
}

function Sidebar({ stage, history, folders, activeFolderId, settings, onNewReading, onNewReadingInFolder, onCreateFolder, onRenameFolder, onDeleteFolder, onMoveReading, onDeleteReading, onOpenHistory, onOpenSettings }: {
  stage: Stage;
  history: ReadingView[];
  folders: ReadingFolder[];
  activeFolderId?: string | undefined;
  settings: TarotSettings;
  onNewReading(): void;
  onNewReadingInFolder(folderId: string): void;
  onCreateFolder(name: string): Promise<void>;
  onRenameFolder(id: string, name: string): Promise<void>;
  onDeleteFolder(id: string): Promise<void>;
  onMoveReading(id: string, folderId?: string): Promise<void>;
  onDeleteReading(id: string): Promise<void>;
  onOpenHistory(item: ReadingView): void;
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
    ><span>{item.status === "completed" ? "✦" : "○"}</span><div><b>{item.question}</b><small>{new Date(item.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</small></div></button>
    <button className="conversation-delete" onClick={(event) => { event.stopPropagation(); void onDeleteReading(item.id); }} title="删除这条解读" aria-label={`删除 ${item.question}`}>×</button>
  </div>;

  return <aside className="sidebar">
    <div className="sidebar-brand"><span className="brand-mark"><StargateMark /></span><div><b>星径</b><small>LOCAL TAROT</small></div></div>
    <button className="new-reading-button" onClick={onNewReading}><span>＋</span><b>新解读</b><kbd>Ctrl N</kbd></button>
    <nav className="sidebar-nav" aria-label="主导航">
      <button data-active={stage !== "settings"} onClick={onNewReading}><span>✧</span><b>探索</b></button>
      <button data-active={stage === "settings"} onClick={onOpenSettings}><span>⌘</span><b>模型连接</b><i className={settings.hasApiKey ? "ready" : ""} /></button>
    </nav>
    <section className="sidebar-history folder-tree">
      <div className="sidebar-section-title"><span>最近记录</span><button className="add-folder-button" onClick={() => setCreatingFolder(true)} title="新建 Folder" aria-label="新建 Folder">＋</button></div>
      {creatingFolder && <div className="folder-create-row"><span>▱</span><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitFolder(); if (event.key === "Escape") setCreatingFolder(false); }} onBlur={() => { if (!folderName.trim()) setCreatingFolder(false); }} placeholder="Folder 名称" /><button onMouseDown={(event) => event.preventDefault()} onClick={() => void submitFolder()}>确认</button></div>}
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
              <span className="folder-icon">▱</span>
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
        ><div className="folder-row"><button className="folder-toggle" data-collapsed={collapsed.ungrouped === true} onClick={() => setCollapsed((current) => ({ ...current, ungrouped: !current.ungrouped }))} aria-label={collapsed.ungrouped ? "展开" : "折叠"}>›</button><span className="folder-icon">▱</span><button className="folder-name" onClick={() => setCollapsed((current) => ({ ...current, ungrouped: false }))}>未分组<small>{ungroupedHistory.length}</small></button></div><div className="folder-children-wrap" data-collapsed={collapsed.ungrouped === true}><div className="folder-children">{ungroupedHistory.map(renderConversation)}</div></div></div>}
      </div>
    </section>
    <footer className="sidebar-footer">
      <button onClick={onOpenSettings}><span className="model-status" data-ready={settings.hasApiKey} /><div><b>{settings.hasApiKey ? settings.model : "尚未连接模型"}</b><small>{settings.hasApiKey ? "API 已配置" : "设置 API 地址与 Token"}</small></div><span>›</span></button>
      <p>● 数据仅保存在本机</p>
    </footer>
  </aside>;
}

function ModelSettings({ settings, apiKey, busy, savedNotice, presetProviders, onApiKeyChange, onSettingsChange, onProviderChange, onModelChange, onSave, onClear }: {
  settings: TarotSettings;
  apiKey: string;
  busy: boolean;
  savedNotice: string;
  presetProviders: PresetProvider[];
  onApiKeyChange(value: string): void;
  onSettingsChange(value: TarotSettings): void;
  onProviderChange(type: string): void;
  onModelChange(model: string): void;
  onSave(): void;
  onClear(): void;
}) {
  const currentPreset = presetProviders.find((p) => p.type === settings.providerType);
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
    <div className="settings-heading"><p className="eyebrow">SETTINGS · MODELS</p><h1>模型连接</h1><p>选择一个提供商，或使用自定义 API 地址。运行时只把已确认的牌阵交给模型解释。</p></div>
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="provider-logo">
          {settings.providerType === "openai" ? "O" :
           settings.providerType === "minimax" || settings.providerType === "minimax-coding-plan" ? "M" :
           settings.providerType === "deepseek" ? "D" :
           settings.providerType === "siliconflow" ? "S" :
           settings.providerType === "qwen" ? "Q" :
           settings.providerType === "kimi" ? "K" :
           settings.providerType === "tencent" ? "H" :
           settings.providerType === "volcengine" ? "V" :
           settings.providerType === "stepfun" ? "F" :
           settings.providerType === "ollama" ? "Ol" :
           "AI"}
        </div>
        <div>
          <h2>{currentPreset?.label ?? "自定义 API"}</h2>
          <p>{currentPreset ? (currentPreset.category === "domestic" ? "国内模型" : currentPreset.category === "overseas" ? "海外模型" : "本地模型") : "OpenAI-compatible"}</p>
        </div>
        <span className="settings-status" data-ready={settings.hasApiKey}>{settings.hasApiKey ? "已连接" : "未配置"}</span>
      </div>
      <div className="settings-fields">
        {/* Provider 选择器 */}
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

        {/* 推荐模型下拉（仅当有推荐列表时） */}
        {recommendedModels.length > 0 && (
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

        <label><span>API 地址</span><small>填写到版本路径，例如 https://api.openai.com/v1</small><input value={settings.baseUrl} onChange={(event) => onSettingsChange({ ...settings, baseUrl: event.target.value })} spellCheck={false} /></label>
        <label><span>模型名称</span><small>服务端接受的实际 model ID</small><input value={settings.model} onChange={(event) => onSettingsChange({ ...settings, model: event.target.value })} spellCheck={false} /></label>
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
    <div className="security-note"><span>⌁</span><div><b>本地安全边界</b><p>API 地址和模型名保存在本地设置文件；Token 使用 Electron safeStorage 调用 Windows DPAPI 加密。前端只能知道"是否已配置"，无法读取明文。</p></div></div>
  </motion.section>;
}

function ReadingContent({ reading }: { reading: ReadingView }) {
  const result = reading.interpretation!;
  return <div className="reading-content">
    <section className="reading-hero"><span>整体脉络</span><p>{result.questionReflection}</p><p>{result.storyline}</p></section>
    <section><h2>五张牌如何连接</h2><div className="card-readings">{result.cards.map((item, index) => <article key={item.cardId}><i>{index + 1}</i><div><h3>{reading.revealed?.[index]?.card.name}</h3><p>{item.meaning}</p><p className="connection">{item.connectionToQuestion}</p></div></article>)}</div></section>
    <section className="two-column"><article><span>动量提示</span><p>{result.momentumInterpretation}</p></article><article><span>价值提示</span><p>{result.valueInterpretation}</p></article></section>
    <section className="advice"><h2>带回现实的行动</h2><ol>{result.actionAdvice.map((advice) => <li key={advice}>{advice}</li>)}</ol><blockquote>{result.reflectionQuestion}</blockquote></section>
    <p className="disclaimer">{result.disclaimer}</p>
  </div>;
}
