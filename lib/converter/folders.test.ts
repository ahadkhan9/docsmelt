/**
 * Folder-drop walker tests — mocked FileSystemEntry trees.
 */
import { describe, expect, it } from "vitest";
import { getDroppedFiles } from "./folders";

interface FakeEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (cb: (f: File) => void, err?: () => void) => void;
  createReader?: () => { readEntries: (cb: (e: FakeEntry[]) => void, err?: () => void) => void };
}

const fakeFile = (name: string, fullPath: string): FakeEntry => ({
  isFile: true,
  isDirectory: false,
  name,
  fullPath,
  file: (cb) => cb(new File(["x"], name)),
});

function fakeDir(name: string, fullPath: string, children: FakeEntry[], loopTo?: string): FakeEntry {
  let batch = children;
  return {
    isFile: false,
    isDirectory: true,
    name,
    fullPath,
    createReader: () => ({
      readEntries: (cb) => {
        const current = batch;
        batch = [];
        // simulate the batched readEntries contract: two batches then done
        if (current.length > 0) cb(current);
        else if (loopTo) cb([{ ...fakeDir("loop", loopTo, []) }]);
        else cb([]);
      },
    }),
  };
}

const fakeDataTransfer = (items: Array<{ kind: string; entry?: FakeEntry }>, files: File[] = []) =>
  ({
    items: items.map((i) => ({ kind: i.kind, webkitGetAsEntry: () => i.entry })),
    files,
  }) as unknown as DataTransfer;

describe("getDroppedFiles", () => {
  it("walks nested directories recursively, batched reads included", async () => {
    const dt = fakeDataTransfer([
      {
        kind: "file",
        entry: fakeDir("docs", "/docs", [
          fakeFile("a.md", "/docs/a.md"),
          fakeDir("sub", "/docs/sub", [fakeFile("b.docx", "/docs/sub/b.docx")]),
        ]),
      },
      { kind: "file", entry: fakeFile("c.pdf", "/c.pdf") },
    ]);
    const result = await getDroppedFiles(dt);
    expect(result.files.map((f) => f.name).sort()).toEqual(["a.md", "b.docx", "c.pdf"]);
    expect(result.folders).toBe(2);
    expect(result.foldersUnsupported).toBe(false);
  });

  it("skips empty and unreadable directories without failing", async () => {
    const broken = fakeDir("broken", "/broken", [fakeFile("x.txt", "/broken/x.txt")]);
    // simulate readEntries error
    broken.createReader = () => ({
      readEntries: (_cb, err) => err && err(),
    });
    const dt = fakeDataTransfer([
      { kind: "file", entry: fakeDir("empty", "/empty", []) },
      { kind: "file", entry: broken },
    ]);
    const result = await getDroppedFiles(dt);
    expect(result.files.length).toBe(0);
    expect(result.folders).toBe(2);
  });

  it("protects against directory cycles", async () => {
    const dt = fakeDataTransfer([
      { kind: "file", entry: fakeDir("root", "/root", [], "/root") },
    ]);
    const result = await getDroppedFiles(dt);
    expect(result.files.length).toBe(0);
    // cycle must terminate
    expect(result.folders).toBe(1);
  });

  it("falls back to flat files when folder enumeration is unsupported", async () => {
    // simulate Firefox: file items without webkitGetAsEntry
    const dt = {
      items: [{ kind: "file" }],
      files: [new File(["a"], "a.md"), new File(["b"], "b.pdf")],
    } as unknown as DataTransfer;
    const result = await getDroppedFiles(dt);
    expect(result.files.length).toBe(2);
    expect(result.foldersUnsupported).toBe(true);
  });
});
