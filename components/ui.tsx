"use client";

import { clsx, type ClassValue } from "clsx";
import { X } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes, TextareaHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-ink text-white hover:bg-ink/90",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-panel",
        variant === "ghost" && "text-muted hover:bg-panel hover:text-ink",
        variant === "danger" && "bg-danger text-white hover:bg-danger/90",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-muted transition hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "focus-ring h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-20 w-full resize-none rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted",
        props.className,
      )}
      {...props}
    />
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm">
      <div className="surface max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  title,
  value,
  tone = "neutral",
  detail,
}: {
  title: string;
  value: string;
  tone?: "neutral" | "success" | "danger" | "info" | "warning";
  detail?: string;
}) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{title}</p>
        <span
          className={cn(
            "mt-0.5 h-2.5 w-2.5 rounded-full",
            tone === "neutral" && "bg-line",
            tone === "success" && "bg-success",
            tone === "danger" && "bg-danger",
            tone === "info" && "bg-info",
            tone === "warning" && "bg-warning",
          )}
        />
      </div>
      <p className="mt-2 break-words text-2xl font-semibold tracking-normal text-ink">{value}</p>
      {detail ? <p className="mt-2 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}
