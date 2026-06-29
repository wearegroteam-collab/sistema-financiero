export type Role = "super_admin" | "admin" | "accountant";

export type MovementType = "sale" | "expense";

export type PaymentMethodKey = "bold" | "bancolombia" | "nequi" | "cash";

export type ExpenseCategoryKey = "payroll" | "inventory" | "extras" | "fixed";

export type User = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password?: string;
};

export type Business = {
  id: string;
  name: string;
  logoUrl?: string;
  currency: "COP" | "USD";
  timezone: string;
  active: boolean;
  adminName?: string;
  adminEmail?: string;
  phone?: string;
};

export type PaymentMethod = {
  key: PaymentMethodKey;
  label: string;
  color: string;
};

export type ExpenseCategory = {
  key: ExpenseCategoryKey;
  label: string;
  color: string;
};

export type DailySale = {
  id: string;
  businessId: string;
  date: string;
  total: number;
  distribution: Record<PaymentMethodKey, number>;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type Expense = {
  id: string;
  businessId: string;
  date: string;
  category: ExpenseCategoryKey;
  detail: string;
  paymentMethod: PaymentMethodKey;
  value: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type MonthlyClosure = {
  id: string;
  businessId: string;
  month: number;
  year: number;
  salesTotal: number;
  expensesTotal: number;
  availableTotal: number;
  utility: number;
  balanceByMethod: Record<PaymentMethodKey, number>;
  categoryTotals: Record<ExpenseCategoryKey, number>;
  percentages: Record<ExpenseCategoryKey | "available", number>;
  notes?: string;
  closedAt: string;
  closedBy: string;
  reopenedAt?: string;
  reopenedBy?: string;
};

export type AuditLog = {
  id: string;
  businessId: string;
  entity: "daily_sales" | "expenses" | "monthly_closures" | "settings" | "businesses" | "users" | "exports";
  entityId: string;
  action: "create" | "update" | "delete" | "close_month" | "reopen_month" | "download_pdf" | "export_excel" | "print";
  actorId: string;
  oldData?: unknown;
  newData?: unknown;
  summary: string;
  createdAt: string;
};

export type AppState = {
  currentBusinessId: string;
  activeUserId: string;
  businesses: Business[];
  users: User[];
  paymentMethods: PaymentMethod[];
  categories: ExpenseCategory[];
  dailySales: DailySale[];
  expenses: Expense[];
  closures: MonthlyClosure[];
  auditLogs: AuditLog[];
};

export type MonthKey = `${number}-${string}`;
