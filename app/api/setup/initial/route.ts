import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expenseCategories, paymentMethods } from "@/lib/constants";

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
  const businessName = String(body.businessName ?? "Hangar").trim();
  const timezone = String(body.timezone ?? "America/Bogota").trim();
  const currency = String(body.currency ?? "COP").trim();

  if (!name || !email || password.length < 8 || !businessName || !timezone || !["COP", "USD"].includes(currency)) {
    return NextResponse.json({ error: "Datos de configuracion inicial incompletos." }, { status: 400 });
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

  const createdUserId = created.user.id;

  const rollbackAuthUser = async () => {
    await adminClient.auth.admin.deleteUser(createdUserId);
  };

  const { data: business, error: businessError } = await adminClient
    .from("businesses")
    .insert({
      name: businessName,
      currency,
      timezone,
      active: true,
      admin_name: name,
      admin_email: email,
    })
    .select("*")
    .single();

  if (businessError || !business) {
    await rollbackAuthUser();
    return NextResponse.json(
      { error: businessError?.message ?? "No se pudo crear el negocio." },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .insert({
      id: createdUserId,
      business_id: business.id,
      name,
      email,
      role: "super_admin",
      active: true,
    })
    .select("*")
    .single();

  if (profileError || !profile) {
    await adminClient.from("businesses").delete().eq("id", business.id);
    await rollbackAuthUser();
    return NextResponse.json(
      { error: profileError?.message ?? "No se pudo crear el perfil Super Admin." },
      { status: 400 },
    );
  }

  const [methodsResult, categoriesResult, settingsResult] = await Promise.all([
    adminClient.from("payment_methods").insert(paymentMethods.map((method) => ({
      business_id: business.id,
      key: method.key,
      label: method.label,
      color: method.color,
      active: true,
    }))),
    adminClient.from("categories").insert(expenseCategories.map((category) => ({
      business_id: business.id,
      key: category.key,
      label: category.label,
      color: category.color,
      active: true,
    }))),
    adminClient.from("settings").insert({
      business_id: business.id,
      data: {
        currency,
        timezone,
        bootstrapped: true,
      },
      updated_by: createdUserId,
    }),
  ]);

  const setupError = methodsResult.error ?? categoriesResult.error ?? settingsResult.error;
  if (setupError) {
    await adminClient.from("payment_methods").delete().eq("business_id", business.id);
    await adminClient.from("categories").delete().eq("business_id", business.id);
    await adminClient.from("settings").delete().eq("business_id", business.id);
    await adminClient.from("users").delete().eq("id", createdUserId);
    await adminClient.from("businesses").delete().eq("id", business.id);
    await rollbackAuthUser();
    return NextResponse.json({ error: setupError.message }, { status: 400 });
  }

  await adminClient.from("audit_logs").insert({
    business_id: business.id,
    entity: "users",
    entity_id: createdUserId,
    action: "create",
    actor_id: createdUserId,
    new_data: { profile, business },
    summary: "Configuracion inicial y Super Admin creados",
  });

  return NextResponse.json({
    user: { id: createdUserId, email },
    business,
    profile,
  });
}
