"use client";

import { useState, useTransition } from "react";

type Mapping = { placeholder: string; sourcePath: string; format: string; required: boolean; defaultValue?: string };
type CatalogItem = { path: string; label: string; group: string; type: string };

/** Editor de mapeamento: {{MARCADOR}} → campo da plataforma, sem alterar código. */
export function MappingEditor({
  placeholders,
  initial,
  catalog,
  formats,
  save,
  readOnly,
}: {
  placeholders: { name: string; kind: "variable" | "section" }[];
  initial: Mapping[];
  catalog: CatalogItem[];
  formats: Record<string, string>;
  save: (json: string) => Promise<{ error?: string; ok?: boolean; count?: number }>;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<Mapping[]>(() =>
    placeholders.map((p) => {
      const m = initial.find((i) => i.placeholder === p.name);
      return m
        ? { ...m, defaultValue: m.defaultValue ?? "" }
        : { placeholder: p.name, sourcePath: "", format: p.kind === "section" ? "boolean" : "text", required: p.kind !== "section", defaultValue: "" };
    }),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = [...new Set(catalog.map((c) => c.group))];
  const update = (i: number, patch: Partial<Mapping>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs text-ink-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Marcador na minuta</th>
              <th className="py-2 pr-3 font-medium">Campo da plataforma</th>
              <th className="py-2 pr-3 font-medium">Formato</th>
              <th className="py-2 pr-3 font-medium">Obrig.</th>
              <th className="py-2 font-medium">Valor por omissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, i) => {
              const kind = placeholders[i].kind;
              return (
                <tr key={r.placeholder} className={!r.sourcePath ? "bg-amber-50/60" : ""}>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {kind === "section" ? `{{#${r.placeholder}}}` : `{{${r.placeholder}}}`}
                  </td>
                  <td className="py-2 pr-3">
                    <select disabled={readOnly} value={r.sourcePath} onChange={(e) => update(i, { sourcePath: e.target.value })} className="input !py-1.5 text-sm">
                      <option value="">— por mapear —</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {catalog
                            .filter((c) => c.group === g && (kind === "section" ? true : c.type !== "boolean"))
                            .map((c) => (
                              <option key={c.path} value={c.path}>{c.label} · {c.path}</option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select disabled={readOnly} value={r.format} onChange={(e) => update(i, { format: e.target.value })} className="input !py-1.5 text-sm">
                      {Object.entries(formats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-center">
                    <input disabled={readOnly || r.format === "boolean"} type="checkbox" checked={r.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  </td>
                  <td className="py-2">
                    <input disabled={readOnly} value={r.defaultValue ?? ""} onChange={(e) => update(i, { defaultValue: e.target.value })} className="input !py-1.5 text-sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await save(JSON.stringify(rows));
                setMsg(r.error ?? `Mapeamento guardado (${r.count} campos).`);
              })
            }
            className="btn btn-primary"
          >
            {pending ? "A guardar…" : "Guardar mapeamento"}
          </button>
          {msg && <span className="text-sm text-ink-600">{msg}</span>}
        </div>
      )}
    </div>
  );
}

type Rule = { field: string; op: string; value?: unknown };

/** Editor estruturado das condições de utilização de uma minuta. */
export function ConditionsEditor({
  initial,
  fields,
  operators,
  save,
}: {
  initial: { all?: Rule[]; any?: Rule[] };
  fields: { path: string; label: string }[];
  operators: Record<string, string>;
  save: (json: string) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [all, setAll] = useState<Rule[]>(initial.all ?? []);
  const [any, setAny] = useState<Rule[]>(initial.any ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noValue = ["exists", "notExists", "isTrue", "isFalse"];

  const list = (rules: Rule[], set: (r: Rule[]) => void, title: string) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {rules.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
          <select value={r.field} onChange={(e) => set(rules.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} className="input !py-1.5 text-sm">
            {fields.map((f) => <option key={f.path} value={f.path}>{f.label}</option>)}
          </select>
          <select value={r.op} onChange={(e) => set(rules.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))} className="input !py-1.5 text-sm">
            {Object.entries(operators).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            disabled={noValue.includes(r.op)}
            value={r.value === undefined ? "" : String(r.value)}
            onChange={(e) => set(rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            className="input !py-1.5 text-sm"
            placeholder="valor"
          />
          <button type="button" onClick={() => set(rules.filter((_, j) => j !== i))} className="btn btn-ghost !px-3 !py-1.5">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => set([...rules, { field: fields[0].path, op: "eq", value: "" }])} className="text-sm underline">
        + adicionar regra
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {list(all, setAll, "Todas estas condições têm de ser verdadeiras (E)")}
      {list(any, setAny, "Pelo menos uma destas (OU) — opcional")}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await save(JSON.stringify({ all, any }));
              setMsg(r.error ?? "Condições guardadas.");
            })
          }
          className="btn btn-primary"
        >
          Guardar condições
        </button>
        {msg && <span className="text-sm text-ink-600">{msg}</span>}
      </div>
    </div>
  );
}
