"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  error,
  hint,
  optional,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-400">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  error,
  mask,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  mask?: (v: string) => string;
}) {
  return (
    <input
      {...rest}
      value={value}
      aria-invalid={error || undefined}
      onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)}
      className={`input ${error ? "input-error" : ""}`}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  error,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  error?: boolean;
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${error ? "input-error" : ""}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  error,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; title: string; description?: string; icon?: ReactNode }[];
  error?: string;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                active ? "border-ink-900 bg-ink-50 ring-4 ring-ink-900/10" : "border-ink-200 hover:border-ink-400"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-ink-900" : "border-ink-300"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-ink-900" />}
              </span>
              <span>
                <span className="block font-semibold">{o.title}</span>
                {o.description && <span className="mt-0.5 block text-sm text-ink-500">{o.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export const masks = {
  digits: (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max),
  postal: (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 7);
    return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
  },
  plate: (v: string) => {
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    return raw.match(/.{1,2}/g)?.join("-") ?? "";
  },
  phone: (v: string) => v.replace(/[^\d+ ]/g, "").slice(0, 16),
};
