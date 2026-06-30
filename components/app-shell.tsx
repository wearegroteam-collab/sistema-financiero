"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarCheck,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FileDown,
  History,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Settings,
  Trash2,
  Unlock,
  UserCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { expenseCategories, paymentMethods, roleLabels } from "@/lib/constants";
import { exportExcel, exportPdf } from "@/lib/export";
import { buildMovements, calculateMonth, calculateRange, isMonthClosed, type ReportFilters } from "@/lib/finance";
import { formatCurrency, formatDate, formatDateTime, formatPercent, monthKey, monthName } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Business, ExpenseCategoryKey, MonthlyClosure, PaymentMethodKey, Role, User } from "@/lib/types";
import { DonutChart, SalesChart } from "./charts";
import { ExpenseForm, SaleForm } from "./forms";
import { Button, cn, Field, IconButton, inputClass, MetricCard, Modal, Section } from "./ui";

type View = "dashboard" | "reports" | "history" | "closures" | "super_admin" | "settings";

export function AppShell() {
  const store = useStore();
  const { state, business, activeUser, canWrite, canManageBusiness, useSupabase } = store;
  const [view, setView] = useState<View>(() => activeUser.role === "super_admin" ? "super_admin" : "dashboard");
  const [saleOpen, setSaleOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [closeMonthOpen, setCloseMonthOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<ReturnType<typeof buildMovements>[number] | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<ReturnType<typeof buildMovements>[number] | null>(null);
  const [viewingClosure, setViewingClosure] = useState<MonthlyClosure | null>(null);
  const [accountPanel, setAccountPanel] = useState<"profile" | "password" | null>(null);
  const activeMonth = monthKey();
  const summary = calculateMonth(state, business.id, activeMonth);
  const closed = isMonthClosed(state, business.id, activeMonth);
  const movements = buildMovements(state, business.id, activeMonth);
  const hasActiveBusiness = Boolean(business.id);
  const superAdminManagingBusiness = activeUser.role === "super_admin" && hasActiveBusiness;
  const globalSuperAdmin = activeUser.role === "super_admin" && !hasActiveBusiness;

  const financialNav = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "reports", label: "Informes", icon: FileText },
    { key: "history", label: "Historial", icon: History },
    { key: "closures", label: "Cierres Mensuales", icon: CalendarCheck },
    { key: "settings", label: "Configuracion", icon: Settings },
  ] as const;
  const nav = globalSuperAdmin
    ? [{ key: "super_admin", label: "Panel Super Admin", icon: Users } as const]
    : financialNav;
  const activeView: View = globalSuperAdmin ? "super_admin" : view;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-sm text-muted">{globalSuperAdmin ? "Panel global" : "Restaurante"}</p>
              <h1 className="text-lg font-semibold text-ink">{globalSuperAdmin ? "Super Admin" : business.name}</h1>
            </div>
          </div>
          <div className="hidden lg:mt-6 lg:grid lg:gap-3">
            {useSupabase ? (
              <div className="rounded-md border border-line px-3 py-2 text-xs text-muted">
                {activeUser.name}
                <span className="mt-1 block font-medium text-ink">{roleLabels[activeUser.role]}</span>
              </div>
            ) : (
              <Field label="Usuario activo">
                <select className={inputClass} value={activeUser.id} onChange={(event) => store.switchUser(event.target.value)}>
                  {state.users.map((user) => (
                    <option key={user.id} value={user.id} disabled={user.active === false}>
                      {user.name} · {roleLabels[user.role]}{user.active === false ? " (inactivo)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:grid lg:overflow-visible">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={cn(
                  "focus-ring flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition hover:bg-panel hover:text-ink",
                  activeView === item.key && "bg-ink text-white hover:bg-ink hover:text-white",
                )}
                onClick={() => setView(item.key)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="px-4 py-5 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-7">
          {superAdminManagingBusiness ? (
            <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-ink">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Estas administrando {business.name} como Super Admin</span>
                <Button variant="secondary" onClick={() => {
                  store.switchBusiness("");
                  setView("super_admin");
                }}>
                  Volver al panel global
                </Button>
              </div>
            </div>
          ) : null}
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium capitalize text-muted">{globalSuperAdmin ? "Administracion global" : monthName(activeMonth)}</p>
              <h2 className="text-2xl font-semibold tracking-normal text-ink">
                {activeView === "dashboard" ? "Finanzas del mes activo" : nav.find((item) => item.key === activeView)?.label}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!globalSuperAdmin ? (
                <>
                  <Button variant="secondary" onClick={() => setExpenseOpen(true)} disabled={closed || !canWrite || !hasActiveBusiness}>
                    <ReceiptText size={16} />
                    Gasto
                  </Button>
                  <Button onClick={() => setSaleOpen(true)} disabled={closed || !canWrite || !hasActiveBusiness}>
                    <Plus size={16} />
                    Venta
                  </Button>
                </>
              ) : null}
              {useSupabase ? (
                <UserMenu
                  user={activeUser}
                  onProfile={() => setAccountPanel("profile")}
                  onPassword={() => setAccountPanel("password")}
                  onSignOut={store.signOut}
                />
              ) : null}
            </div>
          </header>

          {activeView === "dashboard" ? (
            <Dashboard
              summary={summary}
              movements={movements}
              closed={closed}
              activeMonth={activeMonth}
              onCloseMonth={() => setCloseMonthOpen(true)}
            />
          ) : null}
          {activeView === "reports" ? <Reports /> : null}
          {activeView === "history" ? (
            <HistoryView
              onEdit={setEditingMovement}
              onDelete={setDeletingMovement}
            />
          ) : null}
          {activeView === "closures" ? <MonthlyClosuresView onView={setViewingClosure} /> : null}
          {activeView === "super_admin" && canManageBusiness ? <SuperAdminPanel onEnterBusiness={() => setView("dashboard")} /> : null}
          {activeView === "settings" ? <SettingsView /> : null}
        </div>
      </main>
      <Modal title="Registrar venta diaria" open={saleOpen} onClose={() => setSaleOpen(false)}>
        <SaleForm onDone={() => setSaleOpen(false)} />
      </Modal>
      <Modal title="Registrar egreso" open={expenseOpen} onClose={() => setExpenseOpen(false)}>
        <ExpenseForm onDone={() => setExpenseOpen(false)} />
      </Modal>
      <Modal title="Editar venta diaria" open={editingMovement?.type === "sale"} onClose={() => setEditingMovement(null)}>
        {editingMovement?.type === "sale" && "distribution" in editingMovement.raw ? (
          <SaleForm sale={editingMovement.raw} onDone={() => setEditingMovement(null)} />
        ) : null}
      </Modal>
      <Modal title="Editar egreso" open={editingMovement?.type === "expense"} onClose={() => setEditingMovement(null)}>
        {editingMovement?.type === "expense" && "paymentMethod" in editingMovement.raw ? (
          <ExpenseForm expense={editingMovement.raw} onDone={() => setEditingMovement(null)} />
        ) : null}
      </Modal>
      <CloseMonthModal
        open={closeMonthOpen}
        monthKeyValue={activeMonth}
        summary={summary}
        onClose={() => setCloseMonthOpen(false)}
        onConfirm={(notes) => {
          store.closeMonth(activeMonth, notes);
          setCloseMonthOpen(false);
        }}
      />
      <DeleteMovementModal
        movement={deletingMovement}
        onClose={() => setDeletingMovement(null)}
        onConfirm={() => {
          if (deletingMovement) store.deleteMovement(deletingMovement.type, deletingMovement.id);
          setDeletingMovement(null);
        }}
      />
      <Modal title="Extracto financiero mensual" open={Boolean(viewingClosure)} onClose={() => setViewingClosure(null)}>
        {viewingClosure ? (
          <div className="grid gap-4">
            <ClosureStatement closure={viewingClosure} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                store.auditExport("print", "Impresion de extracto mensual", viewingClosure.businessId);
                printDocument("Documento listo para imprimir");
              }}>
                <Printer size={16} />
                Imprimir
              </Button>
              <Button onClick={() => downloadClosurePdf(viewingClosure, state, business, store.auditExport)}>
                <FileDown size={16} />
                Descargar PDF
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal title="Mi perfil" open={Boolean(accountPanel)} onClose={() => setAccountPanel(null)}>
        <ProfilePanel initialMode={accountPanel ?? "profile"} onDone={() => setAccountPanel(null)} />
      </Modal>
    </div>
  );
}

function UserMenu({
  user,
  onProfile,
  onPassword,
  onSignOut,
}: {
  user: User;
  onProfile: () => void;
  onPassword: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <UserCircle size={16} />
        {user.name}
        <ChevronDown size={15} />
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-line bg-white p-2 shadow-lg">
          <div className="border-b border-line px-3 py-2">
            <p className="font-semibold text-ink">{user.name}</p>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
            <p className="mt-1 text-xs font-medium text-muted">{roleLabels[user.role]}</p>
          </div>
          <button className="focus-ring mt-2 flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm text-ink hover:bg-panel" onClick={() => {
            setOpen(false);
            onProfile();
          }}>
            <UserCircle size={16} />
            Mi perfil
          </button>
          <button className="focus-ring flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm text-ink hover:bg-panel" onClick={() => {
            setOpen(false);
            onPassword();
          }}>
            <KeyRound size={16} />
            Cambiar contrasena
          </button>
          <button
            className="focus-ring flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await onSignOut();
              setSigningOut(false);
            }}
          >
            <LogOut size={16} />
            {signingOut ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfilePanel({ initialMode, onDone }: { initialMode: "profile" | "password"; onDone: () => void }) {
  const { activeUser, changePassword } = useStore();
  const [mode, setMode] = useState<"profile" | "password">(initialMode);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-lg border border-line p-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted">Nombre</p>
          <p className="font-medium text-ink">{activeUser.name}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted">Email</p>
          <p className="font-medium text-ink">{activeUser.email}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted">Rol</p>
          <p className="font-medium text-ink">{roleLabels[activeUser.role]}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted">Fecha de creacion</p>
          <p className="font-medium text-ink">{activeUser.createdAt ? formatDateTime(activeUser.createdAt) : "No disponible"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={mode === "profile" ? "primary" : "secondary"} onClick={() => setMode("profile")}>Mi perfil</Button>
        <Button variant={mode === "password" ? "primary" : "secondary"} onClick={() => setMode("password")}>Cambiar contrasena</Button>
      </div>
      {mode === "password" ? (
        <form className="grid gap-4" onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          const ok = await changePassword(form);
          setSubmitting(false);
          if (ok) {
            setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            onDone();
          }
        }}>
          <Field label="Contrasena actual">
            <input className={inputClass} type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required />
          </Field>
          <Field label="Nueva contrasena" hint="Minimo 8 caracteres.">
            <input className={inputClass} type="password" minLength={8} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required />
          </Field>
          <Field label="Confirmar nueva contrasena">
            <input className={inputClass} type="password" minLength={8} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Actualizando..." : "Guardar contrasena"}</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Dashboard({
  summary,
  movements,
  closed,
  activeMonth,
  onCloseMonth,
}: {
  summary: ReturnType<typeof calculateMonth>;
  movements: ReturnType<typeof buildMovements>;
  closed: boolean;
  activeMonth: string;
  onCloseMonth: () => void;
}) {
  const { business, canWrite } = useStore();
  return (
    <>
      <div
        className={cn(
          "rounded-lg border px-4 py-3 text-sm",
          closed ? "border-warning/40 bg-warning/10 text-ink" : "border-success/30 bg-success/10 text-success",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {closed ? <Lock size={16} /> : <Unlock size={16} />}
          {closed ? "Mes cerrado" : "Mes abierto"}
        </div>
        {closed ? (
          <p className="mt-1 text-muted">
            Este mes ya fue cerrado. Para modificar registros, un Super Admin debe reabrirlo.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {paymentMethods.map((method) => (
          <MetricCard
            key={method.key}
            title={method.label}
            value={formatCurrency(summary.balances[method.key], business.currency)}
            tone={summary.balances[method.key] >= 0 ? "info" : "danger"}
          />
        ))}
      </div>
      <div className="surface rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">TOTAL DISPONIBLE</p>
            <p className="mt-1 text-4xl font-semibold tracking-normal text-ink">
              {formatCurrency(summary.availableTotal, business.currency)}
            </p>
          </div>
          <Button variant={closed ? "secondary" : "primary"} onClick={onCloseMonth} disabled={closed || !canWrite || !business.id}>
            {closed ? <Lock size={16} /> : <CalendarCheck size={16} />}
            {closed ? "Mes cerrado" : "Cerrar Mes"}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Ventas del mes" value={formatCurrency(summary.salesTotal, business.currency)} tone="success" />
        <MetricCard title="Total gastado" value={formatCurrency(summary.expensesTotal, business.currency)} tone="danger" />
        <MetricCard title="Disponible total" value={formatCurrency(summary.availableTotal, business.currency)} tone="info" />
        <MetricCard title="Utilidad del mes" value={formatCurrency(summary.utility, business.currency)} tone={summary.utility >= 0 ? "success" : "danger"} />
      </div>
      {summary.sales.length === 0 && summary.expenses.length === 0 ? (
        <div className="surface rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-ink">No existen movimientos este mes.</h3>
          <p className="mt-2 text-sm text-muted">
            No hay ventas registradas ni gastos registrados. Comienza registrando tu primera venta.
          </p>
        </div>
      ) : null}
      <Section title="Porcentajes sobre ventas">
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {expenseCategories.map((category) => (
              <MetricCard key={category.key} title={category.label} value={formatPercent(summary.percentages[category.key])} tone="warning" />
            ))}
            <MetricCard title="Disponible" value={formatPercent(summary.percentages.available)} tone="success" />
          </div>
          <div className="surface rounded-lg p-4">
            {summary.salesTotal > 0 ? (
              <DonutChart percentages={summary.percentages} />
            ) : (
              <EmptyState title="Sin porcentajes para mostrar" description="Registra ventas y gastos para generar este grafico." />
            )}
          </div>
        </div>
      </Section>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Section title="Ventas por dia">
          <div className="surface rounded-lg p-4">
            {summary.salesByDay.length ? (
              <SalesChart data={summary.salesByDay} currency={business.currency} />
            ) : (
              <EmptyState title="No hay ventas registradas" description="Cuando registres ventas diarias apareceran aqui." />
            )}
          </div>
        </Section>
        <Section title="Ultimos movimientos">
          <MovementTable movements={movements.slice(0, 6)} compact />
        </Section>
      </div>
    </>
  );
}

function Reports() {
  const { state, business, auditExport } = useStore();
  const [filters, setFilters] = useState<ReportFilters>({
    from: "",
    to: "",
    month: monthKey(),
    category: "all",
    paymentMethod: "all",
    type: "all",
  });
  const report = calculateRange(state, business.id, filters);
  const rows = buildMovements(state, business.id).filter((row) => {
    if (filters.from && row.date < filters.from) return false;
    if (filters.to && row.date > filters.to) return false;
    if (filters.month && row.date.slice(0, 7) !== filters.month) return false;
    if (filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.category !== "all") {
      if (!("category" in row.raw) || row.raw.category !== filters.category) return false;
    }
    if (filters.paymentMethod !== "all") {
      if ("paymentMethod" in row.raw && row.raw.paymentMethod !== filters.paymentMethod) return false;
      if ("distribution" in row.raw && row.raw.distribution[filters.paymentMethod] <= 0) return false;
    }
    return true;
  });

  function exportReportExcel() {
    try {
      exportExcel(
        rows.map((row) => ({
          Fecha: row.date,
          Tipo: row.type === "sale" ? "Ingreso" : "Egreso",
          Categoria: row.category,
          Detalle: row.detail,
          Metodo: row.paymentMethod,
          Valor: row.value,
        })),
        `informe-${business.name.toLowerCase().replace(/\s+/g, "-")}.xls`,
        `Informe financiero - ${business.name}`,
      );
      auditExport("export_excel", "Exportacion Excel de informes");
      toast.success("Excel generado correctamente");
    } catch {
      toast.error("No se pudo generar el Excel");
    }
  }

  function exportReportPdf() {
    try {
      exportPdf(
        [
          `Informe financiero - ${business.name}`,
          `Generado: ${formatDateTime(new Date().toISOString())}`,
          `Total vendido: ${formatCurrency(report.salesTotal, business.currency)}`,
          `Total gastado: ${formatCurrency(report.expensesTotal, business.currency)}`,
          `Disponible: ${formatCurrency(report.availableTotal, business.currency)}`,
          `Utilidad: ${formatCurrency(report.utility, business.currency)}`,
          "",
          ...rows.map((row) => `${row.date} | ${row.type === "sale" ? "Ingreso" : "Egreso"} | ${row.category} | ${row.detail} | ${row.paymentMethod} | ${formatCurrency(row.value, business.currency)}`),
        ],
        `informe-${business.name.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      );
      auditExport("download_pdf", "Descarga PDF de informes");
      toast.success("PDF generado correctamente");
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  }

  return (
    <div className="grid gap-5">
      <div className="surface rounded-lg p-4">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Desde"><input className={inputClass} type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></Field>
          <Field label="Hasta"><input className={inputClass} type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></Field>
          <Field label="Mes"><input className={inputClass} type="month" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })} /></Field>
          <Field label="Categoria">
            <select className={inputClass} value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value as ExpenseCategoryKey | "all" })}>
              <option value="all">Todas</option>
              {expenseCategories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Metodo">
            <select className={inputClass} value={filters.paymentMethod} onChange={(event) => setFilters({ ...filters, paymentMethod: event.target.value as PaymentMethodKey | "all" })}>
              <option value="all">Todos</option>
              {paymentMethods.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className={inputClass} value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as ReportFilters["type"] })}>
              <option value="all">Todos</option>
              <option value="sale">Ingresos</option>
              <option value="expense">Egresos</option>
            </select>
          </Field>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total vendido" value={formatCurrency(report.salesTotal, business.currency)} tone="success" />
        <MetricCard title="Total gastado" value={formatCurrency(report.expensesTotal, business.currency)} tone="danger" />
        <MetricCard title="Disponible" value={formatCurrency(report.availableTotal, business.currency)} tone="info" />
        <MetricCard title="Utilidad" value={formatCurrency(report.utility, business.currency)} tone={report.utility >= 0 ? "success" : "danger"} />
      </div>
      <Section
        title="Resultados"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportReportExcel}><Download size={16} /> Excel</Button>
            <Button variant="secondary" onClick={exportReportPdf}><Download size={16} /> PDF</Button>
          </div>
        }
      >
        {rows.length ? (
          <MovementTable movements={rows} />
        ) : (
          <div className="surface rounded-lg p-8 text-center text-muted">
            No hay registros para los filtros seleccionados.
          </div>
        )}
      </Section>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-72 place-items-center text-center">
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

function CloseMonthModal({
  open,
  monthKeyValue,
  summary,
  onClose,
  onConfirm,
}: {
  open: boolean;
  monthKeyValue: string;
  summary: ReturnType<typeof calculateMonth>;
  onClose: () => void;
  onConfirm: (notes?: string) => void;
}) {
  const { business } = useStore();
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState(false);

  return (
    <Modal title="Confirmar cierre de mes" open={open} onClose={onClose}>
      <div className="grid gap-5">
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
          <p>
            Estas a punto de cerrar el mes actual. Despues del cierre, los registros de este periodo quedaran
            bloqueados y no podran editarse a menos que un Super Admin reabra el mes.
          </p>
        </div>
        <ClosureSummary monthKeyValue={monthKeyValue} summary={summary} />
        <Field label="Notas del cierre">
          <textarea
            className={cn(inputClass, "min-h-24 py-2")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observaciones opcionales para el extracto"
          />
        </Field>
        {preview ? (
          <div className="rounded-lg border border-line bg-panel p-4">
            <ClosurePreview monthKeyValue={monthKeyValue} summary={summary} notes={notes} />
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={() => setPreview((current) => !current)}>
            <Eye size={16} />
            Vista previa del cierre
          </Button>
          <Button onClick={() => onConfirm(notes.trim() || undefined)}>
            <CalendarCheck size={16} />
            Confirmar cierre
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ClosureSummary({
  monthKeyValue,
  summary,
}: {
  monthKeyValue: string;
  summary: ReturnType<typeof calculateMonth>;
}) {
  const { business } = useStore();
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Mes y ano" value={monthName(monthKeyValue)} tone="info" />
        <MetricCard title="Ventas totales" value={formatCurrency(summary.salesTotal, business.currency)} tone="success" />
        <MetricCard title="Total egresos" value={formatCurrency(summary.expensesTotal, business.currency)} tone="danger" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total disponible" value={formatCurrency(summary.availableTotal, business.currency)} tone="info" />
        {paymentMethods.map((method) => (
          <MetricCard
            key={method.key}
            title={`Saldo final ${method.label}`}
            value={formatCurrency(summary.balances[method.key], business.currency)}
            tone="neutral"
          />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {expenseCategories.map((category) => (
          <MetricCard
            key={category.key}
            title={`% ${category.label}`}
            value={formatPercent(summary.percentages[category.key])}
            tone="warning"
          />
        ))}
        <MetricCard title="% Disponible" value={formatPercent(summary.percentages.available)} tone="success" />
      </div>
    </div>
  );
}

function ClosurePreview({
  monthKeyValue,
  summary,
  notes,
}: {
  monthKeyValue: string;
  summary: ReturnType<typeof calculateMonth>;
  notes?: string;
}) {
  const { business, activeUser } = useStore();
  const previewClosure: MonthlyClosure = {
    id: "preview",
    businessId: business.id,
    month: Number(monthKeyValue.slice(5, 7)),
    year: Number(monthKeyValue.slice(0, 4)),
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

  return <ClosureStatement closure={previewClosure} compact />;
}

function DeleteMovementModal({
  movement,
  onClose,
  onConfirm,
}: {
  movement: ReturnType<typeof buildMovements>[number] | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { business } = useStore();
  return (
    <Modal title="Confirmar eliminacion" open={Boolean(movement)} onClose={onClose}>
      {movement ? (
        <div className="grid gap-4">
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-danger">
              <AlertTriangle size={16} />
              Esta accion quitara el registro de los calculos y quedara guardada en auditoria.
            </p>
          </div>
          <div className="grid gap-2 text-sm">
            <p><span className="font-medium text-ink">Tipo:</span> {movement.type === "sale" ? "Ingreso" : "Egreso"}</p>
            <p><span className="font-medium text-ink">Detalle:</span> {movement.detail}</p>
            <p><span className="font-medium text-ink">Valor:</span> {formatCurrency(movement.value, business.currency)}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="danger" onClick={onConfirm}>
              <Trash2 size={16} />
              Eliminar registro
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function downloadClosurePdf(
  closure: MonthlyClosure,
  state: ReturnType<typeof useStore>["state"],
  business: Business,
  auditExport: ReturnType<typeof useStore>["auditExport"],
) {
  try {
    const user = state.users.find((item) => item.id === closure.closedBy);
    exportPdf(
      [
        `Extracto financiero mensual - ${business.name}`,
        `Mes cerrado: ${monthName(`${closure.year}-${String(closure.month).padStart(2, "0")}`)}`,
        `Fecha de cierre: ${formatDateTime(closure.closedAt)}`,
        `Usuario: ${user?.name ?? "Usuario no disponible"}`,
        `Estado: ${closure.reopenedAt ? "Reabierto" : "Cerrado"}`,
        "",
        `Ventas totales: ${formatCurrency(closure.salesTotal, business.currency)}`,
        `Total egresos: ${formatCurrency(closure.expensesTotal, business.currency)}`,
        `Utilidad / Disponible: ${formatCurrency(closure.utility ?? closure.availableTotal, business.currency)}`,
        "",
        "Saldos finales por metodo de pago",
        ...paymentMethods.map((method) => `${method.label}: ${formatCurrency(closure.balanceByMethod[method.key] ?? 0, business.currency)}`),
        "",
        "Gastos por categoria",
        ...expenseCategories.map((category) => `${category.label}: ${formatCurrency(closure.categoryTotals?.[category.key] ?? 0, business.currency)} (${formatPercent(closure.percentages[category.key] ?? 0)})`),
        `Disponible: ${formatPercent(closure.percentages.available ?? 0)}`,
        closure.notes ? `Observaciones: ${closure.notes}` : "",
      ],
      `extracto-${business.name.toLowerCase().replace(/\s+/g, "-")}-${closure.year}-${String(closure.month).padStart(2, "0")}.pdf`,
    );
    auditExport("download_pdf", "Descarga PDF de cierre mensual", closure.businessId);
    toast.success("PDF generado correctamente");
  } catch {
    toast.error("No se pudo generar el PDF");
  }
}

function printDocument(successMessage: string) {
  try {
    window.print();
    toast.success(successMessage);
  } catch {
    toast.error("No se pudo abrir la impresion");
  }
}

function MonthlyClosuresView({ onView }: { onView: (closure: MonthlyClosure) => void }) {
  const { state, business, activeUser, reopenMonth, canReopenMonths, auditExport } = useStore();
  const closures = state.closures.filter((closure) => closure.businessId === business.id);

  return (
    <Section title="Cierres Mensuales">
      <div className="grid gap-4">
        {closures.length ? closures.map((closure) => (
          <div key={closure.id} className="surface rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted">{business.name}</p>
                <h3 className="mt-1 text-xl font-semibold capitalize text-ink">
                  {monthName(`${closure.year}-${String(closure.month).padStart(2, "0")}`)}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Cerrado el {formatDateTime(closure.closedAt)}
                </p>
              </div>
              <span className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold",
                closure.reopenedAt ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
              )}>
                {closure.reopenedAt ? "Reabierto" : "Cerrado"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetricCard title="Ventas totales" value={formatCurrency(closure.salesTotal, business.currency)} tone="success" />
              <MetricCard title="Total egresos" value={formatCurrency(closure.expensesTotal, business.currency)} tone="danger" />
              <MetricCard title="Utilidad / Disponible" value={formatCurrency(closure.utility ?? closure.availableTotal, business.currency)} tone="info" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onView(closure)}><Eye size={16} /> Ver extracto</Button>
              <Button variant="secondary" onClick={() => downloadClosurePdf(closure, state, business, auditExport)}><FileDown size={16} /> Descargar PDF</Button>
              <Button variant="secondary" onClick={() => {
                auditExport("print", "Impresion de extracto mensual", closure.businessId);
                printDocument("Documento listo para imprimir");
              }}><Printer size={16} /> Imprimir</Button>
              {activeUser.role === "super_admin" ? (
                <Button variant="secondary" onClick={() => reopenMonth(closure.id)} disabled={Boolean(closure.reopenedAt)}>
                  <Unlock size={16} />
                  {canReopenMonths ? "Reabrir mes" : "Sin permiso"}
                </Button>
              ) : null}
            </div>
          </div>
        )) : (
          <div className="surface rounded-lg p-8 text-center text-muted">
            Aun no hay cierres mensuales guardados.
          </div>
        )}
      </div>
    </Section>
  );
}

function ClosureStatement({ closure, compact = false }: { closure: MonthlyClosure; compact?: boolean }) {
  const { state, business } = useStore();
  const user = state.users.find((item) => item.id === closure.closedBy);
  const categoryTotals = closure.categoryTotals ?? {
    payroll: 0,
    inventory: 0,
    extras: 0,
    fixed: 0,
  };

  return (
    <article className={cn("grid gap-5 bg-white", compact ? "" : "p-1")}>
      <div className="border-b border-line pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase text-muted">Extracto financiero mensual</p>
            <h3 className="mt-1 text-2xl font-semibold capitalize text-ink">
              {business.name} · {monthName(`${closure.year}-${String(closure.month).padStart(2, "0")}`)}
            </h3>
          </div>
          <span className={cn(
            "rounded-md px-3 py-1 text-sm font-semibold",
            closure.reopenedAt ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
          )}>
            {closure.reopenedAt ? "Reabierto" : "Cerrado"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-muted md:grid-cols-2">
          <p>Fecha y hora del cierre: <span className="font-medium text-ink">{formatDateTime(closure.closedAt)}</span></p>
          <p>Usuario: <span className="font-medium text-ink">{user?.name ?? "Usuario no disponible"}</span></p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Ventas totales" value={formatCurrency(closure.salesTotal, business.currency)} tone="success" />
        <MetricCard title="Total de egresos" value={formatCurrency(closure.expensesTotal, business.currency)} tone="danger" />
        <MetricCard title="Utilidad / Disponible" value={formatCurrency(closure.utility ?? closure.availableTotal, business.currency)} tone="info" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <h4 className="font-semibold text-ink">Saldos finales por metodo de pago</h4>
          <div className="mt-3 grid gap-2">
            {paymentMethods.map((method) => (
              <div key={method.key} className="flex justify-between gap-3 text-sm">
                <span className="text-muted">{method.label}</span>
                <span className="font-semibold text-ink">{formatCurrency(closure.balanceByMethod[method.key] ?? 0, business.currency)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line p-4">
          <h4 className="font-semibold text-ink">Gastos por categoria</h4>
          <div className="mt-3 grid gap-2">
            {expenseCategories.map((category) => (
              <div key={category.key} className="flex justify-between gap-3 text-sm">
                <span className="text-muted">{category.label}</span>
                <span className="font-semibold text-ink">{formatCurrency(categoryTotals[category.key] ?? 0, business.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-line p-4">
        <h4 className="font-semibold text-ink">Porcentajes sobre ventas</h4>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {expenseCategories.map((category) => (
            <div key={category.key} className="rounded-md bg-panel p-3">
              <p className="text-xs text-muted">{category.label}</p>
              <p className="mt-1 font-semibold text-ink">{formatPercent(closure.percentages[category.key] ?? 0)}</p>
            </div>
          ))}
          <div className="rounded-md bg-success/10 p-3">
            <p className="text-xs text-muted">Disponible</p>
            <p className="mt-1 font-semibold text-success">{formatPercent(closure.percentages.available ?? 0)}</p>
          </div>
        </div>
      </div>
      {closure.notes ? (
        <div className="rounded-lg border border-line p-4">
          <h4 className="font-semibold text-ink">Observaciones</h4>
          <p className="mt-2 text-sm text-muted">{closure.notes}</p>
        </div>
      ) : null}
    </article>
  );
}

function HistoryView({
  onEdit,
  onDelete,
}: {
  onEdit: (movement: ReturnType<typeof buildMovements>[number]) => void;
  onDelete: (movement: ReturnType<typeof buildMovements>[number]) => void;
}) {
  const { state, business } = useStore();
  const [search, setSearch] = useState("");
  const normalized = search.trim().toLowerCase();
  const rows = buildMovements(state, business.id).filter((row) => {
    if (!normalized) return true;
    return [row.detail, row.category, row.paymentMethod, row.type === "sale" ? "ingreso venta" : "egreso gasto"]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });

  return (
    <div className="grid gap-4">
      <div className="surface rounded-lg p-4">
        <Field label="Buscar">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className={cn(inputClass, "pl-9")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Detalle, categoria o metodo de pago"
            />
          </div>
        </Field>
      </div>
      <MovementTable movements={rows} editable onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function SuperAdminPanel({ onEnterBusiness }: { onEnterBusiness: () => void }) {
  const {
    state,
    business,
    switchBusiness,
    createBusiness,
    updateBusiness,
    deactivateBusiness,
    deleteBusiness,
    createUser,
    updateUser,
    deactivateUser,
  } = useStore();
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<Business | null>(null);
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    name: "",
    logoUrl: "",
    currency: "COP" as Business["currency"],
    timezone: "America/Bogota",
    adminName: "",
    adminEmail: "",
    phone: "",
  });
  const [userForm, setUserForm] = useState({
    businessId: business.id,
    name: "",
    email: "",
    role: "admin" as Role,
  });

  async function submitBusiness(event: FormEvent) {
    event.preventDefault();
    setBusinessSubmitting(true);
    if (editingBusiness) {
      await updateBusiness({
        ...editingBusiness,
        ...businessForm,
      });
      setEditingBusiness(null);
    } else {
      await createBusiness(
        {
          name: businessForm.name,
          logoUrl: businessForm.logoUrl,
          currency: businessForm.currency,
          timezone: businessForm.timezone,
          adminName: businessForm.adminName,
          adminEmail: businessForm.adminEmail,
          phone: businessForm.phone,
        },
        businessForm.adminName && businessForm.adminEmail
          ? { name: businessForm.adminName, email: businessForm.adminEmail }
          : undefined,
      );
    }
    setBusinessSubmitting(false);
    setBusinessForm({ name: "", logoUrl: "", currency: "COP", timezone: "America/Bogota", adminName: "", adminEmail: "", phone: "" });
  }

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    if (!userForm.businessId && userForm.role !== "super_admin") {
      toast.error("Selecciona un negocio para este usuario.");
      return;
    }
    setUserSubmitting(true);
    await createUser({
      businessId: userForm.businessId,
      name: userForm.name,
      email: userForm.email,
      role: userForm.role,
    });
    setUserSubmitting(false);
    setUserForm({ businessId: business.id, name: "", email: "", role: "admin" });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Section title="Negocios">
          <div className="grid gap-3">
            {state.businesses.map((item) => (
              <div key={item.id} className="surface rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted">{item.adminName || "Sin administrador"} · {item.adminEmail || "Sin email"}</p>
                    <p className="mt-1 text-xs text-muted">{item.currency} · {item.timezone}</p>
                  </div>
                  <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", item.active === false ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                    {item.active === false ? "Inactivo" : "Activo"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      switchBusiness(item.id);
                      onEnterBusiness();
                    }}
                    disabled={item.active === false}
                  >
                    Entrar
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    setEditingBusiness(item);
                    setBusinessForm({
                      name: item.name,
                      logoUrl: item.logoUrl ?? "",
                      currency: item.currency,
                      timezone: item.timezone,
                      adminName: item.adminName ?? "",
                      adminEmail: item.adminEmail ?? "",
                      phone: item.phone ?? "",
                    });
                  }}>Editar</Button>
                  <Button variant="secondary" onClick={() => deactivateBusiness(item.id)} disabled={item.active === false}>Desactivar</Button>
                  <Button variant="danger" onClick={() => setDeletingBusiness(item)}>Eliminar</Button>
                </div>
              </div>
            ))}
            {!state.businesses.length ? (
              <div className="surface rounded-lg p-8 text-center">
                <h3 className="font-semibold text-ink">Aun no hay negocios creados</h3>
                <p className="mt-2 text-sm text-muted">Crea el primer negocio para empezar a registrar operacion real.</p>
              </div>
            ) : null}
          </div>
        </Section>
        <Section title={editingBusiness ? "Editar negocio" : "Crear negocio"}>
          <form className="surface grid gap-4 rounded-lg p-4" onSubmit={submitBusiness}>
            <Field label="Nombre del negocio"><input className={inputClass} value={businessForm.name} onChange={(event) => setBusinessForm({ ...businessForm, name: event.target.value })} required /></Field>
            <Field label="Logo"><input className={inputClass} value={businessForm.logoUrl} onChange={(event) => setBusinessForm({ ...businessForm, logoUrl: event.target.value })} placeholder="URL del logo" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Moneda">
                <select className={inputClass} value={businessForm.currency} onChange={(event) => setBusinessForm({ ...businessForm, currency: event.target.value as Business["currency"] })}>
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Zona horaria"><input className={inputClass} value={businessForm.timezone} onChange={(event) => setBusinessForm({ ...businessForm, timezone: event.target.value })} required /></Field>
            </div>
            <Field label="Administrador principal"><input className={inputClass} value={businessForm.adminName} onChange={(event) => setBusinessForm({ ...businessForm, adminName: event.target.value })} /></Field>
            <Field label="Email administrador"><input className={inputClass} type="email" value={businessForm.adminEmail} onChange={(event) => setBusinessForm({ ...businessForm, adminEmail: event.target.value })} /></Field>
            <Field label="Telefono opcional"><input className={inputClass} value={businessForm.phone} onChange={(event) => setBusinessForm({ ...businessForm, phone: event.target.value })} /></Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={businessSubmitting}>
                {businessSubmitting ? (editingBusiness ? "Guardando..." : "Creando...") : (editingBusiness ? "Guardar negocio" : "Crear negocio")}
              </Button>
              {editingBusiness ? <Button type="button" variant="secondary" onClick={() => setEditingBusiness(null)} disabled={businessSubmitting}>Cancelar</Button> : null}
            </div>
          </form>
        </Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Section title="Usuarios por negocio">
          <UsersTable
            users={state.users.filter((user) => user.role !== "super_admin")}
            businesses={state.businesses}
            onUpdate={updateUser}
            onDeactivate={deactivateUser}
            allowRoleChange
          />
        </Section>
        <Section title="Crear usuario">
          <form className="surface grid gap-4 rounded-lg p-4" onSubmit={submitUser}>
            <Field label="Negocio">
              <select className={inputClass} value={userForm.businessId} onChange={(event) => setUserForm({ ...userForm, businessId: event.target.value })} disabled={userForm.role === "super_admin"}>
                <option value="">Seleccionar negocio</option>
                {state.businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Nombre"><input className={inputClass} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required /></Field>
            <Field label="Email"><input className={inputClass} type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required /></Field>
            <Field label="Rol">
              <select
                className={inputClass}
                value={userForm.role}
                onChange={(event) => {
                  const role = event.target.value as Role;
                  setUserForm({ ...userForm, role, businessId: userForm.businessId });
                }}
              >
                <option value="admin">Admin del Negocio</option>
                <option value="accountant">Contabilidad</option>
              </select>
            </Field>
            <p className="text-sm text-muted">El usuario recibira un correo para configurar su clave.</p>
            <Button type="submit" disabled={userSubmitting}>{userSubmitting ? "Enviando invitacion..." : "Crear usuario"}</Button>
          </form>
        </Section>
      </div>
      <DeleteBusinessModal
        business={deletingBusiness}
        onClose={() => setDeletingBusiness(null)}
        onConfirm={async () => {
          if (deletingBusiness) await deleteBusiness(deletingBusiness.id);
          setDeletingBusiness(null);
        }}
      />
      <Section title="Auditoria general">
        <AuditTable logs={state.auditLogs} users={state.users} businesses={state.businesses} />
      </Section>
    </div>
  );
}

function DeleteBusinessModal({
  business,
  onClose,
  onConfirm,
}: {
  business: Business | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matches = Boolean(business && confirmation === business.name);

  return (
    <Modal title="Eliminar negocio" open={Boolean(business)} onClose={onClose}>
      {business ? (
        <div className="grid gap-4">
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            Esta accion eliminara permanentemente ventas, gastos, cierres mensuales, usuarios asociados,
            metodos de pago, categorias, configuracion, auditoria del negocio y el negocio.
          </div>
          <div className="grid gap-2 text-sm text-muted">
            <p>Para confirmar, escribe exactamente:</p>
            <p className="rounded-md bg-panel px-3 py-2 font-semibold text-ink">{business.name}</p>
          </div>
          <Field label="Nombre del negocio">
            <input
              className={inputClass}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={business.name}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setConfirmation("");
              onClose();
            }}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!matches || submitting}
              onClick={async () => {
                setSubmitting(true);
                await onConfirm();
                setSubmitting(false);
                setConfirmation("");
              }}
            >
              Eliminar permanentemente
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function SettingsView() {
  const { state, business, activeUser, canWrite, canManageUsers, updateSettings, reopenMonth, createUser, updateUser, deactivateUser } = useStore();
  const [name, setName] = useState(business.name);
  const [currency, setCurrency] = useState(business.currency);
  const [timezone, setTimezone] = useState(business.timezone);
  const [accountingUser, setAccountingUser] = useState({ name: "", email: "" });
  const [accountingSubmitting, setAccountingSubmitting] = useState(false);
  const businessUsers = state.users.filter((user) => user.businessId === business.id);

  return (
    <div className="grid gap-5">
      <div className="surface rounded-lg p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nombre del restaurante"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Moneda">
            <select className={inputClass} value={currency} onChange={(event) => setCurrency(event.target.value as "COP" | "USD")}>
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Zona horaria"><input className={inputClass} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></Field>
        </div>
        <div className="mt-4">
          <Button disabled={!canWrite} onClick={() => updateSettings({ ...business, name, currency, timezone }, state.categories, state.paymentMethods)}>
            <Settings size={16} />
            Guardar configuracion
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Usuarios y permisos">
          <div className="grid gap-4">
            <UsersTable
              users={businessUsers}
              businesses={state.businesses}
              onUpdate={updateUser}
              onDeactivate={deactivateUser}
              allowRoleChange={activeUser.role === "super_admin"}
            />
            {canManageUsers && activeUser.role !== "accountant" ? (
              <form className="surface grid gap-3 rounded-lg p-4" onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  setAccountingSubmitting(true);
                  await createUser({
                    businessId: business.id,
                    name: accountingUser.name,
                    email: accountingUser.email,
                    role: "accountant",
                  });
                  setAccountingSubmitting(false);
                  setAccountingUser({ name: "", email: "" });
                })();
              }}>
                <h3 className="font-semibold text-ink">Crear usuario de Contabilidad</h3>
                <Field label="Nombre"><input className={inputClass} value={accountingUser.name} onChange={(event) => setAccountingUser({ ...accountingUser, name: event.target.value })} required /></Field>
                <Field label="Email"><input className={inputClass} type="email" value={accountingUser.email} onChange={(event) => setAccountingUser({ ...accountingUser, email: event.target.value })} required /></Field>
                <p className="text-sm text-muted">El usuario recibira un correo para configurar su clave.</p>
                <Button type="submit" disabled={accountingSubmitting}>{accountingSubmitting ? "Enviando invitacion..." : "Crear Contabilidad"}</Button>
              </form>
            ) : null}
          </div>
        </Section>
        <Section title="Cierres mensuales">
          <div className="surface overflow-hidden rounded-lg">
            {state.closures.length ? state.closures.map((closure) => (
              <div key={closure.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <div>
                  <p className="font-medium text-ink">{monthName(`${closure.year}-${String(closure.month).padStart(2, "0")}`)}</p>
                  <p className="text-sm text-muted">{formatDateTime(closure.closedAt)}</p>
                </div>
                <Button variant="secondary" onClick={() => reopenMonth(closure.id)} disabled={Boolean(closure.reopenedAt)}>
                  {closure.reopenedAt ? <Unlock size={16} /> : <Lock size={16} />}
                  {closure.reopenedAt ? "Reabierto" : "Reabrir"}
                </Button>
              </div>
            )) : <p className="p-4 text-sm text-muted">Aun no hay cierres registrados.</p>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function UsersTable({
  users,
  businesses,
  onUpdate,
  onDeactivate,
  allowRoleChange,
}: {
  users: User[];
  businesses: Business[];
  onUpdate: (user: User) => void;
  onDeactivate: (userId: string) => void;
  allowRoleChange?: boolean;
}) {
  const businessById = new Map(businesses.map((item) => [item.id, item.name]));
  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-panel text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Usuario</th>
            <th className="px-4 py-3 font-semibold">Negocio</th>
            <th className="px-4 py-3 font-semibold">Rol</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-line">
              <td className="px-4 py-3">
                <p className="font-medium text-ink">{user.name}</p>
                <p className="text-xs text-muted">{user.email}</p>
              </td>
              <td className="px-4 py-3 text-muted">{user.businessId ? businessById.get(user.businessId) : "Global"}</td>
              <td className="px-4 py-3">
                {allowRoleChange ? (
                  <select
                    className={inputClass}
                    value={user.role}
                    onChange={(event) => {
                      const role = event.target.value as Role;
                      if (role !== "super_admin" && !user.businessId) {
                        toast.error("Asigna un negocio antes de cambiar este usuario a rol de negocio.");
                        return;
                      }
                      onUpdate({ ...user, role, businessId: role === "super_admin" ? undefined : user.businessId });
                    }}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin del Negocio</option>
                    <option value="accountant">Contabilidad</option>
                  </select>
                ) : (
                  <span className="rounded-md bg-panel px-2 py-1 text-xs font-medium text-ink">{roleLabels[user.role]}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", user.active === false ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                  {user.active === false ? "Inactivo" : "Activo"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="secondary" disabled={user.active === false} onClick={() => onDeactivate(user.id)}>
                  Desactivar
                </Button>
              </td>
            </tr>
          ))}
          {!users.length ? (
            <tr><td className="px-4 py-8 text-center text-muted" colSpan={5}>No hay usuarios para mostrar.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({
  logs,
  users,
  businesses,
}: {
  logs: ReturnType<typeof useStore>["state"]["auditLogs"];
  users: User[];
  businesses: Business[];
}) {
  const userById = new Map(users.map((user) => [user.id, user.name]));
  const businessById = new Map(businesses.map((item) => [item.id, item.name]));
  return (
    <div className="surface max-h-[520px] overflow-auto rounded-lg">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="sticky top-0 bg-panel text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3 font-semibold">Negocio</th>
            <th className="px-4 py-3 font-semibold">Usuario</th>
            <th className="px-4 py-3 font-semibold">Accion</th>
            <th className="px-4 py-3 font-semibold">Registro</th>
            <th className="px-4 py-3 font-semibold">Resumen</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-line">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(log.createdAt)}</td>
              <td className="px-4 py-3 text-muted">{log.businessId ? businessById.get(log.businessId) : "General"}</td>
              <td className="px-4 py-3 text-muted">{userById.get(log.actorId)}</td>
              <td className="px-4 py-3 text-ink">{log.action}</td>
              <td className="px-4 py-3 text-muted">{log.entity}</td>
              <td className="px-4 py-3 text-muted">{log.summary}</td>
            </tr>
          ))}
          {!logs.length ? (
            <tr><td className="px-4 py-8 text-center text-muted" colSpan={6}>Aun no hay auditoria registrada.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MovementTable({
  movements,
  compact = false,
  editable = false,
  onEdit,
  onDelete,
}: {
  movements: ReturnType<typeof buildMovements>;
  compact?: boolean;
  editable?: boolean;
  onEdit?: (movement: ReturnType<typeof buildMovements>[number]) => void;
  onDelete?: (movement: ReturnType<typeof buildMovements>[number]) => void;
}) {
  const { business, state } = useStore();
  const userById = new Map(state.users.map((user) => [user.id, user.name]));

  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-panel text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3 font-semibold">Tipo</th>
            <th className="px-4 py-3 font-semibold">Categoria</th>
            <th className="px-4 py-3 font-semibold">Detalle</th>
            {!compact ? <th className="px-4 py-3 font-semibold">Metodo</th> : null}
            <th className="px-4 py-3 text-right font-semibold">Valor</th>
            {!compact ? <th className="px-4 py-3 font-semibold">Usuario</th> : null}
            {editable ? <th className="px-4 py-3 text-right font-semibold">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {movements.length ? movements.map((row) => (
            <tr key={`${row.type}-${row.id}`} className="border-t border-line">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(row.date)}</td>
              <td className="px-4 py-3">
                <span className={cn("rounded-md px-2 py-1 text-xs font-medium", row.type === "sale" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                  {row.type === "sale" ? "Ingreso" : "Egreso"}
                </span>
              </td>
              <td className="px-4 py-3 text-ink">{row.category}</td>
              <td className="px-4 py-3 text-muted">{row.detail}</td>
              {!compact ? <td className="px-4 py-3 text-muted">{row.paymentMethod}</td> : null}
              <td className={cn("px-4 py-3 text-right font-semibold", row.type === "sale" ? "text-success" : "text-danger")}>
                {row.type === "sale" ? "+" : "-"}{formatCurrency(row.value, business.currency)}
              </td>
              {!compact ? <td className="px-4 py-3 text-muted">{userById.get(row.userId)}</td> : null}
              {editable ? (
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <IconButton
                      label="Editar"
                      disabled={isMonthClosed(state, business.id, row.date.slice(0, 7))}
                      onClick={() => onEdit?.(row)}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="Eliminar"
                      disabled={isMonthClosed(state, business.id, row.date.slice(0, 7))}
                      onClick={() => onDelete?.(row)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </td>
              ) : null}
            </tr>
          )) : (
            <tr>
              <td colSpan={editable ? 8 : compact ? 5 : 7} className="px-4 py-8 text-center text-muted">
                No hay movimientos para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
