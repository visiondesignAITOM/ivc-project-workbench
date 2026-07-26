"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";

type Status =
  | "backlog"
  | "ready"
  | "implementing"
  | "verify"
  | "blocked"
  | "done";
type Risk = "低" | "中" | "高";

type Task = {
  id: string;
  title: string;
  summary: string;
  status: Status;
  risk: Risk;
  owner: string;
  epic: string;
  story: string;
  team: string;
  due: string;
  gate?: string;
  evidence: string[];
  acceptance: string[];
};

const columns: { id: Status; label: string; hint: string }[] = [
  { id: "backlog", label: "待辦", hint: "尚未承諾" },
  { id: "ready", label: "就緒", hint: "可立即開始" },
  { id: "implementing", label: "進行中", hint: "WIP 上限 3" },
  { id: "verify", label: "驗證中", hint: "等待證據" },
  { id: "blocked", label: "受阻", hint: "需要排除" },
  { id: "done", label: "完成", hint: "已通過關卡" },
];

const seedTasks: Task[] = [
  {
    id: "TASK-096",
    title: "專案工作台第一版",
    summary: "建立可操作的看板與藍圖，讓任務狀態能回推工作層級進度。",
    status: "implementing",
    risk: "低",
    owner: "Codex",
    epic: "專案管理底座",
    story: "團隊可以在同一處掌握工作狀態",
    team: "產品",
    due: "07/28",
    evidence: ["看板可移動任務", "藍圖可檢視 Epic → Story → Task"],
    acceptance: ["六個狀態可更新", "進度依任務狀態自動計算", "手機可完成主要操作"],
  },
  {
    id: "TASK-095",
    title: "分類法保留包與釘選審查",
    summary: "辨識官方 XBRL 分類法保留包，準備人工釘選審查證據。",
    status: "verify",
    risk: "中",
    owner: "資料治理",
    epic: "來源會員治理",
    story: "審查者能確認分類法來源與版本",
    team: "資料",
    due: "07/27",
    gate: "等待人工確認",
    evidence: ["taxonomy-pin-review-package.md", "taxonomy-dictionary-extract.md"],
    acceptance: ["保留包雜湊可追溯", "釘選前維持不可寫入"],
  },
  {
    id: "TASK-094",
    title: "圖譜／報告發布關卡",
    summary: "避免 staging 證據被誤認為正式發布核准。",
    status: "blocked",
    risk: "高",
    owner: "發布治理",
    epic: "產品發布治理",
    story: "發布者能清楚辨識候選與正式資料",
    team: "治理",
    due: "待核准",
    gate: "安全與發布核准未完成",
    evidence: ["graph-report release gate", "Human H2 limited UAT"],
    acceptance: ["公開發布維持關閉", "候選資料不升級為 verified"],
  },
  {
    id: "TASK-093",
    title: "來源會員交接關卡包",
    summary: "把缺少的人工與證據關卡轉為清楚的下一步。",
    status: "done",
    risk: "中",
    owner: "資料治理",
    epic: "來源會員治理",
    story: "審查者能從單一交接包做決策",
    team: "資料",
    due: "07/23",
    evidence: ["s05-gate-bundle.md", "13/13 canary passed"],
    acceptance: ["列出所有阻擋項", "有效可寫入筆數維持 0"],
  },
  {
    id: "TASK-092",
    title: "Claim 治理長期藍圖",
    summary: "記錄 Claim 一級治理的分階段採用路徑與非目標。",
    status: "done",
    risk: "低",
    owner: "產品治理",
    epic: "產品發布治理",
    story: "團隊能區分現在邊界與長期架構",
    team: "產品",
    due: "07/23",
    evidence: ["CLAIM_GOVERNANCE_VISION.md"],
    acceptance: ["長期願景不成為當前阻擋", "候選資料邊界保持不變"],
  },
  {
    id: "TASK-091",
    title: "節點頁面深度盤點",
    summary: "盤點部分 DB 連線頁面，整理可逆的深化順序。",
    status: "ready",
    risk: "中",
    owner: "前台",
    epic: "產品體驗深化",
    story: "使用者能在節點頁取得一致且可信的資訊",
    team: "前台",
    due: "07/30",
    evidence: ["node-surface-deepening audit"],
    acceptance: ["不越過圖譜／報告發布關卡", "產出可執行的深化順序"],
  },
  {
    id: "TASK-090",
    title: "關係邊證據契約",
    summary: "建立 governed relationship-edge 證據契約。",
    status: "backlog",
    risk: "高",
    owner: "未指派",
    epic: "資料關係可信度",
    story: "分析者能追溯關係邊的來源與判定",
    team: "資料",
    due: "未排程",
    evidence: ["relationship-edge-harness"],
    acceptance: ["不寫入 verified graph edges", "證據缺口可見"],
  },
  {
    id: "TASK-089",
    title: "產品會員證據契約",
    summary: "準備產品會員關係的治理契約，不直接寫入資料列。",
    status: "backlog",
    risk: "中",
    owner: "未指派",
    epic: "資料關係可信度",
    story: "分析者能追溯產品與公司的會員關係",
    team: "資料",
    due: "未排程",
    evidence: ["product-membership-harness"],
    acceptance: ["不產生未審查會員列", "契約可由 canary 驗證"],
  },
  {
    id: "TASK-088",
    title: "公司頁資料子卡驗證",
    summary: "驗證公司頁能呈現候選資料，同時保留 candidate 邊界。",
    status: "ready",
    risk: "中",
    owner: "前台",
    epic: "產品體驗深化",
    story: "使用者能分辨公司資料的品質狀態",
    team: "前台",
    due: "07/29",
    evidence: ["company-subcards-harness"],
    acceptance: ["子卡顯示資料狀態", "不暴露受限所有權姓名"],
  },
];

const statusLabel = Object.fromEntries(
  columns.map((column) => [column.id, column.label]),
) as Record<Status, string>;

function progressFor(status: Status) {
  return {
    backlog: 0,
    ready: 15,
    implementing: 55,
    verify: 82,
    blocked: 45,
    done: 100,
  }[status];
}

function initials(owner: string) {
  if (owner === "Codex") return "CX";
  if (owner === "未指派") return "—";
  return owner.slice(0, 1);
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [view, setView] = useState<"board" | "blueprint">("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("全部");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("ivc-workbench-v1");
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem("ivc-workbench-v1");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ivc-workbench-v1", JSON.stringify(tasks));
  }, [tasks]);

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
        `${task.id} ${task.title} ${task.summary} ${task.epic} ${task.story}`
          .toLowerCase()
          .includes(query);
      const matchesTeam = team === "全部" || task.team === team;
      const matchesMine = !onlyMine || task.owner === "Codex";
      return matchesQuery && matchesTeam && matchesMine;
    });
  }, [tasks, search, team, onlyMine]);

  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const activeCount = tasks.filter((task) =>
    ["ready", "implementing", "verify"].includes(task.status),
  ).length;
  const totalProgress = Math.round(
    tasks.reduce((sum, task) => sum + progressFor(task.status), 0) / tasks.length,
  );

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
        epic: String(form.get("epic") ?? "專案管理底座"),
        story: "待規劃 User Story",
        team: "產品",
        due: "未排程",
        evidence: [],
        acceptance: ["補上驗收條件"],
      },
    ]);
    setShowAdd(false);
    setToast(`${nextId} 已加入待辦`);
  }

  const epicGroups = useMemo(() => {
    return [...new Set(visibleTasks.map((task) => task.epic))].map((epic) => {
      const epicTasks = visibleTasks.filter((task) => task.epic === epic);
      const stories = [...new Set(epicTasks.map((task) => task.story))].map(
        (story) => ({
          name: story,
          tasks: epicTasks.filter((task) => task.story === story),
        }),
      );
      const progress = Math.round(
        epicTasks.reduce((sum, task) => sum + progressFor(task.status), 0) /
          epicTasks.length,
      );
      return { epic, stories, progress, count: epicTasks.length };
    });
  }, [visibleTasks]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>IVC 工作台</strong>
            <small>Project OS · alpha</small>
          </div>
        </div>

        <nav aria-label="主要導覽">
          <p className="nav-label">工作空間</p>
          <button className="nav-item active" onClick={() => setMobileNav(false)}>
            <span className="nav-icon">⌂</span>
            工作台
            <span className="nav-count">{tasks.length}</span>
          </button>
          <button className="nav-item" onClick={() => setView("blueprint")}>
            <span className="nav-icon">◇</span>
            專案藍圖
          </button>
          <button className="nav-item" disabled>
            <span className="nav-icon">↗</span>
            變更紀錄
            <Pill tone="quiet">下一階段</Pill>
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
              setTeam("全部");
              setOnlyMine(false);
            }}
          >
            <span className="nav-icon">◎</span>
            清除篩選
          </button>
        </nav>

        <div className="side-plan">
          <div className="side-plan-head">
            <span>本期推進</span>
            <strong>{totalProgress}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${totalProgress}%` }} />
          </div>
          <p>先完成工作台，再展開全專案規劃與來源連動。</p>
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
            <strong>專案工作台</strong>
          </div>
          <div className="top-actions">
            <div className="sync-state" title="目前使用裝置本機儲存">
              <span />
              狀態已保存
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
            <div className="eyebrow">PROJECT CONTROL ROOM</div>
            <h1>把變更，變成可推進的工作</h1>
            <p>任務狀態更新後，藍圖進度會同步重算；先管理眼前工作，再展開全專案。</p>
          </div>
          <div className="view-switch" role="group" aria-label="檢視方式">
            <button
              className={view === "board" ? "selected" : ""}
              onClick={() => setView("board")}
            >
              看板
            </button>
            <button
              className={view === "blueprint" ? "selected" : ""}
              onClick={() => setView("blueprint")}
            >
              藍圖
            </button>
          </div>
        </section>

        <section className="metric-grid" aria-label="工作摘要">
          <article>
            <span className="metric-label">整體推進</span>
            <strong>{totalProgress}<small>%</small></strong>
            <div className="progress-track">
              <span style={{ width: `${totalProgress}%` }} />
            </div>
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
            <span className="metric-label">已完成</span>
            <strong>{doneCount}<small> / {tasks.length}</small></strong>
            <small>依任務狀態計算</small>
          </article>
        </section>

        <section className="toolbar" aria-label="看板工具">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜尋任務、Epic 或 User Story"
            />
          </label>
          <label className="select-wrap">
            <span>團隊</span>
            <select value={team} onChange={(event) => setTeam(event.target.value)}>
              <option>全部</option>
              <option>產品</option>
              <option>資料</option>
              <option>前台</option>
              <option>治理</option>
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

        {view === "board" ? (
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
                            <Pill tone="team">{task.team}</Pill>
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
        ) : (
          <section className="blueprint" aria-label="專案藍圖">
            <div className="blueprint-intro">
              <div>
                <span className="layer-tag layer-epic">EPIC</span>
                <span className="layer-line" />
                <span className="layer-tag layer-story">USER STORY</span>
                <span className="layer-line" />
                <span className="layer-tag layer-task">TASK</span>
              </div>
              <p>任務狀態是唯一進度來源；上層百分比會自動回推。</p>
            </div>
            <div className="epic-list">
              {epicGroups.map((group) => (
                <article className="epic-card" key={group.epic}>
                  <header>
                    <div>
                      <Pill tone="epic">EPIC</Pill>
                      <h2>{group.epic}</h2>
                      <p>{group.count} 個任務 · {group.stories.length} 個 User Story</p>
                    </div>
                    <div className="epic-progress">
                      <strong>{group.progress}%</strong>
                      <div className="progress-track">
                        <span style={{ width: `${group.progress}%` }} />
                      </div>
                    </div>
                  </header>
                  <div className="story-list">
                    {group.stories.map((story) => (
                      <section className="story-row" key={story.name}>
                        <div className="story-copy">
                          <Pill tone="story">STORY</Pill>
                          <strong>{story.name}</strong>
                        </div>
                        <div className="story-tasks">
                          {story.tasks.map((task) => (
                            <button
                              key={task.id}
                              onClick={() => setSelectedId(task.id)}
                              className={`story-task task-status-${task.status}`}
                            >
                              <span className="status-dot" />
                              <span>
                                <small>{task.id}</small>
                                <strong>{task.title}</strong>
                              </span>
                              <Pill tone="quiet">{statusLabel[task.status]}</Pill>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </article>
              ))}
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
                <p>{selected.summary}</p>
                <div className="summary-progress">
                  <span>完成度</span>
                  <strong>{progressFor(selected.status)}%</strong>
                  <div className="progress-track">
                    <span style={{ width: `${progressFor(selected.status)}%` }} />
                  </div>
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
                  <span>目標日</span>
                  <strong>{selected.due}</strong>
                </div>
              </div>
              {selected.gate && (
                <div className="drawer-gate">
                  <span>阻擋關卡</span>
                  <strong>{selected.gate}</strong>
                </div>
              )}
              <section className="hierarchy">
                <h3>工作脈絡</h3>
                <div>
                  <span className="layer-tag layer-epic">EPIC</span>
                  <strong>{selected.epic}</strong>
                </div>
                <span className="hierarchy-stem" />
                <div>
                  <span className="layer-tag layer-story">STORY</span>
                  <strong>{selected.story}</strong>
                </div>
              </section>
              <div className="drawer-sections">
                <section>
                  <h3>驗收條件</h3>
                  <ul>
                    {selected.acceptance.map((item) => (
                      <li key={item}>
                        <span>□</span>{item}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>證據與相關檔案</h3>
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
                <span>歸屬 Epic</span>
                <select name="epic" defaultValue="專案管理底座">
                  <option>專案管理底座</option>
                  <option>來源會員治理</option>
                  <option>產品發布治理</option>
                  <option>產品體驗深化</option>
                  <option>資料關係可信度</option>
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
