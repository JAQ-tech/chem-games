import { esc } from "./engine.js";

const JOBS = ["teaching", "admin", "technical"];
const ROLES = ["staff", "specialist", "principal", "admin", "superadmin"];

function jobLabel(t, job) {
  return t(`job_${job}`) || job;
}

function roleLabel(t, role) {
  return t(`role_${role}`) || role;
}

export function renderAdmin(state, t, powers) {
  const tabs = [];
  if (powers.manageStaff) tabs.push(["staff", "tabStaff"]);
  if (powers.manageHolidays) tabs.push(["holidays", "tabHolidays"]);
  if (powers.viewReports) tabs.push(["reports", "tabReports"]);
  if (powers.settings) tabs.push(["settings", "tabSettings"]);
  if (powers.audit) tabs.push(["audit", "tabAudit"]);
  const active = tabs.some(([id]) => id === state.adminTab) ? state.adminTab : tabs[0]?.[0];
  state.adminTab = active;
  return `
    <section class="space-y-4">
      <div class="flex flex-wrap gap-2">
        ${tabs.map(([id, key]) => `<button class="tab ${id === active ? "tab-on" : ""}" data-action="admin-tab" data-tab="${id}">${esc(t(key))}</button>`).join("")}
      </div>
      ${active === "staff" ? staffPanel(state, t, powers) : ""}
      ${active === "holidays" ? holidayPanel(state, t) : ""}
      ${active === "reports" ? reportPanel(state, t) : ""}
      ${active === "settings" ? settingsPanel(state, t) : ""}
      ${active === "audit" ? auditPanel(state, t) : ""}
    </section>`;
}

function staffPanel(state, t, powers) {
  const form = state.staffForm;
  const preview = state.importPreview;
  return `
    <div class="card p-4 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold">${esc(t("tabStaff"))}</h2>
        <div class="flex flex-wrap gap-2">
          <a class="btn-ghost" href="staff-template.csv" download>${esc(t("downloadTemplate"))}</a>
          <button class="btn-primary" data-action="staff-new">${esc(t("addStaff"))}</button>
        </div>
      </div>
      <label class="block text-sm font-semibold">${esc(t("importFile"))}
        <input class="field mt-1" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-action="import-file">
      </label>
      ${preview ? previewTable(preview, t) : ""}
      ${form ? staffEditor(form, t, powers) : ""}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-start text-slate-500">
            <tr>
              <th class="py-2">${esc(t("name"))}</th>
              <th>${esc(t("fileNo"))}</th>
              <th>${esc(t("job"))}</th>
              <th>${esc(t("subject"))}</th>
              <th>${esc(t("role"))}</th>
              <th>${esc(t("active"))}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.staff.map((row) => `
              <tr class="border-t border-slate-100">
                <td class="py-2 font-semibold">${esc(row.full_name)}</td>
                <td>${esc(row.file_no)}</td>
                <td>${esc(jobLabel(t, row.job_type))}</td>
                <td>${esc(row.subject || "—")}</td>
                <td>${esc(roleLabel(t, row.role))}</td>
                <td>${row.active ? esc(t("yes")) : esc(t("no"))}</td>
                <td class="text-end">
                  <button class="btn-ghost" data-action="staff-edit" data-id="${esc(row.id)}">${esc(t("edit"))}</button>
                  <button class="btn-ghost" data-action="staff-active" data-id="${esc(row.id)}" data-active="${row.active ? "0" : "1"}">${esc(row.active ? t("disable") : t("enable"))}</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function staffEditor(form, t, powers) {
  return `
    <form class="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2" data-action="staff-save">
      <label class="text-sm font-semibold">${esc(t("name"))}
        <input class="field mt-1" data-field="staff_full_name" value="${esc(form.full_name)}" required>
      </label>
      <label class="text-sm font-semibold">${esc(t("fileNo"))}
        <input class="field mt-1" data-field="staff_file_no" value="${esc(form.file_no)}" required>
      </label>
      <label class="text-sm font-semibold">${esc(t("job"))}
        <select class="field mt-1" data-field="staff_job_type">
          ${JOBS.map((job) => `<option value="${job}" ${form.job_type === job ? "selected" : ""}>${esc(jobLabel(t, job))}</option>`).join("")}
        </select>
      </label>
      <label class="text-sm font-semibold">${esc(t("subject"))}
        <input class="field mt-1" data-field="staff_subject" value="${esc(form.subject || "")}">
      </label>
      ${powers.assignRoles ? `
        <label class="text-sm font-semibold">${esc(t("role"))}
          <select class="field mt-1" data-field="staff_role">
            ${ROLES.map((role) => `<option value="${role}" ${form.role === role ? "selected" : ""}>${esc(roleLabel(t, role))}</option>`).join("")}
          </select>
        </label>` : ""}
      <div class="flex items-end gap-2">
        <button class="btn-primary" type="submit">${esc(t("save"))}</button>
        <button class="btn-ghost" type="button" data-action="staff-cancel">${esc(t("close"))}</button>
      </div>
    </form>`;
}

function previewTable(preview, t) {
  const errorLabel = {
    name: t("errMissingName"),
    file: t("errMissingFile"),
    job: t("errBadJob"),
    duplicate: t("errDuplicate"),
  };
  return `
    <div class="space-y-2">
      <p class="text-sm text-slate-600">${esc(t("importPreview"))}</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr><th>#</th><th>${esc(t("name"))}</th><th>${esc(t("fileNo"))}</th><th>${esc(t("job"))}</th><th>${esc(t("result"))}</th></tr></thead>
          <tbody>
            ${preview.map((row) => `
              <tr class="border-t border-slate-100">
                <td>${esc(row.rowNumber)}</td>
                <td>${esc(row.full_name)}</td>
                <td>${esc(row.file_no)}</td>
                <td>${esc(row.job_type || "")}</td>
                <td class="${row.action === "error" ? "text-rose-700" : "text-emerald-800"}">${esc(row.action === "skip" ? t("skippedExample") : row.action === "error" ? row.errors.map((key) => errorLabel[key] || key).join("، ") : t(row.action === "update" ? "willUpdate" : "willInsert"))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <button class="btn-primary" data-action="import-save" ${preview.some((row) => row.action === "error") ? "disabled" : ""}>${esc(t("saveImport"))}</button>
    </div>`;
}

function holidayPanel(state, t) {
  const form = state.holidayForm || { day: "", period: "", reason: "" };
  return `
    <div class="card space-y-4 p-4">
      <h2 class="text-lg font-bold">${esc(t("tabHolidays"))}</h2>
      <form class="grid gap-3 md:grid-cols-4" data-action="holiday-save">
        <label class="text-sm font-semibold">${esc(t("date"))}
          <input class="field mt-1" type="date" data-field="holiday_day" value="${esc(form.day)}" required>
        </label>
        <label class="text-sm font-semibold">${esc(t("period"))}
          <select class="field mt-1" data-field="holiday_period">
            <option value="">${esc(t("wholeDay"))}</option>
            ${(state.catalog?.periods || []).map((period) => `<option value="${period.n}" ${String(form.period) === String(period.n) ? "selected" : ""}>${esc(state.lang === "en" ? period.label_en : period.label_ar)}</option>`).join("")}
          </select>
        </label>
        <label class="text-sm font-semibold md:col-span-2">${esc(t("reason"))}
          <input class="field mt-1" data-field="holiday_reason" value="${esc(form.reason || "")}">
        </label>
        <button class="btn-primary md:col-span-4" type="submit">${esc(t("blockSlot"))}</button>
      </form>
      <ul class="divide-y divide-slate-100">
        ${state.holidays.map((row) => `
          <li class="flex items-center justify-between gap-3 py-2 text-sm">
            <span>${esc(row.day)} · ${row.period ? esc(String(row.period)) : esc(t("wholeDay"))} · ${esc(row.reason || "")}</span>
            <button class="btn-ghost" data-action="holiday-delete" data-id="${esc(row.id)}">${esc(t("delete"))}</button>
          </li>`).join("") || `<li class="py-3 text-sm text-slate-500">${esc(t("empty"))}</li>`}
      </ul>
    </div>`;
}

function reportPanel(state, t) {
  const report = state.report;
  const list = (rows) => rows?.length ? rows.map((row) => `<li class="flex justify-between gap-3 border-b border-slate-100 py-1"><span>${esc(row.key)}</span><b>${esc(row.count)}</b></li>`).join("") : `<li class="text-slate-500">${esc(t("empty"))}</li>`;
  return `
    <div class="card space-y-4 p-4">
      <h2 class="text-lg font-bold">${esc(t("tabReports"))}</h2>
      <form class="flex flex-wrap items-end gap-3" data-action="report-run">
        <label class="text-sm font-semibold">${esc(t("from"))}
          <input class="field mt-1" type="date" data-field="report_from" value="${esc(state.reportFrom || "")}" required>
        </label>
        <label class="text-sm font-semibold">${esc(t("to"))}
          <input class="field mt-1" type="date" data-field="report_to" value="${esc(state.reportTo || "")}" required>
        </label>
        <button class="btn-primary" type="submit">${esc(t("showReport"))}</button>
        <button class="btn-ghost" type="button" data-action="report-csv" ${report ? "" : "disabled"}>${esc(t("exportCsv"))}</button>
        <button class="btn-ghost" type="button" data-action="pdf">${esc(t("exportPdf"))}</button>
      </form>
      ${report ? `
        <div class="grid gap-3 md:grid-cols-4">
          <article class="rounded-2xl bg-emerald-50 p-3"><p class="text-xs text-slate-500">${esc(t("lessons"))}</p><p class="text-2xl font-bold">${report.lessonCount}</p></article>
          <article class="rounded-2xl bg-sky-50 p-3"><p class="text-xs text-slate-500">${esc(t("events"))}</p><p class="text-2xl font-bold">${report.eventCount}</p></article>
          <article class="rounded-2xl bg-amber-50 p-3"><p class="text-xs text-slate-500">${esc(t("attendance"))}</p><p class="text-2xl font-bold">${report.attendance}</p></article>
          <article class="rounded-2xl bg-slate-50 p-3"><p class="text-xs text-slate-500">${esc(t("occupancy"))}</p><p class="text-2xl font-bold">${Math.round(report.occupancyRate * 100)}%</p><p class="text-xs text-slate-500">${report.occupancy}/${report.available}</p></article>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <section><h3 class="font-bold">${esc(t("byStaff"))}</h3><ul>${list(report.byStaff)}</ul></section>
          <section><h3 class="font-bold">${esc(t("bySubject"))}</h3><ul>${list(report.bySubject)}</ul></section>
          <section><h3 class="font-bold">${esc(t("byClass"))}</h3><ul>${list(report.byClass)}</ul></section>
          <section><h3 class="font-bold">${esc(t("eventsByStaff"))}</h3><ul>${list(report.eventsByStaff)}</ul></section>
        </div>` : ""}
    </div>`;
}

function settingsPanel(state, t) {
  const form = state.settingsForm;
  if (!form) return "";
  return `
    <form class="card space-y-4 p-4" data-action="settings-save">
      <h2 class="text-lg font-bold">${esc(t("tabSettings"))}</h2>
      <label class="block text-sm font-semibold">${esc(t("schoolName"))}
        <input class="field mt-1" data-field="set_school" value="${esc(form.school_name)}">
      </label>
      <label class="block text-sm font-semibold">${esc(t("principalName"))}
        <input class="field mt-1" data-field="set_principal" value="${esc(form.principal_name)}">
      </label>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="text-sm font-semibold">${esc(t("breakStart"))}
          <input class="field mt-1" type="time" data-field="set_break_start" value="${esc(form.break.starts)}">
        </label>
        <label class="text-sm font-semibold">${esc(t("breakEnd"))}
          <input class="field mt-1" type="time" data-field="set_break_end" value="${esc(form.break.ends)}">
        </label>
      </div>
      <div class="space-y-2">
        ${form.periods.map((period) => `
          <div class="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
            <span class="font-semibold">${esc(state.lang === "en" ? period.label_en : period.label_ar)}</span>
            <input class="field" type="time" data-field="period_start_${period.n}" value="${esc(period.starts)}">
            <input class="field" type="time" data-field="period_end_${period.n}" value="${esc(period.ends)}">
          </div>`).join("")}
      </div>
      <button class="btn-primary" type="submit">${esc(t("save"))}</button>
    </form>`;
}

function auditPanel(state, t) {
  return `
    <div class="card p-4">
      <h2 class="mb-3 text-lg font-bold">${esc(t("tabAudit"))}</h2>
      <ul class="divide-y divide-slate-100 text-sm">
        ${state.audit.map((row) => `
          <li class="py-2">
            <b>${esc(row.action)}</b>
            <span class="text-slate-500">${esc(row.actor_name || "")} · ${esc(String(row.at || "").replace("T", " ").slice(0, 16))}</span>
          </li>`).join("") || `<li class="text-slate-500">${esc(t("empty"))}</li>`}
      </ul>
    </div>`;
}
