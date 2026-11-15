import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore, seedMemory } from "../js/memory.js";
import { AppError } from "../js/engine.js";

function storeAtSundayMorning() {
  return createMemoryStore(seedMemory(), { now: () => new Date("2026-11-01T03:00:00Z") });
}

async function sign(store, fileNo) {
  return store.signIn(fileNo);
}

test("file-number login accepts an active account and rejects the rest", async () => {
  const store = storeAtSundayMorning();
  const me = await sign(store, "900005");
  assert.equal(me.role, "principal");
  await assert.rejects(() => store.signIn("999999"), (error) => error.code === "not_found");
  await store.signOut();
  await sign(store, "900001");
  const staff = await store.staffList();
  const principal = staff.find((row) => row.file_no === "900005");
  await store.saveStaff({ ...principal, active: false });
  await store.signOut();
  await assert.rejects(() => store.signIn("900005"), (error) => error.code === "disabled");
});

test("a lesson needs class, subject, and title; an event needs a title and a headcount", async () => {
  const store = storeAtSundayMorning();
  await sign(store, "900001");
  await store.saveStaff({ file_no: "900006", full_name: "خالد", job_type: "teaching", subject: "الرياضيات", role: "staff" });
  await store.signOut();
  await sign(store, "900006");
  await assert.rejects(() => store.createBooking({
    day: "2026-11-01", periods: [3], kind: "lesson", class_section: "", subject: "", lesson_title: "",
  }), (error) => error instanceof AppError && error.code === "KIND_FIELDS");
  await assert.rejects(() => store.createBooking({
    day: "2026-11-01", periods: [3], kind: "event", event_title: "", attendees: "",
  }), (error) => error.code === "KIND_FIELDS");
  const eventId = await store.createBooking({
    day: "2026-11-01", periods: [6], kind: "event", event_title: "ندوة القراءة", attendees: 25, visitor_party: "مكتبة",
  });
  const mine = await store.mine();
  const event = mine.find((row) => row.group_id === eventId);
  assert.equal(event.class_section, null);
  assert.equal(event.subject, null);
  assert.equal(event.attendees, 25);
});

test("consecutive periods are one request and a gap is rejected", async () => {
  const store = storeAtSundayMorning();
  await sign(store, "900001");
  await store.saveStaff({ file_no: "900006", full_name: "خالد", job_type: "teaching", subject: "الرياضيات", role: "staff" });
  await store.signOut();
  await sign(store, "900006");
  await assert.rejects(() => store.createBooking({
    day: "2026-11-01", periods: [1, 3], kind: "lesson", class_section: "8-2", subject: "الرياضيات", lesson_title: "الكسور",
  }), (error) => error.code === "NOT_CONSECUTIVE");
  const groupId = await store.createBooking({
    day: "2026-11-01", periods: [2, 3], kind: "lesson", class_section: "8-2", subject: "الرياضيات", lesson_title: "الكسور",
  });
  const rows = (await store.mine()).filter((row) => row.group_id === groupId);
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.status)).size, 1);
});

test("booking stays inside the current week, future slots, and open periods", async () => {
  const store = storeAtSundayMorning();
  await sign(store, "900001");
  await store.saveStaff({ file_no: "900006", full_name: "خالد", job_type: "teaching", subject: "الرياضيات", role: "staff" });
  await store.signOut();
  await sign(store, "900006");
  const lesson = { kind: "lesson", class_section: "8-2", subject: "الرياضيات", lesson_title: "الكسور" };
  await assert.rejects(() => store.createBooking({ ...lesson, day: "2026-11-06", periods: [1] }), (error) => error.code === "WEEKEND");
  await assert.rejects(() => store.createBooking({ ...lesson, day: "2026-11-08", periods: [1] }), (error) => error.code === "OUTSIDE_WEEK");
  await store.signOut();
  await sign(store, "900004");
  await store.addHoliday({ day: "2026-11-02", period: 2, reason: "اجتماع", confirm: false });
  await store.signOut();
  await sign(store, "900006");
  await assert.rejects(() => store.createBooking({ ...lesson, day: "2026-11-02", periods: [2] }), (error) => error.code === "HOLIDAY");
  store.setNow(new Date("2026-11-01T04:00:00Z"));
  await assert.rejects(() => store.createBooking({ ...lesson, day: "2026-11-01", periods: [1] }), (error) => error.code === "STARTED");
});

test("approval rejects the competing request and a staff member cannot decide", async () => {
  const store = storeAtSundayMorning();
  await sign(store, "900001");
  await store.saveStaff({ file_no: "900006", full_name: "خالد", job_type: "teaching", subject: "الرياضيات", role: "staff" });
  await store.saveStaff({ file_no: "900007", full_name: "سعيد", job_type: "teaching", subject: "العلوم", role: "staff" });
  await store.signOut();
  await sign(store, "900006");
  const groupId = await store.createBooking({
    day: "2026-11-01", periods: [2, 3], kind: "lesson", class_section: "8-2", subject: "الرياضيات", lesson_title: "الكسور",
  });
  await store.signOut();
  await sign(store, "900004");
  const notes = await store.notifications();
  assert.equal(notes.some((row) => row.title.includes("طلب حجز جديد")), true);
  await store.signOut();
  await sign(store, "900007");
  const other = await store.createBooking({
    day: "2026-11-01", periods: [3], kind: "lesson", class_section: "9-1", subject: "العلوم", lesson_title: "الخلايا",
  });
  await assert.rejects(() => store.decide(groupId, true), (error) => error.code === "FORBIDDEN");
  const hidden = await store.notifications();
  assert.equal(hidden.some((row) => row.title.includes("طلب حجز جديد")), false);
  await store.signOut();
  await sign(store, "900005");
  assert.equal((await store.requests()).length >= 2, true);
  await assert.rejects(() => store.decide(groupId, true), (error) => error.code === "FORBIDDEN");
  await store.signOut();
  await sign(store, "900004");
  await store.decide(groupId, true);
  const all = await store.requests();
  assert.equal(all.filter((row) => row.group_id === groupId).every((row) => row.status === "approved"), true);
  assert.equal(all.filter((row) => row.group_id === other).every((row) => row.status === "rejected"), true);
  assert.equal(all.filter((row) => row.day === "2026-11-01" && row.period === 3 && row.status === "approved").length, 1);
  await store.signOut();
  await sign(store, "900006");
  assert.equal((await store.notifications()).some((row) => row.body.includes("تم قبول حجزك")), true);
  await store.signOut();
  await sign(store, "900007");
  assert.equal((await store.notifications()).some((row) => row.body.includes("رُفض حجزك")), true);
  await store.signOut();
  await sign(store, "900002");
  const target = (await store.staffList()).find((row) => row.file_no === "900006");
  await assert.rejects(
    () => store.saveStaff({ ...target, role: "superadmin" }),
    (error) => error.code === "ROLE_FORBIDDEN",
  );
});

test("a standing subject period cannot be booked over", async () => {
  const store = storeAtSundayMorning();
  await sign(store, "900001");
  const lesson = { kind: "lesson", class_section: "8-2", subject: "لغة عربية", lesson_title: "قراءة" };
  await assert.rejects(
    () => store.createBooking({ ...lesson, day: "2026-11-01", periods: [4] }),
    (error) => error.code === "SLOT_TAKEN",
  );
  const week = await store.week("2026-11-01");
  const hold = week.bookings.find((row) => row.held && row.day === "2026-11-01" && row.period === 4);
  assert.equal(hold.staff_name, "حصة المادة");
  assert.equal(hold.subject, "لغة عربية");
});
