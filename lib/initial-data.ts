import { expenseCategories, paymentMethods } from "./constants";
import type { AppState } from "./types";

export const initialState: AppState = {
  currentBusinessId: "",
  activeUserId: "user-super-admin",
  businesses: [],
  users: [
    {
      id: "user-super-admin",
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
