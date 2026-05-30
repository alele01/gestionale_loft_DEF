"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerSupabase, getServiceClient } from "@/server/supabase";

const SignInSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(8, "Password troppo corta"),
  next: z
    .string()
    .optional()
    .transform((value) => {
      // Allow only same-origin paths to avoid open-redirect via ?next=.
      if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return undefined;
      }
      return value;
    }),
});

export type SignInState = {
  status: "idle" | "error";
  message?: string;
};

export async function signInAdminAction(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dati non validi",
    };
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return {
      status: "error",
      message: "Credenziali non valide",
    };
  }

  // Enforce admin_users membership. Service-role lookup because the table
  // is fully RLS-protected.
  const admin = getServiceClient();
  const { data: adminRow, error: adminError } = await admin
    .from("admin_users")
    .select("id, role")
    .eq("id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (adminError || !adminRow) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "Utente non autorizzato",
    };
  }

  // Password is only the first factor (aal1). Route to the 2FA step, which
  // forwards to enrollment if no factor exists yet, or to the code challenge
  // otherwise. requireAdmin enforces aal2 on every protected page anyway.
  const next = parsed.data.next ?? "/admin/dashboard";
  redirect(`/admin/2fa?next=${encodeURIComponent(next)}`);
}
