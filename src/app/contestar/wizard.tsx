"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ZodError } from "zod";
import { ChoiceCards, Field, masks, SelectInput, TextInput } from "@/components/form-fields";
import {
  CONDUTOR_OPCOES,
  DOC_TIPOS,
  ENTIDADES_AUTUANTES,
  MEIOS_DETECAO,
  TIPOS_VIA,
  condutorSchema,
  consentSchema,
  infracaoSchema,
  representanteSchema,
  requerenteColetivaSchema,
  requerenteSingularSchema,
  titularSchema,
  veiculoSchema,
} from "@/modules/cases/schema";

const STEPS = ["Qualidade", "Requerente", "Veículo e condutor", "Infração", "Informação adicional", "Confirmação"];
const MAX_FILE = 10 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];

type Errors = Record<string, string>;

const empty = {
  tipo: "" as "" | "SINGULAR" | "COLETIVA",
  requerente: {
    nome: "", nif: "", doc_tipo: "CC", doc_numero: "", doc_validade: "", doc_emitente: "",
    denominacao: "", nipc: "", morada: "", codigo_postal: "", localidade: "", email: "", telefone: "",
  },
  representante: { nome: "", nif: "", cargo: "", doc_numero: "" },
  veiculo: { matricula: "", marca_modelo: "" },
  titular: { e_requerente: "" as "" | "sim" | "nao", nome: "", nif: "" },
  condutor: { identificacao: "", nome: "", nif: "", carta_conducao: "", morada: "", doc_tipo: "CC", doc_numero: "", doc_emitente: "" },
  infracao: {
    numero_auto: "", data: "", hora: "", local: "", tipo_via: "NAO_SEI", meio_detecao: "NAO_SEI",
    velocidade_maxima: "", velocidade_registada: "", velocidade_considerada: "",
    entidade_autuante: "", entidade_autuante_outra: "", data_notificacao: "", data_rececao: "",
    np: "", entidade_numero: "", entidade_morada: "", entidade_codigo_postal: "", entidade_localidade: "",
  },
  adicional: { descricao: "", observacoes: "" },
};
type FormState = typeof empty;

function toErrors(prefix: string, err: ZodError): Errors {
  const out: Errors = {};
  for (const i of err.issues) {
    const key = [prefix, ...i.path].filter(Boolean).join(".");
    out[key] ??= i.message;
  }
  return out;
}

function buildPayload(f: FormState) {
  const r = f.requerente;
  const contactos = { morada: r.morada, codigo_postal: r.codigo_postal, localidade: r.localidade, email: r.email, telefone: r.telefone };
  const requerente =
    f.tipo === "COLETIVA"
      ? { tipo: "COLETIVA" as const, denominacao: r.denominacao, nipc: r.nipc, ...contactos }
      : { tipo: "SINGULAR" as const, nome: r.nome, nif: r.nif, doc_tipo: r.doc_tipo, doc_numero: r.doc_numero, doc_validade: r.doc_validade, doc_emitente: r.doc_emitente, ...contactos };
  return {
    categoria: "EXCESSO_VELOCIDADE",
    requerente,
    representante: f.tipo === "COLETIVA" ? f.representante : undefined,
    veiculo: f.veiculo,
    titular: { e_requerente: f.titular.e_requerente === "sim", nome: f.titular.nome, nif: f.titular.nif },
    condutor: f.condutor.identificacao === "OUTRA_PESSOA" ? f.condutor : { identificacao: f.condutor.identificacao },
    infracao: f.infracao,
    adicional: f.adicional,
  };
}

export function Wizard({ priceLabel }: { priceLabel: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [notificacao, setNotificacao] = useState<File | null>(null);
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [consent, setConsent] = useState({ privacidade: false, termos: false, avisos: false });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isPC = f.tipo === "COLETIVA";
  const payload = useMemo(() => buildPayload(f), [f]);

  function set<G extends keyof FormState>(group: G, field: string, value: string) {
    setF((prev) => ({ ...prev, [group]: { ...(prev[group] as object), [field]: value } }));
    setErrors((e) => {
      const rest = { ...e };
      delete rest[`${String(group)}.${field}`];
      return rest;
    });
  }

  const err = (k: string) => errors[k];

  function validate(s: number): Errors {
    const e: Errors = {};
    const run = (prefix: string, schema: { safeParse: (v: unknown) => { success: boolean; error?: ZodError } }, value: unknown) => {
      const r = schema.safeParse(value);
      if (!r.success && r.error) Object.assign(e, toErrors(prefix, r.error));
    };
    if (s === 0 && !f.tipo) e.tipo = "Escolha uma opção para continuar";
    if (s === 1) {
      run("requerente", isPC ? requerenteColetivaSchema : requerenteSingularSchema, payload.requerente);
      if (isPC) run("representante", representanteSchema, f.representante);
    }
    if (s === 2) {
      run("veiculo", veiculoSchema, f.veiculo);
      if (!f.titular.e_requerente) e["titular.e_requerente"] = "Indique quem é o titular do veículo";
      else run("titular", titularSchema, payload.titular);
      if (!f.condutor.identificacao) e["condutor.identificacao"] = "Indique quem conduzia o veículo";
      else run("condutor", condutorSchema, f.condutor);
    }
    if (s === 3) run("infracao", infracaoSchema, f.infracao);
    if (s === 4) {
      const all = [notificacao, ...documentos].filter(Boolean) as File[];
      if (all.some((x) => x.size > MAX_FILE)) e.files = "Cada ficheiro pode ter no máximo 10 MB.";
      if (all.some((x) => !ACCEPT.includes(x.type))) e.files = "Apenas PDF, JPG ou PNG.";
      if (documentos.length > 5) e.files = "Máximo de 5 documentos complementares.";
    }
    if (s === 5) run("consent", consentSchema, consent);
    return e;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    const e = validate(5);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    setServerError(null);
    const body = new FormData();
    body.set("data", JSON.stringify(payload));
    body.set("consent", JSON.stringify(consent));
    if (notificacao) body.append("notificacao", notificacao);
    documentos.forEach((d) => body.append("documentos", d));
    try {
      const res = await fetch("/api/cases", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setServerError(json.error ?? "Não foi possível submeter o pedido.");
        if (json.fieldErrors) setErrors(json.fieldErrors);
        setSubmitting(false);
        return;
      }
      router.push(`/p/${json.token}`);
    } catch {
      setServerError("Erro de ligação. Tente novamente.");
      setSubmitting(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Progresso */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink-900">
            Passo {step + 1} de {STEPS.length} · {STEPS[step]}
          </span>
          <span className="text-ink-400">{Math.round(progress)}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-4 hidden grid-cols-6 gap-2 text-[11px] text-ink-400 sm:grid">
          {STEPS.map((s, i) => (
            <li key={s} className={i <= step ? "font-medium text-ink-700" : ""}>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-5 sm:p-8">
        {step === 0 && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Em que qualidade pretende apresentar a contestação?</h2>
              <p className="mt-1 text-sm text-ink-500">Esta escolha determina os dados pedidos e a minuta utilizada.</p>
            </div>
            <ChoiceCards
              value={f.tipo}
              onChange={(v) => {
                setF((p) => ({ ...p, tipo: v, condutor: { ...p.condutor, identificacao: "" } }));
                setErrors({});
              }}
              error={err("tipo")}
              options={[
                { value: "SINGULAR", title: "Pessoa singular", description: "Em nome pessoal." },
                { value: "COLETIVA", title: "Pessoa coletiva", description: "Em nome de uma empresa, através do representante legal." },
              ]}
            />
          </section>
        )}

        {step === 1 && (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">{isPC ? "Dados da empresa" : "Os seus dados pessoais"}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {isPC ? (
                <>
                  <Field label="Denominação social" error={err("requerente.denominacao")} className="sm:col-span-2">
                    <TextInput value={f.requerente.denominacao} onChange={(v) => set("requerente", "denominacao", v)} error={!!err("requerente.denominacao")} autoComplete="organization" />
                  </Field>
                  <Field label="NIPC" error={err("requerente.nipc")}>
                    <TextInput value={f.requerente.nipc} onChange={(v) => set("requerente", "nipc", v)} mask={masks.digits(9)} inputMode="numeric" error={!!err("requerente.nipc")} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Nome completo" error={err("requerente.nome")} className="sm:col-span-2">
                    <TextInput value={f.requerente.nome} onChange={(v) => set("requerente", "nome", v)} error={!!err("requerente.nome")} autoComplete="name" />
                  </Field>
                  <Field label="NIF" error={err("requerente.nif")}>
                    <TextInput value={f.requerente.nif} onChange={(v) => set("requerente", "nif", v)} mask={masks.digits(9)} inputMode="numeric" error={!!err("requerente.nif")} />
                  </Field>
                  <Field label="Tipo de documento de identificação" error={err("requerente.doc_tipo")}>
                    <SelectInput value={f.requerente.doc_tipo} onChange={(v) => set("requerente", "doc_tipo", v)} options={DOC_TIPOS} />
                  </Field>
                  <Field label="Número do documento" error={err("requerente.doc_numero")}>
                    <TextInput value={f.requerente.doc_numero} onChange={(v) => set("requerente", "doc_numero", v.toUpperCase())} error={!!err("requerente.doc_numero")} />
                  </Field>
                  <Field label="Validade do documento" optional error={err("requerente.doc_validade")}>
                    <TextInput type="date" value={f.requerente.doc_validade} onChange={(v) => set("requerente", "doc_validade", v)} />
                  </Field>
                  <Field label="Entidade emissora do documento" optional hint="Ex.: República Portuguesa.">
                    <TextInput value={f.requerente.doc_emitente} onChange={(v) => set("requerente", "doc_emitente", v)} />
                  </Field>
                </>
              )}
              <Field label={isPC ? "Sede (morada)" : "Morada"} error={err("requerente.morada")} className="sm:col-span-2">
                <TextInput value={f.requerente.morada} onChange={(v) => set("requerente", "morada", v)} error={!!err("requerente.morada")} autoComplete="street-address" />
              </Field>
              <Field label="Código postal" error={err("requerente.codigo_postal")}>
                <TextInput value={f.requerente.codigo_postal} onChange={(v) => set("requerente", "codigo_postal", v)} mask={masks.postal} placeholder="0000-000" inputMode="numeric" error={!!err("requerente.codigo_postal")} autoComplete="postal-code" />
              </Field>
              <Field label="Localidade" error={err("requerente.localidade")}>
                <TextInput value={f.requerente.localidade} onChange={(v) => set("requerente", "localidade", v)} error={!!err("requerente.localidade")} autoComplete="address-level2" />
              </Field>
              <Field label="Email" error={err("requerente.email")} hint="Enviaremos o documento para este email.">
                <TextInput type="email" value={f.requerente.email} onChange={(v) => set("requerente", "email", v.trim())} error={!!err("requerente.email")} autoComplete="email" />
              </Field>
              <Field label="Telefone" error={err("requerente.telefone")}>
                <TextInput type="tel" value={f.requerente.telefone} onChange={(v) => set("requerente", "telefone", v)} mask={masks.phone} placeholder="912 345 678" error={!!err("requerente.telefone")} autoComplete="tel" />
              </Field>
            </div>

            {isPC && (
              <div className="space-y-5 border-t border-ink-100 pt-6">
                <h3 className="font-semibold">Representante legal</h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nome do representante legal" error={err("representante.nome")} className="sm:col-span-2">
                    <TextInput value={f.representante.nome} onChange={(v) => set("representante", "nome", v)} error={!!err("representante.nome")} />
                  </Field>
                  <Field label="NIF do representante" error={err("representante.nif")}>
                    <TextInput value={f.representante.nif} onChange={(v) => set("representante", "nif", v)} mask={masks.digits(9)} inputMode="numeric" error={!!err("representante.nif")} />
                  </Field>
                  <Field label="Cargo ou qualidade" error={err("representante.cargo")} hint="Ex.: gerente, administrador.">
                    <TextInput value={f.representante.cargo} onChange={(v) => set("representante", "cargo", v)} error={!!err("representante.cargo")} />
                  </Field>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-7">
            <h2 className="text-xl font-semibold">Veículo e intervenientes</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Matrícula" error={err("veiculo.matricula")}>
                <TextInput value={f.veiculo.matricula} onChange={(v) => set("veiculo", "matricula", v)} mask={masks.plate} placeholder="AA-00-AA" error={!!err("veiculo.matricula")} />
              </Field>
              <Field label="Marca e modelo" optional>
                <TextInput value={f.veiculo.marca_modelo} onChange={(v) => set("veiculo", "marca_modelo", v)} />
              </Field>
            </div>

            <div className="space-y-3">
              <p className="label !mb-0">Quem é o titular (proprietário) do veículo?</p>
              <ChoiceCards
                value={f.titular.e_requerente}
                onChange={(v) => set("titular", "e_requerente", v)}
                error={err("titular.e_requerente")}
                options={[
                  { value: "sim", title: isPC ? "A empresa requerente" : "Sou eu" },
                  { value: "nao", title: "Outra pessoa ou entidade" },
                ]}
              />
              {f.titular.e_requerente === "nao" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nome do titular" error={err("titular.nome")}>
                    <TextInput value={f.titular.nome} onChange={(v) => set("titular", "nome", v)} error={!!err("titular.nome")} />
                  </Field>
                  <Field label="NIF do titular" optional error={err("titular.nif")}>
                    <TextInput value={f.titular.nif} onChange={(v) => set("titular", "nif", v)} mask={masks.digits(9)} inputMode="numeric" />
                  </Field>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Field label="Quem conduzia o veículo no momento da infração?" error={err("condutor.identificacao")}>
                <SelectInput
                  value={f.condutor.identificacao}
                  onChange={(v) => set("condutor", "identificacao", v)}
                  placeholder="Selecione…"
                  error={!!err("condutor.identificacao")}
                  options={Object.fromEntries(
                    Object.entries(CONDUTOR_OPCOES).filter(([k]) => (isPC ? k !== "REQUERENTE" : k !== "REPRESENTANTE")),
                  )}
                />
              </Field>
              {f.condutor.identificacao === "OUTRA_PESSOA" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nome do condutor" error={err("condutor.nome")}>
                    <TextInput value={f.condutor.nome} onChange={(v) => set("condutor", "nome", v)} error={!!err("condutor.nome")} />
                  </Field>
                  <Field label="NIF do condutor" optional error={err("condutor.nif")}>
                    <TextInput value={f.condutor.nif} onChange={(v) => set("condutor", "nif", v)} mask={masks.digits(9)} inputMode="numeric" />
                  </Field>
                  <Field label="N.º da carta de condução" optional>
                    <TextInput value={f.condutor.carta_conducao} onChange={(v) => set("condutor", "carta_conducao", v.toUpperCase())} />
                  </Field>
                  <Field label="Morada do condutor" optional>
                    <TextInput value={f.condutor.morada} onChange={(v) => set("condutor", "morada", v)} />
                  </Field>
                  <Field label="Documento de identificação do condutor">
                    <SelectInput value={f.condutor.doc_tipo} onChange={(v) => set("condutor", "doc_tipo", v)} options={DOC_TIPOS} />
                  </Field>
                  <Field label="N.º do documento do condutor" optional>
                    <TextInput value={f.condutor.doc_numero} onChange={(v) => set("condutor", "doc_numero", v.toUpperCase())} />
                  </Field>
                  <Field label="Entidade emissora do documento do condutor" optional>
                    <TextInput value={f.condutor.doc_emitente} onChange={(v) => set("condutor", "doc_emitente", v)} />
                  </Field>
                </div>
              )}
              {f.titular.e_requerente === "nao" && f.condutor.identificacao && f.condutor.identificacao !== "REQUERENTE" && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  Normalmente, a defesa é apresentada pelo titular do veículo ou pelo condutor. Como não é nenhum deles, o seu caso
                  não terá uma minuta automática e será indicado para análise — não será cobrado nada.
                </p>
              )}
              {f.condutor.identificacao === "NAO_IDENTIFICADO" && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  A identificação do condutor pode ter consequências próprias. Confirme na notificação as instruções e prazos aplicáveis.
                </p>
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Dados da infração</h2>
              <p className="mt-1 text-sm text-ink-500">Copie os dados exatamente como constam na notificação.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="N.º do auto de contraordenação" error={err("infracao.numero_auto")}>
                <TextInput value={f.infracao.numero_auto} onChange={(v) => set("infracao", "numero_auto", v.toUpperCase())} error={!!err("infracao.numero_auto")} />
              </Field>
              <Field label="Entidade autuante" error={err("infracao.entidade_autuante")}>
                <SelectInput value={f.infracao.entidade_autuante} onChange={(v) => set("infracao", "entidade_autuante", v)} options={ENTIDADES_AUTUANTES} placeholder="Selecione…" error={!!err("infracao.entidade_autuante")} />
              </Field>
              {f.infracao.entidade_autuante === "OUTRA" && (
                <Field label="Qual a entidade?" error={err("infracao.entidade_autuante_outra")} className="sm:col-span-2">
                  <TextInput value={f.infracao.entidade_autuante_outra} onChange={(v) => set("infracao", "entidade_autuante_outra", v)} error={!!err("infracao.entidade_autuante_outra")} />
                </Field>
              )}
              <Field label="N.º da entidade autuante" optional hint="Código numérico que consta na notificação.">
                <TextInput value={f.infracao.entidade_numero} onChange={(v) => set("infracao", "entidade_numero", v)} />
              </Field>
              <Field label="NP" optional hint="Se constar na notificação.">
                <TextInput value={f.infracao.np} onChange={(v) => set("infracao", "np", v.toUpperCase())} />
              </Field>
              <Field label="Morada da entidade autuante" optional hint="Morada para onde deve ser enviada a resposta, conforme a notificação." className="sm:col-span-2">
                <TextInput value={f.infracao.entidade_morada} onChange={(v) => set("infracao", "entidade_morada", v)} />
              </Field>
              <Field label="Código postal da entidade" optional error={err("infracao.entidade_codigo_postal")}>
                <TextInput value={f.infracao.entidade_codigo_postal} onChange={(v) => set("infracao", "entidade_codigo_postal", v)} mask={masks.postal} placeholder="0000-000" inputMode="numeric" error={!!err("infracao.entidade_codigo_postal")} />
              </Field>
              <Field label="Localidade da entidade" optional>
                <TextInput value={f.infracao.entidade_localidade} onChange={(v) => set("infracao", "entidade_localidade", v)} />
              </Field>
              <Field label="Data da infração" error={err("infracao.data")}>
                <TextInput type="date" value={f.infracao.data} onChange={(v) => set("infracao", "data", v)} error={!!err("infracao.data")} />
              </Field>
              <Field label="Hora da infração" optional error={err("infracao.hora")}>
                <TextInput type="time" value={f.infracao.hora} onChange={(v) => set("infracao", "hora", v)} error={!!err("infracao.hora")} />
              </Field>
              <Field label="Local da infração" error={err("infracao.local")} className="sm:col-span-2" hint="Ex.: A1, km 10, sentido Norte–Sul; ou Rua X, Lisboa.">
                <TextInput value={f.infracao.local} onChange={(v) => set("infracao", "local", v)} error={!!err("infracao.local")} />
              </Field>
              <Field label="Tipo de via">
                <SelectInput value={f.infracao.tipo_via} onChange={(v) => set("infracao", "tipo_via", v)} options={TIPOS_VIA} />
              </Field>
              <Field label="Meio de deteção">
                <SelectInput value={f.infracao.meio_detecao} onChange={(v) => set("infracao", "meio_detecao", v)} options={MEIOS_DETECAO} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Velocidade máxima permitida" error={err("infracao.velocidade_maxima")}>
                <SpeedInput value={f.infracao.velocidade_maxima} onChange={(v) => set("infracao", "velocidade_maxima", v)} error={!!err("infracao.velocidade_maxima")} />
              </Field>
              <Field label="Velocidade registada" optional error={err("infracao.velocidade_registada")}>
                <SpeedInput value={f.infracao.velocidade_registada} onChange={(v) => set("infracao", "velocidade_registada", v)} />
              </Field>
              <Field label="Velocidade considerada" error={err("infracao.velocidade_considerada")} hint="Após dedução da margem de erro.">
                <SpeedInput value={f.infracao.velocidade_considerada} onChange={(v) => set("infracao", "velocidade_considerada", v)} error={!!err("infracao.velocidade_considerada")} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Data da notificação" optional error={err("infracao.data_notificacao")} hint="Data que consta no documento.">
                <TextInput type="date" value={f.infracao.data_notificacao} onChange={(v) => set("infracao", "data_notificacao", v)} />
              </Field>
              <Field label="Data em que recebeu a notificação" error={err("infracao.data_rececao")}>
                <TextInput type="date" value={f.infracao.data_rececao} onChange={(v) => set("infracao", "data_rececao", v)} error={!!err("infracao.data_rececao")} />
              </Field>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">Informação adicional</h2>
            <Field label="Descreva o que aconteceu" optional hint="Factos relevantes, de forma objetiva. Não altera os fundamentos da minuta.">
              <textarea rows={5} maxLength={5000} className="input" value={f.adicional.descricao} onChange={(e) => set("adicional", "descricao", e.target.value)} />
            </Field>
            <Field label="Observações adicionais" optional>
              <textarea rows={3} maxLength={3000} className="input" value={f.adicional.observacoes} onChange={(e) => set("adicional", "observacoes", e.target.value)} />
            </Field>
            <Field label="Fotografia ou digitalização da notificação" optional hint="PDF, JPG ou PNG, até 10 MB.">
              <input type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setNotificacao(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-ink-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
            </Field>
            <Field label="Documentos complementares" optional hint="Até 5 ficheiros (PDF, JPG ou PNG).">
              <input type="file" multiple accept=".pdf,image/jpeg,image/png" onChange={(e) => setDocumentos(Array.from(e.target.files ?? []))} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-ink-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink-800" />
            </Field>
            {err("files") && <p className="text-sm text-red-600">{err("files")}</p>}
          </section>
        )}

        {step === 5 && (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">Confirme os seus dados</h2>
            <Summary f={f} files={[notificacao, ...documentos].filter(Boolean).length} />
            <div className="space-y-3 rounded-2xl bg-ink-50 p-4 text-sm">
              <Check checked={consent.avisos} onChange={(v) => setConsent((c) => ({ ...c, avisos: v }))} error={err("consent.avisos")}>
                Compreendo que o serviço prepara um documento personalizado; que devo verificar os dados antes de assinar; que a
                apresentação da defesa e a verificação dos prazos legais são da minha responsabilidade; e que a preparação do documento
                não garante o deferimento da defesa.
              </Check>
              <Check checked={consent.termos} onChange={(v) => setConsent((c) => ({ ...c, termos: v }))} error={err("consent.termos")}>
                Aceito os <a href="/termos" target="_blank" className="underline">termos do serviço</a>.
              </Check>
              <Check checked={consent.privacidade} onChange={(v) => setConsent((c) => ({ ...c, privacidade: v }))} error={err("consent.privacidade")}>
                Li a <a href="/privacidade" target="_blank" className="underline">política de privacidade</a> e autorizo o tratamento dos dados para a preparação do documento.
              </Check>
            </div>
            <p className="text-sm text-ink-500">
              Ao continuar verificamos se existe uma minuta adequada ao seu caso. Só paga ({priceLabel}) se existir.
            </p>
            {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
          </section>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ink-100 pt-6 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-ghost">
              Voltar
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn btn-primary">
              Continuar
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} className="btn btn-accent">
              {submitting ? "A verificar…" : "Verificar e continuar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpeedInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  return (
    <div className="relative">
      <TextInput value={value} onChange={onChange} mask={masks.digits(3)} inputMode="numeric" error={error} />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-400">km/h</span>
    </div>
  );
}

function Check({ checked, onChange, error, children }: { checked: boolean; onChange: (v: boolean) => void; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-ink-900" />
      <span>
        <span className="text-ink-700">{children}</span>
        {error && <span className="mt-1 block text-red-600">{error}</span>}
      </span>
    </label>
  );
}

function Summary({ f, files }: { f: FormState; files: number }) {
  const isPC = f.tipo === "COLETIVA";
  const rows: [string, string][] = [
    ["Qualidade", isPC ? "Pessoa coletiva" : "Pessoa singular"],
    [isPC ? "Empresa" : "Nome", isPC ? `${f.requerente.denominacao} (NIPC ${f.requerente.nipc})` : `${f.requerente.nome} (NIF ${f.requerente.nif})`],
    ...(isPC ? ([["Representante", `${f.representante.nome}, ${f.representante.cargo}`]] as [string, string][]) : []),
    ["Morada", `${f.requerente.morada}, ${f.requerente.codigo_postal} ${f.requerente.localidade}`],
    ["Contactos", `${f.requerente.email} · ${f.requerente.telefone}`],
    ["Veículo", `${f.veiculo.matricula}${f.veiculo.marca_modelo ? ` · ${f.veiculo.marca_modelo}` : ""}`],
    ["Titular", f.titular.e_requerente === "sim" ? "O requerente" : f.titular.nome],
    ["Condutor", f.condutor.identificacao === "OUTRA_PESSOA" ? f.condutor.nome : CONDUTOR_OPCOES[f.condutor.identificacao as keyof typeof CONDUTOR_OPCOES] ?? ""],
    ["Auto n.º", f.infracao.numero_auto],
    ["Data e local", `${f.infracao.data}${f.infracao.hora ? ` ${f.infracao.hora}` : ""} · ${f.infracao.local}`],
    ["Velocidades", `máx. ${f.infracao.velocidade_maxima} · considerada ${f.infracao.velocidade_considerada} km/h`],
    ["Notificação recebida em", f.infracao.data_rececao],
    ["Ficheiros", `${files}`],
  ];
  return (
    <dl className="divide-y divide-ink-100 rounded-2xl border border-ink-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[200px_1fr]">
          <dt className="text-ink-500">{k}</dt>
          <dd className="break-words text-ink-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
