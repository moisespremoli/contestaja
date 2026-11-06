import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageTitle, Panel, StatusBadge, eur, fmtDate } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { METHOD_LABELS } from "@/modules/payments";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { requireAdmin } from "@/modules/auth/session";
import { CONDUTOR_OPCOES, ENTIDADES_AUTUANTES, type CaseData } from "@/modules/cases/schema";
import { caseData, missingRequiredFields } from "@/modules/cases/service";
import type { SelectionResult } from "@/modules/selection/engine";
import { anonymizeAction, approveAndGenerate, overrideTemplateAction, rerunSelection, resendDocument } from "./actions";

export default async function ProcessoDetalhe({ params, searchParams }: PageProps<"/admin/processos/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.case.findUnique({
    where: { id },
    include: {
      category: true,
      files: true,
      payments: { orderBy: { createdAt: "desc" }, include: { coupon: true } },
      documents: { orderBy: { createdAt: "desc" }, include: { templateVersion: { include: { template: true } } } },
      templateVersion: { include: { template: true } },
    },
  });
  if (!c) notFound();
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: "admin.case_viewed", entityType: "Case", entityId: id });

  const data = c.anonymizedAt ? null : caseData(c);
  const [history, templates, missing] = await Promise.all([
    db.auditLog.findMany({ where: { entityType: "Case", entityId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.template.findMany({ where: { categoryId: c.categoryId, currentVersionId: { not: null } }, orderBy: { code: "asc" } }),
    c.anonymizedAt ? Promise.resolve([]) : missingRequiredFields(c),
  ]);
  const trace = c.selectionTrace as unknown as SelectionResult | null;
  const paid = c.payments.some((p) => p.status === "CONFIRMED");

  return (
    <>
      <PageTitle title={`Processo ${c.reference}`}>
        <StatusBadge status={c.status} />
      </PageTitle>
      {typeof sp.ok === "string" && <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{sp.ok}</p>}
      {typeof sp.erro === "string" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{sp.erro}</p>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Dados do processo">
            {data ? <CaseDataView d={data} /> : <p className="text-sm text-ink-500">Dados anonimizados em {fmtDate(c.anonymizedAt)}.</p>}
          </Panel>

          <Panel title="Seleção de minuta">
            <p className="text-sm">
              Resultado: <Badge tone={c.selectionOutcome === "SELECTED" || c.selectionOutcome === "MANUAL_OVERRIDE" ? "green" : "red"}>{c.selectionOutcome ?? "—"}</Badge>{" "}
              {c.templateVersion && (
                <Link href={`/admin/minutas/${c.templateVersion.templateId}`} className="ml-2 underline">
                  {c.templateVersion.template.code} v{c.templateVersion.version}
                </Link>
              )}
            </p>
            {trace?.message && <p className="mt-2 text-sm text-ink-600">{trace.message}</p>}
            {trace?.trace?.length ? (
              <ul className="mt-3 space-y-1.5 text-xs">
                {trace.trace.map((t) => (
                  <li key={t.templateId} className="rounded-lg bg-ink-50 p-2">
                    <span className="font-mono font-semibold">{t.code}</span> — {t.eligible ? "elegível" : t.reasons.join("; ")}
                  </li>
                ))}
              </ul>
            ) : null}
            {missing.length > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                Campos obrigatórios em falta: {missing.map((m) => m.placeholder).join(", ")}
              </p>
            )}
            {!c.anonymizedAt && (
              <div className="mt-5 grid gap-4 border-t border-ink-100 pt-5 md:grid-cols-2">
                <form action={rerunSelection.bind(null, id)}>
                  <p className="mb-2 text-sm text-ink-500">Executar novamente o motor de seleção (ex.: após ativar nova minuta).</p>
                  <button className="btn btn-ghost" disabled={paid}>Reexecutar seleção</button>
                </form>
                <form action={overrideTemplateAction.bind(null, id)} className="space-y-2 text-sm">
                  <p className="font-medium">Seleção manual (validação expressa)</p>
                  <select name="templateId" className="input" required defaultValue="">
                    <option value="" disabled>Escolha a minuta…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.applicantType}{t.applicantType !== c.applicantType ? " ⚠ outro tipo de requerente" : ""}{t.status === "INACTIVE" ? " (inativa)" : ""}
                      </option>
                    ))}
                  </select>
                  <textarea name="reason" className="input" rows={2} placeholder="Justificação (obrigatória)" required minLength={10} />
                  <label className="flex gap-2"><input type="checkbox" name="confirm" /> Confirmo que validei a adequação jurídica desta minuta.</label>
                  <label className="flex gap-2 text-red-700"><input type="checkbox" name="confirmCross" /> Autorizo expressamente o uso de minuta de outro tipo de requerente.</label>
                  <button className="btn btn-primary">Atribuir minuta</button>
                </form>
              </div>
            )}
          </Panel>

          <Panel title="Histórico de operações">
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3 border-b border-ink-50 pb-2">
                  <span className="text-ink-400">{fmtDate(h.createdAt)}</span>
                  <Badge tone={h.actorType === "ADMIN" ? "violet" : h.actorType === "CLIENT" ? "neutral" : "amber"}>{h.actorType}</Badge>
                  <span className="font-mono text-xs">{h.action}</span>
                  {h.meta ? <span className="w-full truncate text-xs text-ink-400">{JSON.stringify(h.meta)}</span> : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Resumo">
            <dl className="space-y-2 text-sm">
              <Row k="Cliente" v={c.displayName} />
              <Row k="Email" v={c.email} />
              <Row k="Categoria" v={c.category.name} />
              <Row k="Requerente" v={c.applicantType === "SINGULAR" ? "Pessoa singular" : "Pessoa coletiva"} />
              <Row k="Criado" v={fmtDate(c.createdAt)} />
              <Row k="Consentimentos" v={fmtDate(c.privacyConsentAt)} />
              <Row k="Conservar até" v={fmtDate(c.retentionUntil)} />
            </dl>
          </Panel>

          <Panel title="Pagamentos">
            {c.payments.length === 0 && <p className="text-sm text-ink-400">Sem pagamentos.</p>}
            <ul className="space-y-2 text-sm">
              {c.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>{METHOD_LABELS[p.method]} · {eur(p.amountCents)}{p.coupon && <> · cupão <b className="font-mono">{p.coupon.code}</b>{p.coupon.isTest && " (teste)"}</>}<span className="block text-xs text-ink-400">{p.provider} · {fmtDate(p.createdAt)}</span></span>
                  <Badge tone={p.status === "CONFIRMED" ? "green" : p.status === "PENDING" ? "amber" : "red"}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Documentos">
            {c.documents.map((d) => (
              <div key={d.id} className="mb-3 text-sm">
                <p>{d.templateVersion.template.code} v{d.templateVersion.version} · {fmtDate(d.createdAt)}</p>
                <p className="text-xs text-ink-400">Entregue: {fmtDate(d.deliveredAt)} · SHA-256 {d.pdfSha256.slice(0, 12)}…</p>
                {!c.anonymizedAt && (
                  <div className="mt-1 flex gap-3">
                    <a className="underline" href={`/api/admin/files?kind=pdf&id=${d.id}`} target="_blank">PDF</a>
                    <a className="underline" href={`/api/admin/files?kind=docx&id=${d.id}`}>DOCX</a>
                  </div>
                )}
              </div>
            ))}
            {c.documents.length === 0 && <p className="text-sm text-ink-400">Nenhum documento gerado.</p>}
            {paid && !c.anonymizedAt && ["AWAITING_REVIEW", "PAYMENT_CONFIRMED"].includes(c.status) && (
              <form action={approveAndGenerate.bind(null, id)} className="mt-3">
                <button className="btn btn-accent w-full">Aprovar, gerar e entregar</button>
              </form>
            )}
            {c.documents.length > 0 && !c.anonymizedAt && (
              <form action={resendDocument.bind(null, id)} className="mt-2">
                <button className="btn btn-ghost w-full">Reenviar email ao cliente</button>
              </form>
            )}
          </Panel>

          <Panel title="Ficheiros do cliente">
            {c.files.length === 0 && <p className="text-sm text-ink-400">Sem ficheiros.</p>}
            <ul className="space-y-1 text-sm">
              {c.files.map((f) => (
                <li key={f.id}>
                  <a className="underline" href={`/api/admin/files?kind=upload&id=${f.id}`} target="_blank">{f.originalName}</a>{" "}
                  <span className="text-xs text-ink-400">{f.kind === "NOTIFICATION" ? "notificação" : "complementar"} · {Math.round(f.size / 1024)} KB</span>
                </li>
              ))}
            </ul>
          </Panel>

          {admin.role === "ADMIN" && !c.anonymizedAt && (
            <Panel title="RGPD — eliminar dados">
              <form action={anonymizeAction.bind(null, id)} className="space-y-2 text-sm">
                <p className="text-ink-500">Elimina ficheiros e documentos e anonimiza os dados pessoais. Irreversível.</p>
                <input name="confirm" className="input" placeholder="Escreva ELIMINAR" />
                <button className="btn btn-danger w-full">Eliminar dados</button>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function CaseDataView({ d }: { d: CaseData }) {
  const r = d.requerente;
  const groups: [string, [string, string | number | undefined][]][] = [
    [
      "Requerente",
      r.tipo === "SINGULAR"
        ? [["Nome", r.nome], ["NIF", r.nif], ["Documento", `${r.doc_tipo} ${r.doc_numero}`], ["Validade", r.doc_validade]]
        : [["Denominação", r.denominacao], ["NIPC", r.nipc]],
    ],
    ["Contactos", [["Morada", `${r.morada}, ${r.codigo_postal} ${r.localidade}`], ["Email", r.email], ["Telefone", r.telefone]]],
    ...(d.representante
      ? ([["Representante", [["Nome", d.representante.nome], ["NIF", d.representante.nif], ["Cargo", d.representante.cargo]]]] as [string, [string, string][]][])
      : []),
    [
      "Veículo e intervenientes",
      [
        ["Matrícula", d.veiculo.matricula],
        ["Marca/modelo", d.veiculo.marca_modelo],
        ["Titular", d.titular.e_requerente ? "O requerente" : `${d.titular.nome ?? ""} ${d.titular.nif ?? ""}`],
        ["Condutor", d.condutor.identificacao === "OUTRA_PESSOA" ? `${d.condutor.nome} ${d.condutor.nif ?? ""}` : CONDUTOR_OPCOES[d.condutor.identificacao]],
      ],
    ],
    [
      "Infração",
      [
        ["Auto n.º", d.infracao.numero_auto],
        ["Data/hora", `${d.infracao.data} ${d.infracao.hora ?? ""}`],
        ["Local", d.infracao.local],
        ["Via / deteção", `${d.infracao.tipo_via} / ${d.infracao.meio_detecao}`],
        ["Velocidades (máx/reg/cons)", `${d.infracao.velocidade_maxima} / ${d.infracao.velocidade_registada ?? "—"} / ${d.infracao.velocidade_considerada}`],
        ["Entidade autuante", d.infracao.entidade_autuante === "OUTRA" ? d.infracao.entidade_autuante_outra : ENTIDADES_AUTUANTES[d.infracao.entidade_autuante]],
        ["Notificação / receção", `${d.infracao.data_notificacao ?? "—"} / ${d.infracao.data_rececao}`],
      ],
    ],
    ["Informação adicional", [["Descrição", d.adicional?.descricao], ["Observações", d.adicional?.observacoes]]],
  ];
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {groups.map(([title, rows]) => (
        <div key={title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
          <dl className="space-y-1 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                <dt className="text-ink-500">{k}</dt>
                <dd className="whitespace-pre-wrap break-words">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
