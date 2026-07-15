import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UPLOADS_DIR = join(process.cwd(), "uploads", "meals");

export async function savePhoto(buffer: Buffer, fileName: string): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const path = join(UPLOADS_DIR, fileName);
  await writeFile(path, buffer);
  return path;
}
