// File-number sign-in. The caller never has a password.
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are injected
// by the Supabase runtime. The service role key must not be copied into the repo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const payload = await req.json().catch(() => ({}));
    const fileNo = String(payload.file_no ?? "").trim();
    if (!fileNo) return json({ error: "missing_file_no" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "server" }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select("id, active, user_id, full_name, role")
      .eq("file_no", fileNo)
      .maybeSingle();

    if (staffError) return json({ error: "server" }, 500);
    if (!staff) return json({ error: "not_found" }, 401);
    if (!staff.active) return json({ error: "disabled" }, 403);

    const email = `${fileNo}@lrc.local`;
    let userId = staff.user_id as string | null;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { file_no: fileNo, staff_id: staff.id },
      });
      if (created?.user?.id) {
        userId = created.user.id;
      } else if (createError) {
        const { data: link, error: linkError } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });
        if (linkError || !link?.user?.id) return json({ error: "server" }, 500);
        userId = link.user.id;
      }
      const { error: linkStaffError } = await admin
        .from("staff")
        .update({ user_id: userId })
        .eq("id", staff.id);
      if (linkStaffError) return json({ error: "server" }, 500);
    }

    // Rotate a server-only password and exchange it for a session.
    // The person signs in with a file number; they never see or choose this value.
    const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password });
    if (passwordError) return json({ error: "server" }, 500);

    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email, password });
    if (signError || !signed.session) return json({ error: "server" }, 500);

    return json({
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
      expires_in: signed.session.expires_in,
    });
  } catch (_err) {
    return json({ error: "server" }, 500);
  }
});
