import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para verificar usuarios Auth." },
      { status: 500 },
    );
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [{ data: authUsers, error: authError }, { count: profileCount, error: profileError }, { count: superAdminCount, error: superAdminError }] =
    await Promise.all([
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1 }),
      adminClient.from("users").select("id", { count: "exact", head: true }),
      adminClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")
        .eq("active", true),
    ]);

  if (authError || profileError || superAdminError) {
    return NextResponse.json(
      { error: authError?.message ?? profileError?.message ?? superAdminError?.message },
      { status: 500 },
    );
  }

  const authUserCount = authUsers.users.length;
  const setupRequired = authUserCount === 0 || (profileCount ?? 0) === 0 || (superAdminCount ?? 0) === 0;

  return NextResponse.json({
    authUserCount,
    profileCount: profileCount ?? 0,
    superAdminCount: superAdminCount ?? 0,
    setupRequired,
  });
}
