import { APP_NAME, APP_TAGLINE_AR, APP_TAGLINE_EN, CREDIT_LINE, PRINCIPAL_NAME_DEFAULT, SCHOOL_NAME_DEFAULT, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { renderAdmin } from "./admin.js";
import {
  addDays, can, esc, groupBookings, isConsecutive,
  muscatParts, reportToCsv, schoolSunday, slotHoliday, timeToMinutes, trText,
} from "./engine.js";
import { buildWeekModel, downloadWeekPdf } from "./pdf.js";
import { createStore } from "./store.js";

const DAYS = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
};

const T = {
  ar: {
    tagline: APP_TAGLINE_AR,
    principalPrefix: "مدير المدرسة:",
    fileNo: "رقم الملف",
    signIn: "دخول",
    signOut: "خروج",
    language: "English",
    week: "الجدول",
    mine: "حجوزاتي",
    requests: "الطلبات",
    notifications: "الإشعارات",
    admin: "الإدارة",
    prevWeek: "الأسبوع السابق",
    nextWeek: "الأسبوع التالي",
    bookTitle: "طلب حجز",
    kindLesson: "حصة دراسية",
    kindEvent: "فعالية",
    name: "الاسم",
    periods: "الحصص",
    classSection: "الصف والشعبة",
    subject: "المادة",
    lessonTitle: "عنوان الدرس",
    eventTitle: "عنوان الفعالية",
    visitor: "الجهة الزائرة",
    attendees: "عدد الحضور",
    equipment: "التجهيزات المطلوبة",
    notes: "ملاحظات",
    optional: "اختياري",
    send: "إرسال الطلب",
    close: "إغلاق",
    sent: "أُرسل الطلب وبانتظار موافقة أخصائي المركز",
    pending: "معلّق",
    approved: "معتمد",
    rejected: "مرفوض",
    cancelled: "ملغى",
    cancel: "إلغاء الحجز",
    accept: "قبول",
    reject: "رفض",
    rejectReason: "سبب الرفض",
    confirmReject: "تأكيد الرفض",
    viewOnly: "اطلاع فقط",
    markAll: "تعليم الكل كمقروء",
    enableNotes: "تفعيل إشعار المتصفح",
    empty: "لا يوجد شيء هنا",
    breakLabel: "الفسحة",
    past: "انتهت",
    holiday: "محجوبة",
    compete: "توجد طلبات معلّقة. يمكنك تقديم طلب منافس.",
    localBanner: "معاينة محلية بلا Supabase. أرقام الملفات للتجربة: 900001 يعقوب (مشرف عام)، 900002 أحمد، 900003 محمد، 900004 محمود (أخصائي)، 900005 د.سالم (مدير).",
    tabStaff: "الكادر",
    tabHolidays: "العطل والحجب",
    tabReports: "التقارير",
    tabSettings: "الإعدادات",
    tabAudit: "سجل العمليات",
    addStaff: "إضافة موظف",
    edit: "تعديل",
    save: "حفظ",
    disable: "تعطيل",
    enable: "تفعيل",
    job: "الوظيفة",
    role: "الدور",
    active: "الحالة",
    yes: "نشط",
    no: "معطّل",
    subject: "المادة",
    importFile: "استيراد CSV أو Excel",
    downloadTemplate: "قالب الكادر",
    importPreview: "معاينة الاستيراد. صفوف example تُتجاهل، ولا يُحفظ الملف إن وُجدت أخطاء.",
    saveImport: "حفظ الصفوف السليمة",
    skippedExample: "مثال متجاهل",
    willInsert: "إضافة",
    willUpdate: "تحديث",
    result: "النتيجة",
    errMissingName: "الاسم ناقص",
    errMissingFile: "رقم الملف ناقص",
    errBadJob: "نوع الوظيفة غير صحيح",
    errDuplicate: "رقم ملف مكرر في الملف",
    date: "التاريخ",
    period: "الحصة",
    reason: "السبب",
    wholeDay: "اليوم كاملًا",
    blockSlot: "حجب",
    delete: "حذف",
    from: "من",
    to: "إلى",
    showReport: "عرض",
    exportCsv: "تصدير CSV",
    exportPdf: "تصدير PDF",
    lessons: "حصص معتمدة",
    events: "فعاليات معتمدة",
    attendance: "حضور الفعاليات",
    occupancy: "نسبة إشغال المركز",
    byStaff: "الحصص لكل موظف",
    bySubject: "الحصص لكل مادة",
    byClass: "الحصص لكل صف",
    eventsByStaff: "الفعاليات لكل موظف",
    schoolName: "اسم المدرسة",
    principalName: "اسم المدير",
    breakStart: "بداية الفسحة",
    breakEnd: "نهاية الفسحة",
    saved: "تم الحفظ",
    holidayConfirm: "توجد حجوزات على هذه الخانة. تأكيد الحجب يلغيها ويُشعر أصحابها.",
    confirm: "تأكيد الإلغاء",
    job_teaching: "معلم",
    job_admin: "إداري",
    job_technical: "فني",
    role_superadmin: "مشرف عام",
    role_admin: "مساعد مدير",
    role_specialist: "أخصائي المركز",
    role_principal: "مدير المدرسة",
    role_staff: "موظف",
    autoReject: "تم قبول طلب آخر على هذه الخانة",
    choose: "اختر",
    err_not_found: "رقم الملف غير موجود",
    err_disabled: "هذا الحساب معطّل",
    err_NOT_CONSECUTIVE: "الحصص يجب أن تكون متتالية في اليوم نفسه",
    err_KIND_FIELDS: "أكمل الحقول الإلزامية",
    err_PAST: "لا يمكن الحجز أو الإلغاء في وقت ماضٍ",
    err_STARTED: "هذه الحصة بدأت",
    err_HOLIDAY: "هذه الخانة محجوبة أو عطلة",
    err_OUTSIDE_WEEK: "الحجز متاح في الأسبوع الدراسي الحالي فقط",
    err_WEEKEND: "الجمعة والسبت عطلة",
    err_SLOT_TAKEN: "الخانة فيها حجز معتمد",
    err_ALREADY_REQUESTED: "عندك طلب قائم على هذه الخانة",
    err_FORBIDDEN: "لا تملك صلاحية هذا الإجراء",
    err_REASON_REQUIRED: "اكتب سبب الرفض",
    err_NOT_PENDING: "الطلب لم يعد معلّقًا",
    err_ROLE_FORBIDDEN: "لا يمكن منح دور المشرف العام أو مساعد المدير أو سحبه إلا للمشرف العام",
    err_NOT_CANCELLABLE: "لا يمكن إلغاء هذا الطلب",
    err_duplicate: "رقم الملف مستخدم",
    err_server: "تعذر الاتصال بالخادم",
    err_generic: "تعذر تنفيذ الطلب",
    err_import: "أصلح صفوف الأخطاء قبل الحفظ",
  },
  en: {
    tagline: APP_TAGLINE_EN,
    principalPrefix: "School principal:",
    fileNo: "File number",
    signIn: "Sign in",
    signOut: "Sign out",
    language: "العربية",
    week: "Timetable",
    mine: "My bookings",
    requests: "Requests",
    notifications: "Notifications",
    admin: "Admin",
    prevWeek: "Previous week",
    nextWeek: "Next week",
    bookTitle: "Booking request",
    kindLesson: "Lesson",
    kindEvent: "Event",
    name: "Name",
    periods: "Periods",
    classSection: "Class section",
    subject: "Subject",
    lessonTitle: "Lesson title",
    eventTitle: "Event title",
    visitor: "Visiting party",
    attendees: "Number of attendees",
    equipment: "Equipment needed",
    notes: "Notes",
    optional: "optional",
    send: "Submit request",
    close: "Close",
    sent: "The request was sent and is waiting for the specialist",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
    cancel: "Cancel booking",
    accept: "Approve",
    reject: "Reject",
    rejectReason: "Reason for rejection",
    confirmReject: "Confirm rejection",
    viewOnly: "View only",
    markAll: "Mark all as read",
    enableNotes: "Enable browser notifications",
    empty: "Nothing here",
    breakLabel: "Break",
    past: "Passed",
    holiday: "Blocked",
    compete: "Other requests are pending. You can submit a competing one.",
    localBanner: "Local preview without Supabase. Try file numbers 900001 Yaqoob (superadmin), 900002 Ahmed, 900003 Mohammed, 900004 Mahmoud (specialist), 900005 Dr Salim (principal).",
    tabStaff: "Staff",
    tabHolidays: "Holidays and blocks",
    tabReports: "Reports",
    tabSettings: "Settings",
    tabAudit: "Audit log",
    addStaff: "Add staff",
    edit: "Edit",
    save: "Save",
    disable: "Disable",
    enable: "Enable",
    job: "Job",
    role: "Role",
    active: "Status",
    yes: "Active",
    no: "Disabled",
    importFile: "Import CSV or Excel",
    downloadTemplate: "Staff template",
    importPreview: "Import preview. Rows marked example are ignored. Fix errors before saving.",
    saveImport: "Save valid rows",
    skippedExample: "Ignored example",
    willInsert: "Add",
    willUpdate: "Update",
    result: "Result",
    errMissingName: "Name is missing",
    errMissingFile: "File number is missing",
    errBadJob: "Job type is not valid",
    errDuplicate: "Duplicate file number in the file",
    date: "Date",
    period: "Period",
    reason: "Reason",
    wholeDay: "Whole day",
    blockSlot: "Block",
    delete: "Delete",
    from: "From",
    to: "To",
    showReport: "Show",
    exportCsv: "Export CSV",
    exportPdf: "Export PDF",
    lessons: "Approved lessons",
    events: "Approved events",
    attendance: "Event attendance",
    occupancy: "Centre occupancy",
    byStaff: "Lessons by staff",
    bySubject: "Lessons by subject",
    byClass: "Lessons by class",
    eventsByStaff: "Events by staff",
    schoolName: "School name",
    principalName: "Principal name",
    breakStart: "Break starts",
    breakEnd: "Break ends",
    saved: "Saved",
    holidayConfirm: "Bookings already use this slot. Confirming the block cancels them and notifies the owners.",
    confirm: "Confirm cancellation",
    job_teaching: "Teacher",
    job_admin: "Administrative",
    job_technical: "Technical",
    role_superadmin: "Superadmin",
    role_admin: "Deputy",
    role_specialist: "Centre specialist",
    role_principal: "Principal",
    role_staff: "Staff",
    autoReject: "Another request was approved for this slot",
    choose: "Choose",
    err_not_found: "That file number was not found",
    err_disabled: "This account is disabled",
    err_NOT_CONSECUTIVE: "Periods must be consecutive on the same day",
    err_KIND_FIELDS: "Complete the required fields",
    err_PAST: "Past dates cannot be booked or cancelled",
    err_STARTED: "This period has already started",
    err_HOLIDAY: "This slot is blocked",
    err_OUTSIDE_WEEK: "Booking is open for the current school week only",
    err_WEEKEND: "Friday and Saturday are off",
    err_SLOT_TAKEN: "This slot already has an approved booking",
    err_ALREADY_REQUESTED: "You already have a request on this slot",
    err_FORBIDDEN: "You cannot do that",
    err_REASON_REQUIRED: "Write a reason for the rejection",
    err_NOT_PENDING: "This request is no longer pending",
    err_ROLE_FORBIDDEN: "Only the superadmin can grant or revoke superadmin and deputy roles",
    err_NOT_CANCELLABLE: "This request cannot be cancelled",
    err_duplicate: "That file number is already used",
    err_server: "The server could not be reached",
    err_generic: "The request could not be completed",
    err_import: "Fix the error rows before saving",
  },
};

const state = {
  lang: localStorage.getItem("manhal.lang") === "en" ? "en" : "ar",
  me: null,
  route: "week",
  catalog: null,
  weekSunday: null,
  week: { bookings: [], holidays: [] },
  mine: [],
  requests: [],
  notifications: [],
  staff: [],
  holidays: [],
  report: null,
  audit: [],
  flash: null,
  modal: null,
  confirm: null,
  busy: false,
  adminTab: "staff",
  importPreview: null,
  importRecords: null,
  staffForm: null,
  holidayForm: { day: "", period: "", reason: "" },
  settingsForm: null,
  requestFilter: "pending",
  mobileDay: 0,
  reportFrom: "",
  reportTo: "",
  rejectFor: null,
  rejectReason: "",
};

let store = null;
const seenNotes = new Set();
const app = () => document.getElementById("app");

function t(key) {
  return T[state.lang][key] ?? T.ar[key] ?? key;
}

function applyLang() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = APP_NAME;
  localStorage.setItem("manhal.lang", state.lang);
}

function clock() {
  return muscatParts(new Date());
}

function syncMobileDay() {
  const today = muscatParts(new Date()).iso;
  const index = [0, 1, 2, 3, 4].findIndex((offset) => addDays(state.weekSunday, offset) === today);
  state.mobileDay = index >= 0 ? index : 0;
}

function currentSunday() {
  return schoolSunday(clock().iso);
}

function schoolName() {
  return state.catalog?.settings?.school_name || SCHOOL_NAME_DEFAULT;
}

function principalName() {
  return state.catalog?.settings?.principal_name || PRINCIPAL_NAME_DEFAULT;
}

function breakInfo() {
  return state.catalog?.settings?.break || { starts: "09:45", ends: "10:05", label_ar: "الفسحة", label_en: "Break" };
}

function powers() {
  return can(state.me?.role);
}

function errorText(error) {
  const code = error?.code || error?.message || "generic";
  return t(`err_${code}`) || t("err_generic");
}

function flash(kind, text) {
  state.flash = { kind, text };
}

function formatIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(state.lang === "ar" ? "ar-OM" : "en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function periodLabel(n) {
  const row = state.catalog?.periods?.find((item) => Number(item.n) === Number(n));
  if (!row) return String(n);
  return state.lang === "en" ? row.label_en : row.label_ar;
}

function isPastSlot(day, period) {
  const now = clock();
  if (day < now.iso) return true;
  if (day > now.iso) return false;
  const row = state.catalog.periods.find((item) => Number(item.n) === Number(period));
  return Boolean(row && timeToMinutes(row.starts) <= timeToMinutes(now.time.slice(0, 5)));
}

function inCurrentWeek(day) {
  const sunday = currentSunday();
  return day >= sunday && day <= addDays(sunday, 4);
}

function bookingsAt(day, period, status) {
  return state.week.bookings.filter((row) => row.day === day && Number(row.period) === Number(period) && row.status === status);
}

function statusName(status) {
  return t(status) || status;
}

function reasonText(reason) {
  if (!reason) return "";
  if (reason === "SLOT_TAKEN") return t("autoReject");
  return reason;
}

function canCancel(group) {
  if (!state.me || group.held || !["pending", "approved"].includes(group.status)) return false;
  if (state.me.role === "superadmin" || state.me.role === "admin") return true;
  if (group.staff_id !== state.me.id) return false;
  return group.rows.every((row) => !isPastSlot(row.day, row.period) && inCurrentWeek(row.day));
}

function shell(content) {
  const unread = state.notifications.filter((row) => !row.read).length;
  const pendingGroups = groupBookings(state.requests.filter((row) => row.status === "pending")).length;
  const role = state.me?.role;
  const showRequests = role && (powers().manageBookings || role === "principal");
  const showAdmin = role && (powers().manageStaff || powers().manageHolidays || powers().viewReports || powers().settings);
  const link = (id, label, badge) => `<button class="nav-link ${state.route === id ? "nav-on" : ""}" data-action="go" data-route="${id}">${esc(label)}${badge ? `<span class="badge">${badge}</span>` : ""}</button>`;
  return `
    <div class="principal-bar">${esc(t("principalPrefix"))} ${esc(principalName())}</div>
    <header class="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-4 text-center">
      <div class="flex items-center justify-center gap-4">
        <img src="assets/school-logo.jpg" alt="" class="logo">
        <img src="assets/moe-logo.jpg" alt="" class="logo">
        <img src="assets/oman-vision-2040.png" alt="" class="logo">
      </div>
      <h1 class="text-3xl font-bold text-brand-800">${esc(APP_NAME)}</h1>
      <p class="text-sm text-slate-600">${esc(t("tagline"))}</p>
      <p class="text-sm font-semibold">${esc(schoolName())}</p>
    </header>
    ${state.me ? `
      <nav class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
        ${link("week", t("week"))}
        ${link("mine", t("mine"))}
        ${showRequests ? link("requests", t("requests"), pendingGroups || "") : ""}
        ${link("notifications", t("notifications"), unread || "")}
        ${showAdmin ? link("admin", t("admin")) : ""}
        <span class="flex-1"></span>
        <button class="nav-link" data-action="lang">${esc(t("language"))}</button>
        <button class="nav-link" data-action="logout">${esc(t("signOut"))}</button>
      </nav>` : `
      <div class="mx-auto flex w-full max-w-6xl justify-end px-4 pb-3">
        <button class="nav-link" data-action="lang">${esc(t("language"))}</button>
      </div>`}
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pb-8">${flashHtml()}${content}</main>
    <footer class="border-t border-slate-200 py-4 text-center text-xs text-slate-500">${esc(CREDIT_LINE)}</footer>`;
}

function flashHtml() {
  if (!state.flash) return "";
  const tone = state.flash.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800";
  return `<p class="mb-4 rounded-2xl px-4 py-3 text-sm font-semibold ${tone}">${esc(state.flash.text)}</p>`;
}

function renderLogin() {
  app().innerHTML = shell(`
    ${store?.mode === "local" ? `<p class="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm">${esc(t("localBanner"))}</p>` : ""}
    <form class="card mx-auto max-w-md space-y-4 p-6" data-action="login">
      <label class="block text-sm font-bold">${esc(t("fileNo"))}
        <input class="field mt-2" name="file_no" inputmode="numeric" autocomplete="username" required autofocus>
      </label>
      <button class="btn-primary w-full" type="submit">${esc(t("signIn"))}</button>
    </form>`);
}

function renderWeek() {
  const sunday = state.weekSunday;
  const thursday = addDays(sunday, 4);
  const days = [0, 1, 2, 3, 4].map((offset) => addDays(sunday, offset));
  const periods = state.catalog.periods;
  const canPdf = powers().viewReports;
  const atCurrent = sunday === currentSunday();
  return `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold">${esc(formatIso(sunday))} – ${esc(formatIso(thursday))}</h2>
        <div class="flex flex-wrap gap-2">
          <button class="btn-ghost" data-action="week" data-dir="-1">${esc(t("prevWeek"))}</button>
          <button class="btn-ghost" data-action="week" data-dir="1" ${atCurrent ? "disabled" : ""}>${esc(t("nextWeek"))}</button>
          ${canPdf ? `<button class="btn-primary" data-action="pdf">${esc(t("exportPdf"))}</button>` : ""}
        </div>
      </div>
      <div class="hidden lg:block overflow-x-auto card">
        <table class="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th class="p-2"></th>
              ${headerCells(periods)}
            </tr>
          </thead>
          <tbody>
            ${days.map((day, index) => `
              <tr>
                <th class="whitespace-nowrap p-2 text-start">${esc(DAYS[state.lang][index])}<div class="font-normal text-slate-500">${esc(formatIso(day))}</div></th>
                ${periods.map((period) => periodCell(day, period.n, true)).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="space-y-3 lg:hidden">
        <div class="flex gap-2 overflow-x-auto">
          ${days.map((day, index) => `<button class="tab ${state.mobileDay === index ? "tab-on" : ""}" data-action="mobile-day" data-index="${index}">${esc(DAYS[state.lang][index])}</button>`).join("")}
        </div>
        <div class="space-y-2">
          ${mobileCards(days[state.mobileDay], periods)}
        </div>
      </div>
    </section>`;
}

function headerCells(periods) {
  const info = breakInfo();
  const label = state.lang === "en" ? info.label_en : info.label_ar;
  return periods.map((period) => {
    const cell = `<th class="p-2">${esc(state.lang === "en" ? period.label_en : period.label_ar)}<div class="font-normal text-slate-500">${esc(period.starts)}–${esc(period.ends)}</div></th>`;
    if (Number(period.n) === 4) {
      return `${cell}<th class="w-16 p-2 text-amber-800">${esc(label)}<div class="font-normal">${esc(info.starts)}–${esc(info.ends)}</div></th>`;
    }
    return cell;
  }).join("");
}

function periodCell(day, period, desktop) {
  const html = cellButton(day, period);
  if (desktop && Number(period) === 4) {
    return `${html}<td class="cell cell-break">${esc(t("breakLabel"))}</td>`;
  }
  return html;
}

function cellButton(day, period) {
  const holiday = slotHoliday(state.week.holidays, day, period);
  const approved = bookingsAt(day, period, "approved")[0];
  const pending = bookingsAt(day, period, "pending");
  const past = isPastSlot(day, period) || !inCurrentWeek(day);
  let tone = "cell-free";
  let body = "";
  if (holiday) {
    tone = "cell-holiday";
    body = `<b>${esc(t("holiday"))}</b><span>${esc(holiday.reason || "")}</span>`;
  } else if (approved) {
    tone = "cell-ok";
    body = approved.kind === "event"
      ? `<b>${esc(approved.event_title)}</b><span>${esc(approved.staff_name)}</span>`
      : `<b>${esc(approved.staff_name)}</b>${approved.class_section ? `<span>${esc(approved.class_section)}</span>` : ""}<span>${esc(approved.subject || "")}</span>`;
  } else if (pending.length) {
    tone = "cell-wait";
    body = `<b>${esc(t("pending"))} × ${pending.length}</b>`;
  } else if (past) {
    tone = "cell-past";
    body = `<span>${esc(t("past"))}</span>`;
  }
  const ownPending = pending.some((row) => row.staff_id === state.me.id);
  const clickable = !holiday && (approved || ownPending || (!past && inCurrentWeek(day)));
  const tag = clickable ? "button" : "div";
  const attrs = clickable ? `type="button" data-action="slot" data-day="${day}" data-period="${period}"` : "";
  return `<td><${tag} class="cell ${tone}" ${attrs}>${body || ""}</${tag}></td>`;
}

function mobileCards(day, periods) {
  const info = breakInfo();
  return periods.map((period) => {
    const card = cellButton(day, period.n).replace("<td>", "").replace("</td>", "");
    const block = `<article><p class="mb-1 text-xs font-bold text-slate-500">${esc(state.lang === "en" ? period.label_en : period.label_ar)} · ${esc(period.starts)}</p>${card}</article>`;
    if (Number(period.n) === 4) {
      return `${block}<p class="rounded-2xl bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-900">${esc(state.lang === "en" ? info.label_en : info.label_ar)} ${esc(info.starts)}–${esc(info.ends)}</p>`;
    }
    return block;
  }).join("");
}

function renderMine() {
  const groups = groupBookings(state.mine).sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!groups.length) return `<p class="text-sm text-slate-500">${esc(t("empty"))}</p>`;
  return `<section class="space-y-3">${groups.map((group) => bookingCard(group, false)).join("")}</section>`;
}

function renderRequests() {
  const filtered = state.requests.filter((row) => state.requestFilter === "all" || row.status === state.requestFilter);
  const groups = groupBookings(filtered).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const filters = ["pending", "approved", "rejected", "cancelled", "all"];
  return `
    <section class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${filters.map((filter) => `<button class="tab ${state.requestFilter === filter ? "tab-on" : ""}" data-action="filter" data-filter="${filter}">${esc(filter === "all" ? (state.lang === "ar" ? "الكل" : "All") : t(filter))}</button>`).join("")}
      </div>
      ${groups.length ? groups.map((group) => bookingCard(group, true)).join("") : `<p class="text-sm text-slate-500">${esc(t("empty"))}</p>`}
    </section>`;
}

function bookingCard(group, queue) {
  const title = group.kind === "event" ? group.event_title : group.lesson_title;
  const meta = group.kind === "event"
    ? `${t("kindEvent")} · ${t("attendees")}: ${group.attendees || ""}${group.visitor_party ? ` · ${group.visitor_party}` : ""}`
    : [group.class_section, group.subject].filter(Boolean).join(" · ");
  const decide = queue && group.status === "pending" && powers().manageBookings;
  const viewOnly = queue && group.status === "pending" && !powers().manageBookings;
  return `
    <article class="card space-y-2 p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="font-bold">${esc(group.staff_name || state.me.full_name)} · ${esc(title || "")}</h3>
          <p class="text-sm text-slate-600">${esc(DAYS[state.lang][weekdayOf(group.day)])} ${esc(formatIso(group.day))} · ${group.periods.map((n) => esc(periodLabel(n))).join(state.lang === "ar" ? "، " : ", ")}</p>
          <p class="text-sm">${esc(meta)}</p>
          ${group.notes ? `<p class="text-sm text-slate-500">${esc(group.notes)}</p>` : ""}
          ${group.equipment ? `<p class="text-sm text-slate-500">${esc(group.equipment)}</p>` : ""}
          ${group.status === "rejected" ? `<p class="text-sm text-rose-700">${esc(reasonText(group.reject_reason))}</p>` : ""}
        </div>
        <span class="status status-${group.status}">${esc(statusName(group.status))}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        ${canCancel(group) ? `<button class="btn-ghost" data-action="cancel" data-group="${esc(group.group_id)}">${esc(t("cancel"))}</button>` : ""}
        ${decide ? `<button class="btn-ok" data-action="decide" data-group="${esc(group.group_id)}" data-approve="1">${esc(t("accept"))}</button>` : ""}
        ${decide ? `<button class="btn-danger" data-action="reject-open" data-group="${esc(group.group_id)}">${esc(t("reject"))}</button>` : ""}
        ${viewOnly ? `<span class="text-xs font-semibold text-slate-500">${esc(t("viewOnly"))}</span>` : ""}
      </div>
      ${state.rejectFor === group.group_id ? `
        <form class="flex flex-wrap gap-2" data-action="reject-send" data-group="${esc(group.group_id)}">
          <input class="field max-w-md" data-field="reject_reason" placeholder="${esc(t("rejectReason"))}" value="${esc(state.rejectReason)}">
          <button class="btn-danger" type="submit">${esc(t("confirmReject"))}</button>
        </form>` : ""}
    </article>`;
}

function weekdayOf(iso) {
  const sunday = schoolSunday(iso);
  return [0, 1, 2, 3, 4].find((offset) => addDays(sunday, offset) === iso) ?? 0;
}

function renderNotes() {
  return `
    <section class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <button class="btn-ghost" data-action="read-all">${esc(t("markAll"))}</button>
        <button class="btn-ghost" data-action="notify-permission">${esc(t("enableNotes"))}</button>
      </div>
      ${state.notifications.length ? state.notifications.map((row) => `
        <button class="card w-full p-4 text-start ${row.read ? "opacity-70" : ""}" data-action="read" data-id="${esc(row.id)}">
          <b>${esc(trText(row.title, state.lang))}</b>
          <p class="text-sm">${esc(trText(row.body, state.lang))}</p>
        </button>`).join("") : `<p class="text-sm text-slate-500">${esc(t("empty"))}</p>`}
    </section>`;
}

function renderModal() {
  const modal = state.modal;
  if (!modal) return "";
  if (modal.type === "detail") return detailModal(modal.group);
  return bookModal(modal);
}

function bookModal(modal) {
  const form = modal.form;
  const periods = state.catalog.periods;
  return `
    <div class="overlay" data-action="close-modal">
      <form class="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" data-action="book-send">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold">${esc(t("bookTitle"))}</h2>
          <button type="button" class="btn-ghost" data-action="close-modal">${esc(t("close"))}</button>
        </div>
        <div class="flex gap-2">
          <button type="button" class="tab ${form.kind === "lesson" ? "tab-on" : ""}" data-action="kind" data-kind="lesson">${esc(t("kindLesson"))}</button>
          <button type="button" class="tab ${form.kind === "event" ? "tab-on" : ""}" data-action="kind" data-kind="event">${esc(t("kindEvent"))}</button>
        </div>
        <label class="block text-sm font-bold">${esc(t("name"))}
          <input class="field mt-1" value="${esc(state.me.full_name)}" disabled>
        </label>
        <div>
          <p class="mb-1 text-sm font-bold">${esc(t("periods"))}</p>
          <div class="flex flex-wrap gap-2">
            ${periods.map((period) => {
              const selected = form.periods.includes(Number(period.n));
              const allowed = periodAllowed(modal.day, Number(period.n), form.periods, modal.origin);
              return `<button type="button" class="tab ${selected ? "tab-on" : ""}" data-action="toggle-period" data-period="${period.n}" ${!selected && !allowed ? "disabled" : ""}>${esc(state.lang === "en" ? period.label_en : period.label_ar)}</button>`;
            }).join("")}
          </div>
        </div>
        ${form.kind === "lesson" ? `
          <label class="block text-sm font-bold">${esc(t("classSection"))}
            <select class="field mt-1" data-field="class_section">${state.catalog.classSections.map((row) => `<option ${form.class_section === row.label ? "selected" : ""}>${esc(row.label)}</option>`).join("")}</select>
          </label>
          <label class="block text-sm font-bold">${esc(t("subject"))}
            <input class="field mt-1" data-field="subject" value="${esc(form.subject || "")}">
          </label>
          <label class="block text-sm font-bold">${esc(t("lessonTitle"))}
            <input class="field mt-1" data-field="lesson_title" value="${esc(form.lesson_title || "")}">
          </label>` : `
          <label class="block text-sm font-bold">${esc(t("eventTitle"))}
            <input class="field mt-1" data-field="event_title" value="${esc(form.event_title || "")}">
          </label>
          <label class="block text-sm font-bold">${esc(t("visitor"))} <span class="font-normal text-slate-500">(${esc(t("optional"))})</span>
            <input class="field mt-1" data-field="visitor_party" value="${esc(form.visitor_party || "")}">
          </label>
          <label class="block text-sm font-bold">${esc(t("attendees"))}
            <input class="field mt-1" type="number" min="1" data-field="attendees" value="${esc(form.attendees || "")}">
          </label>`}
        <label class="block text-sm font-bold">${esc(t("equipment"))} <span class="font-normal text-slate-500">(${esc(t("optional"))})</span>
          <input class="field mt-1" data-field="equipment" value="${esc(form.equipment || "")}" placeholder="${esc(state.lang === "ar" ? "جهاز عرض، مكبر صوت، كراسي إضافية" : "Projector, speaker, extra chairs")}">
        </label>
        <label class="block text-sm font-bold">${esc(t("notes"))} <span class="font-normal text-slate-500">(${esc(t("optional"))})</span>
          <textarea class="field mt-1" data-field="notes">${esc(form.notes || "")}</textarea>
        </label>
        ${modal.hint ? `<p class="text-sm text-amber-800">${esc(modal.hint)}</p>` : ""}
        ${modal.error ? `<p class="text-sm font-semibold text-rose-700">${esc(modal.error)}</p>` : ""}
        <button class="btn-primary w-full" type="submit" ${state.busy ? "disabled" : ""}>${esc(t("send"))}</button>
      </form>
    </div>`;
}

function periodAllowed(day, period, selected, origin) {
  if (period === origin) return true;
  if (!slotOpen(day, period)) return false;
  const next = [...new Set([...selected, period])].sort((a, b) => a - b);
  return next.includes(origin) && isConsecutive(next);
}

function slotOpen(day, period) {
  if (!inCurrentWeek(day) || isPastSlot(day, period)) return false;
  if (slotHoliday(state.week.holidays, day, period)) return false;
  if (bookingsAt(day, period, "approved").length) return false;
  if (bookingsAt(day, period, "pending").some((row) => row.staff_id === state.me.id)) return false;
  return true;
}

function detailModal(group) {
  return `
    <div class="overlay" data-action="close-modal">
      <div class="card w-full max-w-lg space-y-3 p-5">
        ${bookingCard(group, false)}
        <button class="btn-ghost" data-action="close-modal">${esc(t("close"))}</button>
      </div>
    </div>`;
}

function renderConfirm() {
  if (!state.confirm) return "";
  return `
    <div class="overlay">
      <div class="card w-full max-w-md space-y-3 p-5">
        <p>${esc(t("holidayConfirm"))}</p>
        <p class="font-bold">${esc(String(state.confirm.count))}</p>
        <div class="flex gap-2">
          <button class="btn-danger" data-action="holiday-confirm">${esc(t("confirm"))}</button>
          <button class="btn-ghost" data-action="confirm-close">${esc(t("close"))}</button>
        </div>
      </div>
    </div>`;
}

function render() {
  applyLang();
  if (!state.me) {
    renderLogin();
    return;
  }
  let content = "";
  if (state.route === "week") content = renderWeek();
  else if (state.route === "mine") content = renderMine();
  else if (state.route === "requests") content = renderRequests();
  else if (state.route === "notifications") content = renderNotes();
  else if (state.route === "admin") content = renderAdmin(state, t, powers());
  app().innerHTML = shell(content) + renderModal() + renderConfirm();
}

function assignField(field, value) {
  if (field.startsWith("staff_") && state.staffForm) {
    const map = { staff_full_name: "full_name", staff_file_no: "file_no", staff_job_type: "job_type", staff_subject: "subject", staff_role: "role" };
    state.staffForm[map[field] || field] = value;
    return;
  }
  if (field.startsWith("holiday_")) {
    state.holidayForm[field.replace("holiday_", "")] = value;
    return;
  }
  if (field === "reject_reason") {
    state.rejectReason = value;
    return;
  }
  if (field === "report_from") state.reportFrom = value;
  if (field === "report_to") state.reportTo = value;
  if (state.settingsForm) {
    if (field === "set_school") state.settingsForm.school_name = value;
    if (field === "set_principal") state.settingsForm.principal_name = value;
    if (field === "set_break_start") state.settingsForm.break.starts = value;
    if (field === "set_break_end") state.settingsForm.break.ends = value;
    const start = field.match(/^period_start_(\d)$/);
    const end = field.match(/^period_end_(\d)$/);
    if (start) state.settingsForm.periods.find((row) => Number(row.n) === Number(start[1])).starts = value;
    if (end) state.settingsForm.periods.find((row) => Number(row.n) === Number(end[1])).ends = value;
  }
  if (state.modal?.form && ["class_section", "subject", "lesson_title", "event_title", "visitor_party", "attendees", "equipment", "notes"].includes(field)) {
    state.modal.form[field] = value;
  }
}

async function loadCatalog() {
  state.catalog = await store.catalog();
  const settings = state.catalog.settings || {};
  state.catalog.settings = {
    school_name: settings.school_name || SCHOOL_NAME_DEFAULT,
    principal_name: settings.principal_name || PRINCIPAL_NAME_DEFAULT,
    break: settings.break || breakInfo(),
  };
}

async function loadWeek() {
  state.week = await store.week(state.weekSunday);
}

async function loadMine() {
  state.mine = await store.mine();
}

async function loadRequests() {
  if (powers().manageBookings || state.me.role === "principal") state.requests = await store.requests();
}

async function loadNotes(pingNew) {
  const rows = await store.notifications();
  if (pingNew) {
    for (const row of rows) {
      if (!row.read && !seenNotes.has(row.id)) {
        await showBrowserNote(trText(row.title, state.lang), trText(row.body, state.lang));
      }
    }
  }
  rows.forEach((row) => seenNotes.add(row.id));
  state.notifications = rows;
}

async function showBrowserNote(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await reg.showNotification(title, { body, lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr" });
    else new Notification(title, { body });
  } catch {
    /* the in-app list still updates */
  }
}

async function refreshLive() {
  if (!state.me) return;
  await loadWeek();
  await loadNotes(true);
  if (state.route === "mine") await loadMine();
  if (state.route === "requests" || state.route === "admin") await loadRequests();
  const active = document.activeElement;
  if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
  render();
}

function openSlot(day, period) {
  const approved = bookingsAt(day, period, "approved")[0];
  const pending = bookingsAt(day, period, "pending");
  const mine = pending.find((row) => row.staff_id === state.me.id) || (approved && approved.staff_id === state.me.id ? approved : null);
  const target = approved || mine;
  if (target) {
    const group = groupBookings(state.week.bookings.filter((row) => row.group_id === target.group_id && row.status === target.status))[0];
    state.modal = { type: "detail", group };
    render();
    return;
  }
  if (!inCurrentWeek(day) || isPastSlot(day, period) || slotHoliday(state.week.holidays, day, period)) return;
  state.modal = {
    type: "book",
    day,
    origin: Number(period),
    hint: pending.length ? t("compete") : "",
    error: "",
    form: {
      kind: "lesson",
      periods: [Number(period)],
      class_section: state.catalog.classSections[0]?.label || "",
      subject: state.me.subject || "",
      lesson_title: "",
      event_title: "",
      visitor_party: "",
      attendees: "",
      equipment: "",
      notes: "",
    },
  };
  render();
}

function nativeSession(fileNo) {
  const bridge = globalThis.ManhalAndroid;
  if (!bridge?.setSession) return;
  bridge.setSession(SUPABASE_URL || "", SUPABASE_ANON_KEY || "", fileNo || "", state.lang);
}

async function onLogin(form) {
  const fileNo = new FormData(form).get("file_no");
  state.busy = true;
  try {
    state.me = await store.signIn(fileNo);
    nativeSession(state.me.file_no);
    state.weekSunday = currentSunday();
    state.reportFrom = state.weekSunday;
    state.reportTo = addDays(state.weekSunday, 4);
    syncMobileDay();
    await loadCatalog();
    await loadWeek();
    await loadMine();
    await loadRequests();
    await loadNotes(false);
    state.route = "week";
    location.hash = "#/week";
    state.flash = null;
  } catch (error) {
    flash("bad", errorText(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function submitBooking(form) {
  const modal = state.modal;
  form.querySelectorAll("[data-field]").forEach((el) => assignField(el.dataset.field, el.value));
  const input = { ...modal.form, day: modal.day, periods: modal.form.periods };
  if (input.kind === "lesson" && (!input.class_section || !input.subject?.trim() || !input.lesson_title?.trim())) {
    modal.error = t("err_KIND_FIELDS");
    render();
    return;
  }
  if (input.kind === "event" && (!input.event_title?.trim() || !(Number(input.attendees) > 0))) {
    modal.error = t("err_KIND_FIELDS");
    render();
    return;
  }
  state.busy = true;
  try {
    await store.createBooking(input);
    state.modal = null;
    flash("ok", t("sent"));
    await loadWeek();
    await loadMine();
  } catch (error) {
    modal.error = errorText(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function exportPdf() {
  try {
    const model = buildWeekModel({
      sunday: state.weekSunday,
      bookings: state.week.bookings,
      holidays: state.week.holidays,
      periods: state.catalog.periods,
      schoolName: schoolName(),
    });
    await downloadWeekPdf(model);
  } catch (error) {
    flash("bad", errorText(error));
    render();
  }
}

async function handle(event) {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "login" || action === "book-send" || action === "staff-save" || action === "holiday-save" || action === "settings-save" || action === "report-run" || action === "reject-send") {
    return;
  }
  if (action === "close-modal" && event.target !== el && !event.target.closest("button")) return;
  event.preventDefault();
  try {
    if (action === "lang") {
      state.lang = state.lang === "ar" ? "en" : "ar";
      if (state.me) nativeSession(state.me.file_no);
      render();
    } else if (action === "logout") {
      await store.signOut();
      globalThis.ManhalAndroid?.clearSession?.();
      state.me = null;
      state.modal = null;
      location.hash = "";
      render();
    } else if (action === "go") {
      state.route = el.dataset.route;
      location.hash = `#/${state.route}`;
      if (state.route === "admin") await openAdmin();
      if (state.route === "mine") await loadMine();
      if (state.route === "requests") await loadRequests();
      state.flash = null;
      render();
    } else if (action === "week") {
      const next = addDays(state.weekSunday, Number(el.dataset.dir) * 7);
      if (next > currentSunday()) return;
      state.weekSunday = next;
      syncMobileDay();
      await loadWeek();
      render();
    } else if (action === "mobile-day") {
      state.mobileDay = Number(el.dataset.index);
      render();
    } else if (action === "slot") {
      openSlot(el.dataset.day, Number(el.dataset.period));
    } else if (action === "close-modal") {
      state.modal = null;
      render();
    } else if (action === "kind") {
      state.modal.form.kind = el.dataset.kind;
      render();
    } else if (action === "toggle-period") {
      const period = Number(el.dataset.period);
      const form = state.modal.form;
      if (period === state.modal.origin && form.periods.includes(period) && form.periods.length === 1) return;
      const selected = new Set(form.periods);
      if (selected.has(period)) selected.delete(period);
      else if (periodAllowed(state.modal.day, period, form.periods, state.modal.origin)) selected.add(period);
      const next = [...selected].sort((a, b) => a - b);
      if (!next.includes(state.modal.origin) || !isConsecutive(next)) return;
      form.periods = next;
      render();
    } else if (action === "cancel") {
      await store.cancel(el.dataset.group);
      state.modal = null;
      await loadWeek();
      await loadMine();
      await loadRequests();
      render();
    } else if (action === "decide") {
      await store.decide(el.dataset.group, true, null);
      await loadWeek();
      await loadRequests();
      await loadNotes(false);
      render();
    } else if (action === "reject-open") {
      state.rejectFor = el.dataset.group;
      state.rejectReason = "";
      render();
    } else if (action === "filter") {
      state.requestFilter = el.dataset.filter;
      render();
    } else if (action === "read") {
      await store.markRead(Number(el.dataset.id) || el.dataset.id);
      await loadNotes(false);
      render();
    } else if (action === "read-all") {
      await store.markAllRead();
      await loadNotes(false);
      render();
    } else if (action === "notify-permission") {
      if ("Notification" in window) await Notification.requestPermission();
    } else if (action === "pdf") {
      await exportPdf();
    } else if (action === "admin-tab") {
      state.adminTab = el.dataset.tab;
      if (state.adminTab === "settings") fillSettingsForm();
      render();
    } else if (action === "staff-edit") {
      const row = state.staff.find((item) => item.id === el.dataset.id);
      state.staffForm = { ...row, subject: row.subject || "" };
      render();
    } else if (action === "staff-cancel") {
      state.staffForm = { id: null, full_name: "", file_no: "", job_type: "teaching", subject: "", role: "staff" };
      render();
    } else if (action === "staff-active") {
      const row = state.staff.find((item) => item.id === el.dataset.id);
      await store.saveStaff({ ...row, active: el.dataset.active === "1" });
      state.staff = await store.staffList();
      flash("ok", t("saved"));
      render();
    } else if (action === "holiday-delete") {
      await store.deleteHoliday(el.dataset.id);
      state.holidays = await store.holidays();
      await loadWeek();
      render();
    } else if (action === "holiday-confirm") {
      const payload = { ...state.confirm.payload, confirm: true };
      await store.addHoliday(payload);
      state.confirm = null;
      state.holidays = await store.holidays();
      await loadWeek();
      flash("ok", t("saved"));
      render();
    } else if (action === "confirm-close") {
      state.confirm = null;
      render();
    } else if (action === "report-csv" && state.report) {
      const csv = reportToCsv(state.report);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `manhal-report-${state.reportFrom}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    flash("bad", errorText(error));
    render();
  }
}

async function onSubmit(event) {
  const form = event.target.closest("form[data-action]");
  if (!form) return;
  event.preventDefault();
  const action = form.dataset.action;
  try {
    if (action === "login") await onLogin(form);
    else if (action === "book-send") await submitBooking(form);
    else if (action === "reject-send") {
      form.querySelectorAll("[data-field]").forEach((el) => assignField(el.dataset.field, el.value));
      await store.decide(form.dataset.group, false, state.rejectReason);
      state.rejectFor = null;
      await loadWeek();
      await loadRequests();
      await loadNotes(false);
      render();
    } else if (action === "staff-save") {
      form.querySelectorAll("[data-field]").forEach((el) => assignField(el.dataset.field, el.value));
      await store.saveStaff(state.staffForm);
      state.staffForm = { id: null, full_name: "", file_no: "", job_type: "teaching", subject: "", role: "staff" };
      state.staff = await store.staffList();
      flash("ok", t("saved"));
      render();
    } else if (action === "holiday-save") {
      form.querySelectorAll("[data-field]").forEach((el) => assignField(el.dataset.field, el.value));
      const result = await store.addHoliday({
        day: state.holidayForm.day,
        period: state.holidayForm.period,
        reason: state.holidayForm.reason,
        confirm: false,
      });
      if (result?.needs_confirm) {
        state.confirm = { count: result.count, payload: { day: state.holidayForm.day, period: state.holidayForm.period, reason: state.holidayForm.reason } };
      } else {
        flash("ok", t("saved"));
        state.holidays = await store.holidays();
        await loadWeek();
      }
      render();
    } else if (action === "settings-save") {
      form.querySelectorAll("[data-field]").forEach((el) => assignField(el.dataset.field, el.value));
      const formState = state.settingsForm;
      await store.savePeriods(formState.periods);
      await store.saveSettings({
        school_name: formState.school_name,
        principal_name: formState.principal_name,
        break: formState.break,
      });
      await loadCatalog();
      fillSettingsForm();
      flash("ok", t("saved"));
      render();
    } else if (action === "report-run") {
      form.querySelectorAll("[data-field]").forEach((el) => assignField(el.dataset.field, el.value));
      state.report = await store.report(state.reportFrom, state.reportTo);
      render();
    }
  } catch (error) {
    flash("bad", errorText(error));
    render();
  }
}

function fillSettingsForm() {
  state.settingsForm = {
    school_name: schoolName(),
    principal_name: principalName(),
    break: { ...breakInfo() },
    periods: state.catalog.periods.map((row) => ({ ...row })),
  };
}

async function openAdmin() {
  if (powers().manageStaff) state.staff = await store.staffList();
  if (powers().manageHolidays || powers().viewReports) state.holidays = await store.holidays();
  if (powers().audit) state.audit = await store.auditLog();
  if (state.adminTab === "settings") fillSettingsForm();
  if (!state.reportFrom) {
    state.reportFrom = state.weekSunday;
    state.reportTo = addDays(state.weekSunday, 4);
  }
}

function routeFromHash() {
  const name = location.hash.replace(/^#\//, "");
  return ["week", "mine", "requests", "notifications", "admin"].includes(name) ? name : "week";
}

async function boot() {
  applyLang();
  store = await createStore();
  state.me = await store.restore();
  state.weekSunday = currentSunday();
  state.reportFrom = state.weekSunday;
  state.reportTo = addDays(state.weekSunday, 4);
  syncMobileDay();
  if (state.me) {
    nativeSession(state.me.file_no);
    await loadCatalog();
    await loadWeek();
    await loadMine();
    await loadRequests();
    await loadNotes(false);
    state.route = routeFromHash();
    if (state.route === "admin") await openAdmin();
  } else {
    state.catalog = { settings: { school_name: SCHOOL_NAME_DEFAULT, principal_name: PRINCIPAL_NAME_DEFAULT, break: breakInfo() }, periods: [], classSections: [] };
  }
  store.subscribe(() => { refreshLive().catch(() => {}); });
  document.addEventListener("click", (event) => { handle(event).catch((error) => { flash("bad", errorText(error)); render(); }); });
  document.addEventListener("submit", (event) => { onSubmit(event).catch((error) => { flash("bad", errorText(error)); render(); }); });
  document.addEventListener("input", (event) => {
    if (event.target.dataset?.field) assignField(event.target.dataset.field, event.target.value);
  });
  document.addEventListener("change", (event) => {
    if (event.target.dataset?.field) assignField(event.target.dataset.field, event.target.value);
  });
  window.addEventListener("hashchange", () => {
    if (!state.me) return;
    const next = routeFromHash();
    if (next === state.route) return;
    state.route = next;
    if (state.route === "admin") openAdmin().then(render);
    else render();
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  render();
}

boot().catch((error) => {
  document.getElementById("app").textContent = errorText(error);
});
