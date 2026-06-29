import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Faltan variables de Supabase para eliminar negocios." },
      { status: 500 },
    );
  }

  const businessId = (await params).id;
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
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
    .select("id,role,active")
    .eq("id", authUser.user.id)
    .single();

  if (actorError || !actor || actor.role !== "super_admin" || actor.active === false) {
    return NextResponse.json({ error: "Solo Super Admin puede eliminar negocios." }, { status: 403 });
  }

  const { data: business, error: businessError } = await adminClient
    .from("businesses")
    .select("id,name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  const { data: businessUsers, error: usersError } = await adminClient
    .from("users")
    .select("id")
    .eq("business_id", businessId);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  for (const user of businessUsers ?? []) {
    await adminClient.auth.admin.deleteUser(user.id);
  }

  const deleteSteps = [
    () => adminClient.from("monthly_closures").delete().eq("business_id", businessId),
    () => adminClient.from("daily_sales").delete().eq("business_id", businessId),
    () => adminClient.from("expenses").delete().eq("business_id", businessId),
    () => adminClient.from("payment_methods").delete().eq("business_id", businessId),
    () => adminClient.from("categories").delete().eq("business_id", businessId),
    () => adminClient.from("settings").delete().eq("business_id", businessId),
    () => adminClient.from("audit_logs").delete().eq("business_id", businessId),
    () => adminClient.from("users").delete().eq("business_id", businessId),
  ];

  for (const step of deleteSteps) {
    const { error } = await step();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const { error: finalError } = await adminClient.from("businesses").delete().eq("id", businessId);
  if (finalError) {
    return NextResponse.json({ error: finalError.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true, business });
}
