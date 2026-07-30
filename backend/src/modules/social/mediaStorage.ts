import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../../config/env.js";

const UPLOADS_DIR = join(process.cwd(), "uploads", "social");

/** Salva un'immagine caricata per un post social e ritorna il path relativo (usato per costruire l'URL pubblico). */
export async function saveSocialMedia(buffer: Buffer, filename: string): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(join(UPLOADS_DIR, filename), buffer);
  return `social/${filename}`;
}

/** URL pubblico dell'immagine, se PUBLIC_BASE_URL e' configurato (obbligatorio per Instagram/foto Facebook). */
export function publicMediaUrl(relativePath: string): string | null {
  if (!env.publicBaseUrl) return null;
  return `${env.publicBaseUrl.replace(/\/$/, "")}/uploads/${relativePath}`;
}
