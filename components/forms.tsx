"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { expenseCategories, paymentMethods } from "@/lib/constants";
import { formatCurrency, toInputDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { DailySale, Expense, ExpenseCategoryKey, PaymentMethodKey } from "@/lib/types";
import { Button, Field, inputClass, Textarea } from "./ui";

export function SaleForm({ onDone, sale }: { onDone: () => void; sale?: DailySale }) {
  const { addSale, updateSale, business } = useStore();
  const [date, setDate] = useState(sale?.date ?? toInputDate());
  const [total, setTotal] = useState(sale?.total ?? 0);
  const [distribution, setDistribution] = useState<Record<PaymentMethodKey, number>>({
    bold: sale?.distribution.bold ?? 0,
    bancolombia: sale?.distribution.bancolombia ?? 0,
    nequi: sale?.distribution.nequi ?? 0,
    cash: sale?.distribution.cash ?? 0,
  });
  const [notes, setNotes] = useState(sale?.notes ?? "");

  const sum = useMemo(
    () => Object.values(distribution).reduce((partial, value) => partial + Number(value || 0), 0),
    [distribution],
  );
  const diff = sum - total;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = sale
      ? await updateSale(sale.id, { date, total, distribution, notes })
      : await addSale({ date, total, distribution, notes });
    if (saved) onDone();
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
              onChange={(event) =>
                setDistribution((current) => ({ ...current, [method.key]: Number(event.target.value) }))
              }
              required
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
      <Button type="submit" disabled={diff !== 0 || total <= 0}>
        <Save size={16} />
        {sale ? "Actualizar venta" : "Guardar venta"}
      </Button>
    </form>
  );
}

export function ExpenseForm({ onDone, expense }: { onDone: () => void; expense?: Expense }) {
  const { addExpense, updateExpense } = useStore();
  const [date, setDate] = useState(expense?.date ?? toInputDate());
  const [category, setCategory] = useState<ExpenseCategoryKey>(expense?.category ?? "inventory");
  const [detail, setDetail] = useState(expense?.detail ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>(expense?.paymentMethod ?? "bancolombia");
  const [value, setValue] = useState(expense?.value ?? 0);
  const [notes, setNotes] = useState(expense?.notes ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = expense
      ? await updateExpense(expense.id, { date, category, detail, paymentMethod, value, notes })
      : await addExpense({ date, category, detail, paymentMethod, value, notes });
    if (saved) onDone();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fecha">
          <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label="Categoria">
          <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategoryKey)}>
            {expenseCategories.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Metodo de pago">
          <select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodKey)}>
            {paymentMethods.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Valor">
          <input className={inputClass} type="number" min="0" value={value || ""} onChange={(event) => setValue(Number(event.target.value))} required />
        </Field>
      </div>
      <Field label="Detalle">
        <input className={inputClass} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ej. Compra de inventario" required />
      </Field>
      <Field label="Notas">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones del gasto" />
      </Field>
      <Button type="submit" disabled={value <= 0 || !detail.trim()}>
        <Save size={16} />
        {expense ? "Actualizar gasto" : "Guardar gasto"}
      </Button>
    </form>
  );
}
