/**
 * Media upload pipeline.
 *   POST /api/media          (multipart/form-data, field "file") → saves under ./media/{ai_user_id}/
 *   GET  /api/media-file?path=...                                 → serves a saved file
 *
 * Files are stored locally. Note that some platforms (Instagram, and IG-style
 * flows) require a PUBLIC https URL — a local path will not be reachable by the
 * platform. For those, host the file or expose ./media via a tunnel.
 */
import type { FastifyPluginAsync } from "fastify";
import { createWriteStream, createReadStream, existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { resolve, relative, isAbsolute, basename, extname } from "node:path";
import { nanoid } from "nanoid";

const MEDIA_ROOT = resolve("./media");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

function isUnderMediaRoot(p: string): boolean {
  const abs = isAbsolute(p) ? resolve(p) : resolve(p);
  const rel = relative(MEDIA_ROOT, abs);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Querystring: { ai_user_id?: string } }>("/media", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "no file uploaded (field 'file')" });

    const aiUserId = (req.query.ai_user_id ?? (data.fields?.ai_user_id as any)?.value ?? "shared").toString();
    const safeAi = aiUserId.replace(/[^a-zA-Z0-9_-]/g, "");
    const dir = resolve(MEDIA_ROOT, safeAi || "shared");
    await mkdir(dir, { recursive: true });

    const safeName = basename(data.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${nanoid()}-${safeName}`;
    const fullPath = resolve(dir, fileName);

    await pipeline(data.file, createWriteStream(fullPath));

    const relPath = relative(process.cwd(), fullPath).split("\\").join("/");
    return {
      path: relPath,
      url: `/api/media-file?path=${encodeURIComponent(relPath)}`,
      mime: data.mimetype,
      size: (data.file as any).bytesRead ?? null,
    };
  });

  app.get<{ Querystring: { path: string } }>("/media-file", async (req, reply) => {
    const p = req.query.path;
    if (!p) return reply.code(400).send({ error: "path required" });
    const abs = resolve(p);
    if (!isUnderMediaRoot(abs)) return reply.code(403).send({ error: "path outside media root" });
    if (!existsSync(abs) || !statSync(abs).isFile()) return reply.code(404).send({ error: "not found" });
    const type = MIME[extname(abs).toLowerCase()] ?? "application/octet-stream";
    reply.header("Content-Type", type);
    return reply.send(createReadStream(abs));
  });
};
