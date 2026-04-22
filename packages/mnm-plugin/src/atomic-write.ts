import { promises as fs } from "node:fs";
import { dirname } from "node:path";

/**
 * Writes `content` to `targetPath` atomically: writes to `${targetPath}.tmp`
 * first, then renames onto the target. `fs.rename` is atomic on POSIX and
 * near-atomic on Windows NTFS (uses MoveFileEx internally). Creates parent
 * directories if they do not exist.
 *
 * Not concurrent-safe — two writers racing on the same target can clobber
 * each other's `.tmp` file. For our use case (single session-start hook +
 * harness Write tool) this is fine.
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string | Uint8Array,
): Promise<void> {
  await fs.mkdir(dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.tmp`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, targetPath);
}
