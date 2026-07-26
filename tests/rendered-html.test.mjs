import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the IVC project workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>IVC 專案工作台<\/title>/i);
  assert.match(html, /專案總覽/);
  assert.match(html, /工作看板/);
  assert.match(html, /積木架構/);
  assert.match(html, /TASK-105/);
  assert.match(html, /甘特圖/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("defines the eight requested architecture blocks", async () => {
  const source = await readFile(
    new URL("../app/project-plan.ts", import.meta.url),
    "utf8",
  );
  for (const block of [
    "介面",
    "前端",
    "資料",
    "後端",
    "AI",
    "自動化",
    "治理安全",
    "測試發布",
  ]) {
    assert.match(source, new RegExp(`name: "${block}"`));
  }
});

test("labels evidence basis and avoids invented completion percentages", async () => {
  const plan = await readFile(
    new URL("../app/project-plan.ts", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  for (const basis of ["已有證據", "未來規劃", "人工關卡"]) {
    assert.match(plan, new RegExp(`basis: "${basis}"`));
  }
  assert.doesNotMatch(page, /function progressFor/);
  assert.doesNotMatch(page, /block\.progress/);
});

test("defines four execution phases, milestones, and a critical path", async () => {
  const plan = await readFile(
    new URL("../app/project-plan.ts", import.meta.url),
    "utf8",
  );
  for (const phase of ["P0", "P1", "P2", "P3"]) {
    assert.match(plan, new RegExp(`id: "${phase}"`));
  }
  for (const milestone of ["M0", "M1", "M2", "M3"]) {
    assert.match(plan, new RegExp(`id: "${milestone}"`));
  }
  assert.match(plan, /export const criticalPath/);
  assert.match(plan, /"TASK-105"[\s\S]*"TASK-117"/);
});

test("does not use decorative vertical accent lines", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(css, /\.column-head::before/);
  assert.doesNotMatch(css, /\.architecture-block::before/);
  assert.doesNotMatch(css, /border-left:\s*3px\s+solid/);
  assert.doesNotMatch(css, /block-task-\w+\s*\{\s*border-left-color/);
});

test("keeps primary mobile controls readable and touch friendly", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /-webkit-text-size-adjust:\s*100%/);
  assert.match(css, /\.view-switch button[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.phase-tasks button[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?\.metric-grid[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.gantt-scroll::before[\s\S]*左右滑動查看完整時程/);
});

test("keeps the overview metrics aligned and the critical path responsive", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.metric-grid article,\s*\n\.metric-grid article:first-child[\s\S]*?display:\s*flex/);
  assert.match(css, /\.critical-chain[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?\.critical-chain\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(page, /className="critical-step"/);
  assert.doesNotMatch(page, /criticalTasks\.length - 1[\s\S]*?<i>→<\/i>/);
});

test("includes a GitHub Pages static deployment workflow", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
  const config = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /NEXT_PUBLIC_BASE_PATH:\s*\/ivc-project-workbench/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /unoptimized:\s*true/);
});
