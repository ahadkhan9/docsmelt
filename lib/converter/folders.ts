/**
 * Folder-drop support — walks dropped directories via the FileSystemEntry
 * API (webkitGetAsEntry) and flattens every file inside, recursively.
 * Browsers without the entry API (Firefox) get the flat file list and a
 * foldersUnsupported flag so the UI can say so honestly.
 */

export interface DropResult {
  files: File[];
  /** Directories encountered (including nested). */
  folders: number;
  /** True when this browser can't enumerate folders. */
  foldersUnsupported: boolean;
}

export function supportsFolderDrop(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items ?? []).some(
    (item) => item.kind === "file" && typeof item.webkitGetAsEntry === "function",
  );
}

export async function getDroppedFiles(dataTransfer: DataTransfer): Promise<DropResult> {
  const items = Array.from(dataTransfer.items ?? []);
  const fileItems = items.filter(
    (item) => item.kind === "file" && typeof item.webkitGetAsEntry === "function",
  );

  if (fileItems.length === 0) {
    // No entry API available (Firefox) or a drop without item entries:
    // whatever files arrived, use them as-is.
    return { files: Array.from(dataTransfer.files), folders: 0, foldersUnsupported: true };
  }

  const files: File[] = [];
  let folders = 0;
  const seen = new Set<string>();

  const readAllEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries(
          (batch) => {
            if (batch.length === 0) return resolve(all);
            all.push(...batch);
            readBatch();
          },
          reject,
        );
      };
      readBatch();
    });

  const walkEntry = async (entry: FileSystemEntry): Promise<void> => {
    // Cycle protection: the entry API can hand back symlink loops.
    if (seen.has(entry.fullPath)) return;
    seen.add(entry.fullPath);
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File | null>((resolve) =>
        fileEntry.file(resolve, () => resolve(null)),
      );
      if (file) files.push(file);
    } else if (entry.isDirectory) {
      folders += 1;
      const dirEntry = entry as FileSystemDirectoryEntry;
      try {
        const entries = await readAllEntries(dirEntry.createReader());
        await Promise.all(entries.map(walkEntry));
      } catch {
        // unreadable directory — skip it, keep going
      }
    }
  };

  await Promise.all(fileItems.map((item) => walkEntry(item.webkitGetAsEntry()!)));
  return { files, folders, foldersUnsupported: false };
}
