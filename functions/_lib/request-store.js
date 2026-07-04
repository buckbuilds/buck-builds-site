const PLATFORMS = {
  windows: "Windows",
  macos: "Mac",
  linux: "Linux"
};

const PUBLIC_STATUSES = new Set(["private", "requested", "building", "available"]);

export function cleanText(value, maxLength) {
  return String(value || "").replace(/\0/g, "").trim().slice(0, maxLength);
}

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

export function textResponse(text, status = 200, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

export async function ensureSchema(db) {
  if (!db) {
    throw new Error("Missing D1 binding named DB.");
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tool_requests (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL,
      platform TEXT NOT NULL,
      platform_label TEXT NOT NULL,
      problem TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      contact_method TEXT NOT NULL DEFAULT '',
      source_page TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL DEFAULT '',
      public_title TEXT NOT NULL DEFAULT '',
      public_status TEXT NOT NULL DEFAULT 'private',
      gumroad_url TEXT NOT NULL DEFAULT ''
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_tool_requests_received_at
    ON tool_requests(received_at DESC)
  `).run();
}

export function validateRequestPayload(payload) {
  const errors = [];
  const platform = cleanText(payload.platform, 32).toLowerCase();
  const problem = cleanText(payload.problem, 5000);

  if (!PLATFORMS[platform]) {
    errors.push("Choose Windows, Mac, or Linux.");
  }

  if (problem.length < 20) {
    errors.push("Describe the work pain in at least 20 characters.");
  }

  return {
    errors,
    cleaned: {
      platform,
      platform_label: PLATFORMS[platform] || "",
      problem,
      contact_name: cleanText(payload.contact_name, 120),
      contact_method: cleanText(payload.contact_method, 160),
      source_page: cleanText(payload.source_page, 500),
      submitted_at: cleanText(payload.submitted_at, 80)
    }
  };
}

export function makeRequestId() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${stamp}-${random}`;
}

export async function saveToolRequest(db, cleaned) {
  const id = makeRequestId();
  const receivedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  await db.prepare(`
    INSERT INTO tool_requests (
      id, received_at, platform, platform_label, problem,
      contact_name, contact_method, source_page, submitted_at,
      public_title, public_status, gumroad_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'private', '')
  `).bind(
    id,
    receivedAt,
    cleaned.platform,
    cleaned.platform_label,
    cleaned.problem,
    cleaned.contact_name,
    cleaned.contact_method,
    cleaned.source_page,
    cleaned.submitted_at
  ).run();

  return { id, received_at: receivedAt };
}

export async function loadPublicJobs(db) {
  const result = await db.prepare(`
    SELECT
      id,
      public_title AS title,
      platform_label AS platform,
      public_status AS status,
      gumroad_url AS url,
      received_at
    FROM tool_requests
    WHERE public_title != ''
      AND public_status IN ('requested', 'building', 'available')
    ORDER BY received_at DESC
    LIMIT 50
  `).all();

  return (result.results || []).map((job) => ({
    id: String(job.id || ""),
    title: String(job.title || ""),
    platform: String(job.platform || "Any computer"),
    status: String(job.status || "requested"),
    url: job.status === "available" ? safePublicUrl(job.url) : "",
    received_at: String(job.received_at || "")
  }));
}

export async function loadAdminRequests(db) {
  const result = await db.prepare(`
    SELECT *
    FROM tool_requests
    ORDER BY received_at DESC
    LIMIT 500
  `).all();

  return (result.results || []).map((record) => {
    const cleaned = {};
    for (const [key, value] of Object.entries(record)) {
      cleaned[key] = String(value || "");
    }
    return cleaned;
  });
}

export async function updatePublicFields(db, fields) {
  const id = cleanText(fields.id, 80).replace(/[^A-Za-z0-9_-]/g, "");
  const publicTitle = cleanText(fields.public_title, 120);
  const publicStatus = PUBLIC_STATUSES.has(fields.public_status) ? fields.public_status : "private";
  const gumroadUrl = safePublicUrl(fields.gumroad_url);

  if (!id) {
    return false;
  }

  const existing = await db.prepare(`
    SELECT id
    FROM tool_requests
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return false;
  }

  await db.prepare(`
    UPDATE tool_requests
    SET public_title = ?, public_status = ?, gumroad_url = ?
    WHERE id = ?
  `).bind(publicTitle, publicStatus, gumroadUrl, id).run();

  return true;
}

export function safePublicUrl(value) {
  const url = cleanText(value, 500);
  return /^https?:\/\//i.test(url) ? url : "";
}

export function htmlEscape(value, quote = false) {
  let escaped = String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (quote) {
    escaped = escaped.replace(/"/g, "&quot;");
  }

  return escaped;
}

export function csvEscape(value) {
  const text = String(value || "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv(records) {
  const fields = [
    "id",
    "received_at",
    "platform_label",
    "problem",
    "contact_name",
    "contact_method",
    "source_page",
    "submitted_at",
    "public_title",
    "public_status",
    "gumroad_url"
  ];

  const lines = [fields.join(",")];
  for (const record of records) {
    lines.push(fields.map((field) => csvEscape(record[field])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function adminPassword(env) {
  return cleanText(env.BUCK_ADMIN_PASSWORD || env.BUCK_INBOX_ADMIN_PASSWORD, 500);
}

export function requireAdmin(request, env) {
  const password = adminPassword(env);
  if (!password) {
    return textResponse(
      "Set BUCK_ADMIN_PASSWORD in Cloudflare Pages environment variables before opening the admin inbox.\n",
      503
    );
  }

  const header = request.headers.get("Authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const separator = decoded.indexOf(":");
      const provided = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (provided === password) {
        return null;
      }
    } catch (_error) {
      return unauthorizedResponse();
    }
  }

  return unauthorizedResponse();
}

function unauthorizedResponse() {
  return new Response(null, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Buck Builds Request Inbox"',
      "Cache-Control": "no-store"
    }
  });
}
