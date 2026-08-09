/**
 * Conversion-history tests against a real IndexedDB implementation
 * (fake-indexeddb — the only test-only dependency; justified because the
 * store's CRUD and cap behavior are the point).
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearHistory,
  loadAll,
  recordFromJob,
  recordToJobView,
  saveRecord,
  type HistoryRecord,
} from "./history";
import type { JobView } from "./useConverter";

const rec = (id: string, markdown: string, doneAt: number): HistoryRecord => ({
  id,
  name: `${id}.md`,
  size: markdown.length,
  kind: "md",
  markdown,
  chars: markdown.length,
  doneAt,
});

beforeEach(async () => {
  await clearHistory();
});

describe("history store CRUD", () => {
  it("saves and loads records, newest first", async () => {
    await saveRecord(rec("a", "# A", 100));
    await saveRecord(rec("b", "# B", 200));
    const all = await loadAll();
    expect(all.map((r) => r.id)).toEqual(["b", "a"]);
    await clearHistory();
    expect(await loadAll()).toEqual([]);
  });
});

describe("storage cap", () => {
  it("evicts the oldest records when the cap is exceeded", async () => {
    // 60-char records under a 120-byte cap: two fit exactly, three don't
    const md = "x".repeat(60);
    expect(await saveRecord(rec("a", md, 1), 120)).toBe(0);
    expect(await saveRecord(rec("b", md, 2), 120)).toBe(0);
    const evicted = await saveRecord(rec("c", md, 3), 120);
    expect(evicted).toBe(1); // exactly one over
    const all = await loadAll();
    expect(all.map((r) => r.id)).toEqual(["c", "b"]);
    expect(all.some((r) => r.id === "a")).toBe(false); // oldest gone
  });

  it("keeps everything under a generous default cap", async () => {
    await saveRecord(rec("a", "hello", 1));
    await saveRecord(rec("b", "world", 2));
    expect((await loadAll()).length).toBe(2);
  });
});

describe("record ↔ JobView mapping", () => {
  it("recordToJobView marks restored jobs and keeps the markdown", () => {
    const view = recordToJobView(rec("a", "# A\n\nbody", 100));
    expect(view.status).toBe("done");
    expect(view.restored).toBe(true);
    expect(view.markdown).toBe("# A\n\nbody");
    expect(view.file.name).toBe("a.md");
    expect(view.kind).toBe("md");
  });

  it("recordFromJob captures only finished jobs", () => {
    const done: JobView = {
      id: "x",
      file: new File(["# Hi"], "x.docx"),
      status: "done",
      format: "docx",
      markdown: "# Hi",
      chars: 4,
      ms: 12,
      startedAt: 1,
    };
    const record = recordFromJob(done);
    expect(record?.format).toBe("docx");
    expect(record?.kind).toBeUndefined();
    expect(recordFromJob({ ...done, status: "smelting" })).toBeNull();
    expect(recordFromJob({ ...done, markdown: undefined })).toBeNull();
  });
});
