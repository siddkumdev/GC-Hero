import "server-only";
import { promises as fs } from "fs";
import path from "path";

// SYSTEM LAYER helper. Uploaded issue photos live under public/uploads and are referenced by a
// web path like "/uploads/<id>.<ext>". The Gemini perception layer needs them back as base64
// (e.g. the F1 before/after comparison reads the original report photo off disk). Centralized
// here so the mime/extension table isn't duplicated across routes.

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/** Best-effort mime type from a stored upload path's extension. */
export function mimeFromPath(imagePath: string): string {
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/jpeg";
}

export interface InlineImage {
  base64: string;
  mimeType: string;
}

/**
 * Read a previously-stored upload ("/uploads/<file>") back as base64 for Gemini.
 * Path-traversal guarded: only filenames directly inside UPLOAD_DIR are allowed.
 */
export async function readUploadAsBase64(imagePath: string): Promise<InlineImage> {
  const fileName = path.basename(imagePath); // strip any directory components
  const full = path.join(UPLOAD_DIR, fileName);
  if (path.dirname(full) !== UPLOAD_DIR) {
    throw new Error("Refusing to read image outside the uploads directory.");
  }
  const bytes = await fs.readFile(full);
  return { base64: bytes.toString("base64"), mimeType: mimeFromPath(fileName) };
}
