import { createServerFn } from "@tanstack/react-start";

export const signUpAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; name: string; code: string }) => data)
  .handler(async ({ data }) => {
    if (!data.email || !data.password || !data.code) {
      throw new Error("Missing required fields");
    }
    const expected = process.env.ADMIN_SIGNUP_CODE;
    if (!expected || data.code !== expected) {
      throw new Error("Invalid admin signup code");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | undefined;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      const exists = msg.includes("already") || msg.includes("registered");
      if (!exists) throw new Error(error.message);

      // Promote existing user to admin and reset their password to the provided one
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) throw new Error(listErr.message);
      const existing = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!existing) throw new Error("User exists but could not be located");
      userId = existing.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), name: data.name },
      });
      if (updErr) throw new Error(updErr.message);
    } else {
      if (!created.user) throw new Error("Failed to create admin");
      userId = created.user.id;
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "voter");

    return { ok: true };
  });
