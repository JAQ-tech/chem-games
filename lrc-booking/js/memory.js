import {
  AppError,
  BOOTSTRAP_STAFF,
  CLASS_SECTIONS,
  DEFAULT_PERIODS,
  addDays,
  assertBooking,
  bi,
  buildReport,
  can,
  classifyStaffRows,
  defaultSettings,
  muscatParts,
  schoolSunday,
} from "./engine.js";

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const n = Math.floor(Math.random() * 16);
    return (ch === "x" ? n : (n & 0x3) | 0x8).toString(16);
  });
}

export function seedMemory() {
  const settings = defaultSettings();
  return {
    staff: BOOTSTRAP_STAFF.map((row) => ({
      id: uid(),
      user_id: null,
      file_no: row.file_no,
      full_name: row.full_name,
      job_type: row.job_type,
      subject: row.subject || null,
      role: row.role,
      active: true,
      created_at: new Date().toISOString(),
    })),
    periods: DEFAULT_PERIODS.map((row) => ({ ...row })),
    classSections: CLASS_SECTIONS.map((label, index) => ({ id: index + 1, label })),
    holidays: [],
    bookings: [],
    notifications: [],
    settings,
    audit: [],
    noteSeq: 1,
  };
}

export function createMemoryStore(initial, options = {}) {
  const db = initial || seedMemory();
  let nowFn = options.now || (() => new Date());
  let sessionId = null;
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => fn());
  }

  function clock() {
    const parts = muscatParts(nowFn());
    return { today: parts.iso, nowTime: parts.time, weekSunday: schoolSunday(parts.iso) };
  }

  function me() {
    return db.staff.find((row) => row.id === sessionId) || null;
  }

  function requireMe() {
    const row = me();
    if (!row || !row.active) throw new AppError("FORBIDDEN");
    return row;
  }

  function ctx(staffId) {
    const time = clock();
    return { ...time, periods: db.periods, holidays: db.holidays, bookings: db.bookings, staffId };
  }

  function staffName(id) {
    return db.staff.find((row) => row.id === id)?.full_name || "";
  }

  function decorate(booking) {
    return { ...booking, staff_name: staffName(booking.staff_id) };
  }

  function notify(staffId, titleAr, titleEn, bodyAr, bodyEn, bookingId) {
    db.notifications.unshift({
      id: db.noteSeq++,
      staff_id: staffId,
      title: bi(titleAr, titleEn),
      body: bi(bodyAr, bodyEn),
      booking_id: bookingId || null,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  function notifySpecialists(titleAr, titleEn, bodyAr, bodyEn, bookingId) {
    db.staff.filter((row) => row.role === "specialist" && row.active).forEach((row) => {
      notify(row.id, titleAr, titleEn, bodyAr, bodyEn, bookingId);
    });
  }

  function audit(actor, action, details) {
    db.audit.unshift({ id: uid(), actor, action, details, at: new Date().toISOString() });
  }

  return {
    mode: "local",
    db,
    setNow(date) { nowFn = () => date; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async signIn(fileNo) {
      const row = db.staff.find((item) => item.file_no === String(fileNo).trim());
      if (!row) throw new AppError("not_found");
      if (!row.active) throw new AppError("disabled");
      sessionId = row.id;
      return me();
    },
    async signOut() { sessionId = null; },
    async restore(id) {
      sessionId = id;
      return me();
    },
    sessionStaffId() { return sessionId; },
    async me() { return me(); },
    async catalog() {
      return {
        periods: db.periods.map((row) => ({ ...row })),
        classSections: db.classSections.map((row) => ({ ...row })),
        settings: structuredClone(db.settings),
      };
    },
    async week(sunday) {
      const thursday = addDays(sunday, 4);
      return {
        bookings: db.bookings.filter((row) => row.day >= sunday && row.day <= thursday).map(decorate),
        holidays: db.holidays.filter((row) => row.day >= sunday && row.day <= thursday).map((row) => ({ ...row })),
      };
    },
    async mine() {
      const row = requireMe();
      return db.bookings.filter((item) => item.staff_id === row.id).map(decorate)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async requests() {
      requireMe();
      return db.bookings.map(decorate).sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    async notifications() {
      const row = requireMe();
      return db.notifications.filter((item) => item.staff_id === row.id).map((item) => ({ ...item }));
    },
    async staffList() {
      const row = requireMe();
      if (!can(row.role).manageStaff) throw new AppError("FORBIDDEN");
      return db.staff.map((item) => ({ ...item }));
    },
    async createBooking(input) {
      const row = requireMe();
      const periods = assertBooking(input, ctx(row.id));
      const groupId = uid();
      const created = new Date().toISOString();
      const kind = input.kind;
      periods.forEach((period) => {
        db.bookings.push({
          id: uid(),
          day: input.day,
          period,
          group_id: groupId,
          staff_id: row.id,
          kind,
          class_section: kind === "lesson" ? input.class_section.trim() : null,
          subject: kind === "lesson" ? input.subject.trim() : null,
          lesson_title: kind === "lesson" ? input.lesson_title.trim() : null,
          event_title: kind === "event" ? input.event_title.trim() : null,
          visitor_party: kind === "event" && input.visitor_party ? input.visitor_party.trim() : null,
          attendees: kind === "event" ? Number(input.attendees) : null,
          equipment: input.equipment ? String(input.equipment).trim() : null,
          notes: input.notes ? String(input.notes).trim() : null,
          status: "pending",
          decided_by: null,
          decided_at: null,
          reject_reason: null,
          created_at: created,
        });
      });
      const first = db.bookings.find((item) => item.group_id === groupId);
      notifySpecialists(
        "طلب حجز جديد",
        "New booking request",
        `قدّم ${row.full_name} طلب حجز بتاريخ ${input.day}.`,
        `${row.full_name} submitted a booking request for ${input.day}.`,
        first.id,
      );
      emit();
      return groupId;
    },
    async decide(groupId, approve, reason) {
      const actor = requireMe();
      if (!can(actor.role).manageBookings) throw new AppError("FORBIDDEN");
      const rows = db.bookings.filter((item) => item.group_id === groupId);
      if (!rows.length || rows.some((item) => item.status !== "pending")) throw new AppError("NOT_PENDING");
      if (approve) {
        for (const row of rows) {
          const taken = db.bookings.some((item) => item.day === row.day && item.period === row.period && item.status === "approved" && item.group_id !== groupId);
          if (taken) throw new AppError("SLOT_TAKEN");
        }
        const stamp = new Date().toISOString();
        rows.forEach((row) => {
          row.status = "approved";
          row.decided_by = actor.id;
          row.decided_at = stamp;
          row.reject_reason = null;
        });
        const overlappingGroups = new Set();
        for (const row of rows) {
          db.bookings.forEach((item) => {
            if (item.status === "pending" && item.group_id !== groupId && item.day === row.day && item.period === row.period) {
              overlappingGroups.add(item.group_id);
            }
          });
        }
        overlappingGroups.forEach((otherGroup) => {
          const otherRows = db.bookings.filter((item) => item.group_id === otherGroup && item.status === "pending");
          otherRows.forEach((item) => {
            item.status = "rejected";
            item.decided_by = actor.id;
            item.decided_at = stamp;
            item.reject_reason = "SLOT_TAKEN";
          });
          if (otherRows[0]) {
            notify(
              otherRows[0].staff_id,
              "رُفض حجزك",
              "Your booking was rejected",
              "رُفض حجزك: تم قبول طلب آخر على هذه الخانة.",
              "Your booking was rejected: another request was approved for this slot.",
              otherRows[0].id,
            );
          }
        });
        notify(
          rows[0].staff_id,
          "تم قبول حجزك",
          "Your booking was approved",
          `تم قبول حجزك ليوم ${rows[0].day}.`,
          `Your booking was approved for ${rows[0].day}.`,
          rows[0].id,
        );
        audit(actor.id, "approve", { group_id: groupId });
      } else {
        const text = String(reason || "").trim();
        if (!text) throw new AppError("REASON_REQUIRED");
        const stamp = new Date().toISOString();
        rows.forEach((row) => {
          row.status = "rejected";
          row.decided_by = actor.id;
          row.decided_at = stamp;
          row.reject_reason = text;
        });
        notify(
          rows[0].staff_id,
          "رُفض حجزك",
          "Your booking was rejected",
          `رُفض حجزك: ${text}`,
          `Your booking was rejected: ${text}`,
          rows[0].id,
        );
        audit(actor.id, "reject", { group_id: groupId, reason: text });
      }
      emit();
    },
    async cancel(groupId) {
      const actor = requireMe();
      const rows = db.bookings.filter((item) => item.group_id === groupId && (item.status === "pending" || item.status === "approved"));
      if (!rows.length) throw new AppError("NOT_CANCELLABLE");
      const owner = rows[0].staff_id;
      const manager = can(actor.role).manageBookings;
      if (owner !== actor.id && !manager) throw new AppError("FORBIDDEN");
      if (!manager) {
        const time = clock();
        for (const row of rows) {
          if (row.day < time.today) throw new AppError("PAST");
          const periodRow = db.periods.find((item) => Number(item.n) === Number(row.period));
          if (row.day === time.today && periodRow && timeToStarted(periodRow, time.nowTime)) throw new AppError("STARTED");
        }
      }
      rows.forEach((row) => { row.status = "cancelled"; });
      notifySpecialists("إلغاء حجز", "Booking cancelled", "أُلغي حجز في جدول المركز.", "A resource-centre booking was cancelled.", rows[0].id);
      if (actor.id !== owner) {
        notify(owner, "أُلغي حجزك", "Your booking was cancelled", "أُلغي حجزك من قبل الإدارة أو بسبب حجب الخانة.", "Your booking was cancelled by a manager or because the slot was blocked.", rows[0].id);
      }
      audit(actor.id, "cancel", { group_id: groupId });
      emit();
    },
    async addHoliday({ day, period, reason, confirm }) {
      const actor = requireMe();
      if (!can(actor.role).manageHolidays) throw new AppError("FORBIDDEN");
      const periodValue = period == null || period === "" ? null : Number(period);
      if (db.holidays.some((row) => row.day === day && (row.period ?? null) === periodValue)) throw new AppError("duplicate");
      const affected = db.bookings.filter((row) => row.day === day && (row.status === "pending" || row.status === "approved") && (periodValue == null || Number(row.period) === periodValue));
      if (affected.length && !confirm) return { needs_confirm: true, count: affected.length };
      const id = uid();
      db.holidays.push({
        id,
        day,
        period: periodValue,
        reason: String(reason || "").trim() || null,
        created_by: actor.id,
        created_at: new Date().toISOString(),
      });
      const groups = new Set(affected.map((row) => row.group_id));
      affected.forEach((row) => { row.status = "cancelled"; });
      groups.forEach((groupId) => {
        const sample = db.bookings.find((row) => row.group_id === groupId);
        notifySpecialists("إلغاء حجز", "Booking cancelled", "أُلغي حجز في جدول المركز.", "A resource-centre booking was cancelled.", sample?.id);
        const owners = new Set(affected.filter((row) => row.group_id === groupId).map((row) => row.staff_id));
        owners.forEach((owner) => {
          if (owner !== actor.id) {
            notify(owner, "أُلغي حجزك", "Your booking was cancelled", "أُلغي حجزك من قبل الإدارة أو بسبب حجب الخانة.", "Your booking was cancelled by a manager or because the slot was blocked.", sample?.id);
          }
        });
      });
      audit(actor.id, "holiday", { day, period: periodValue, cancelled: affected.length, id });
      emit();
      return { needs_confirm: false, id, cancelled: affected.length };
    },
    async deleteHoliday(id) {
      const actor = requireMe();
      if (!can(actor.role).manageHolidays) throw new AppError("FORBIDDEN");
      db.holidays = db.holidays.filter((row) => row.id !== id);
      emit();
    },
    async saveStaff(input) {
      const actor = requireMe();
      if (!can(actor.role).manageStaff) throw new AppError("FORBIDDEN");
      const fileNo = String(input.file_no || "").trim();
      const fullName = String(input.full_name || "").trim();
      if (!fileNo || !fullName) throw new AppError("KIND_FIELDS");
      if (!["teaching", "admin", "technical"].includes(input.job_type)) throw new AppError("KIND_FIELDS");
      const duplicate = db.staff.find((row) => row.file_no === fileNo && row.id !== input.id);
      if (duplicate) throw new AppError("duplicate");
      if (input.id) {
        const row = db.staff.find((item) => item.id === input.id);
        if (!row) throw new AppError("not_found");
        if (input.role && input.role !== row.role) {
          const touchesProtected = ["superadmin", "admin"].includes(row.role) || ["superadmin", "admin"].includes(input.role);
          if (actor.role !== "superadmin" && actor.role !== "admin") throw new AppError("FORBIDDEN");
          if (touchesProtected && actor.role !== "superadmin") throw new AppError("ROLE_FORBIDDEN");
          row.role = input.role;
        }
        row.file_no = fileNo;
        row.full_name = fullName;
        row.job_type = input.job_type;
        row.subject = input.subject ? String(input.subject).trim() : null;
        if (typeof input.active === "boolean") row.active = input.active;
      } else {
        const role = input.role || "staff";
        if ((role === "superadmin" || role === "admin") && actor.role !== "superadmin") throw new AppError("ROLE_FORBIDDEN");
        db.staff.push({
          id: uid(),
          user_id: null,
          file_no: fileNo,
          full_name: fullName,
          job_type: input.job_type,
          subject: input.subject ? String(input.subject).trim() : null,
          role: can(actor.role).assignRoles ? role : "staff",
          active: true,
          created_at: new Date().toISOString(),
        });
      }
      emit();
    },
    async importStaff(records) {
      const actor = requireMe();
      if (!can(actor.role).manageStaff) throw new AppError("FORBIDDEN");
      const classified = classifyStaffRows(records, db.staff.map((row) => row.file_no));
      const saved = classified.filter((row) => row.action === "insert" || row.action === "update");
      saved.forEach((row) => {
        const existing = db.staff.find((item) => item.file_no === row.file_no);
        if (existing) {
          existing.full_name = row.full_name;
          existing.job_type = row.job_code;
          existing.subject = row.subject || null;
          existing.active = true;
        } else {
          db.staff.push({
            id: uid(),
            user_id: null,
            file_no: row.file_no,
            full_name: row.full_name,
            job_type: row.job_code,
            subject: row.subject || null,
            role: "staff",
            active: true,
            created_at: new Date().toISOString(),
          });
        }
      });
      emit();
      return classified;
    },
    async savePeriods(periods) {
      const actor = requireMe();
      if (!can(actor.role).settings) throw new AppError("FORBIDDEN");
      periods.forEach((row) => {
        const target = db.periods.find((item) => Number(item.n) === Number(row.n));
        if (!target) return;
        if (row.starts) target.starts = row.starts;
        if (row.ends) target.ends = row.ends;
      });
      emit();
    },
    async saveSettings(patch) {
      const actor = requireMe();
      if (!can(actor.role).settings) throw new AppError("FORBIDDEN");
      if (patch.school_name != null) db.settings.school_name = String(patch.school_name).trim();
      if (patch.principal_name != null) db.settings.principal_name = String(patch.principal_name).trim();
      if (patch.break) db.settings.break = { ...db.settings.break, ...patch.break };
      emit();
    },
    async markRead(id) {
      const actor = requireMe();
      const row = db.notifications.find((item) => item.id === id && item.staff_id === actor.id);
      if (row) row.read = true;
      emit();
    },
    async markAllRead() {
      const actor = requireMe();
      db.notifications.forEach((item) => { if (item.staff_id === actor.id) item.read = true; });
      emit();
    },
    async report(from, to) {
      const actor = requireMe();
      if (!can(actor.role).viewReports) throw new AppError("FORBIDDEN");
      return buildReport(db.bookings.map(decorate), db.holidays, from, to);
    },
    async auditLog() {
      const actor = requireMe();
      if (!can(actor.role).audit) throw new AppError("FORBIDDEN");
      return db.audit.map((row) => ({ ...row, actor_name: staffName(row.actor) }));
    },
    async holidays() {
      requireMe();
      return db.holidays.map((row) => ({ ...row }));
    },
  };
}

function timeToStarted(period, nowTime) {
  const [h, m] = period.starts.split(":").map(Number);
  const [nh, nm] = nowTime.split(":").map(Number);
  return h * 60 + m <= nh * 60 + nm;
}
