import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  APP_NAME,
} from "../js/config.js";
import {
  CLASS_SECTIONS,
  DEFAULT_PERIODS,
  addDays,
  buildReport,
  cellModel,
  classifyStaffRows,
  isConsecutive,
  rowsFromMatrix,
  BOOTSTRAP_STAFF,
  schoolSunday,
  sortStaff,
  subjectHoldRows,
  SUBJECT_HOLD_NAME,
  weekTitle,
} from "../js/engine.js";
import { buildWeekModel } from "../js/pdf.js";

test("the app name is the single constant used by the manifest and the page title", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const strings = fs.readFileSync(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8");
  assert.equal(manifest.name, APP_NAME);
  assert.equal(manifest.short_name, APP_NAME);
  assert.match(html, new RegExp(`<title>${APP_NAME}</title>`));
  assert.match(strings, new RegExp(`<string name="app_name">${APP_NAME}</string>`));
});

test("school week starts Sunday and skips Friday and Saturday", () => {
  assert.equal(schoolSunday("2026-11-05"), "2026-11-01");
  assert.equal(schoolSunday("2026-11-01"), "2026-11-01");
  assert.equal(schoolSunday("2026-11-06"), "2026-11-01");
  assert.equal(schoolSunday("2026-11-07"), "2026-11-01");
  assert.equal(addDays("2026-11-01", 4), "2026-11-05");
});

test("periods match the Jisr timetable and the break is not bookable", () => {
  assert.equal(DEFAULT_PERIODS.length, 7);
  assert.equal(DEFAULT_PERIODS[0].starts, "07:10");
  assert.equal(DEFAULT_PERIODS[3].ends, "09:45");
  assert.equal(DEFAULT_PERIODS[4].starts, "10:05");
  assert.equal(DEFAULT_PERIODS.at(-1).ends, "12:00");
  assert.equal(isConsecutive([3, 4]), true);
  assert.equal(isConsecutive([1, 3]), false);
  assert.equal(isConsecutive([4, 5]), true);
});

test("class sections match Jisr without 12س", () => {
  assert.equal(CLASS_SECTIONS.length, 30);
  assert.equal(CLASS_SECTIONS.includes("12س"), false);
  assert.equal(CLASS_SECTIONS.at(-2), "8س");
  assert.equal(CLASS_SECTIONS.at(-1), "10س");
  const seed = fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  for (const label of CLASS_SECTIONS) assert.match(seed, new RegExp(`'${label}'`));
});

test("staff template rows marked example are ignored and errors are reported", () => {
  const csv = fs.readFileSync(new URL("../staff-template.csv", import.meta.url), "utf8").trim();
  const matrix = csv.split(/\r?\n/).map((line) => line.split(","));
  const rows = rowsFromMatrix(matrix);
  const preview = classifyStaffRows(rows, ["10000001"]);
  assert.equal(preview.every((row) => row.action === "skip"), true);

  const broken = classifyStaffRows([
    { rowNumber: 2, full_name: "سالم", file_no: "200", job_type: "معلم", subject: "ع", note: "" },
    { rowNumber: 3, full_name: "", file_no: "201", job_type: "فني", subject: "", note: "" },
    { rowNumber: 4, full_name: "أحمد", file_no: "200", job_type: "إداري", subject: "", note: "" },
    { rowNumber: 5, full_name: "خالد", file_no: "202", job_type: "موظف", subject: "", note: "" },
    { rowNumber: 6, full_name: "مثال", file_no: "1", job_type: "معلم", subject: "", note: "example" },
    { rowNumber: 7, full_name: "موجود", file_no: "10000001", job_type: "معلم", subject: "ع", note: "" },
  ], ["10000001"]);
  assert.equal(broken.find((row) => row.rowNumber === 2).errors.includes("duplicate"), true);
  assert.equal(broken.find((row) => row.rowNumber === 3).errors.includes("name"), true);
  assert.equal(broken.find((row) => row.rowNumber === 5).errors.includes("job"), true);
  assert.equal(broken.find((row) => row.rowNumber === 6).action, "skip");
  assert.equal(broken.find((row) => row.rowNumber === 7).action, "update");
  assert.equal(broken.find((row) => row.rowNumber === 7).job_code, "teaching");
});

test("the weekly PDF model uses the Arabic title, approved rows, and the app name", () => {
  const model = buildWeekModel({
    sunday: "2026-11-01",
    periods: DEFAULT_PERIODS,
    holidays: [{ day: "2026-11-02", period: 2, reason: "اجتماع" }],
    schoolName: "مدرسة بلج بن عقبة الفراهيدي للبنين (٧-٩)",
    bookings: [
      { day: "2026-11-01", period: 3, status: "approved", kind: "lesson", staff_name: "خالد", class_section: "8-2", subject: "الرياضيات" },
      { day: "2026-11-01", period: 3, status: "pending", kind: "lesson", staff_name: "سعيد", class_section: "9-1", subject: "علوم" },
      { day: "2026-11-03", period: 6, status: "approved", kind: "event", staff_name: "أحمد", event_title: "ندوة القراءة" },
    ],
  });
  assert.equal(model.appName, APP_NAME);
  assert.equal(model.filename, "manhal-week-2026-11-01.pdf");
  assert.equal(model.title, "جدول حصص التعلم الذاتي بمركز مصادر التعلم للأسبوع من (١/١١/٢٠٢٦) إلى الخميس (٥/١١/٢٠٢٦ م)");
  assert.deepEqual(model.columns, DEFAULT_PERIODS.map((period) => period.label_ar));
  assert.deepEqual(model.rows.map((row) => row.label), ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]);
  assert.deepEqual(model.rows[0].cells[2].lines, ["الاسم: خالد", "الصف: 8-2", "المادة: الرياضيات"]);
  assert.deepEqual(model.rows[0].cells[0].lines, ["الاسم:", "الصف:", "المادة:"]);
  assert.deepEqual(model.rows[1].cells[1].lines, ["اجتماع"]);
  assert.deepEqual(model.rows[2].cells[5].lines, ["فعالية: ندوة القراءة", "مقدّم الطلب: أحمد"]);
  assert.match(model.credit, /يعقوب المعمري/);
  assert.match(model.specialist, /محمود هلال المعمري/);
  assert.deepEqual(cellModel(null, null).lines, ["الاسم:", "الصف:", "المادة:"]);
});

test("the staff list puts the principal first and the assistants next", () => {
  const ordered = sortStaff(BOOTSTRAP_STAFF);
  assert.deepEqual(ordered.slice(0, 3).map((row) => row.full_name), [
    "د.سالم المعمري",
    "أحمد السناني",
    "محمد النخيلي",
  ]);
  assert.ok(ordered.slice(3).every((row) => row.role !== "principal" && row.role !== "admin"));
});

test("subject periods repeat every week under the name حصة المادة", () => {
  const rows = subjectHoldRows("2026-11-01", "2026-11-05");
  assert.equal(rows.length, 6);
  assert.equal(rows.every((row) => row.staff_name === SUBJECT_HOLD_NAME && row.status === "approved" && row.held), true);
  const subject = (day, period) => rows.find((row) => row.day === day && row.period === period).subject;
  assert.equal(subject("2026-11-01", 4), "لغة عربية");
  assert.equal(subject("2026-11-02", 4), "علوم");
  assert.equal(subject("2026-11-03", 4), "رياضيات");
  assert.equal(subject("2026-11-03", 5), "تربية إسلامية");
  assert.equal(subject("2026-11-04", 5), "لغة إنجليزية");
  assert.equal(subject("2026-11-05", 4), "الدراسات الاجتماعية");
  const next = subjectHoldRows("2026-11-08", "2026-11-12");
  assert.equal(next.find((row) => row.day === "2026-11-08" && row.period === 4).subject, "لغة عربية");
});

test("reports separate lessons from events and count occupancy", () => {
  const report = buildReport([
    { day: "2026-11-01", period: 1, status: "approved", kind: "lesson", staff_name: "خالد", subject: "الرياضيات", class_section: "8-2" },
    { day: "2026-11-01", period: 2, status: "approved", kind: "event", staff_name: "أحمد", event_title: "ندوة", attendees: 20 },
    { day: "2026-11-01", period: 3, status: "pending", kind: "lesson", staff_name: "سعيد", subject: "علوم", class_section: "9-1" },
  ], [{ day: "2026-11-02", period: null, reason: "عطلة" }], "2026-11-01", "2026-11-05");
  assert.equal(report.lessonCount, 1);
  assert.equal(report.eventCount, 1);
  assert.equal(report.attendance, 20);
  assert.equal(report.available, 28);
  assert.equal(report.byStaff[0].key, "خالد");
  assert.equal(report.byClass[0].key, "8-2");
});
