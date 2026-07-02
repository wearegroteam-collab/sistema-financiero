import { expenseCategories, paymentMethods } from "./constants";
import type {
  AppState,
  DailySale,
  Expense,
  ExpenseCategoryKey,
  MonthKey,
  MovementType,
  PaymentMethodKey,
} from "./types";

export function getMonthKeyFromDate(date: string): MonthKey {
  return date.slice(0, 7) as MonthKey;
}

export function isSameMonth(date: string, activeMonth: string) {
  return getMonthKeyFromDate(date) === activeMonth;
}

export function isMonthClosed(state: AppState, businessId: string, monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return state.closures.some(
    (closure) =>
      closure.businessId === businessId &&
      closure.year === year &&
      closure.month === month &&
      !closure.reopenedAt,
  );
}

export function emptyBalances(): Record<PaymentMethodKey, number> {
  return paymentMethods.reduce(
    (balances, method) => ({ ...balances, [method.key]: 0 }),
    {} as Record<PaymentMethodKey, number>,
  );
}

export function emptyCategoryTotals(): Record<ExpenseCategoryKey, number> {
  return expenseCategories.reduce(
    (totals, category) => ({ ...totals, [category.key]: 0 }),
    {} as Record<ExpenseCategoryKey, number>,
  );
}

export function calculateMonth(state: AppState, businessId: string, activeMonth: string) {
  const sales = state.dailySales.filter(
    (sale) => !sale.deletedAt && sale.businessId === businessId && isSameMonth(sale.date, activeMonth),
  );
  const expenses = state.expenses.filter(
    (expense) => !expense.deletedAt && expense.businessId === businessId && isSameMonth(expense.date, activeMonth),
  );
  return calculateFinancials(sales, expenses);
}

export function findOldestPendingClosureMonth(state: AppState, businessId: string, currentMonth: string) {
  const movementMonths = new Set<string>();

  state.dailySales
    .filter((sale) => !sale.deletedAt && sale.businessId === businessId && getMonthKeyFromDate(sale.date) < currentMonth)
    .forEach((sale) => movementMonths.add(getMonthKeyFromDate(sale.date)));

  state.expenses
    .filter((expense) => !expense.deletedAt && expense.businessId === businessId && getMonthKeyFromDate(expense.date) < currentMonth)
    .forEach((expense) => movementMonths.add(getMonthKeyFromDate(expense.date)));

  return [...movementMonths]
    .filter((movementMonth) => !isMonthClosed(state, businessId, movementMonth))
    .sort((a, b) => a.localeCompare(b))[0];
}

export function calculateRange(state: AppState, businessId: string, filters: ReportFilters) {
  const sales = state.dailySales.filter((sale) => {
    if (sale.deletedAt || sale.businessId !== businessId) return false;
    if (filters.from && sale.date < filters.from) return false;
    if (filters.to && sale.date > filters.to) return false;
    if (filters.month && getMonthKeyFromDate(sale.date) !== filters.month) return false;
    if (filters.type === "expense") return false;
    return true;
  });

  const expenses = state.expenses.filter((expense) => {
    if (expense.deletedAt || expense.businessId !== businessId) return false;
    if (filters.from && expense.date < filters.from) return false;
    if (filters.to && expense.date > filters.to) return false;
    if (filters.month && getMonthKeyFromDate(expense.date) !== filters.month) return false;
    if (filters.category !== "all" && expense.category !== filters.category) return false;
    if (filters.paymentMethod !== "all" && expense.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    if (filters.type === "sale") return false;
    return true;
  });

  return calculateFinancials(sales, expenses);
}

export function calculateFinancials(sales: DailySale[], expenses: Expense[]) {
  const balances = emptyBalances();
  const categoryTotals = emptyCategoryTotals();
  const salesTotal = sales.reduce((total, sale) => {
    paymentMethods.forEach((method) => {
      balances[method.key] += sale.distribution[method.key] ?? 0;
    });
    return total + sale.total;
  }, 0);

  const expensesTotal = expenses.reduce((total, expense) => {
    balances[expense.paymentMethod] -= expense.value;
    categoryTotals[expense.category] += expense.value;
    return total + expense.value;
  }, 0);

  const availableTotal = Object.values(balances).reduce((total, value) => total + value, 0);
  const utility = salesTotal - expensesTotal;
  const percentages = {
    payroll: ratio(categoryTotals.payroll, salesTotal),
    inventory: ratio(categoryTotals.inventory, salesTotal),
    extras: ratio(categoryTotals.extras, salesTotal),
    fixed: ratio(categoryTotals.fixed, salesTotal),
    available: ratio(availableTotal, salesTotal),
  };

  const salesByDay = sales
    .reduce<{ date: string; total: number }[]>((days, sale) => {
      const existing = days.find((day) => day.date === sale.date);
      if (existing) existing.total += sale.total;
      else days.push({ date: sale.date, total: sale.total });
      return days;
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date));

  const expenseChart = expenseCategories.map((category) => ({
    name: category.label,
    value: categoryTotals[category.key],
    color: category.color,
  }));

  return {
    sales,
    expenses,
    balances,
    categoryTotals,
    salesTotal,
    expensesTotal,
    availableTotal,
    utility,
    percentages,
    salesByDay,
    expenseChart,
  };
}

export function buildMovements(state: AppState, businessId: string, activeMonth?: string) {
  const saleRows = state.dailySales
    .filter((sale) => !sale.deletedAt && sale.businessId === businessId)
    .filter((sale) => !activeMonth || isSameMonth(sale.date, activeMonth))
    .map((sale) => ({
      id: sale.id,
      date: sale.date,
      type: "sale" as MovementType,
      category: "Ventas",
      detail: "Venta diaria",
      paymentMethod: "Distribuida",
      value: sale.total,
      userId: sale.createdBy,
      createdAt: sale.createdAt,
      raw: sale,
    }));

  const expenseRows = state.expenses
    .filter((expense) => !expense.deletedAt && expense.businessId === businessId)
    .filter((expense) => !activeMonth || isSameMonth(expense.date, activeMonth))
    .map((expense) => ({
      id: expense.id,
      date: expense.date,
      type: "expense" as MovementType,
      category: expenseCategories.find((category) => category.key === expense.category)?.label ?? "",
      detail: expense.detail,
      paymentMethod:
        paymentMethods.find((method) => method.key === expense.paymentMethod)?.label ?? "",
      value: expense.value,
      userId: expense.createdBy,
      createdAt: expense.createdAt,
      raw: expense,
    }));

  return [...saleRows, ...expenseRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export type ReportFilters = {
  from: string;
  to: string;
  month: string;
  category: ExpenseCategoryKey | "all";
  paymentMethod: PaymentMethodKey | "all";
  type: MovementType | "all";
};

function ratio(value: number, total: number) {
  if (!total) return 0;
  return (value / total) * 100;
}
