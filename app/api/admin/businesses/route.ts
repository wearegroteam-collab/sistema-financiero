import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expenseCategories, paymentMethods } from "@/lib/constants";

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
  const businessInput = body.business ?? {};
  const adminInput = body.admin ?? null;
  const name = String(businessInput.name ?? "").trim();
  const logoUrl = String(businessInput.logoUrl ?? "").trim() || null;
  const currency = String(businessInput.currency ?? "COP");
  const timezone = String(businessInput.timezone ?? "America/Bogota").trim();
  const adminName = String(businessInput.adminName ?? adminInput?.name ?? "").trim();
  const adminEmail = String(businessInput.adminEmail ?? adminInput?.email ?? "").trim().toLowerCase();
  const phone = String(businessInput.phone ?? "").trim() || null;

  if (!name || !timezone || !["COP", "USD"].includes(currency)) {
    return NextResponse.json({ error: "Datos del negocio incompletos." }, { status: 400 });
  }

  if ((adminName && !adminEmail) || (!adminName && adminEmail)) {
    return NextResponse.json({ error: "Completa nombre y email del administrador principal." }, { status: 400 });
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
    return NextResponse.json({ error: "Solo Super Admin puede crear negocios." }, { status: 403 });
  }

  let createdBusinessId: string | null = null;
  let invitedUserId: string | null = null;

  try {
    const { data: business, error: businessError } = await adminClient
      .from("businesses")
      .insert({
        name,
        logo_url: logoUrl,
        currency,
        timezone,
        active: businessInput.active ?? true,
        admin_name: adminName || null,
        admin_email: adminEmail || null,
        phone,
      })
      .select("*")
      .single();

    if (businessError || !business) {
      throw new Error(businessError?.message ?? "No se pudo crear el negocio.");
    }

    createdBusinessId = business.id;

    const { error: methodsError } = await adminClient.from("payment_methods").insert(
      paymentMethods.map((method) => ({
        business_id: business.id,
        key: method.key,
        label: method.label,
        color: method.color,
      })),
    );
    if (methodsError) throw new Error(methodsError.message);

    const { error: categoriesError } = await adminClient.from("categories").insert(
      expenseCategories.map((category) => ({
        business_id: business.id,
        key: category.key,
        label: category.label,
        color: category.color,
      })),
    );
    if (categoriesError) throw new Error(categoriesError.message);

    const { error: settingsError } = await adminClient.from("settings").insert({
      business_id: business.id,
      data: { currency, timezone },
      updated_by: actor.id,
    });
    if (settingsError) throw new Error(settingsError.message);

    let adminProfile = null;
    if (adminName && adminEmail) {
      const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
      const inviteOptions = redirectTo
        ? { data: { name: adminName }, redirectTo }
        : { data: { name: adminName } };
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(adminEmail, inviteOptions);

      if (inviteError || !invited.user) {
        throw new Error(inviteError?.message ?? "No se pudo invitar al administrador.");
      }

      invitedUserId = invited.user.id;

      const { data: profile, error: profileError } = await adminClient
        .from("users")
        .insert({
          id: invited.user.id,
          business_id: business.id,
          name: adminName,
          email: adminEmail,
          role: "admin",
          active: true,
        })
        .select("*")
        .single();

      if (profileError || !profile) {
        throw new Error(profileError?.message ?? "No se pudo crear el perfil del administrador.");
      }

      adminProfile = profile;

      await adminClient.from("audit_logs").insert({
        business_id: business.id,
        entity: "users",
        entity_id: invited.user.id,
        action: "create",
        actor_id: actor.id,
        new_data: profile,
        summary: "Administrador principal invitado",
      });
    }

    await adminClient.from("audit_logs").insert({
      business_id: business.id,
      entity: "businesses",
      entity_id: business.id,
      action: "create",
      actor_id: actor.id,
      new_data: business,
      summary: "Negocio creado",
    });

    return NextResponse.json({ business, admin: adminProfile });
  } catch (error) {
    if (invitedUserId) {
      await adminClient.auth.admin.deleteUser(invitedUserId);
    }
    if (createdBusinessId) {
      await adminClient.from("businesses").delete().eq("id", createdBusinessId);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el negocio." },
      { status: 400 },
    );
  }
}
