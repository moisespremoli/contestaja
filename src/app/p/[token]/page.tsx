import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { addBusinessDays } from "@/modules/cases/derive";
import {
  caseData,
  documentDownloadUrl,
  hashAccessToken,
  missingRequiredFields,
  STATUS_LABELS,
  syncPendingPayments,
} from "@/modules/cases/service";
import { catalogField } from "@/modules/fields/catalog";
import { formatDateLong } from "@/modules/fields/format";
import { getPaymentProvider, METHOD_LABELS } from "@/modules/payments";
import { cancelPaymentAction, completeFieldsAction, payAction } from "./actions";
import { AutoRefresh, MissingFieldsForm, PaymentForm } from "./client";

export const metadata = { title: "O seu processo", robots: { index: false } };
export const dynamic = "force-dynamic";

const eur = (c: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(c / 100);

/** Campos derivados não podem ser editados pelo cliente. */
const DERIVED = /(^calc\.|^flags\.|^minuta\.|_extenso$|nome_efetivo$|morada_completa$|nome_ou_denominacao$)/;

export default async function CasePage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const found = await db.case.findUnique({ where: { accessTokenHash: hashAccessToken(token) }, select: { id: true, status: true } });
  // Consulta ativa do gateway (MB WAY) enquanto o cliente aguarda — complementa o callback.
  if (found?.status === "AWAITING_PAYMENT") await syncPendingPayments(found.id);
  const c = await db.case.findUnique({
    where: { accessTokenHash: hashAccessToken(token) },
    include: {
      category: true,
      payments: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c || c.anonymizedAt) notFound();

  const data = caseData(c);
  const missing = c.status === "AWAITING_PAYMENT" ? await missingRequiredFields(c) : [];
  const editable = missing.filter((m) => !DERIVED.test(m.sourcePath));
  const pending = c.payments.find((p) => p.status === "PENDING");
  const doc = c.documents[0];
  const deadline =
    c.category.defenseDeadlineDays && data.infracao.data_rececao
      ? addBusinessDays(data.infracao.data_rececao, c.category.defenseDeadlineDays)
      : null;
  const pay = payAction.bind(null, token);
  const cancelPayment = cancelPaymentAction.bind(null, token);
  const provider = getPaymentProvider();
  const complete = completeFieldsAction.bind(null, token);
  const instructions = pending?.instructions as
    | { entity?: string; reference?: string; expiresAt?: string; phoneMasked?: string; redirectUrl?: string; message: string }
    | undefined;

  const timeline = [
    { label: "Dados recebidos", done: true },
    { label: "Minuta identificada", done: !!c.templateVersionId && c.status !== "REJECTED_NO_TEMPLATE" },
    { label: "Pagamento confirmado", done: c.payments.some((p) => p.status === "CONFIRMED") },
    { label: "Documento entregue", done: c.status === "DELIVERED" || c.status === "DOCUMENT_GENERATED" },
  ];

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-ink-50/60 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-ink-500">Processo</p>
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{c.reference}</h1>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-ink-700 ring-1 ring-ink-200">
              {STATUS_LABELS[c.status]}
            </span>
          </div>

          <ol className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {timeline.map((t) => (
              <li key={t.label} className="flex items-center gap-2 text-sm">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${t.done ? "bg-brand-500 text-ink-950" : "bg-ink-100 text-ink-400"}`}>
                  {t.done ? "✓" : "•"}
                </span>
                <span className={t.done ? "text-ink-900" : "text-ink-400"}>{t.label}</span>
              </li>
            ))}
          </ol>

          {c.status === "REJECTED_NO_TEMPLATE" && (
            <section className="card space-y-3 p-6">
              <h2 className="text-lg font-semibold">Não existe uma minuta adequada ao seu caso</h2>
              <p className="text-ink-600">
                De acordo com os dados indicados, a nossa biblioteca não tem, de momento, uma minuta aprovada para este tipo de
                situação. Não geramos contestações genéricas, por isso <b>não foi cobrado qualquer valor</b>.
              </p>
              <p className="text-sm text-ink-500">
                O pedido ficou registado para análise. Recomendamos que confirme o prazo para apresentar defesa indicado na notificação.
              </p>
            </section>
          )}

          {c.status === "AWAITING_REVIEW" && !c.payments.some((p) => p.status === "CONFIRMED") && (
            <section className="card p-6">
              <h2 className="text-lg font-semibold">O seu processo está em análise</h2>
              <p className="mt-2 text-ink-600">Precisamos de confirmar qual a minuta adequada. Receberá um email assim que puder avançar para o pagamento.</p>
            </section>
          )}

          {c.status === "AWAITING_PAYMENT" && editable.length > 0 && (
            <section className="card space-y-4 p-6">
              <h2 className="text-lg font-semibold">Faltam alguns dados</h2>
              <p className="text-sm text-ink-500">A minuta aplicável ao seu caso exige os seguintes dados adicionais.</p>
              <MissingFieldsForm
                action={complete}
                fields={editable.map((m) => ({
                  path: m.sourcePath,
                  label: catalogField(m.sourcePath)?.label ?? m.sourcePath,
                  type: catalogField(m.sourcePath)?.type ?? "text",
                }))}
              />
            </section>
          )}

          {c.status === "AWAITING_PAYMENT" && missing.length > editable.length && (
            <section className="card p-6 text-sm text-ink-600">Alguns dados necessários terão de ser confirmados pela nossa equipa. Será contactado por email.</section>
          )}

          {c.status === "AWAITING_PAYMENT" && missing.length === 0 && (
            <section className="card space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold">Existe uma minuta adequada ao seu caso</h2>
                <p className="mt-1 text-ink-600">
                  Conclua o pagamento de <b>{eur(c.category.priceCents)}</b> para gerar o documento. O PDF só é disponibilizado após a confirmação do pagamento.
                </p>
              </div>
              {pending && instructions ? (
                <div className="space-y-4 rounded-2xl bg-ink-50 p-5">
                  <AutoRefresh />
                  <p className="font-medium">{METHOD_LABELS[pending.method]} — a aguardar confirmação</p>
                  {instructions.entity && (
                    <dl className="grid grid-cols-[100px_1fr] gap-1 font-mono text-sm">
                      <dt className="text-ink-500">Entidade</dt><dd>{instructions.entity}</dd>
                      <dt className="text-ink-500">Referência</dt><dd>{instructions.reference}</dd>
                      <dt className="text-ink-500">Valor</dt><dd>{eur(pending.amountCents)}</dd>
                    </dl>
                  )}
                  {instructions.phoneMasked && <p className="text-sm">Pedido enviado para {instructions.phoneMasked}.</p>}
                  <p className="text-sm text-ink-600">{instructions.message}</p>
                  {env.paymentProvider === "mock" && instructions.redirectUrl && (
                    <Link href={`${instructions.redirectUrl}?back=/p/${token}`} className="btn btn-ghost text-xs">
                      [Desenvolvimento] Simular resposta do gateway
                    </Link>
                  )}
                  {env.paymentProvider !== "mock" && pending.method === "CARD" && instructions.redirectUrl && (
                    <a href={instructions.redirectUrl} className="btn btn-primary">Continuar para a página de pagamento</a>
                  )}
                  <p className="text-xs text-ink-400">Esta página atualiza automaticamente.</p>
                  <form action={cancelPayment}>
                    <button className="text-xs text-ink-500 underline">Escolher outro método de pagamento</button>
                  </form>
                </div>
              ) : (
                <PaymentForm action={pay} priceLabel={eur(c.category.priceCents)} methods={provider.methods} />
              )}
            </section>
          )}

          {(c.status === "PAYMENT_CONFIRMED" || (c.status === "AWAITING_REVIEW" && c.payments.some((p) => p.status === "CONFIRMED"))) && (
            <section className="card p-6">
              <AutoRefresh everyMs={8000} />
              <h2 className="text-lg font-semibold">Pagamento confirmado</h2>
              <p className="mt-2 text-ink-600">
                {c.status === "AWAITING_REVIEW"
                  ? "O seu documento está a ser verificado pela nossa equipa antes da entrega. Receberá um email assim que estiver pronto."
                  : "Estamos a preparar o seu documento…"}
              </p>
            </section>
          )}

          {doc && (c.status === "DELIVERED" || c.status === "DOCUMENT_GENERATED") && (
            <section className="card space-y-5 p-6">
              <h2 className="text-lg font-semibold">O seu documento está pronto</h2>
              <a href={documentDownloadUrl(doc.id, "pdf", 1)} className="btn btn-primary">
                Descarregar PDF
              </a>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Antes de apresentar</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Verifique cuidadosamente todos os dados do documento.</li>
                  <li>Imprima e assine o documento (não contém assinatura).</li>
                  <li>Apresente-o à entidade indicada no documento/notificação — a apresentação é da sua responsabilidade.</li>
                  <li>
                    Confirme o prazo legal na notificação.
                    {deadline && <> Prazo meramente indicativo calculado: <b>{formatDateLong(deadline)}</b> (não considera feriados).</>}
                  </li>
                  <li>A preparação do documento não garante o deferimento da defesa.</li>
                </ul>
              </div>
            </section>
          )}

          <p className="text-center text-xs text-ink-400">
            Este link é pessoal. Não o partilhe. Os seus dados são conservados de acordo com a nossa{" "}
            <Link href="/privacidade" className="underline">política de privacidade</Link>.
          </p>
        </div>
      </main>
    </>
  );
}
