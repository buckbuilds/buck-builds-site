import {
  ensureSchema,
  exportCsv,
  htmlEscape,
  loadAdminRequests,
  requireAdmin,
  safePublicUrl,
  textResponse,
  updatePublicFields
} from "../_lib/request-store.js";

const PUBLIC_STATUS_OPTIONS = [
  ["private", "Private"],
  ["requested", "Requested"],
  ["building", "Building"],
  ["available", "Available"]
];

function adminPage(records) {
  const rows = records.map((record) => {
    const problem = record.problem || "";
    const shortProblem = htmlEscape(problem.slice(0, 260) + (problem.length > 260 ? "..." : ""));
    const options = PUBLIC_STATUS_OPTIONS.map(([value, label]) => {
      const selected = value === record.public_status ? " selected" : "";
      return `<option value="${value}"${selected}>${label}</option>`;
    }).join("");

    return `<article class="request">
      <div class="request-top">
        <strong>${htmlEscape(record.platform_label)}</strong>
        <span>${htmlEscape(record.received_at)}</span>
      </div>
      <p>${shortProblem}</p>
      <dl>
        <dt>Name or business</dt><dd>${htmlEscape(record.contact_name || "Not provided")}</dd>
        <dt>Email or phone</dt><dd>${htmlEscape(record.contact_method || "Not provided")}</dd>
      </dl>
      <form class="public-form" method="post" action="/admin/public">
        <input type="hidden" name="id" value="${htmlEscape(record.id, true)}">
        <label>Public title
          <input type="text" name="public_title" value="${htmlEscape(record.public_title, true)}" maxlength="120" placeholder="Safe title for the public board">
        </label>
        <div class="public-grid">
          <label>Status
            <select name="public_status">${options}</select>
          </label>
          <label>Gumroad URL
            <input type="url" name="gumroad_url" value="${htmlEscape(safePublicUrl(record.gumroad_url), true)}" placeholder="https://rinerchris.gumroad.com/l/...">
          </label>
        </div>
        <button type="submit">Save public row</button>
      </form>
    </article>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Buck Builds Request Inbox</title>
  <style>
    :root { color-scheme: light; --ink: #101417; --soft: #49555b; --paper: #f7f4ed; --line: rgba(16,20,23,.14); --blue: #256fb8; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 16px; color: var(--ink); background: var(--paper); font: 16px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(920px, 100%); margin: 0 auto; }
    header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(2.2rem, 7vw, 4.4rem); line-height: .95; }
    a { color: var(--blue); font-weight: 800; }
    .request { padding: 18px; margin: 0 0 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .request-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: var(--soft); }
    .request strong { color: var(--blue); }
    .request p { white-space: pre-wrap; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; margin: 0; color: var(--soft); }
    dt { font-weight: 800; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .public-form { display: grid; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
    .public-grid { display: grid; grid-template-columns: minmax(140px, .4fr) minmax(0, 1fr); gap: 10px; }
    label { display: grid; gap: 5px; color: var(--soft); font-weight: 800; }
    input, select { width: 100%; min-height: 38px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; font: inherit; }
    button { justify-self: start; min-height: 38px; padding: 0 14px; border: 0; border-radius: 8px; color: white; background: var(--blue); font: inherit; font-weight: 850; }
    .empty { padding: 18px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    @media (max-width: 720px) { .public-grid, dl { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p>Buck Builds</p>
        <h1>Request Inbox</h1>
      </div>
      <nav>
        <a href="/admin/export.csv">Export CSV</a>
      </nav>
    </header>
    ${rows || '<p class="empty">No requests yet.</p>'}
  </main>
</body>
</html>`;
}

async function readForm(request) {
  const formData = await request.formData();
  return {
    id: String(formData.get("id") || ""),
    public_title: String(formData.get("public_title") || ""),
    public_status: String(formData.get("public_status") || "private"),
    gumroad_url: String(formData.get("gumroad_url") || "")
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const authResponse = requireAdmin(request, env);
  if (authResponse) {
    return authResponse;
  }

  await ensureSchema(env.DB);

  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    return textResponse(adminPage(await loadAdminRequests(env.DB)), 200, "text/html; charset=utf-8", {
      "Cache-Control": "no-store"
    });
  }

  if (request.method === "GET" && url.pathname === "/admin/export.csv") {
    return textResponse(exportCsv(await loadAdminRequests(env.DB)), 200, "text/csv; charset=utf-8", {
      "Cache-Control": "no-store"
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/public") {
    const updated = await updatePublicFields(env.DB, await readForm(request));
    if (!updated) {
      return textResponse("Request not found.\n", 404);
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin",
        "Cache-Control": "no-store"
      }
    });
  }

  return textResponse("Not found.\n", 404);
}
