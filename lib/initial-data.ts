import { expenseCategories, paymentMethods } from "./constants";
import type { AppState } from "./types";

export const initialState: AppState = {
  currentBusinessId: "business-hangar",
  activeUserId: "user-super-admin",
  businesses: [
    {
      id: "business-hangar",
      name: "Hangar",
      currency: "COP",
      timezone: "America/Bogota",
      active: true,
    },
  ],
  users: [
    {
      id: "user-super-admin",
      businessId: "business-hangar",
      name: "Super Admin",
      email: "admin@hangar.local",
      role: "super_admin",
      active: true,
    },
  ],
  paymentMethods,
  categories: expenseCategories,
  dailySales: [],
  expenses: [],
  closures: [],
  auditLogs: [],
};
