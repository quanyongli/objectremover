import { auth } from "~/lib/auth.server";
import {
  insertAsset,
  listAssetsByUser,
  getAssetById,
  softDeleteAsset,
} from "~/lib/assets.repo";
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("out");

async function requireUserId(request: Request): Promise<string> {
  // Try Better Auth runtime API first
  try {
    // @ts-ignore - runtime API may not be typed
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const userId: string | undefined =
      session?.user?.id ?? session?.session?.userId;
    if (userId) return String(userId);
  } catch {
    console.error("Failed to get session");
  }

  // Fallback: call /api/auth/session with forwarded cookies
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:5173";
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const cookie = request.headers.get("cookie") || "";
  const res = await fetch(`${base}/api/auth/session`, {
    headers: {
      Cookie: cookie,
      Accept: "application/json",
    },
    method: "GET",
  });
  if (!res.ok) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const json = await res.json().catch(() => ({}));
  const uid: string | undefined =
    json?.user?.id ||
    json?.user?.userId ||
    json?.session?.user?.id ||
    json?.session?.userId ||
    json?.data?.user?.id ||
    json?.data?.user?.userId;
  if (!uid) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return String(uid);
}

function inferMediaTypeFromName(
  name: string,
  fallback: string = "application/octet-stream"
): string {
  const ext = path.extname(name).toLowerCase();
  if ([".mp4", ".mov", ".webm", ".mkv", ".avi"].includes(ext)) return "video/*";
  if ([".mp3", ".wav", ".aac", ".ogg", ".flac"].includes(ext)) return "audio/*";
  if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext))
    return "image/*";
  return fallback;
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const userId = await requireUserId(request);

  // GET /api/assets[?projectId=...] -> list assets for user
  if (pathname.endsWith("/api/assets") && request.method === "GET") {
    const projectIdParam = new URL(request.url).searchParams.get("projectId");
    const projectId = projectIdParam ? String(projectIdParam) : null;
    const rows = await listAssetsByUser(userId, projectId);
    const items = rows.map((r) => ({
      id: r.id,
      name: r.original_name,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      width: r.width,
      height: r.height,
      duration_seconds: r.duration_seconds,
      durationInSeconds: r.duration_seconds, // camelCase for frontend
      created_at: r.created_at,
      mediaUrlRemote: `/api/assets/${r.id}/raw`,
      fullUrl: `http://localhost:8000/media/${encodeURIComponent(
        r.storage_key
      )}`,
    }));
    return new Response(JSON.stringify({ assets: items }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // GET /api/assets/:id -> get asset info
  const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetMatch && request.method === "GET") {
    const assetId = assetMatch[1];
    const asset = await getAssetById(assetId);
    if (!asset || asset.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        asset: {
          id: asset.id,
          name: asset.original_name,
          mediaUrlRemote: `/api/assets/${asset.id}/raw`,
          fullUrl: `http://localhost:8000/media/${encodeURIComponent(asset.storage_key)}`,
          width: asset.width,
          height: asset.height,
          durationInSeconds: asset.duration_seconds,
          size: asset.size_bytes,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // GET /api/assets/:id/raw -> stream file with auth
  const rawMatch = pathname.match(/\/api\/assets\/([^/]+)\/raw$/);
  if (rawMatch && request.method === "GET") {
    const assetId = rawMatch[1];
    const asset = await getAssetById(assetId);
    if (!asset || asset.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Sanitize storage_key to prevent path traversal
    const sanitizedKey = path.basename(asset.storage_key);
    const filePath = path.resolve(OUT_DIR, sanitizedKey);
    
    // 添加详细的错误日志
    if (!filePath.startsWith(OUT_DIR)) {
      console.error(`❌ Path traversal attempt: ${filePath} not in ${OUT_DIR}`);
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath} (storage_key: ${asset.storage_key})`);
      return new Response(JSON.stringify({ error: "File not found", path: filePath }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Support range requests for video/audio
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (error: any) {
      console.error(`❌ Error reading file stats: ${filePath}`, error);
      return new Response(JSON.stringify({ error: "File access error", message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const range = request.headers.get("range");
    const contentType =
      asset.mime_type || inferMediaTypeFromName(asset.original_name);
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      if (
        isNaN(start) ||
        isNaN(end) ||
        start > end ||
        start < 0 ||
        end >= stat.size
      ) {
        return new Response(undefined, { status: 416 });
      }
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
        },
      });
    }

    const stream = fs.createReadStream(filePath);
    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Length": String(stat.size),
        "Content-Type": contentType,
      },
    });
  }

  return new Response("Not Found", { status: 404 });
}

export async function action({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // POST /api/assets/upload -> save file directly and record DB
  if (pathname.endsWith("/api/assets/upload") && method === "POST") {
    console.log(`📤 Upload request received`);
    
    let userId: string;
    try {
      userId = await requireUserId(request);
      console.log(`✅ User authenticated: ${userId}`);
    } catch (authError: any) {
      console.error(`❌ Authentication failed:`, authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: authError.message }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const width = Number(request.headers.get("x-media-width") || "") || null;
    const height = Number(request.headers.get("x-media-height") || "") || null;
    const duration =
      Number(request.headers.get("x-media-duration") || "") || null;
    const originalNameHeader = request.headers.get("x-original-name") || "file";
    const projectIdHeader = request.headers.get("x-project-id");

    console.log(`📋 Upload metadata:`, {
      width,
      height,
      duration,
      originalName: originalNameHeader,
      projectId: projectIdHeader,
    });

    // Parse incoming multipart form
    const incoming = await request.formData();
    const media = incoming.get("media");
    if (!(media instanceof Blob)) {
      console.error(`❌ No file provided in form data`);
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    console.log(`📁 File received: ${originalNameHeader}, size: ${media.size} bytes`);

    try {
      // Try to forward to 8000 service first (if available)
      const uploadUrl = process.env.NODE_ENV === "production" 
        ? process.env.UPLOAD_SERVICE_URL || "https://localhost:8000/upload"
        : "http://localhost:8000/upload";
      
      let filename: string;
      let size: number;

      try {
        const form = new FormData();
        const filenameFor8000 = (media as {name?: string})?.name || originalNameHeader || "upload.bin";
        form.append("media", media, filenameFor8000);

        console.log(`📤 Attempting to forward upload to ${uploadUrl}`);
        const forwardRes = await fetch(uploadUrl, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (forwardRes.ok) {
          const json = await forwardRes.json();
          filename = json.filename;
          size = json.size;
          console.log(`✅ File forwarded successfully: ${filename}`);
        } else {
          const errorText = await forwardRes.text().catch(() => "");
          console.warn(`⚠️ Forward failed (${forwardRes.status}): ${errorText}`);
          throw new Error(`Upload service returned ${forwardRes.status}: ${errorText}`);
        }
      } catch (forwardError: any) {
        console.warn(`⚠️ Forward error, using fallback:`, forwardError.message);
        // Fallback: save file directly to out/ directory
        try {
          if (!fs.existsSync(OUT_DIR)) {
            console.log(`📁 Creating out directory: ${OUT_DIR}`);
            fs.mkdirSync(OUT_DIR, { recursive: true });
          }

          const timestamp = Date.now();
          const ext = path.extname(originalNameHeader);
          const baseName = path.basename(originalNameHeader, ext);
          const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
          filename = `${sanitizedBase}_${timestamp}${ext}`;
          const filePath = path.resolve(OUT_DIR, filename);

          console.log(`💾 Saving file directly to: ${filePath}`);
          // Convert Blob to Buffer and save
          const arrayBuffer = await media.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          fs.writeFileSync(filePath, buffer);
          size = buffer.length;
          console.log(`✅ File saved successfully: ${filename} (${size} bytes)`);
        } catch (saveError: any) {
          console.error(`❌ Failed to save file:`, saveError);
          throw new Error(`Failed to save file: ${saveError.message}`);
        }
      }

      const mime = inferMediaTypeFromName(
        originalNameHeader,
        "application/octet-stream"
      );

      console.log(`💾 Inserting asset record to database...`);
      const record = await insertAsset({
        userId,
        projectId: projectIdHeader || null,
        originalName: originalNameHeader,
        storageKey: filename,
        mimeType: mime,
        sizeBytes: Number(size) || 0,
        width,
        height,
        durationSeconds: duration,
      });

      console.log(`✅ Asset record created:`, {
        id: record.id,
        name: record.original_name,
        storageKey: record.storage_key,
      });

      if (!record.id) {
        console.error(`❌ Asset ID is missing in record:`, record);
        throw new Error("Failed to create asset record: ID is missing");
      }

      const assetResponse = {
        success: true,
        asset: {
          id: String(record.id), // 确保是字符串
          name: record.original_name,
          mediaUrlRemote: `/api/assets/${record.id}/raw`,
          fullUrl: process.env.NODE_ENV === "production"
            ? `${process.env.UPLOAD_SERVICE_URL?.replace('/upload', '') || 'https://localhost:8000'}/media/${encodeURIComponent(filename)}`
            : `http://localhost:8000/media/${encodeURIComponent(filename)}`,
          width: record.width,
          height: record.height,
          durationInSeconds: record.duration_seconds,
          size: record.size_bytes,
        },
      };
      
      console.log(`✅ Upload completed, returning asset:`, JSON.stringify(assetResponse, null, 2));
      
      return new Response(
        JSON.stringify(assetResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("❌ Upload error:", error);
      console.error("   Error message:", error.message);
      console.error("   Error stack:", error.stack);
      console.error("   User ID:", userId);
      console.error("   File name:", originalNameHeader);
      
      // 返回更详细的错误信息（开发环境）
      const errorDetail = process.env.NODE_ENV === "development" 
        ? {
            error: "Upload failed",
            message: error.message || "Unknown error",
            stack: error.stack,
            userId,
            fileName: originalNameHeader,
          }
        : {
            error: "Upload failed",
            message: error.message || "Unknown error",
          };
      
      return new Response(
        JSON.stringify(errorDetail),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // POST /api/assets/register -> register an already-uploaded file from out/
  if (pathname.endsWith("/api/assets/register") && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const filename: string | undefined = body.filename;
    const originalName: string | undefined = body.originalName;
    const size: number | undefined = body.size;
    const width: number | null =
      typeof body.width === "number" ? body.width : null;
    const height: number | null =
      typeof body.height === "number" ? body.height : null;
    const duration: number | null =
      typeof body.duration === "number" ? body.duration : null;

    if (!filename || !originalName) {
      return new Response(
        JSON.stringify({ error: "filename and originalName are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const filePath = path.resolve(OUT_DIR, decodeURIComponent(filename));
    if (!filePath.startsWith(OUT_DIR) || !fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: "File not found in out/" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const stat = fs.statSync(filePath);
    const mime = inferMediaTypeFromName(
      originalName,
      "application/octet-stream"
    );

    const record = await insertAsset({
      userId,
      originalName,
      storageKey: path.basename(filePath),
      mimeType: mime,
      sizeBytes: typeof size === "number" ? size : stat.size,
      width,
      height,
      durationSeconds: duration,
    });

    return new Response(
      JSON.stringify({
        success: true,
        asset: {
          id: record.id,
          name: record.original_name,
          mediaUrlRemote: `/api/assets/${record.id}/raw`,
          fullUrl: `http://localhost:8000/media/${encodeURIComponent(
            record.storage_key
          )}`,
          width: record.width,
          height: record.height,
          durationInSeconds: record.duration_seconds,
          size: record.size_bytes,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // DELETE /api/assets/:id -> delete
  const delMatch = pathname.match(/\/api\/assets\/([^/]+)$/);
  if (delMatch && method === "DELETE") {
    const assetId = delMatch[1];
    const asset = await getAssetById(assetId);
    if (!asset || asset.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Sanitize storage_key to prevent path traversal
    const sanitizedKey = path.basename(asset.storage_key);
    const filePath = path.resolve(OUT_DIR, sanitizedKey);
    if (filePath.startsWith(OUT_DIR) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    await softDeleteAsset(assetId, userId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/assets/:id/clone -> clone to new file and record
  const cloneMatch = pathname.match(/\/api\/assets\/([^/]+)\/clone$/);
  if (cloneMatch && method === "POST") {
    const assetId = cloneMatch[1];
    const suffix = (await request.json().catch(() => ({})))?.suffix || "copy";
    const asset = await getAssetById(assetId);
    if (!asset || asset.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Sanitize storage_key to prevent path traversal
    const sanitizedKey = path.basename(asset.storage_key);
    const srcPath = path.resolve(OUT_DIR, sanitizedKey);
    if (!srcPath.startsWith(OUT_DIR) || !fs.existsSync(srcPath)) {
      return new Response(JSON.stringify({ error: "Source missing" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const timestamp = Date.now();
    const ext = path.extname(sanitizedKey);
    const base = path.basename(sanitizedKey, ext);
    // Sanitize suffix to prevent path traversal in filename
    const sanitizedSuffix = suffix.replace(/[^a-zA-Z0-9_-]/g, '');
    const newFilename = `${base}_${sanitizedSuffix}_${timestamp}${ext}`;
    const destPath = path.resolve(OUT_DIR, newFilename);
    fs.copyFileSync(srcPath, destPath);

    const stat = fs.statSync(destPath);
    const record = await insertAsset({
      userId,
      projectId: asset.project_id ?? null,
      originalName: `${asset.original_name} ${suffix}`.trim(),
      storageKey: newFilename,
      mimeType: asset.mime_type,
      sizeBytes: stat.size,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.duration_seconds,
    });

    return new Response(
      JSON.stringify({
        success: true,
        asset: {
          id: record.id,
          name: record.original_name,
          mediaUrlRemote: `/api/assets/${record.id}/raw`,
          fullUrl: `http://localhost:8000/media/${encodeURIComponent(
            newFilename
          )}`,
          width: record.width,
          height: record.height,
          durationInSeconds: record.duration_seconds,
          size: record.size_bytes,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response("Not Found", { status: 404 });
}
