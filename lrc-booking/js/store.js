import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { AppError, addDays, buildReport, classifyStaffRows, sortStaff, withSubjectHolds } from "./engine.js";
import { createMemoryStore, seedMemory } from "./memory.js";

const DB_KEY = "manhal.local.v1";
const SESSION_KEY = "manhal.session";

function mapError(error) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  const codes = [
    "NOT_CONSECUTIVE", "KIND_FIELDS", "PAST", "STARTED", "HOLIDAY", "OUTSIDE_WEEK",
    "WEEKEND", "SLOT_TAKEN", "ALREADY_REQUESTED", "FORBIDDEN", "REASON_REQUIRED",
    "NOT_PENDING", "ROLE_FORBIDDEN", "PERIODS", "NOT_CANCELLABLE", "not_found", "disabled",
  ];
  const found = codes.find((code) => text.includes(code));
  if (found) throw new AppError(found);
  if (String(error?.code) === "23505") throw new AppError(text.includes("file_no") ? "duplicate" : "SLOT_TAKEN");
  throw new AppError("server", text);
}

async function must(promise) {
  const result = await promise;
  if (result?.error) mapError(result.error);
  return result.data;
}

function decorateRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    staff_name: row.staff?.full_name || row.staff_name || "",
  }));
}

function persistLocal(memory) {
  const save = () => localStorage.setItem(DB_KEY, JSON.stringify(memory.db));
  memory.subscribe(save);
  const signIn = memory.signIn.bind(memory);
  const signOut = memory.signOut.bind(memory);
  memory.signIn = async (fileNo) => {
    const me = await signIn(fileNo);
    localStorage.setItem(SESSION_KEY, me.id);
    return me;
  };
  memory.signOut = async () => {
    await signOut();
    localStorage.removeItem(SESSION_KEY);
  };
  return memory;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return seedMemory();
    const parsed = JSON.parse(raw);
    if (!parsed?.staff?.length || !parsed?.periods?.length) return seedMemory();
    return parsed;
  } catch {
    return seedMemory();
  }
}

function createRemote(supabase) {
  const listeners = new Set();
  let channel = null;

  function emit() { listeners.forEach((fn) => fn()); }

  async function userId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new AppError("FORBIDDEN");
    return data.user.id;
  }

  async function me() {
    const id = await userId();
    const data = await must(supabase.from("staff").select("*").eq("user_id", id).maybeSingle());
    if (!data || !data.active) throw new AppError("disabled");
    return data;
  }

  function watch() {
    if (channel) return;
    channel = supabase.channel("manhal-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, emit)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, emit)
      .subscribe();
  }

  return {
    mode: "remote",
    supabase,
    subscribe(fn) { listeners.add(fn); watch(); return () => listeners.delete(fn); },
    async signIn(fileNo) {
      const { data, error } = await supabase.functions.invoke("login", { body: { file_no: String(fileNo).trim() } });
      if (error) mapError(error);
      if (data?.error === "not_found") throw new AppError("not_found");
      if (data?.error === "disabled") throw new AppError("disabled");
      if (!data?.access_token) throw new AppError("server");
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) mapError(sessionError);
      return me();
    },
    async signOut() { await supabase.auth.signOut(); },
    async restore() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      try { return await me(); } catch { return null; }
    },
    async me() { return me(); },
    async catalog() {
      const [periods, classSections, settingsRows] = await Promise.all([
        must(supabase.from("periods").select("*").order("n")),
        must(supabase.from("class_sections").select("*").order("id")),
        must(supabase.from("settings").select("key, value")),
      ]);
      const settings = {};
      (settingsRows || []).forEach((row) => { settings[row.key] = row.value; });
      return { periods, classSections, settings };
    },
    async week(sunday) {
      const thursday = addDays(sunday, 4);
      const [bookings, holidays] = await Promise.all([
        must(supabase.from("bookings").select("*, staff:staff_id(full_name)").gte("day", sunday).lte("day", thursday)),
        must(supabase.from("holidays").select("*").gte("day", sunday).lte("day", thursday)),
      ]);
      return { bookings: withSubjectHolds(decorateRows(bookings), sunday, thursday), holidays: holidays || [] };
    },
    async mine() {
      const row = await me();
      const data = await must(supabase.from("bookings").select("*, staff:staff_id(full_name)").eq("staff_id", row.id).order("created_at", { ascending: false }));
      return decorateRows(data);
    },
    async requests() {
      await me();
      const data = await must(supabase.from("bookings").select("*, staff:staff_id(full_name)").order("created_at", { ascending: true }));
      return decorateRows(data);
    },
    async notifications() {
      const row = await me();
      const data = await must(supabase.from("notifications").select("*").eq("staff_id", row.id).order("created_at", { ascending: false }).limit(100));
      return data || [];
    },
    async staffList() {
      const data = await must(supabase.from("staff").select("*"));
      return sortStaff(data || []);
    },
    async createBooking(input) {
      const kind = input.kind;
      const data = await must(supabase.rpc("create_booking", {
        p_day: input.day,
        p_periods: input.periods.map(Number),
        p_kind: kind,
        p_class_section: kind === "lesson" ? input.class_section : null,
        p_subject: kind === "lesson" ? input.subject : null,
        p_lesson_title: kind === "lesson" ? input.lesson_title : null,
        p_event_title: kind === "event" ? input.event_title : null,
        p_visitor_party: kind === "event" ? input.visitor_party || null : null,
        p_attendees: kind === "event" ? Number(input.attendees) : null,
        p_equipment: input.equipment || null,
        p_notes: input.notes || null,
      }));
      return data;
    },
    async decide(groupId, approve, reason) {
      await must(supabase.rpc("decide_booking", {
        p_group: groupId,
        p_approve: approve,
        p_reason: reason || null,
      }));
    },
    async cancel(groupId) {
      await must(supabase.rpc("cancel_booking", { p_group: groupId }));
    },
    async addHoliday({ day, period, reason, confirm }) {
      return must(supabase.rpc("add_holiday", {
        p_day: day,
        p_period: period === "" || period == null ? null : Number(period),
        p_reason: reason || null,
        p_confirm: Boolean(confirm),
      }));
    },
    async deleteHoliday(id) {
      await must(supabase.from("holidays").delete().eq("id", id));
    },
    async saveStaff(input) {
      const payload = {
        file_no: String(input.file_no).trim(),
        full_name: String(input.full_name).trim(),
        job_type: input.job_type,
        subject: input.subject ? String(input.subject).trim() : null,
      };
      if (input.role) payload.role = input.role;
      if (typeof input.active === "boolean") payload.active = input.active;
      if (input.id) {
        await must(supabase.from("staff").update(payload).eq("id", input.id));
      } else {
        payload.role = payload.role || "staff";
        await must(supabase.from("staff").insert(payload));
      }
    },
    async importStaff(records) {
      const existing = await must(supabase.from("staff").select("id, file_no"));
      const classified = classifyStaffRows(records, (existing || []).map((row) => row.file_no));
      const byFile = new Map((existing || []).map((row) => [row.file_no, row]));
      for (const row of classified) {
        if (row.action === "update") {
          await must(supabase.from("staff").update({
            full_name: row.full_name,
            job_type: row.job_code,
            subject: row.subject || null,
            active: true,
          }).eq("id", byFile.get(row.file_no).id));
        } else if (row.action === "insert") {
          await must(supabase.from("staff").insert({
            file_no: row.file_no,
            full_name: row.full_name,
            job_type: row.job_code,
            subject: row.subject || null,
            role: "staff",
            active: true,
          }));
        }
      }
      return classified;
    },
    async savePeriods(periods) {
      for (const row of periods) {
        await must(supabase.from("periods").update({ starts: row.starts, ends: row.ends }).eq("n", row.n));
      }
    },
    async saveSettings(patch) {
      const writes = [];
      if (patch.school_name != null) writes.push({ key: "school_name", value: patch.school_name });
      if (patch.principal_name != null) writes.push({ key: "principal_name", value: patch.principal_name });
      if (patch.break) writes.push({ key: "break", value: patch.break });
      if (writes.length) await must(supabase.from("settings").upsert(writes));
    },
    async markRead(id) {
      await must(supabase.from("notifications").update({ read: true }).eq("id", id));
    },
    async markAllRead() {
      const row = await me();
      await must(supabase.from("notifications").update({ read: true }).eq("staff_id", row.id).eq("read", false));
    },
    async report(from, to) {
      const [bookings, holidays] = await Promise.all([
        must(supabase.from("bookings").select("*, staff:staff_id(full_name)").gte("day", from).lte("day", to).eq("status", "approved")),
        must(supabase.from("holidays").select("*").gte("day", from).lte("day", to)),
      ]);
      return buildReport(withSubjectHolds(decorateRows(bookings), from, to), holidays || [], from, to);
    },
    async auditLog() {
      const data = await must(supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(100));
      return data || [];
    },
    async holidays() {
      const data = await must(supabase.from("holidays").select("*").order("day", { ascending: false }));
      return data || [];
    },
  };
}

export async function createStore() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const memory = persistLocal(createMemoryStore(loadLocal()));
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) await memory.restore(saved);
    return memory;
  }
  const { createClient } = await import("./vendor/supabase.js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, storageKey: "manhal-auth", autoRefreshToken: true },
  });
  return createRemote(supabase);
}

export { AppError };
