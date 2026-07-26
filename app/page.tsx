"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  architectureBlocks,
  architectureOrder,
  columns,
  criticalPath,
  planMilestones,
  planPhases,
  seedTasks,
  timeline,
  type Architecture,
  type Risk,
  type Status,
  type Task,
} from "./project-plan";

const statusLabel = Object.fromEntries(
  columns.map((column) => [column.id, column.label]),
) as Record<Status, string>;

const STORAGE_KEY = "ivc-workbench-v3";
const PLAN_REVISION = "2026-07-26-evidence-labelled-plan-1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type View = "overview" | "board" | "architecture" | "gantt";

const viewCopy: Record<View, { eyebrow: string; title: string; summary: string }> = {
  overview: {
    eyebrow: "PROJECT OVERVIEW",
    title: "專案總覽",
    summary: "先看整體進度與風險，再決定要進入哪一個工作頁。",
  },
  board: {
    eyebrow: "WORK BOARD",
    title: "工作看板",
    summary: "只處理任務狀態：待辦、就緒、進行、驗證、受阻與完成。",
  },
  architecture: {
    eyebrow: "SYSTEM BUILDING BLOCKS",
    title: "積木架構",
    summary: "用 8 個積木看懂整個系統、目前工作與下一步。",
  },
  gantt: {
    eyebrow: "PROJECT TIMELINE",
    title: "甘特圖",
    summary: "依日期與前置工作掌握未來兩個月的推進順序。",
  },
};

function initials(owner: string) {
  if (owner === "Codex") return "CX";
  if (owner === "未指派") return "—";
  return owner.slice(0, 1);
}

function shortDate(value: string) {
  const [, month, day] = value.split(/[-/]/);
  return `${Number(month)}/${Number(day)}`;
}

function dateNumber(value: string) {
  return new Date(`${value}T00:00:00+08:00`).getTime();
}

function ganttPosition(task: Task) {
  const range = dateNumber(timeline.end) - dateNumber(timeline.start);
  const start = Math.max(dateNumber(task.start), dateNumber(timeline.start));
  const end = Math.min(dateNumber(task.due), dateNumber(timeline.end));
  const left = ((start - dateNumber(timeline.start)) / range) * 100;
  const width = Math.max(((end - start) / range) * 100, 1.8);
  return { left: `${left}%`, width: `${width}%` };
}

function timelinePercent(value: string) {
  const range = dateNumber(timeline.end) - dateNumber(timeline.start);
  return `${((dateNumber(value) - dateNumber(timeline.start)) / range) * 100}%`;
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [architecture, setArchitecture] = useState<"全部" | Architecture>("全部");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          revision?: string;
          tasks?: Task[];
        };
        if (
          parsed.revision === PLAN_REVISION &&
          parsed.tasks?.some((task) => task.id === "TASK-117") &&
          parsed.tasks.every(
            (task) =>
              task.architecture &&
              task.basis &&
              task.start &&
              task.due,
          )
        ) {
          setTasks(parsed.tasks);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ revision: PLAN_REVISION, tasks }),
    );
  }, [storageReady, tasks]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setShowAdd(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesQuery =
        !query ||
        `${task.id} ${task.title} ${task.summary} ${task.epic} ${task.story} ${task.architecture}`
          .toLowerCase()
          .includes(query);
      const matchesArchitecture =
        architecture === "全部" || task.architecture === architecture;
      const matchesMine = !onlyMine || task.owner === "Codex";
      return matchesQuery && matchesArchitecture && matchesMine;
    });
  }, [tasks, search, architecture, onlyMine]);

  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const activeCount = tasks.filter((task) =>
    ["ready", "implementing", "verify"].includes(task.status),
  ).length;
  const evidenceCount = tasks.filter((task) => task.basis === "已有證據").length;

  function moveTask(id: string, status: Status) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;
    setTasks((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    setToast(`${id} 已移至「${statusLabel[status]}」`);
  }

  function handleDrop(event: DragEvent, status: Status) {
    event.preventDefault();
    if (dragId.current) moveTask(dragId.current, status);
    dragId.current = null;
  }

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    const numericIds = tasks.map((task) => Number(task.id.replace(/\D/g, "")));
    const nextId = `TASK-${String(Math.max(...numericIds) + 1).padStart(3, "0")}`;
    setTasks((current) => [
      ...current,
      {
        id: nextId,
        title,
        summary: String(form.get("summary") ?? "尚待補充任務說明"),
        status: "backlog",
        risk: form.get("risk") as Risk,
        owner: "未指派",
        epic: String(form.get("epic") ?? "專案管理與決策"),
        story: "待補上使用者成果",
        architecture: form.get("architecture") as Architecture,
        basis: "未來規劃",
        start: timeline.today,
        due: String(form.get("due") ?? timeline.today),
        dependencies: [],
        evidence: [],
        acceptance: ["補上驗收條件"],
      },
    ]);
    setShowAdd(false);
    setToast(`${nextId} 已加入待辦`);
  }

  const architectureGroups = useMemo(
    () =>
      architectureBlocks
        .filter(
          (block) =>
            architecture === "全部" || block.name === architecture,
        )
        .map((block) => {
          const allTasks = tasks.filter(
            (task) => task.architecture === block.name,
          );
          const filteredTasks = visibleTasks.filter(
            (task) => task.architecture === block.name,
          );
          return {
            ...block,
            tasks: filteredTasks,
            done: allTasks.filter((task) => task.status === "done").length,
            evidence: allTasks.filter((task) => task.basis === "已有證據").length,
            planned: allTasks.filter((task) => task.basis === "未來規劃").length,
            gates: allTasks.filter((task) => task.basis === "人工關卡").length,
            total: allTasks.length,
          };
        }),
    [architecture, tasks, visibleTasks],
  );

  const phaseGroups = useMemo(
    () =>
      planPhases.map((phase) => {
        const phaseTasks = phase.taskIds
          .map((id) => tasks.find((task) => task.id === id))
          .filter((task): task is Task => Boolean(task));
        const phaseDone = phaseTasks.filter(
          (task) => task.status === "done",
        ).length;
        const phaseStatus: Status =
          phaseDone === phaseTasks.length
            ? "done"
            : phaseTasks.some((task) => task.status === "implementing")
              ? "implementing"
              : phaseTasks.some((task) => task.status === "ready")
                ? "ready"
                : phaseTasks.some((task) => task.status === "blocked")
                  ? "blocked"
                  : "backlog";
        return {
          ...phase,
          tasks: phaseTasks,
          done: phaseDone,
          total: phaseTasks.length,
          status: phaseStatus,
        };
      }),
    [tasks],
  );

  const criticalTasks = criticalPath
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task));

  const ganttGroups = useMemo(
    () =>
      architectureOrder
        .map((name) => ({
          name,
          tasks: visibleTasks
            .filter((task) => task.architecture === name)
            .sort((a, b) => dateNumber(a.start) - dateNumber(b.start)),
        }))
        .filter((group) => group.tasks.length),
    [visibleTasks],
  );

  const ganttMonths = [
    { label: "7 月", width: "16.67%" },
    { label: "8 月", width: "46.97%" },
    { label: "9 月", width: "36.36%" },
  ];

  const ganttWeeks = ["7/21", "7/27", "8/3", "8/10", "8/17", "8/24", "8/31", "9/7", "9/14", "9/21"];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-symbol">
            <Image
              src={`${BASE_PATH}/ivc-logo-on-dark.svg`}
              alt="IVC"
              width={72}
              height={27}
              priority
            />
          </div>
          <div className="brand-copy">
            <strong>專案工作台</strong>
            <small>IVC INTELLIGENCE</small>
          </div>
        </div>

        <nav aria-label="主要導覽">
          <p className="nav-label">工作空間</p>
          <button
            className={`nav-item ${view === "overview" ? "active" : ""}`}
            onClick={() => {
              setView("overview");
              setMobileNav(false);
            }}
          >
            <span className="nav-icon">⌂</span>
            專案總覽
            <span className="nav-count">{tasks.length}</span>
          </button>
          <button
            className={`nav-item ${view === "board" ? "active" : ""}`}
            onClick={() => {
              setView("board");
              setMobileNav(false);
            }}
          >
            <span className="nav-icon">▤</span>
            工作看板
          </button>
          <button
            className={`nav-item ${view === "architecture" ? "active" : ""}`}
            onClick={() => {
              setView("architecture");
              setMobileNav(false);
            }}
          >
            <span className="nav-icon">▦</span>
            積木架構
          </button>
          <button
            className={`nav-item ${view === "gantt" ? "active" : ""}`}
            onClick={() => {
              setView("gantt");
              setMobileNav(false);
            }}
          >
            <span className="nav-icon">▥</span>
            甘特圖
          </button>

          <p className="nav-label">快速篩選</p>
          <button
            className={`nav-item ${onlyMine ? "active-secondary" : ""}`}
            onClick={() => setOnlyMine((value) => !value)}
          >
            <span className="avatar avatar-small">CX</span>
            我的任務
            <span className="nav-count">
              {tasks.filter((task) => task.owner === "Codex").length}
            </span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              setSearch("");
              setArchitecture("全部");
              setOnlyMine(false);
            }}
          >
            <span className="nav-icon">◎</span>
            清除篩選
          </button>
        </nav>

        <div className="side-plan">
          <div className="side-plan-head">
            <span>已完成工作</span>
            <strong>{doneCount} / {tasks.length}</strong>
          </div>
          <p>目前先完成獨立審查與安全關卡，再啟動下一條價值鏈。</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="開啟導覽"
            onClick={() => setMobileNav(true)}
          >
            ☰
          </button>
          <div className="breadcrumb">
            <span>IVC 產業價值鏈資訊平台</span>
            <b>/</b>
            <strong>{viewCopy[view].title}</strong>
          </div>
          <div className="top-actions">
            <div className="sync-state" title="目前使用裝置本機儲存">
              <span />
              本機已保存
            </div>
            <button className="primary-button" onClick={() => setShowAdd(true)}>
              <span>＋</span> 新增任務
            </button>
            <button className="avatar" aria-label="使用者選單">
              VX
            </button>
          </div>
        </header>

        <section className="page-head">
          <div>
            <div className="eyebrow">{viewCopy[view].eyebrow}</div>
            <h1>{viewCopy[view].title}</h1>
            <p>{viewCopy[view].summary}</p>
          </div>
          <div className="view-switch" role="group" aria-label="檢視方式">
            <button
              className={view === "overview" ? "selected" : ""}
              onClick={() => setView("overview")}
            >
              總覽
            </button>
            <button
              className={view === "board" ? "selected" : ""}
              onClick={() => setView("board")}
            >
              看板
            </button>
            <button
              className={view === "architecture" ? "selected" : ""}
              onClick={() => setView("architecture")}
            >
              架構
            </button>
            <button
              className={view === "gantt" ? "selected" : ""}
              onClick={() => setView("gantt")}
            >
              甘特圖
            </button>
          </div>
        </section>

        {view === "overview" && (
          <section className="metric-grid" aria-label="工作摘要">
            <article>
              <span className="metric-label">全部工作</span>
              <strong>{tasks.length}</strong>
              <small>包含已有證據與未來規劃</small>
            </article>
            <article>
              <span className="metric-label">進行中</span>
              <strong>{activeCount}</strong>
              <small>包含就緒與驗證</small>
            </article>
            <article>
              <span className="metric-label">待排除</span>
              <strong className={blockedCount ? "danger-text" : ""}>
                {blockedCount}
              </strong>
              <small>發布關卡需決策</small>
            </article>
            <article>
              <span className="metric-label">已有證據</span>
              <strong>{evidenceCount}</strong>
              <small>有 repository 或本機成果可核對</small>
            </article>
          </section>
        )}

        {view !== "overview" && (
        <section className="toolbar" aria-label="工作篩選工具">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜尋任務、工作成果或架構分類"
            />
          </label>
          <label className="select-wrap">
            <span>架構</span>
            <select
              value={architecture}
              onChange={(event) =>
                setArchitecture(event.target.value as "全部" | Architecture)
              }
            >
              <option>全部</option>
              {architectureOrder.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            className={`filter-button ${onlyMine ? "filter-active" : ""}`}
            onClick={() => setOnlyMine((value) => !value)}
            aria-pressed={onlyMine}
          >
            我的任務
          </button>
          <span className="result-count">{visibleTasks.length} 項工作</span>
        </section>
        )}

        {view === "overview" ? (
          <div className="master-plan">
            <section className="plan-baseline" aria-label="規劃基準">
              <div>
                <span className="eyebrow">PLANNING BASELINE</span>
                <h2>規劃基準與可信度</h2>
                <p>已完成成果以 repository 與測試為準；人工關卡表示確實被阻擋；未來日期只是建議排程。</p>
              </div>
              <dl>
                <div>
                  <dt>資料日期</dt>
                  <dd>2026/07/26</dd>
                </div>
                <div>
                  <dt>Repository</dt>
                  <dd>main 89f34e8f</dd>
                </div>
                <div>
                  <dt>規劃範圍</dt>
                  <dd>TASK-097—117</dd>
                </div>
                <div>
                  <dt>發布狀態</dt>
                  <dd>未授權</dd>
                </div>
              </dl>
            </section>

            <section className="plan-section" aria-labelledby="phase-title">
              <header>
                <div>
                  <span className="eyebrow">EXECUTION PHASES</span>
                  <h2 id="phase-title">四個執行階段</h2>
                </div>
                <p>每一階段必須符合退出條件，才能進入下一階段。</p>
              </header>
              <div className="phase-grid">
                {phaseGroups.map((phase) => (
                  <article className="phase-card" key={phase.id}>
                    <header>
                      <div>
                        <span className="phase-id">{phase.id}</span>
                        <h3>{phase.title}</h3>
                        <small>{phase.period}</small>
                      </div>
                      <div className="phase-count">
                        <strong>{phase.done}/{phase.total}</strong>
                        <span>{statusLabel[phase.status]}</span>
                      </div>
                    </header>
                    <p>{phase.outcome}</p>
                    <div className="phase-basis">
                      <Pill
                        tone={
                          phase.basis === "已有證據"
                            ? "evidence"
                            : phase.basis === "人工關卡"
                              ? "gate"
                              : "plan"
                        }
                      >
                        {phase.basis}
                      </Pill>
                    </div>
                    <div className="phase-tasks">
                      {phase.tasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedId(task.id)}
                          title={task.title}
                        >
                          {task.id.replace("TASK-", "")}
                        </button>
                      ))}
                    </div>
                    <details>
                      <summary>退出條件</summary>
                      <ul>
                        {phase.exitCriteria.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
            </section>

            <section className="plan-two-column">
              <article className="critical-path">
                <header>
                  <span className="eyebrow">CRITICAL PATH</span>
                  <h2>關鍵路徑</h2>
                  <p>任一項延遲，都會直接推遲最後的發布決策。</p>
                </header>
                <div className="critical-chain">
                  {criticalTasks.map((task, index) => (
                    <span key={task.id}>
                      <button onClick={() => setSelectedId(task.id)}>
                        <small>{task.id}</small>
                        <strong>{task.title}</strong>
                      </button>
                      {index < criticalTasks.length - 1 && <i>→</i>}
                    </span>
                  ))}
                </div>
              </article>

              <article className="milestone-list">
                <header>
                  <span className="eyebrow">MILESTONES</span>
                  <h2>里程碑與決策點</h2>
                  <p>日期為規劃日期；只有 M0 已有完成證據。</p>
                </header>
                <div>
                  {planMilestones.map((milestone) => (
                    <button
                      key={milestone.id}
                      onClick={() => setSelectedId(milestone.taskIds[0])}
                    >
                      <span>{milestone.id}</span>
                      <time>{shortDate(milestone.date)}</time>
                      <strong>{milestone.title}</strong>
                      <Pill
                        tone={
                          milestone.basis === "已有證據"
                            ? "evidence"
                            : milestone.basis === "人工關卡"
                              ? "gate"
                              : "plan"
                        }
                      >
                        {milestone.basis}
                      </Pill>
                    </button>
                  ))}
                </div>
              </article>
            </section>
          </div>
        ) : view === "board" ? (
          <section className="board" aria-label="專案工作看板">
            {columns.map((column) => {
              const list = visibleTasks.filter((task) => task.status === column.id);
              return (
                <div
                  className={`board-column column-${column.id}`}
                  key={column.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, column.id)}
                >
                  <div className="column-head">
                    <div>
                      <span className="status-dot" />
                      <h2>{column.label}</h2>
                      <span className="column-count">{list.length}</span>
                    </div>
                    <small>{column.hint}</small>
                  </div>
                  <div className="column-body">
                    {list.map((task) => (
                      <button
                        className="task-card"
                        key={task.id}
                        draggable
                        onDragStart={() => {
                          dragId.current = task.id;
                        }}
                        onClick={() => setSelectedId(task.id)}
                      >
                        <div className="task-topline">
                          <span>{task.id}</span>
                          <span className="drag-handle" aria-hidden="true">•••</span>
                        </div>
                        <strong>{task.title}</strong>
                        <p>{task.summary}</p>
                        {task.gate && (
                          <div className="gate-note">
                            <span>!</span>
                            {task.gate}
                          </div>
                        )}
                        <div className="task-meta">
                          <div>
                            <Pill tone={`risk-${task.risk}`}>風險 {task.risk}</Pill>
                            <Pill tone="architecture">{task.architecture}</Pill>
                          </div>
                          <span className="avatar avatar-small" title={task.owner}>
                            {initials(task.owner)}
                          </span>
                        </div>
                      </button>
                    ))}
                    {list.length === 0 && (
                      <div className="empty-state">
                        <span>○</span>
                        <p>目前沒有任務</p>
                        <button onClick={() => setShowAdd(true)}>新增一項</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ) : view === "architecture" ? (
          <section className="architecture-board" aria-label="系統積木架構">
            <div className="architecture-flow">
              <div>
                <span className="eyebrow">HOW THE SYSTEM WORKS</span>
                <h2>八個積木，共同組成 IVC</h2>
                <p>資料與後端提供底座，AI 和自動化提高處理能力，前端與介面交付給使用者；治理安全與測試發布保護整條路徑。</p>
                <div className="evidence-basis">
                  <span><b>資料基準</b> 2026/07/26</span>
                  <span><b>Repository</b> main 89f34e8f</span>
                  <span><b>數字定義</b> 僅計算工作項目，不代表系統完成率</span>
                </div>
              </div>
              <div className="flow-line" aria-label="主要資料流">
                {["資料", "後端", "AI", "自動化", "前端", "介面"].map(
                  (item, index, items) => (
                    <span key={item}>
                      <b>{item}</b>
                      {index < items.length - 1 && <i>→</i>}
                    </span>
                  ),
                )}
              </div>
              <div className="flow-guard">
                <span>治理安全：全程限制什麼可以做</span>
                <span>測試發布：最後確認什麼可以交付</span>
              </div>
            </div>

            {(["使用體驗層", "資料智慧層", "信任交付層"] as const).map(
              (layer) => {
                const blocks = architectureGroups.filter(
                  (block) => block.layer === layer,
                );
                if (!blocks.length) return null;
                return (
                  <section className="architecture-layer" key={layer}>
                    <header>
                      <div>
                        <span>{layer}</span>
                        <h2>
                          {layer === "使用體驗層"
                            ? "使用者直接看見與操作的部分"
                            : layer === "資料智慧層"
                              ? "讓資料可以累積、研究與運轉的核心"
                              : "確保資料可信、系統安全、交付可回復"}
                        </h2>
                      </div>
                    </header>
                    <div className="architecture-grid">
                      {blocks.map((block) => (
                        <article
                          className={`architecture-block block-${block.code.toLowerCase()}`}
                          key={block.name}
                        >
                          <header>
                            <div>
                              <span className="block-code">{block.code}</span>
                              <h3>{block.name}</h3>
                            </div>
                            <div className="block-progress">
                              <strong>{block.done}/{block.total}</strong>
                              <span>工作已完成</span>
                            </div>
                          </header>
                          <p className="block-purpose">{block.purpose}</p>
                          <div className="block-basis-counts">
                            <span>已有證據 {block.evidence}</span>
                            <span>未來規劃 {block.planned}</span>
                            <span>人工關卡 {block.gates}</span>
                          </div>
                          <div className="block-includes">
                            {block.includes.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                          <div className="block-dependency">
                            <span>需要的積木</span>
                            <strong>
                              {block.dependsOn.length
                                ? block.dependsOn.join("、")
                                : "它是整個系統的共同底線"}
                            </strong>
                          </div>
                          <div className="block-task-list">
                            <span className="block-list-label">目前工作</span>
                            {block.tasks.length ? (
                              block.tasks.map((task) => (
                                <button
                                  key={task.id}
                                  onClick={() => setSelectedId(task.id)}
                                  className={`block-task block-task-${task.status}`}
                                >
                                  <span>
                                    <small>{task.id}</small>
                                    <strong>{task.title}</strong>
                                  </span>
                                  <span className="block-task-tags">
                                    <Pill
                                      tone={
                                        task.basis === "已有證據"
                                          ? "evidence"
                                          : task.basis === "人工關卡"
                                            ? "gate"
                                            : "plan"
                                      }
                                    >
                                      {task.basis}
                                    </Pill>
                                    <Pill tone="quiet">{statusLabel[task.status]}</Pill>
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="block-empty">目前篩選條件下沒有工作。</p>
                            )}
                          </div>
                          <footer>
                            <span>下一步</span>
                            <strong>{block.next}</strong>
                          </footer>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              },
            )}
          </section>
        ) : (
          <section className="gantt" aria-label="專案甘特圖">
            <div className="gantt-intro">
              <div>
                <span className="eyebrow">LOCAL PLAN · 2026/07—09</span>
                <h2>這一版排程先解決「能不能安全往下走」</h2>
                <p>紅色工作不是正在執行，而是等待人工決策；通過前不會進入公開發布。</p>
              </div>
              <div className="gantt-legend" aria-label="甘特圖狀態圖例">
                {columns.map((column) => (
                  <span key={column.id} className={`legend-${column.id}`}>
                    <i />
                    {column.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="gantt-scroll">
              <div className="gantt-chart">
                <div className="gantt-header gantt-grid-row">
                  <div className="gantt-label-cell">
                    <strong>工作與架構</strong>
                    <small>點選工作查看白話重點與證據</small>
                  </div>
                  <div className="gantt-time-head">
                    <div className="gantt-months">
                      {ganttMonths.map((month) => (
                        <span key={month.label} style={{ width: month.width }}>
                          {month.label}
                        </span>
                      ))}
                    </div>
                    <div className="gantt-weeks">
                      {ganttWeeks.map((week) => (
                        <span key={week}>{week}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {ganttGroups.map((group) => (
                  <section className="gantt-group" key={group.name}>
                    <header className="gantt-group-head">
                      <strong>{group.name}</strong>
                      <span>{group.tasks.length} 項工作</span>
                    </header>
                    {group.tasks.map((task) => (
                      <div className="gantt-grid-row gantt-task-row" key={task.id}>
                        <button
                          className="gantt-task-copy"
                          onClick={() => setSelectedId(task.id)}
                        >
                          <span>{task.id}</span>
                          <strong>{task.title}</strong>
                          <small>
                            {shortDate(task.start)}—{shortDate(task.due)}
                            {task.dependencies.length
                              ? ` · 前置 ${task.dependencies.join("、")}`
                              : " · 無前置工作"}
                          </small>
                        </button>
                        <div className="gantt-track">
                          <span
                            className="gantt-today"
                            style={{ left: timelinePercent(timeline.today) }}
                            aria-label="今天"
                          />
                          <button
                            className={`gantt-bar gantt-bar-${task.status}`}
                            style={ganttPosition(task)}
                            onClick={() => setSelectedId(task.id)}
                            title={`${task.id} ${task.title}，${statusLabel[task.status]}`}
                          >
                            <span>{task.title}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {mobileNav && (
        <button
          className="scrim nav-scrim"
          aria-label="關閉導覽"
          onClick={() => setMobileNav(false)}
        />
      )}

      {selected && (
        <div className="modal-layer" role="presentation">
          <button
            className="scrim"
            aria-label="關閉任務詳情"
            onClick={() => setSelectedId(null)}
          />
          <section
            className="task-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-title"
          >
            <header className="drawer-head">
              <div>
                <span className="drawer-id">{selected.id}</span>
                <h2 id="task-title">{selected.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="關閉"
                onClick={() => setSelectedId(null)}
              >
                ×
              </button>
            </header>
            <div className="drawer-body">
              <div className="drawer-summary">
                <span className="drawer-kicker">白話重點</span>
                <p>{selected.summary}</p>
                <div className="summary-basis">
                  <span>資料性質</span>
                  <Pill
                    tone={
                      selected.basis === "已有證據"
                        ? "evidence"
                        : selected.basis === "人工關卡"
                          ? "gate"
                          : "plan"
                    }
                  >
                    {selected.basis}
                  </Pill>
                  <small>
                    {selected.basis === "已有證據"
                      ? "可由任務文件、Git 或本機成果核對。"
                      : selected.basis === "人工關卡"
                        ? "阻擋狀態有文件依據，但仍需要人工作出決定。"
                        : "這是依前置工作安排的建議，不是已承諾日期。"}
                  </small>
                </div>
              </div>
              <div className="field-grid">
                <label>
                  <span>階段</span>
                  <select
                    value={selected.status}
                    onChange={(event) =>
                      moveTask(selected.id, event.target.value as Status)
                    }
                  >
                    {columns.map((column) => (
                      <option value={column.id} key={column.id}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span>負責人</span>
                  <strong>{selected.owner}</strong>
                </div>
                <div>
                  <span>風險</span>
                  <Pill tone={`risk-${selected.risk}`}>{selected.risk}風險</Pill>
                </div>
                <div>
                  <span>架構分類</span>
                  <strong>{selected.architecture}</strong>
                </div>
                <div>
                  <span>開始日</span>
                  <strong>{shortDate(selected.start)}</strong>
                </div>
                <div>
                  <span>目標日</span>
                  <strong>{shortDate(selected.due)}</strong>
                </div>
              </div>
              {selected.gate && (
                <div className="drawer-gate">
                  <span>為什麼現在不能往下走</span>
                  <strong>{selected.gate}</strong>
                </div>
              )}
              <section className="hierarchy">
                <h3>這項工作屬於哪裡</h3>
                <div>
                  <span className="layer-tag layer-epic">專案主題</span>
                  <strong>{selected.epic}</strong>
                </div>
                <span className="hierarchy-stem" />
                <div>
                  <span className="layer-tag layer-story">完成後的成果</span>
                  <strong>{selected.story}</strong>
                </div>
              </section>
              <div className="drawer-sections">
                <section>
                  <h3>前置工作</h3>
                  {selected.dependencies.length ? (
                    <ul>
                      {selected.dependencies.map((item) => (
                        <li key={item}>
                          <span>→</span>{item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">沒有前置工作，可以獨立安排。</p>
                  )}
                </section>
                <section>
                  <h3>做到什麼才算完成</h3>
                  <ul>
                    {selected.acceptance.map((item) => (
                      <li key={item}>
                        <span>□</span>{item}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>依據與相關檔案</h3>
                  {selected.evidence.length ? (
                    <ul>
                      {selected.evidence.map((item) => (
                        <li key={item}>
                          <span>↗</span>{item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">尚未掛上證據，進入驗證前需要補齊。</p>
                  )}
                </section>
              </div>
            </div>
            <footer className="drawer-footer">
              <span>變更會同步更新看板與藍圖</span>
              <button className="primary-button" onClick={() => setSelectedId(null)}>
                完成
              </button>
            </footer>
          </section>
        </div>
      )}

      {showAdd && (
        <div className="modal-layer">
          <button className="scrim" aria-label="取消新增" onClick={() => setShowAdd(false)} />
          <form className="add-dialog" onSubmit={createTask}>
            <header>
              <div>
                <span className="drawer-id">QUICK CREATE</span>
                <h2>新增工作任務</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowAdd(false)}>
                ×
              </button>
            </header>
            <label>
              <span>任務名稱</span>
              <input name="title" autoFocus required placeholder="例：整理全專案 Epic 清單" />
            </label>
            <label>
              <span>一句話說明</span>
              <textarea name="summary" rows={3} placeholder="這項工作完成後，會帶來什麼結果？" />
            </label>
            <div className="form-row">
              <label>
                <span>歸屬專案主題</span>
                <select name="epic" defaultValue="專案管理與決策">
                  <option>專案管理與決策</option>
                  <option>公司黃金頁產品化</option>
                  <option>規模化資料與公司頁</option>
                  <option>資料可信度與計算</option>
                  <option>下一條價值鏈擴張</option>
                  <option>品質與發布治理</option>
                </select>
              </label>
              <label>
                <span>風險</span>
                <select name="risk" defaultValue="低">
                  <option>低</option>
                  <option>中</option>
                  <option>高</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>架構分類</span>
                <select name="architecture" defaultValue="介面">
                  {architectureOrder.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>目標日</span>
                <input name="due" type="date" defaultValue={timeline.today} />
              </label>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setShowAdd(false)}>
                取消
              </button>
              <button className="primary-button">加入待辦</button>
            </footer>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
