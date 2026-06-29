import type { ExpenseCategory, PaymentMethod } from "./types";

export const paymentMethods: PaymentMethod[] = [
  { key: "bold", label: "BOLD", color: "#2563eb" },
  { key: "bancolombia", label: "Bancolombia", color: "#eab308" },
  { key: "nequi", label: "Nequi", color: "#8b5cf6" },
  { key: "cash", label: "Efectivo", color: "#178047" },
];

export const expenseCategories: ExpenseCategory[] = [
  { key: "payroll", label: "Nomina", color: "#c13d3a" },
  { key: "inventory", label: "Inventario", color: "#ea580c" },
  { key: "extras", label: "Extras", color: "#b7791f" },
  { key: "fixed", label: "Gastos Fijos", color: "#475569" },
];

export const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin del Negocio",
  accountant: "Contabilidad",
};
