import {
  cleanText,
  ensureSchema,
  jsonResponse,
  saveToolRequest,
  validateRequestPayload
} from "../_lib/request-store.js";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([
    "https://buckbuilds.org",
    "https://www.buckbuilds.org",
    "https://buckbuilds.github.io"
  ]);

  if (!allowed.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, {
      Allow: "POST, OPTIONS",
      ...cors
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Send JSON." }, 400, cors);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ ok: false, error: "Send a JSON object." }, 400, cors);
  }

  if (cleanText(payload.company_site, 200)) {
    return jsonResponse({ ok: true, stored: false }, 202, cors);
  }

  const { errors, cleaned } = validateRequestPayload(payload);
  if (errors.length) {
    return jsonResponse({ ok: false, errors }, 400, cors);
  }

  try {
    await ensureSchema(env.DB);
    const record = await saveToolRequest(env.DB, cleaned);
    return jsonResponse({ ok: true, id: record.id }, 201, cors);
  } catch (error) {
    return jsonResponse(
      { ok: false, error: "Request inbox is not ready yet." },
      503,
      cors
    );
  }
}
