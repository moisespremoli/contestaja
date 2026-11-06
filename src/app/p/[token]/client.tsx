"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "./actions";

export function AutoRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}

const METHODS = [
  { value: "MBWAY", title: "MB WAY", description: "Confirmação na app, em segundos." },
  { value: "CARD", title: "Cartão bancário", description: "Visa, Mastercard." },
  { value: "MULTIBANCO", title: "Referência Multibanco", description: "Pague no ATM ou homebanking." },
] as const;

export function PaymentForm({
  action,
  priceLabel,
  methods,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  priceLabel: string;
  methods: string[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const available = METHODS.filter((m) => methods.includes(m.value));
  const [method, setMethod] = useState<string>(available[0]?.value ?? "");
  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Método de pagamento</legend>
        {available.map((m) => (
          <label
            key={m.value}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              method === m.value ? "border-ink-900 bg-ink-50 ring-4 ring-ink-900/10" : "border-ink-200 hover:border-ink-400"
            }`}
          >
            <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="sr-only" />
            <span className="block font-semibold">{m.title}</span>
            <span className="mt-1 block text-xs text-ink-500">{m.description}</span>
          </label>
        ))}
      </fieldset>
      {method === "MBWAY" && (
        <div>
          <label className="label" htmlFor="phone">Telemóvel associado ao MB WAY</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="912 345 678" className="input max-w-xs" required />
        </div>
      )}
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-accent w-full sm:w-auto" disabled={pending}>
        {pending ? "A iniciar pagamento…" : `Pagar ${priceLabel}`}
      </button>
    </form>
  );
}

export function MissingFieldsForm({
  action,
  fields,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  fields: { path: string; label: string; type: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) => (
        <div key={f.path}>
          <label className="label" htmlFor={f.path}>{f.label}</label>
          <input
            id={f.path}
            name={f.path}
            type={f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "number" ? "number" : "text"}
            className="input"
            required
          />
        </div>
      ))}
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "A guardar…" : "Guardar e continuar"}
      </button>
    </form>
  );
}

export function CouponForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <details className="group rounded-2xl border border-ink-200 p-4" open={!!state?.error}>
      <summary className="cursor-pointer text-sm font-medium text-ink-700">Tem um código promocional?</summary>
      <form action={formAction} className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="coupon">Código promocional</label>
        <input id="coupon" name="code" autoComplete="off" autoCapitalize="characters" placeholder="CÓDIGO" className="input max-w-xs font-mono uppercase" />
        <button className="btn btn-ghost" disabled={pending}>{pending ? "A validar…" : "Aplicar"}</button>
      </form>
      {state?.error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    </details>
  );
}

export function FreeCompleteForm({ action }: { action: (s: ActionState) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-accent w-full sm:w-auto" disabled={pending}>
        {pending ? "A concluir…" : "Concluir pedido sem pagamento"}
      </button>
    </form>
  );
}
