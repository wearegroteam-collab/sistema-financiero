import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  }

  const body = await request.json();
  const rawBusinessId = body.businessId == null ? "" : String(body.businessId);
  const name = String(body.name ?? "");
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const role = String(body.role ?? "");
  const businessId = role === "super_admin" ? null : rawBusinessId;

  if (!name || !email || !password || !["super_admin", "admin", "accountant"].includes(role) || (role !== "super_admin" && !businessId)) {
    return NextResponse.json({ error: "Datos de usuario incompletos." }, { status: 400 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authUser, error: authError } = await userClient.auth.getUser();
  if (authError || !authUser.user) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const { data: actor, error: actorError } = await adminClient
    .from("users")
    .select("id,business_id,role,active")
    .eq("id", authUser.user.id)
    .single();

  if (actorError || !actor || actor.active === false) {
    return NextResponse.json({ error: "Usuario no autorizado." }, { status: 403 });
  }

  const isSuperAdmin = actor.role === "super_admin";
  const isBusinessAdminCreatingAccounting =
    actor.role === "admin" && actor.business_id === businessId && role === "accountant";

  if (!isSuperAdmin && !isBusinessAdminCreatingAccounting) {
    return NextResponse.json({ error: "No tienes permisos para crear este usuario." }, { status: 403 });
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "No se pudo crear el usuario Auth." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .insert({
      id: created.user.id,
      business_id: businessId,
      name,
      email,
      role,
      active: true,
    })
    .select("*")
    .single();

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await adminClient.from("audit_logs").insert({
    business_id: businessId,
    entity: "users",
    entity_id: created.user.id,
    action: "create",
    actor_id: actor.id,
    new_data: profile,
    summary: "Usuario creado",
  });

  return NextResponse.json({ user: profile });
}
