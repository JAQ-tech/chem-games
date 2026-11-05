import { SCHOOL_NAME_DEFAULT, PRINCIPAL_NAME_DEFAULT } from "./config.js";

export const TZ = "Asia/Muscat";

export const CLASS_SECTIONS = [
  "7-1", "7-2", "7-3", "7-4", "7-5", "7-6", "7-7", "7-8", "7-9",
  "8-1", "8-2", "8-3", "8-4", "8-5", "8-6", "8-7", "8-8", "8-9", "8-10",
  "9-1", "9-2", "9-3", "9-4", "9-5", "9-6", "9-7", "9-8", "9-9",
  "8س", "10س",
];

export const DEFAULT_PERIODS = [
  { n: 1, label_ar: "الحصة الأولى", label_en: "Period 1", starts: "07:10", ends: "07:45" },
  { n: 2, label_ar: "الحصة الثانية", label_en: "Period 2", starts: "07:50", ends: "08:25" },
  { n: 3, label_ar: "الحصة الثالثة", label_en: "Period 3", starts: "08:30", ends: "09:05" },
  { n: 4, label_ar: "الحصة الرابعة", label_en: "Period 4", starts: "09:10", ends: "09:45" },
  { n: 5, label_ar: "الحصة الخامسة", label_en: "Period 5", starts: "10:05", ends: "10:40" },
  { n: 6, label_ar: "الحصة السادسة", label_en: "Period 6", starts: "10:45", ends: "11:20" },
  { n: 7, label_ar: "الحصة السابعة", label_en: "Period 7", starts: "11:25", ends: "12:00" },
];

export const DEFAULT_BREAK = {
  starts: "09:45",
  ends: "10:05",
  label_ar: "الفسحة",
  label_en: "Break",
};

const STAFF_RANK = { principal: 0, admin: 1 };

export function sortStaff(rows) {
  return [...(rows || [])].sort((a, b) => {
    const rankA = STAFF_RANK[a.role] ?? 2;
    const rankB = STAFF_RANK[b.role] ?? 2;
    if (rankA !== rankB) return rankA - rankB;
    return String(a.full_name || "").localeCompare(String(b.full_name || ""), "ar");
  });
}

export const BOOTSTRAP_STAFF = [
  { file_no: "900001", full_name: "يعقوب المعمري", job_type: "technical", subject: "", role: "superadmin" },
  { file_no: "900002", full_name: "أحمد السناني", job_type: "admin", subject: "", role: "admin" },
  { file_no: "900003", full_name: "محمد النخيلي", job_type: "admin", subject: "", role: "admin" },
  { file_no: "900004", full_name: "محمود هلال المعمري", job_type: "technical", subject: "", role: "specialist" },
  { file_no: "900005", full_name: "د.سالم المعمري", job_type: "admin", subject: "", role: "principal" },
];

export const JOB_MAP = {
  "إداري": "admin",
  "فني": "technical",
  "معلم": "teaching",
  admin: "admin",
  technical: "technical",
  teaching: "teaching",
};

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export class AppError extends Error {
  constructor(code, extra) {
    super(code);
    this.code = code;
    this.extra = extra || null;
  }
}

export function arDigits(value) {
  return String(value).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

export function bi(ar, en) {
  return JSON.stringify({ ar, en });
}

export function trText(value, lang) {
  if (value == null) return "";
  const text = String(value);
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") return parsed[lang] || parsed.ar || text;
    } catch {
      return text;
    }
  }
  return text;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function muscatParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${String(hour).padStart(2, "0")}:${parts.minute}:${parts.second}`;
  return { iso, time, weekday: parts.weekday };
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

export const SUBJECT_HOLD_NAME = "حصة المادة";

// Standing subject periods. weekday 0 is Sunday.
export const SUBJECT_HOLDS = [
  { weekday: 0, period: 4, subject: "لغة عربية" },
  { weekday: 1, period: 4, subject: "علوم" },
  { weekday: 2, period: 4, subject: "رياضيات" },
  { weekday: 2, period: 5, subject: "تربية إسلامية" },
  { weekday: 3, period: 5, subject: "لغة إنجليزية" },
  { weekday: 4, period: 4, subject: "الدراسات الاجتماعية" },
];

export function isSubjectHold(day, period) {
  const weekday = weekdayIndex(day);
  return SUBJECT_HOLDS.some((slot) => slot.weekday === weekday && Number(slot.period) === Number(period));
}

export function subjectHoldRows(from, to) {
  const rows = [];
  for (const day of eachDate(from, to)) {
    const weekday = weekdayIndex(day);
    for (const slot of SUBJECT_HOLDS) {
      if (slot.weekday !== weekday) continue;
      rows.push({
        id: `hold:${day}:${slot.period}`,
        group_id: `hold:${day}:${slot.period}`,
        day,
        period: slot.period,
        status: "approved",
        kind: "lesson",
        staff_id: null,
        staff_name: SUBJECT_HOLD_NAME,
        class_section: "",
        subject: slot.subject,
        lesson_title: slot.subject,
        held: true,
        created_at: `${day}T00:00:00.000Z`,
      });
    }
  }
  return rows;
}

export function withSubjectHolds(bookings, from, to) {
  return [...subjectHoldRows(from, to), ...(bookings || [])];
}

export function weekdayIndex(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function schoolSunday(iso) {
  return addDays(iso, -weekdayIndex(iso));
}

export function isWeekend(iso) {
  const day = weekdayIndex(iso);
  return day === 5 || day === 6;
}

export function timeToMinutes(value) {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  return h * 60 + m;
}

export function isConsecutive(periods) {
  const sorted = [...new Set(periods.map(Number))].sort((a, b) => a - b);
  if (!sorted.length) return false;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return sorted.every((n) => n >= 1 && n <= 7);
}

export function slotHoliday(holidays, day, period) {
  return holidays.find((h) => h.day === day && (h.period == null || Number(h.period) === Number(period))) || null;
}

export function can(role) {
  const managers = ["superadmin", "admin", "specialist"];
  return {
    manageBookings: managers.includes(role),
    viewReports: ["superadmin", "admin", "specialist", "principal"].includes(role),
    manageStaff: ["superadmin", "admin"].includes(role),
    assignRoles: role === "superadmin",
    manageHolidays: managers.includes(role),
    settings: role === "superadmin",
    audit: role === "superadmin",
    cancelAny: ["superadmin", "admin"].includes(role),
  };
}

export function periodHasStarted(period, today, nowTime) {
  if (!period?.starts) return false;
  return timeToMinutes(period.starts) <= timeToMinutes(nowTime.slice(0, 5));
}

export function slotBlock(ctx, day, period) {
  const { today, nowTime, weekSunday, periods, holidays, bookings, staffId } = ctx;
  const thursday = addDays(weekSunday, 4);
  if (isWeekend(day)) return "WEEKEND";
  if (day < weekSunday || day > thursday) return "OUTSIDE_WEEK";
  if (day < today) return "PAST";
  const periodRow = periods.find((p) => Number(p.n) === Number(period));
  if (!periodRow) return "PERIODS";
  if (day === today && periodHasStarted(periodRow, today, nowTime)) return "STARTED";
  if (slotHoliday(holidays, day, period)) return "HOLIDAY";
  if (isSubjectHold(day, period)) return "SLOT_TAKEN";
  if (bookings.some((b) => b.day === day && Number(b.period) === Number(period) && b.status === "approved")) {
    return "SLOT_TAKEN";
  }
  if (bookings.some((b) => b.day === day && Number(b.period) === Number(period) && b.staff_id === staffId && (b.status === "pending" || b.status === "approved"))) {
    return "ALREADY_REQUESTED";
  }
  return null;
}

export function assertBooking(input, ctx) {
  const periods = [...new Set((input.periods || []).map(Number))].sort((a, b) => a - b);
  if (!isConsecutive(periods)) throw new AppError("NOT_CONSECUTIVE");
  if (input.kind === "lesson") {
    if (!String(input.class_section || "").trim() || !String(input.subject || "").trim() || !String(input.lesson_title || "").trim()) {
      throw new AppError("KIND_FIELDS");
    }
  } else if (input.kind === "event") {
    const attendees = Number(input.attendees);
    if (!String(input.event_title || "").trim() || !Number.isFinite(attendees) || attendees <= 0) {
      throw new AppError("KIND_FIELDS");
    }
  } else {
    throw new AppError("KIND_FIELDS");
  }
  for (const period of periods) {
    const block = slotBlock(ctx, input.day, period);
    if (block) throw new AppError(block);
  }
  return periods;
}

export function rowsFromMatrix(matrix) {
  if (!matrix?.length) return [];
  const headers = matrix[0].map((cell) => String(cell ?? "").trim());
  return matrix.slice(1).map((row, index) => {
    const record = { rowNumber: index + 2 };
    headers.forEach((header, col) => {
      record[header] = row[col] == null ? "" : String(row[col]).trim();
    });
    return record;
  }).filter((record) => Object.entries(record).some(([key, value]) => key !== "rowNumber" && String(value).trim() !== ""));
}

export function classifyStaffRows(records, existingFileNos) {
  const existing = new Set((existingFileNos || []).map((value) => String(value).trim()));
  const seen = new Map();
  const prepared = records.map((record) => {
    const note = String(record.note ?? "").trim().toLowerCase();
    const fileNo = String(record.file_no ?? "").trim();
    const fullName = String(record.full_name ?? "").trim();
    const rawJob = String(record.job_type ?? "").trim();
    const subject = String(record.subject ?? "").trim();
    if (note === "example") {
      return { ...record, file_no: fileNo, full_name: fullName, subject, action: "skip", errors: [], job_code: null };
    }
    const errors = [];
    if (!fullName) errors.push("name");
    if (!fileNo) errors.push("file");
    const jobCode = JOB_MAP[rawJob] || null;
    if (!jobCode) errors.push("job");
    if (fileNo) {
      const rows = seen.get(fileNo) || [];
      rows.push(record.rowNumber);
      seen.set(fileNo, rows);
    }
    return {
      ...record,
      file_no: fileNo,
      full_name: fullName,
      subject,
      job_code: jobCode,
      action: errors.length ? "error" : (existing.has(fileNo) ? "update" : "insert"),
      errors,
    };
  });

  for (const [fileNo, rows] of seen) {
    if (!fileNo || rows.length < 2) continue;
    for (const row of prepared) {
      if (row.action === "skip") continue;
      if (row.file_no === fileNo) {
        if (!row.errors.includes("duplicate")) row.errors.push("duplicate");
        row.action = "error";
      }
    }
  }
  return prepared;
}

export function eachDate(from, to) {
  const days = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function buildReport(bookings, holidays, from, to) {
  const inRange = (booking) => booking.day >= from && booking.day <= to && booking.status === "approved";
  const approved = bookings.filter(inRange);
  const lessons = approved.filter((b) => (b.kind || "lesson") === "lesson");
  const events = approved.filter((b) => b.kind === "event");
  let available = 0;
  for (const day of eachDate(from, to)) {
    if (isWeekend(day)) continue;
    for (let period = 1; period <= 7; period += 1) {
      if (!slotHoliday(holidays, day, period)) available += 1;
    }
  }
  const countBy = (rows, keyFn) => {
    const map = new Map();
    for (const row of rows) {
      const key = keyFn(row) || "—";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ar"));
  };
  return {
    from,
    to,
    lessonCount: lessons.length,
    eventCount: events.length,
    attendance: events.reduce((sum, row) => sum + (Number(row.attendees) || 0), 0),
    available,
    occupancy: available ? lessons.length + events.length : 0,
    occupancyRate: available ? (lessons.length + events.length) / available : 0,
    byStaff: countBy(lessons, (row) => row.staff_name),
    bySubject: countBy(lessons, (row) => row.subject),
    byClass: countBy(lessons, (row) => row.class_section),
    eventsByStaff: countBy(events, (row) => row.staff_name),
  };
}

export function reportToCsv(report) {
  const lines = [];
  const push = (cells) => lines.push(cells.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","));
  push(["from", report.from, "to", report.to]);
  push(["lessons", report.lessonCount, "events", report.eventCount, "attendance", report.attendance]);
  push(["available_slots", report.available, "approved_slots", report.occupancy, "occupancy_rate", report.occupancyRate.toFixed(4)]);
  push([]);
  push(["by_staff", "lessons"]);
  report.byStaff.forEach((row) => push([row.key, row.count]));
  push([]);
  push(["by_subject", "lessons"]);
  report.bySubject.forEach((row) => push([row.key, row.count]));
  push([]);
  push(["by_class", "lessons"]);
  report.byClass.forEach((row) => push([row.key, row.count]));
  push([]);
  push(["events_by_staff", "events"]);
  report.eventsByStaff.forEach((row) => push([row.key, row.count]));
  return `\uFEFF${lines.join("\n")}`;
}

export function weekTitle(sundayIso) {
  const thursday = addDays(sundayIso, 4);
  const format = (iso) => {
    const [year, month, day] = iso.split("-");
    return arDigits(`${Number(day)}/${Number(month)}/${year}`);
  };
  return `جدول حصص التعلم الذاتي بمركز مصادر التعلم للأسبوع من (${format(sundayIso)}) إلى الخميس (${format(thursday)} م)`;
}

export function emptyCellLines() {
  return ["الاسم:", "الصف:", "المادة:"];
}

export function cellModel(booking, holiday) {
  if (holiday) {
    return { kind: "holiday", lines: [holiday.reason || "عطلة"] };
  }
  if (!booking) return { kind: "empty", lines: emptyCellLines() };
  if (booking.kind === "event") {
    return {
      kind: "event",
      lines: [`فعالية: ${booking.event_title || ""}`, `مقدّم الطلب: ${booking.staff_name || ""}`],
    };
  }
  return {
    kind: "lesson",
    lines: [
      `الاسم: ${booking.staff_name || ""}`,
      `الصف: ${booking.class_section || ""}`,
      `المادة: ${booking.subject || ""}`,
    ],
  };
}

export function defaultSettings() {
  return {
    app_name: "مَنْهَل",
    school_name: SCHOOL_NAME_DEFAULT,
    principal_name: PRINCIPAL_NAME_DEFAULT,
    break: { ...DEFAULT_BREAK },
  };
}

export function groupBookings(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.group_id}:${row.status}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map((items) => {
    items.sort((a, b) => Number(a.period) - Number(b.period) || a.day.localeCompare(b.day));
    return {
      ...items[0],
      periods: items.map((item) => Number(item.period)),
      rows: items,
    };
  });
}
