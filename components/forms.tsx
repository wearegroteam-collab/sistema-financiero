"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { expenseCategories, paymentMethods } from "@/lib/constants";
import { usePersistentDraft } from "@/lib/drafts";
import { formatCurrency, toInputDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { DailySale, Expense, ExpenseCategoryKey, PaymentMethodKey } from "@/lib/types";
import { Button, Field, inputClass, Textarea } from "./ui";

export function SaleForm({ onDone, sale }: { onDone: () => void; sale?: DailySale }) {
  const { addSale, updateSale, business } = useStore();
  const initialSale = {
    date: sale?.date ?? toInputDate(),
    total: sale?.total ?? 0,
    distribution: {
      bold: sale?.distribution.bold ?? 0,
      bancolombia: sale?.distribution.bancolombia ?? 0,
      nequi: sale?.distribution.nequi ?? 0,
      cash: sale?.distribution.cash ?? 0,
    } as Record<PaymentMethodKey, number>,
    notes: sale?.notes ?? "",
  };
  const [draft, setDraft, clearDraft] = usePersistentDraft(sale ? `sale-edit:${sale.id}` : `sale-new:${business.id}`, initialSale);
  const [submitting, setSubmitting] = useState(false);
  const { date, total, distribution, notes } = draft;
  const setDate = (value: string) => setDraft((current) => ({ ...current, date: value }));
  const setTotal = (value: number) => setDraft((current) => ({ ...current, total: value }));
  const setDistribution = (updater: (current: Record<PaymentMethodKey, number>) => Record<PaymentMethodKey, number>) =>
    setDraft((current) => ({ ...current, distribution: updater(current.distribution) }));
  const setMethodValue = (method: PaymentMethodKey, value: string) =>
    setDistribution((current) => ({ ...current, [method]: value === "" ? 0 : Number(value) }));
  const setNotes = (value: string) => setDraft((current) => ({ ...current, notes: value }));

  const sum = useMemo(
    () => Object.values(distribution).reduce((partial, value) => partial + Number(value || 0), 0),
    [distribution],
  );
  const diff = sum - total;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const saved = sale
        ? await updateSale(sale.id, { date, total, distribution, notes })
        : await addSale({ date, total, distribution, notes });
      if (saved) {
        clearDraft();
        onDone();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fecha">
          <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label="Venta total">
          <input className={inputClass} type="number" min="0" value={total || ""} onChange={(event) => setTotal(Number(event.target.value))} required />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {paymentMethods.map((method) => (
          <Field key={method.key} label={method.label}>
            <input
              className={inputClass}
              type="number"
              min="0"
              value={distribution[method.key] || ""}
              onChange={(event) => setMethodValue(method.key, event.target.value)}
            />
          </Field>
        ))}
      </div>
      <Field label="Notas">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones del dia" />
      </Field>
      <div className="rounded-lg border border-line bg-panel p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-muted">Distribucion registrada</span>
          <span className="font-semibold text-ink">{formatCurrency(sum, business.currency)}</span>
        </div>
        {diff !== 0 ? (
          <p className="mt-2 flex items-center gap-2 text-danger">
            <AlertTriangle size={16} />
            {diff > 0 ? `Sobran ${formatCurrency(diff, business.currency)}` : `Faltan ${formatCurrency(Math.abs(diff), business.currency)}`}
          </p>
        ) : (
          <p className="mt-2 text-success">La distribucion coincide con la venta total.</p>
        )}
      </div>
      <Button type="submit" disabled={diff !== 0 || total <= 0 || submitting}>
        <Save size={16} />
        {submitting ? "Guardando..." : sale ? "Actualizar venta" : "Guardar venta"}
      </Button>
    </form>
  );
}

export function ExpenseForm({ onDone, expense }: { onDone: () => void; expense?: Expense }) {
  const { addExpense, updateExpense, business } = useStore();
  const initialExpense = {
    date: expense?.date ?? toInputDate(),
    category: expense?.category ?? "inventory" as ExpenseCategoryKey,
    detail: expense?.detail ?? "",
    paymentMethod: expense?.paymentMethod ?? "bancolombia" as PaymentMethodKey,
    value: expense?.value ?? 0,
    notes: expense?.notes ?? "",
  };
  const [draft, setDraft, clearDraft] = usePersistentDraft(expense ? `expense-edit:${expense.id}` : `expense-new:${business.id}`, initialExpense);
  const [submitting, setSubmitting] = useState(false);
  const { date, category, detail, paymentMethod, value, notes } = draft;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const saved = expense
        ? await updateExpense(expense.id, { date, category, detail, paymentMethod, value, notes })
        : await addExpense({ date, category, detail, paymentMethod, value, notes });
      if (saved) {
        clearDraft();
        onDone();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fecha">
          <input className={inputClass} type="date" value={date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required />
        </Field>
        <Field label="Categoria">
          <select className={inputClass} value={category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as ExpenseCategoryKey }))}>
            {expenseCategories.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Metodo de pago">
          <select className={inputClass} value={paymentMethod} onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethodKey }))}>
            {paymentMethods.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Valor">
          <input className={inputClass} type="number" min="0" value={value || ""} onChange={(event) => setDraft((current) => ({ ...current, value: Number(event.target.value) }))} required />
        </Field>
      </div>
      <Field label="Detalle">
        <input className={inputClass} value={detail} onChange={(event) => setDraft((current) => ({ ...current, detail: event.target.value }))} placeholder="Ej. Compra de inventario" required />
      </Field>
      <Field label="Notas">
        <Textarea value={notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Observaciones del gasto" />
      </Field>
      <Button type="submit" disabled={value <= 0 || !detail.trim() || submitting}>
        <Save size={16} />
        {submitting ? "Guardando..." : expense ? "Actualizar gasto" : "Guardar gasto"}
      </Button>
    </form>
  );
}
