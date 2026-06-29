"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { initialState } from "./initial-data";
import { calculateMonth, getMonthKeyFromDate, isMonthClosed } from "./finance";
import type {
  AppState,
  AuditLog,
  Business,
  DailySale,
  Expense,
  ExpenseCategory,
  MonthlyClosure,
  PaymentMethod,
  User,
} from "./types";

const STORAGE_KEY = "hangar-finanzas-state-production-v1";
const LEGACY_STORAGE_KEYS = ["hangar-finanzas-state-v1"];
const CLEANUP_MARKER_KEY = "hangar-finanzas-production-cleaned-v1";

type StoreContextValue = {
  state: AppState;
  business: Business;
  activeUser: User;
  canWrite: boolean;
  canManageBusiness: boolean;
  canManageUsers: boolean;
  canReopenMonths: boolean;
  switchBusiness: (businessId: string) => void;
  switchUser: (userId: string) => void;
  addSale: (sale: Omit<DailySale, "id" | "businessId" | "createdBy" | "createdAt">) => boolean;
  addExpense: (expense: Omit<Expense, "id" | "businessId" | "createdBy" | "createdAt">) => boolean;
  updateSale: (id: string, sale: Omit<DailySale, "id" | "businessId" | "createdBy" | "createdAt">) => boolean;
  updateExpense: (id: string, expense: Omit<Expense, "id" | "businessId" | "createdBy" | "createdAt">) => boolean;
  deleteMovement: (type: "sale" | "expense", id: string) => void;
  closeMonth: (monthKey: string, notes?: string) => void;
  reopenMonth: (closureId: string) => void;
  updateSettings: (business: Business, categories: ExpenseCategory[], methods: PaymentMethod[]) => void;
  createBusiness: (business: Omit<Business, "id" | "active"> & { active?: boolean }, admin?: { name: string; email: string; password?: string }) => void;
  updateBusiness: (business: Business) => void;
  deactivateBusiness: (businessId: string) => void;
  deleteBusiness: (businessId: string) => void;
  createUser: (user: Omit<User, "id" | "active"> & { active?: boolean }) => void;
  updateUser: (user: User) => void;
  deactivateUser: (userId: string) => void;
  auditExport: (action: "download_pdf" | "export_excel" | "print", summary: string, businessId?: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
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
  });

  function commit(next: AppState) {
    setState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }

  const business = state.businesses.find((item) => item.id === state.currentBusinessId) ?? state.businesses[0];
  const activeUser = state.users.find((user) => user.id === state.activeUserId) ?? state.users[0];
  const canWrite = activeUser.active !== false && ["super_admin", "admin"].includes(activeUser.role);
  const canManageBusiness = activeUser.active !== false && activeUser.role === "super_admin";
  const canManageUsers = activeUser.active !== false && ["super_admin", "admin"].includes(activeUser.role);
  const canReopenMonths = activeUser.active !== false && activeUser.role === "super_admin";

  const value = useMemo<StoreContextValue>(() => {
    const audit = (
      next: AppState,
      entity: AuditLog["entity"],
      entityId: string,
      action: AuditLog["action"],
      summary: string,
      oldData?: unknown,
      newData?: unknown,
    ): AppState => ({
      ...next,
      auditLogs: [
        {
          id: crypto.randomUUID(),
          businessId: business.id,
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
    });

    return {
      state,
      business,
      activeUser,
      canWrite,
      canManageBusiness,
      canManageUsers,
      canReopenMonths,
      switchBusiness: (businessId) => {
        if (activeUser.role !== "super_admin") return;
        const target = state.businesses.find((item) => item.id === businessId && item.active !== false);
        if (!target) {
          toast.error("No se puede entrar a un negocio inactivo.");
          return;
        }
        commit({ ...state, currentBusinessId: businessId });
      },
      switchUser: (userId) => {
        const target = state.users.find((user) => user.id === userId && user.active !== false);
        if (!target) {
          toast.error("No se puede entrar con un usuario inactivo.");
          return;
        }
        const nextBusinessId = target.role === "super_admin" ? state.currentBusinessId : target.businessId;
        commit({ ...state, activeUserId: userId, currentBusinessId: nextBusinessId });
      },
      addSale: (sale) => {
        if (!canWrite) {
          toast.error("Tu rol no permite crear ventas.");
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
        const record: DailySale = {
          ...sale,
          id: crypto.randomUUID(),
          businessId: business.id,
          createdBy: activeUser.id,
          createdAt: new Date().toISOString(),
        };
        commit(audit({ ...state, dailySales: [record, ...state.dailySales] }, "daily_sales", record.id, "create", "Venta diaria registrada", undefined, record));
        toast.success("Venta creada");
        return true;
      },
      addExpense: (expense) => {
        if (!canWrite) {
          toast.error("Tu rol no permite crear gastos.");
          return false;
        }
        if (isMonthClosed(state, business.id, getMonthKeyFromDate(expense.date))) {
          toast.error("El mes esta cerrado. No se pueden agregar gastos.");
          return false;
        }
        const record: Expense = {
          ...expense,
          id: crypto.randomUUID(),
          businessId: business.id,
          createdBy: activeUser.id,
          createdAt: new Date().toISOString(),
        };
        commit(audit({ ...state, expenses: [record, ...state.expenses] }, "expenses", record.id, "create", "Egreso registrado", undefined, record));
        toast.success("Gasto creado");
        return true;
      },
      updateSale: (id, sale) => {
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
        if (!previous || previous.deletedAt) {
          toast.error("No se encontro la venta.");
          return false;
        }
        if (
          isMonthClosed(state, business.id, getMonthKeyFromDate(previous.date)) ||
          isMonthClosed(state, business.id, getMonthKeyFromDate(sale.date))
        ) {
          toast.error("No se puede editar un registro de un mes cerrado.");
          return false;
        }
        const updated: DailySale = {
          ...previous,
          ...sale,
          updatedAt: new Date().toISOString(),
          updatedBy: activeUser.id,
        };
        const next = {
          ...state,
          dailySales: state.dailySales.map((item) => (item.id === id ? updated : item)),
        };
        commit(audit(next, "daily_sales", id, "update", "Venta diaria actualizada", previous, updated));
        toast.success("Registro actualizado");
        return true;
      },
      updateExpense: (id, expense) => {
        if (!canWrite) {
          toast.error("Tu rol no permite editar gastos.");
          return false;
        }
        const previous = state.expenses.find((item) => item.id === id);
        if (!previous || previous.deletedAt) {
          toast.error("No se encontro el gasto.");
          return false;
        }
        if (
          isMonthClosed(state, business.id, getMonthKeyFromDate(previous.date)) ||
          isMonthClosed(state, business.id, getMonthKeyFromDate(expense.date))
        ) {
          toast.error("No se puede editar un registro de un mes cerrado.");
          return false;
        }
        const updated: Expense = {
          ...previous,
          ...expense,
          updatedAt: new Date().toISOString(),
          updatedBy: activeUser.id,
        };
        const next = {
          ...state,
          expenses: state.expenses.map((item) => (item.id === id ? updated : item)),
        };
        commit(audit(next, "expenses", id, "update", "Egreso actualizado", previous, updated));
        toast.success("Registro actualizado");
        return true;
      },
      deleteMovement: (type, id) => {
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
        const deletedAt = new Date().toISOString();
        const next =
          type === "sale"
            ? {
                ...state,
                dailySales: state.dailySales.map((sale) =>
                  sale.id === id ? { ...sale, deletedAt, deletedBy: activeUser.id } : sale,
                ),
              }
            : {
                ...state,
                expenses: state.expenses.map((expense) =>
                  expense.id === id ? { ...expense, deletedAt, deletedBy: activeUser.id } : expense,
                ),
              };
        const updated = type === "sale"
          ? next.dailySales.find((sale) => sale.id === id)
          : next.expenses.find((expense) => expense.id === id);
        commit(audit(next, type === "sale" ? "daily_sales" : "expenses", id, "delete", "Registro eliminado", record, updated));
        toast.success("Registro eliminado");
      },
      closeMonth: (monthKey, notes) => {
        if (!canWrite) {
          toast.error("Tu rol no permite cerrar meses.");
          return;
        }
        if (isMonthClosed(state, business.id, monthKey)) {
          toast.message("Este mes ya esta cerrado");
          return;
        }
        const [year, month] = monthKey.split("-").map(Number);
        const summary = calculateMonth(state, business.id, monthKey);
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
        commit(audit({ ...state, closures: [closure, ...state.closures] }, "monthly_closures", closure.id, "close_month", "Mes cerrado", undefined, closure));
        toast.success("Mes cerrado correctamente");
      },
      reopenMonth: (closureId) => {
        if (!canReopenMonths) {
          toast.error("Solo el Super Admin puede reabrir meses");
          return;
        }
        const closures = state.closures.map((closure) =>
          closure.id === closureId
            ? { ...closure, reopenedAt: new Date().toISOString(), reopenedBy: activeUser.id }
            : closure,
        );
        const previous = state.closures.find((closure) => closure.id === closureId);
        const updated = closures.find((closure) => closure.id === closureId);
        commit(audit({ ...state, closures }, "monthly_closures", closureId, "reopen_month", "Mes reabierto", previous, updated));
        toast.success("Mes reabierto correctamente");
      },
      updateSettings: (updatedBusiness, categories, methods) => {
        if (!canWrite) {
          toast.error("Tu rol no permite cambiar la configuracion.");
          return;
        }
        const next = {
          ...state,
          businesses: state.businesses.map((item) => (item.id === updatedBusiness.id ? updatedBusiness : item)),
          categories,
          paymentMethods: methods,
        };
        commit(audit(next, "settings", updatedBusiness.id, "update", "Configuracion actualizada", business, updatedBusiness));
        toast.success("Configuracion guardada");
      },
      createBusiness: (newBusiness, admin) => {
        if (!canManageBusiness) {
          toast.error("Solo Super Admin puede crear negocios.");
          return;
        }
        const record: Business = {
          ...newBusiness,
          id: crypto.randomUUID(),
          active: newBusiness.active ?? true,
        };
        const adminUser: User | null = admin?.email
          ? {
              id: crypto.randomUUID(),
              businessId: record.id,
              name: admin.name,
              email: admin.email,
              role: "admin",
              active: true,
              password: admin.password || "temporal123",
            }
          : null;
        const next = {
          ...state,
          businesses: [record, ...state.businesses],
          users: adminUser ? [adminUser, ...state.users] : state.users,
          currentBusinessId: record.id,
        };
        commit(audit(next, "businesses", record.id, "create", "Negocio creado", undefined, { record, adminUser }));
        toast.success("Negocio creado");
      },
      updateBusiness: (updatedBusiness) => {
        if (!canManageBusiness) {
          toast.error("Solo Super Admin puede editar negocios.");
          return;
        }
        const previous = state.businesses.find((item) => item.id === updatedBusiness.id);
        const next = {
          ...state,
          businesses: state.businesses.map((item) => (item.id === updatedBusiness.id ? updatedBusiness : item)),
        };
        commit(audit(next, "businesses", updatedBusiness.id, "update", "Negocio actualizado", previous, updatedBusiness));
        toast.success("Negocio actualizado");
      },
      deactivateBusiness: (businessId) => {
        if (!canManageBusiness) {
          toast.error("Solo Super Admin puede desactivar negocios.");
          return;
        }
        const previous = state.businesses.find((item) => item.id === businessId);
        const businesses = state.businesses.map((item) => (item.id === businessId ? { ...item, active: false } : item));
        const nextBusinessId = state.currentBusinessId === businessId
          ? businesses.find((item) => item.active !== false)?.id ?? state.currentBusinessId
          : state.currentBusinessId;
        const updated = businesses.find((item) => item.id === businessId);
        commit(audit({ ...state, businesses, currentBusinessId: nextBusinessId }, "businesses", businessId, "delete", "Negocio desactivado", previous, updated));
        toast.success("Negocio desactivado");
      },
      deleteBusiness: (businessId) => {
        if (!canManageBusiness) {
          toast.error("Solo Super Admin puede eliminar negocios.");
          return;
        }
        const previous = state.businesses.find((item) => item.id === businessId);
        const nextBusinesses = state.businesses.filter((item) => item.id !== businessId);
        const nextBusinessId = state.currentBusinessId === businessId
          ? nextBusinesses.find((item) => item.active !== false)?.id ?? nextBusinesses[0]?.id ?? state.currentBusinessId
          : state.currentBusinessId;
        const next = {
          ...state,
          businesses: nextBusinesses,
          users: state.users.filter((user) => user.businessId !== businessId),
          dailySales: state.dailySales.filter((sale) => sale.businessId !== businessId),
          expenses: state.expenses.filter((expense) => expense.businessId !== businessId),
          closures: state.closures.filter((closure) => closure.businessId !== businessId),
          currentBusinessId: nextBusinessId,
        };
        commit(audit(next, "businesses", businessId, "delete", "Negocio eliminado", previous, undefined));
        toast.success("Negocio eliminado");
      },
      createUser: (user) => {
        if (!canManageUsers) {
          toast.error("Tu rol no permite crear usuarios.");
          return;
        }
        if (activeUser.role === "admin" && (user.businessId !== business.id || user.role !== "accountant")) {
          toast.error("Admin del Negocio solo puede crear usuarios de Contabilidad para su negocio.");
          return;
        }
        const record: User = {
          ...user,
          id: crypto.randomUUID(),
          active: user.active ?? true,
        };
        const next = { ...state, users: [record, ...state.users] };
        commit(audit(next, "users", record.id, "create", "Usuario creado", undefined, record));
        toast.success("Usuario creado");
      },
      updateUser: (updatedUser) => {
        if (!canManageUsers) {
          toast.error("Tu rol no permite editar usuarios.");
          return;
        }
        if (activeUser.role === "admin" && (updatedUser.businessId !== business.id || updatedUser.role !== "accountant")) {
          toast.error("Admin del Negocio solo puede gestionar Contabilidad de su negocio.");
          return;
        }
        const previous = state.users.find((user) => user.id === updatedUser.id);
        const next = { ...state, users: state.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)) };
        commit(audit(next, "users", updatedUser.id, "update", "Usuario actualizado", previous, updatedUser));
        toast.success("Usuario actualizado");
      },
      deactivateUser: (userId) => {
        if (!canManageUsers) {
          toast.error("Tu rol no permite desactivar usuarios.");
          return;
        }
        const previous = state.users.find((user) => user.id === userId);
        if (!previous) return;
        if (activeUser.role === "admin" && (previous.businessId !== business.id || previous.role !== "accountant")) {
          toast.error("Admin del Negocio solo puede desactivar Contabilidad de su negocio.");
          return;
        }
        const users = state.users.map((user) => (user.id === userId ? { ...user, active: false } : user));
        const updated = users.find((user) => user.id === userId);
        commit(audit({ ...state, users }, "users", userId, "delete", "Usuario desactivado", previous, updated));
        toast.success("Usuario desactivado");
      },
      auditExport: (action, summary, businessId) => {
        commit(audit(state, "exports", crypto.randomUUID(), action, summary, undefined, { businessId: businessId ?? business.id }));
      },
    };
  }, [activeUser, business, canManageBusiness, canManageUsers, canReopenMonths, canWrite, state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
