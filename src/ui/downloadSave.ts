import { buildSaveFile, saveFileName } from "../engine/saveFile.ts";

/** Downloads the current game as a save file (issue #142). Shared by Settings and the crash screen,
 * which both need it and only one of which has a working app around it. */
export function downloadSave(): void {
  const file = buildSaveFile(__APP_VERSION__);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = saveFileName(file);
  link.click();
  URL.revokeObjectURL(url);
}
