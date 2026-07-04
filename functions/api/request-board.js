import {
  ensureSchema,
  jsonResponse,
  loadPublicJobs
} from "../_lib/request-store.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, {
      Allow: "GET"
    });
  }

  try {
    await ensureSchema(env.DB);
    const jobs = await loadPublicJobs(env.DB);
    return jsonResponse({
      updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      jobs
    });
  } catch (_error) {
    return jsonResponse(
      { ok: false, error: "Request board is not ready yet.", jobs: [] },
      503
    );
  }
}
