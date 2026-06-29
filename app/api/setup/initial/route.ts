import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: "Datos de Super Admin incompletos." }, { status: 400 });
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count: superAdminCount, error: superAdminError } = await adminClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("active", true);

  if (superAdminError) {
    return NextResponse.json({ error: superAdminError.message }, { status: 500 });
  }

  if ((superAdminCount ?? 0) > 0) {
    return NextResponse.json({ error: "Ya existe un Super Admin real." }, { status: 409 });
  }

  const { data: created, error: createAuthError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createAuthError || !created.user) {
    return NextResponse.json(
      { error: createAuthError?.message ?? "No se pudo crear el usuario Auth." },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .insert({
      id: created.user.id,
      business_id: null,
      name,
      email,
      role: "super_admin",
      active: true,
    })
    .select("*")
    .single();

  if (profileError || !profile) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: profileError?.message ?? "No se pudo crear el perfil Super Admin." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    user: { id: created.user.id, email },
    profile,
  });
}
