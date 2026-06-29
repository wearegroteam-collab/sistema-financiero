"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { expenseCategories, paymentMethods } from "./constants";
import { calculateMonth, getMonthKeyFromDate, isMonthClosed } from "./finance";
import { initialState } from "./initial-data";
import { createClient, hasSupabaseConfig } from "./supabase/client";
import type {
  AppState,
  AuditLog,
  Business,
  DailySale,
  Expense,
  ExpenseCategory,
  ExpenseCategoryKey,
  MonthlyClosure,
  PaymentMethod,
  PaymentMethodKey,
  Role,
  User,
} from "./types";

const STORAGE_KEY = "hangar-finanzas-state-production-v1";
const LEGACY_STORAGE_KEYS = ["hangar-finanzas-state-v1"];
const CLEANUP_MARKER_KEY = "hangar-finanzas-production-cleaned-v1";

type SaleInput = Omit<DailySale, "id" | "businessId" | "createdBy" | "createdAt">;
type ExpenseInput = Omit<Expense, "id" | "businessId" | "createdBy" | "createdAt">;

type StoreContextValue = {
  state: AppState;
  business: Business;
  activeUser: User;
  loading: boolean;
  useSupabase: boolean;
  session: Session | null;
  setupRequired: boolean;
  canWrite: boolean;
  canManageBusiness: boolean;
  canManageUsers: boolean;
  canReopenMonths: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  createInitialSuperAdmin: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<boolean>;
  switchBusiness: (businessId: string) => Promise<void> | void;
  switchUser: (userId: string) => void;
  addSale: (sale: SaleInput) => Promise<boolean> | boolean;
  addExpense: (expense: ExpenseInput) => Promise<boolean> | boolean;
  updateSale: (id: string, sale: SaleInput) => Promise<boolean> | boolean;
  updateExpense: (id: string, expense: ExpenseInput) => Promise<boolean> | boolean;
  deleteMovement: (type: "sale" | "expense", id: string) => Promise<void> | void;
  closeMonth: (monthKey: string, notes?: string) => Promise<void> | void;
  reopenMonth: (closureId: string) => Promise<void> | void;
  updateSettings: (business: Business, categories: ExpenseCategory[], methods: PaymentMethod[]) => Promise<void> | void;
  createBusiness: (business: Omit<Business, "id" | "active"> & { active?: boolean }, admin?: { name: string; email: string; password?: string }) => Promise<void> | void;
  updateBusiness: (business: Business) => Promise<void> | void;
  deactivateBusiness: (businessId: string) => Promise<void> | void;
  deleteBusiness: (businessId: string) => Promise<void> | void;
  createUser: (user: Omit<User, "id" | "active"> & { active?: boolean }) => Promise<void> | void;
  updateUser: (user: User) => Promise<void> | void;
  deactivateUser: (userId: string) => Promise<void> | void;
  auditExport: (action: "download_pdf" | "export_excel" | "print", summary: string, businessId?: string) => Promise<void> | void;
  refresh: () => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

const emptyState: AppState = {
  currentBusinessId: "",
  activeUserId: "",
  businesses: [],
  users: [],
  paymentMethods,
  categories: expenseCategories,
  dailySales: [],
  expenses: [],
  closures: [],
  auditLogs: [],
};

const fallbackBusiness: Business = {
  id: "",
  name: "Sin negocio",
  currency: "COP",
  timezone: "America/Bogota",
  active: true,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const useSupabase = hasSupabaseConfig();
  const supabase = useMemo(() => (useSupabase ? createClient() : null), [useSupabase]);
  const [state, setState] = useState<AppState>(() => (useSupabase ? emptyState : readLocalState()));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(useSupabase);
  const [setupRequired, setSetupRequired] = useState(false);

  const business = state.businesses.find((item) => item.id === state.currentBusinessId) ?? state.businesses[0] ?? fallbackBusiness;
  const activeUser = state.users.find((user) => user.id === state.activeUserId) ?? state.users[0] ?? initialState.users[0];
  const canWrite = activeUser.active !== false && ["super_admin", "admin"].includes(activeUser.role);
  const canManageBusiness = activeUser.active !== false && activeUser.role === "super_admin";
  const canManageUsers = activeUser.active !== false && ["super_admin", "admin"].includes(activeUser.role);
  const canReopenMonths = activeUser.active !== false && activeUser.role === "super_admin";

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const setupStatus = await getSetupStatus(supabase);
    setSetupRequired(setupStatus.setupRequired);

    const { data: auth } = await supabase.auth.getSession();
    setSession(auth.session);

    if (setupStatus.setupRequired) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    if (!auth.session) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", auth.session.user.id)
      .single();

    if (profileError || !profile) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    const user = mapUser(profile);
    const allBusinessesQuery = supabase.from("businesses").select("*").order("created_at", { ascending: true });
    const allUsersQuery = supabase.from("users").select("*").order("created_at", { ascending: true });
    const businessScopedId = user.role === "super_admin" ? undefined : user.businessId;

    const [
      businessesResult,
      usersResult,
      salesResult,
      expensesResult,
      closuresResult,
      paymentMethodsResult,
      categoriesResult,
      auditResult,
    ] = await Promise.all([
      allBusinessesQuery,
      allUsersQuery,
      scopedSelect(supabase.from("daily_sales").select("*").is("deleted_at", null).order("date", { ascending: false }), businessScopedId),
      scopedSelect(supabase.from("expenses").select("*").is("deleted_at", null).order("date", { ascending: false }), businessScopedId),
      scopedSelect(supabase.from("monthly_closures").select("*").order("closed_at", { ascending: false }), businessScopedId),
      scopedSelect(supabase.from("payment_methods").select("*").eq("active", true), businessScopedId),
      scopedSelect(supabase.from("categories").select("*").eq("active", true), businessScopedId),
      scopedSelect(supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200), businessScopedId),
    ]);

    const businesses = (businessesResult.data ?? []).map(mapBusiness);
    const currentBusinessId = state.currentBusinessId && businesses.some((item) => item.id === state.currentBusinessId)
      ? state.currentBusinessId
      : user.role === "super_admin"
        ? businesses[0]?.id || ""
        : user.businessId || "";

    setState({
      currentBusinessId,
      activeUserId: user.id,
      businesses,
      users: (usersResult.data ?? []).map(mapUser),
      dailySales: (salesResult.data ?? []).map(mapSale),
      expenses: (expensesResult.data ?? []).map(mapExpense),
      closures: (closuresResult.data ?? []).map(mapClosure),
      paymentMethods: (paymentMethodsResult.data ?? []).map(mapPaymentMethod),
      categories: (categoriesResult.data ?? []).map(mapCategory),
      auditLogs: (auditResult.data ?? []).map(mapAuditLog),
    });
    setLoading(false);
  }, [supabase, state.currentBusinessId]);

  useEffect(() => {
    if (!supabase) return;
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, supabase]);

  const commitLocal = useCallback((next: AppState) => {
    setState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const auditLocal = useCallback((next: AppState, entity: AuditLog["entity"], entityId: string, action: AuditLog["action"], summary: string, oldData?: unknown, newData?: unknown): AppState => ({
    ...next,
    auditLogs: [
      {
        id: crypto.randomUUID(),
        businessId: business.id || undefined,
        entity,
        entityId,
        action,
        actorId: activeUser.id,
        oldData,
        newData,
        summary,
        createdAt: new Date().toISOString(),
      },
      ...next.auditLogs,
    ],
  }), [activeUser.id, business.id]);

  async function insertAudit(entity: AuditLog["entity"], entityId: string, action: AuditLog["action"], summary: string, oldData?: unknown, newData?: unknown, businessId?: string) {
    if (!supabase || !session) return;
    await supabase.from("audit_logs").insert({
      business_id: businessId || null,
      entity,
      entity_id: entityId,
      action,
      actor_id: session.user.id,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      summary,
    });
  }

  const value = useMemo<StoreContextValue>(() => ({
    state,
    business,
    activeUser,
    loading,
    useSupabase,
    session,
    setupRequired,
    canWrite,
    canManageBusiness,
    canManageUsers,
    canReopenMonths,
    signIn: async (email, password) => {
      if (!supabase) return false;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Sesion iniciada");
      await refresh();
      return true;
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
      setState(emptyState);
      setSession(null);
      toast.success("Sesion cerrada");
    },
    createInitialSuperAdmin: async (input) => {
      if (!supabase) return false;
      const setupStatus = await getSetupStatus(supabase);
      if (!setupStatus.setupRequired) {
        toast.error("Ya existe un Super Admin.");
        setSetupRequired(false);
        return false;
      }
      const response = await fetch("/api/setup/initial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo completar la configuracion inicial");
        return false;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (signInError) {
        toast.error(`Super Admin creado. Inicia sesion manualmente: ${signInError.message}`);
        setSetupRequired(false);
        return false;
      }
      setSetupRequired(false);
      toast.success("Super Admin creado");
      await refresh();
      return true;
    },
    switchBusiness: async (businessId) => {
      if (activeUser.role !== "super_admin") return;
      const target = state.businesses.find((item) => item.id === businessId && item.active !== false);
      if (!target) {
        toast.error("No se puede entrar a un negocio inactivo.");
        return;
      }
      setState({ ...state, currentBusinessId: businessId });
    },
    switchUser: (userId) => {
      if (useSupabase) return;
      const target = state.users.find((user) => user.id === userId && user.active !== false);
      if (!target) {
        toast.error("No se puede entrar con un usuario inactivo.");
        return;
      }
      const nextBusinessId = target.role === "super_admin" ? state.currentBusinessId : target.businessId || "";
      commitLocal({ ...state, activeUserId: userId, currentBusinessId: nextBusinessId });
    },
    addSale: async (sale) => {
      if (!canWrite) {
        toast.error("Tu rol no permite crear ventas.");
        return false;
      }
      if (!business.id) {
        toast.error("Crea o selecciona un negocio antes de registrar ventas.");
        return false;
      }
      const expected = Object.values(sale.distribution).reduce((total, value) => total + value, 0);
      if (expected !== sale.total) {
        const diff = expected - sale.total;
        toast.error(diff > 0 ? `Sobran ${diff.toLocaleString("es-CO")}` : `Faltan ${Math.abs(diff).toLocaleString("es-CO")}`);
        return false;
      }
      if (isMonthClosed(state, business.id, getMonthKeyFromDate(sale.date))) {
        toast.error("El mes esta cerrado. No se pueden agregar ventas.");
        return false;
      }
      if (supabase && session) {
        const { data, error } = await supabase.from("daily_sales").insert({
          business_id: business.id,
          date: sale.date,
          total: sale.total,
          bold: sale.distribution.bold,
          bancolombia: sale.distribution.bancolombia,
          nequi: sale.distribution.nequi,
          cash: sale.distribution.cash,
          notes: sale.notes,
          created_by: session.user.id,
        }).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo crear la venta");
          return false;
        }
        await insertAudit("daily_sales", data.id, "create", "Venta diaria registrada", undefined, data);
        await refresh();
        toast.success("Venta creada");
        return true;
      }
      const record: DailySale = { ...sale, id: crypto.randomUUID(), businessId: business.id, createdBy: activeUser.id, createdAt: new Date().toISOString() };
      commitLocal(auditLocal({ ...state, dailySales: [record, ...state.dailySales] }, "daily_sales", record.id, "create", "Venta diaria registrada", undefined, record));
      toast.success("Venta creada");
      return true;
    },
    addExpense: async (expense) => {
      if (!canWrite) {
        toast.error("Tu rol no permite crear gastos.");
        return false;
      }
      if (!business.id) {
        toast.error("Crea o selecciona un negocio antes de registrar gastos.");
        return false;
      }
      if (isMonthClosed(state, business.id, getMonthKeyFromDate(expense.date))) {
        toast.error("El mes esta cerrado. No se pueden agregar gastos.");
        return false;
      }
      if (supabase && session) {
        const { data, error } = await supabase.from("expenses").insert({
          business_id: business.id,
          date: expense.date,
          category: expense.category,
          detail: expense.detail,
          payment_method: expense.paymentMethod,
          value: expense.value,
          notes: expense.notes,
          created_by: session.user.id,
        }).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo crear el gasto");
          return false;
        }
        await insertAudit("expenses", data.id, "create", "Egreso registrado", undefined, data);
        await refresh();
        toast.success("Gasto creado");
        return true;
      }
      const record: Expense = { ...expense, id: crypto.randomUUID(), businessId: business.id, createdBy: activeUser.id, createdAt: new Date().toISOString() };
      commitLocal(auditLocal({ ...state, expenses: [record, ...state.expenses] }, "expenses", record.id, "create", "Egreso registrado", undefined, record));
      toast.success("Gasto creado");
      return true;
    },
    updateSale: async (id, sale) => {
      if (!canWrite) {
        toast.error("Tu rol no permite editar ventas.");
        return false;
      }
      const expected = Object.values(sale.distribution).reduce((total, value) => total + value, 0);
      if (expected !== sale.total) {
        const diff = expected - sale.total;
        toast.error(diff > 0 ? `Sobran ${diff.toLocaleString("es-CO")}` : `Faltan ${Math.abs(diff).toLocaleString("es-CO")}`);
        return false;
      }
      const previous = state.dailySales.find((item) => item.id === id);
      if (!previous || previous.deletedAt) return false;
      if (isMonthClosed(state, business.id, getMonthKeyFromDate(previous.date)) || isMonthClosed(state, business.id, getMonthKeyFromDate(sale.date))) {
        toast.error("No se puede editar un registro de un mes cerrado.");
        return false;
      }
      if (supabase && session) {
        const { data, error } = await supabase.from("daily_sales").update({
          date: sale.date,
          total: sale.total,
          bold: sale.distribution.bold,
          bancolombia: sale.distribution.bancolombia,
          nequi: sale.distribution.nequi,
          cash: sale.distribution.cash,
          notes: sale.notes,
          updated_at: new Date().toISOString(),
          updated_by: session.user.id,
        }).eq("id", id).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo actualizar la venta");
          return false;
        }
        await insertAudit("daily_sales", id, "update", "Venta diaria actualizada", previous, data);
        await refresh();
        toast.success("Registro actualizado");
        return true;
      }
      const updated: DailySale = { ...previous, ...sale, updatedAt: new Date().toISOString(), updatedBy: activeUser.id };
      commitLocal(auditLocal({ ...state, dailySales: state.dailySales.map((item) => (item.id === id ? updated : item)) }, "daily_sales", id, "update", "Venta diaria actualizada", previous, updated));
      toast.success("Registro actualizado");
      return true;
    },
    updateExpense: async (id, expense) => {
      if (!canWrite) {
        toast.error("Tu rol no permite editar gastos.");
        return false;
      }
      const previous = state.expenses.find((item) => item.id === id);
      if (!previous || previous.deletedAt) return false;
      if (isMonthClosed(state, business.id, getMonthKeyFromDate(previous.date)) || isMonthClosed(state, business.id, getMonthKeyFromDate(expense.date))) {
        toast.error("No se puede editar un registro de un mes cerrado.");
        return false;
      }
      if (supabase && session) {
        const { data, error } = await supabase.from("expenses").update({
          date: expense.date,
          category: expense.category,
          detail: expense.detail,
          payment_method: expense.paymentMethod,
          value: expense.value,
          notes: expense.notes,
          updated_at: new Date().toISOString(),
          updated_by: session.user.id,
        }).eq("id", id).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo actualizar el gasto");
          return false;
        }
        await insertAudit("expenses", id, "update", "Egreso actualizado", previous, data);
        await refresh();
        toast.success("Registro actualizado");
        return true;
      }
      const updated: Expense = { ...previous, ...expense, updatedAt: new Date().toISOString(), updatedBy: activeUser.id };
      commitLocal(auditLocal({ ...state, expenses: state.expenses.map((item) => (item.id === id ? updated : item)) }, "expenses", id, "update", "Egreso actualizado", previous, updated));
      toast.success("Registro actualizado");
      return true;
    },
    deleteMovement: async (type, id) => {
      if (!canWrite) {
        toast.error("Tu rol no permite eliminar registros.");
        return;
      }
      const source = type === "sale" ? state.dailySales : state.expenses;
      const record = source.find((item) => item.id === id);
      if (!record || isMonthClosed(state, business.id, getMonthKeyFromDate(record.date))) {
        toast.error("No se puede eliminar un registro de un mes cerrado.");
        return;
      }
      if (supabase && session) {
        const table = type === "sale" ? "daily_sales" : "expenses";
        const { data, error } = await supabase.from(table).update({
          deleted_at: new Date().toISOString(),
          deleted_by: session.user.id,
        }).eq("id", id).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo eliminar el registro");
          return;
        }
        await insertAudit(type === "sale" ? "daily_sales" : "expenses", id, "delete", "Registro eliminado", record, data);
        await refresh();
        toast.success("Registro eliminado");
        return;
      }
      const deletedAt = new Date().toISOString();
      const next = type === "sale"
        ? { ...state, dailySales: state.dailySales.map((sale) => sale.id === id ? { ...sale, deletedAt, deletedBy: activeUser.id } : sale) }
        : { ...state, expenses: state.expenses.map((expense) => expense.id === id ? { ...expense, deletedAt, deletedBy: activeUser.id } : expense) };
      commitLocal(auditLocal(next, type === "sale" ? "daily_sales" : "expenses", id, "delete", "Registro eliminado", record));
      toast.success("Registro eliminado");
    },
    closeMonth: async (monthKey, notes) => {
      if (!canWrite) {
        toast.error("Tu rol no permite cerrar meses.");
        return;
      }
      if (!business.id) {
        toast.error("Crea o selecciona un negocio antes de cerrar mes.");
        return;
      }
      if (isMonthClosed(state, business.id, monthKey)) {
        toast.message("Este mes ya esta cerrado");
        return;
      }
      const [year, month] = monthKey.split("-").map(Number);
      const summary = calculateMonth(state, business.id, monthKey);
      const payload = {
        business_id: business.id,
        month,
        year,
        sales_total: summary.salesTotal,
        expenses_total: summary.expensesTotal,
        available_total: summary.availableTotal,
        utility: summary.utility,
        bold_balance: summary.balances.bold,
        bancolombia_balance: summary.balances.bancolombia,
        nequi_balance: summary.balances.nequi,
        cash_balance: summary.balances.cash,
        payroll_total: summary.categoryTotals.payroll,
        inventory_total: summary.categoryTotals.inventory,
        extras_total: summary.categoryTotals.extras,
        fixed_total: summary.categoryTotals.fixed,
        payroll_percentage: summary.percentages.payroll,
        inventory_percentage: summary.percentages.inventory,
        extras_percentage: summary.percentages.extras,
        fixed_percentage: summary.percentages.fixed,
        available_percentage: summary.percentages.available,
        notes,
        closed_by: activeUser.id,
      };
      if (supabase) {
        const { data, error } = await supabase.from("monthly_closures").insert(payload).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo cerrar el mes");
          return;
        }
        await insertAudit("monthly_closures", data.id, "close_month", "Mes cerrado", undefined, data);
        await refresh();
        toast.success("Mes cerrado correctamente");
        return;
      }
      const closure: MonthlyClosure = {
        id: crypto.randomUUID(),
        businessId: business.id,
        month,
        year,
        salesTotal: summary.salesTotal,
        expensesTotal: summary.expensesTotal,
        availableTotal: summary.availableTotal,
        utility: summary.utility,
        balanceByMethod: summary.balances,
        categoryTotals: summary.categoryTotals,
        percentages: summary.percentages,
        notes,
        closedAt: new Date().toISOString(),
        closedBy: activeUser.id,
      };
      commitLocal(auditLocal({ ...state, closures: [closure, ...state.closures] }, "monthly_closures", closure.id, "close_month", "Mes cerrado", undefined, closure));
      toast.success("Mes cerrado correctamente");
    },
    reopenMonth: async (closureId) => {
      if (!canReopenMonths) {
        toast.error("Solo el Super Admin puede reabrir meses");
        return;
      }
      const previous = state.closures.find((closure) => closure.id === closureId);
      if (supabase && session) {
        const { data, error } = await supabase.from("monthly_closures").update({
          reopened_at: new Date().toISOString(),
          reopened_by: session.user.id,
        }).eq("id", closureId).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo reabrir el mes");
          return;
        }
        await insertAudit("monthly_closures", closureId, "reopen_month", "Mes reabierto", previous, data);
        await refresh();
        toast.success("Mes reabierto correctamente");
        return;
      }
      const closures = state.closures.map((closure) => closure.id === closureId ? { ...closure, reopenedAt: new Date().toISOString(), reopenedBy: activeUser.id } : closure);
      commitLocal(auditLocal({ ...state, closures }, "monthly_closures", closureId, "reopen_month", "Mes reabierto", previous, closures.find((closure) => closure.id === closureId)));
      toast.success("Mes reabierto correctamente");
    },
    updateSettings: async (updatedBusiness) => {
      if (!canWrite) {
        toast.error("Tu rol no permite cambiar la configuracion.");
        return;
      }
      if (supabase) {
        const { error } = await supabase.from("businesses").update({
          name: updatedBusiness.name,
          logo_url: updatedBusiness.logoUrl,
          currency: updatedBusiness.currency,
          timezone: updatedBusiness.timezone,
          active: updatedBusiness.active,
          admin_name: updatedBusiness.adminName,
          admin_email: updatedBusiness.adminEmail,
          phone: updatedBusiness.phone,
        }).eq("id", updatedBusiness.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        await insertAudit("settings", updatedBusiness.id, "update", "Configuracion actualizada", business, updatedBusiness);
        await refresh();
        toast.success("Configuracion guardada");
        return;
      }
      const next = { ...state, businesses: state.businesses.map((item) => (item.id === updatedBusiness.id ? updatedBusiness : item)) };
      commitLocal(auditLocal(next, "settings", updatedBusiness.id, "update", "Configuracion actualizada", business, updatedBusiness));
      toast.success("Configuracion guardada");
    },
    createBusiness: async (newBusiness) => {
      if (!canManageBusiness) {
        toast.error("Solo Super Admin puede crear negocios.");
        return;
      }
      if (supabase) {
        const { data, error } = await supabase.from("businesses").insert({
          name: newBusiness.name,
          logo_url: newBusiness.logoUrl,
          currency: newBusiness.currency,
          timezone: newBusiness.timezone,
          active: newBusiness.active ?? true,
          admin_name: newBusiness.adminName,
          admin_email: newBusiness.adminEmail,
          phone: newBusiness.phone,
        }).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo crear el negocio");
          return;
        }
        await Promise.all([
          supabase.from("payment_methods").insert(paymentMethods.map((method) => ({ business_id: data.id, key: method.key, label: method.label, color: method.color }))),
          supabase.from("categories").insert(expenseCategories.map((category) => ({ business_id: data.id, key: category.key, label: category.label, color: category.color }))),
        ]);
        await insertAudit("businesses", data.id, "create", "Negocio creado", undefined, data, data.id);
        await refresh();
        toast.success("Negocio creado");
        return;
      }
      const record: Business = { ...newBusiness, id: crypto.randomUUID(), active: newBusiness.active ?? true };
      commitLocal(auditLocal({ ...state, businesses: [record, ...state.businesses], currentBusinessId: record.id }, "businesses", record.id, "create", "Negocio creado", undefined, record));
      toast.success("Negocio creado");
    },
    updateBusiness: async (updatedBusiness) => {
      if (!canManageBusiness) {
        toast.error("Solo Super Admin puede editar negocios.");
        return;
      }
      if (supabase) {
        const { error } = await supabase.from("businesses").update({
          name: updatedBusiness.name,
          logo_url: updatedBusiness.logoUrl,
          currency: updatedBusiness.currency,
          timezone: updatedBusiness.timezone,
          active: updatedBusiness.active,
          admin_name: updatedBusiness.adminName,
          admin_email: updatedBusiness.adminEmail,
          phone: updatedBusiness.phone,
        }).eq("id", updatedBusiness.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        await insertAudit("businesses", updatedBusiness.id, "update", "Negocio actualizado", business, updatedBusiness, updatedBusiness.id);
        await refresh();
        toast.success("Negocio actualizado");
        return;
      }
      const previous = state.businesses.find((item) => item.id === updatedBusiness.id);
      const next = { ...state, businesses: state.businesses.map((item) => (item.id === updatedBusiness.id ? updatedBusiness : item)) };
      commitLocal(auditLocal(next, "businesses", updatedBusiness.id, "update", "Negocio actualizado", previous, updatedBusiness));
      toast.success("Negocio actualizado");
    },
    deactivateBusiness: async (businessId) => {
      if (!canManageBusiness) return;
      const previous = state.businesses.find((item) => item.id === businessId);
      if (supabase) {
        const { data, error } = await supabase.from("businesses").update({ active: false }).eq("id", businessId).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo desactivar el negocio");
          return;
        }
        await insertAudit("businesses", businessId, "delete", "Negocio desactivado", previous, data, businessId);
        await refresh();
        toast.success("Negocio desactivado");
        return;
      }
      const businesses = state.businesses.map((item) => (item.id === businessId ? { ...item, active: false } : item));
      commitLocal(auditLocal({ ...state, businesses }, "businesses", businessId, "delete", "Negocio desactivado", previous));
      toast.success("Negocio desactivado");
    },
    deleteBusiness: async (businessId) => {
      if (!canManageBusiness) return;
      if (supabase) {
        const token = session?.access_token;
        if (!token) {
          toast.error("Sesion no valida.");
          return;
        }
        const response = await fetch(`/api/admin/businesses/${businessId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(payload.error ?? "No se pudo eliminar el negocio");
          return;
        }
        await refresh();
        toast.success("Negocio eliminado");
        return;
      }
      const previous = state.businesses.find((item) => item.id === businessId);
      const businesses = state.businesses.map((item) => (item.id === businessId ? { ...item, active: false } : item));
      commitLocal(auditLocal({ ...state, businesses }, "businesses", businessId, "delete", "Negocio eliminado/desactivado", previous));
      toast.success("Negocio eliminado");
    },
    createUser: async (user) => {
      if (!canManageUsers) {
        toast.error("Tu rol no permite crear usuarios.");
        return;
      }
      if (supabase) {
        const token = session?.access_token;
        if (!token) {
          toast.error("Sesion no valida.");
          return;
        }
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            businessId: user.businessId,
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(payload.error ?? "No se pudo crear el usuario");
          return;
        }
        await refresh();
        toast.success("Usuario creado");
        return;
      }
      const record: User = { ...user, id: crypto.randomUUID(), active: user.active ?? true };
      commitLocal(auditLocal({ ...state, users: [record, ...state.users] }, "users", record.id, "create", "Usuario creado", undefined, record));
      toast.success("Usuario creado");
    },
    updateUser: async (updatedUser) => {
      if (!canManageUsers) return;
      if (supabase) {
        const { error } = await supabase.from("users").update({
          name: updatedUser.name,
          role: updatedUser.role,
          active: updatedUser.active,
          business_id: updatedUser.role === "super_admin" ? null : updatedUser.businessId,
        }).eq("id", updatedUser.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        await insertAudit("users", updatedUser.id, "update", "Usuario actualizado", undefined, updatedUser, updatedUser.businessId);
        await refresh();
        toast.success("Usuario actualizado");
        return;
      }
      const previous = state.users.find((user) => user.id === updatedUser.id);
      commitLocal(auditLocal({ ...state, users: state.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)) }, "users", updatedUser.id, "update", "Usuario actualizado", previous, updatedUser));
      toast.success("Usuario actualizado");
    },
    deactivateUser: async (userId) => {
      if (!canManageUsers) return;
      const previous = state.users.find((user) => user.id === userId);
      if (supabase) {
        const { data, error } = await supabase.from("users").update({ active: false }).eq("id", userId).select("*").single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo desactivar el usuario");
          return;
        }
        await insertAudit("users", userId, "delete", "Usuario desactivado", previous, data, data.business_id);
        await refresh();
        toast.success("Usuario desactivado");
        return;
      }
      const users = state.users.map((user) => (user.id === userId ? { ...user, active: false } : user));
      commitLocal(auditLocal({ ...state, users }, "users", userId, "delete", "Usuario desactivado", previous));
      toast.success("Usuario desactivado");
    },
    auditExport: async (action, summary, businessId) => {
      if (supabase && session) {
        await insertAudit("exports", crypto.randomUUID(), action, summary, undefined, { businessId: businessId ?? business.id }, businessId ?? business.id);
        await refresh();
        return;
      }
      commitLocal(auditLocal(state, "exports", crypto.randomUUID(), action, summary, undefined, { businessId: businessId ?? business.id }));
    },
    refresh,
  }), [activeUser, auditLocal, business, canManageBusiness, canManageUsers, canReopenMonths, canWrite, commitLocal, loading, refresh, session, setupRequired, state, supabase, useSupabase]);

  if (useSupabase && loading) return <AuthFrame title="Conectando con Supabase" subtitle="Validando sesion y permisos..." />;
  if (useSupabase && setupRequired) return <SetupScreen onSubmit={value.createInitialSuperAdmin} />;
  if (useSupabase && !session) return <LoginScreen onSubmit={value.signIn} />;

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function readLocalState() {
  if (typeof window === "undefined") return initialState;
  if (!window.localStorage.getItem(CLEANUP_MARKER_KEY)) {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("hangar-finanzas-state"))
      .forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.setItem(CLEANUP_MARKER_KEY, "true");
    return initialState;
  }
  LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved ? (JSON.parse(saved) as AppState) : initialState;
}

function scopedSelect<T>(query: T, businessId?: string): T {
  if (!businessId) return query;
  return (query as { eq: (column: string, value: string) => T }).eq("business_id", businessId);
}

async function getSetupStatus(supabase: ReturnType<typeof createClient>) {
  try {
    const response = await fetch("/api/setup/status", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      return {
        setupRequired: Boolean(payload.setupRequired),
        authUserCount: Number(payload.authUserCount ?? 0),
        profileCount: Number(payload.profileCount ?? 0),
        superAdminCount: Number(payload.superAdminCount ?? 0),
      };
    }
  } catch {
    // Fall back to the public RPC below when the service-role status route is unavailable.
  }

  const { data: hasAdmin } = await supabase.rpc("has_super_admin");
  return {
    setupRequired: hasAdmin === false,
    authUserCount: undefined,
    profileCount: undefined,
    superAdminCount: hasAdmin ? 1 : 0,
  };
}

function mapBusiness(row: Record<string, any>): Business {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url ?? undefined,
    currency: row.currency,
    timezone: row.timezone,
    active: row.active,
    adminName: row.admin_name ?? undefined,
    adminEmail: row.admin_email ?? undefined,
    phone: row.phone ?? undefined,
  };
}

function mapUser(row: Record<string, any>): User {
  return {
    id: row.id,
    businessId: row.business_id ?? undefined,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
  };
}

function mapPaymentMethod(row: Record<string, any>): PaymentMethod {
  return { key: row.key, label: row.label, color: row.color };
}

function mapCategory(row: Record<string, any>): ExpenseCategory {
  return { key: row.key, label: row.label, color: row.color };
}

function mapSale(row: Record<string, any>): DailySale {
  return {
    id: row.id,
    businessId: row.business_id,
    date: row.date,
    total: Number(row.total),
    distribution: {
      bold: Number(row.bold),
      bancolombia: Number(row.bancolombia),
      nequi: Number(row.nequi),
      cash: Number(row.cash),
    },
    notes: row.notes ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: row.deleted_by ?? undefined,
  };
}

function mapExpense(row: Record<string, any>): Expense {
  return {
    id: row.id,
    businessId: row.business_id,
    date: row.date,
    category: row.category as ExpenseCategoryKey,
    detail: row.detail,
    paymentMethod: row.payment_method as PaymentMethodKey,
    value: Number(row.value),
    notes: row.notes ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: row.deleted_by ?? undefined,
  };
}

function mapClosure(row: Record<string, any>): MonthlyClosure {
  return {
    id: row.id,
    businessId: row.business_id,
    month: row.month,
    year: row.year,
    salesTotal: Number(row.sales_total),
    expensesTotal: Number(row.expenses_total),
    availableTotal: Number(row.available_total),
    utility: Number(row.utility),
    balanceByMethod: {
      bold: Number(row.bold_balance),
      bancolombia: Number(row.bancolombia_balance),
      nequi: Number(row.nequi_balance),
      cash: Number(row.cash_balance),
    },
    categoryTotals: {
      payroll: Number(row.payroll_total),
      inventory: Number(row.inventory_total),
      extras: Number(row.extras_total),
      fixed: Number(row.fixed_total),
    },
    percentages: {
      payroll: Number(row.payroll_percentage),
      inventory: Number(row.inventory_percentage),
      extras: Number(row.extras_percentage),
      fixed: Number(row.fixed_percentage),
      available: Number(row.available_percentage),
    },
    notes: row.notes ?? undefined,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    reopenedAt: row.reopened_at ?? undefined,
    reopenedBy: row.reopened_by ?? undefined,
  };
}

function mapAuditLog(row: Record<string, any>): AuditLog {
  return {
    id: row.id,
    businessId: row.business_id,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    actorId: row.actor_id,
    oldData: row.old_data ?? undefined,
    newData: row.new_data ?? undefined,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

function AuthFrame({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-panel p-4">
      <div className="surface w-full max-w-md rounded-lg p-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-panel p-4">
      <form className="surface grid w-full max-w-md gap-4 rounded-lg p-6" onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        await onSubmit(email, password);
        setSubmitting(false);
      }}>
        <div>
          <h1 className="text-xl font-semibold text-ink">Ingresar</h1>
          <p className="mt-2 text-sm text-muted">Usa tu email y contrasena de Supabase Auth.</p>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          Email
          <input className="focus-ring h-10 rounded-md border border-line px-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          Contrasena
          <input className="focus-ring h-10 rounded-md border border-line px-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="focus-ring h-10 rounded-md bg-ink px-4 text-sm font-medium text-white" disabled={submitting}>
          {submitting ? "Ingresando..." : "Iniciar sesion"}
        </button>
      </form>
    </div>
  );
}

function SetupScreen({ onSubmit }: { onSubmit: StoreContextValue["createInitialSuperAdmin"] }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-panel p-4">
      <form className="surface grid w-full max-w-xl gap-4 rounded-lg p-6" onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        await onSubmit(form);
        setSubmitting(false);
      }}>
        <div>
          <h1 className="text-xl font-semibold text-ink">Configuracion inicial</h1>
          <p className="mt-2 text-sm text-muted">Crea el primer Super Admin global. Despues podras crear negocios desde el panel.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-ink">Nombre<input className="focus-ring h-10 rounded-md border border-line px-3" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">Email<input className="focus-ring h-10 rounded-md border border-line px-3" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">Contrasena<input className="focus-ring h-10 rounded-md border border-line px-3" type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
        </div>
        <button className="focus-ring h-10 rounded-md bg-ink px-4 text-sm font-medium text-white" disabled={submitting}>
          {submitting ? "Creando..." : "Crear Super Admin"}
        </button>
      </form>
    </div>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
