import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site";
import { db } from "@/lib/db";

export const revalidate = 300;

async function getPrice() {
  try {
    const c = await db.infractionCategory.findUnique({ where: { code: "EXCESSO_VELOCIDADE" } });
    return c?.priceCents ?? null;
  } catch {
    return null;
  }
}

const eur = (cents: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

const steps = [
  { t: "Indique os dados da multa", d: "Responda a um formulário simples, guiado passo a passo. Demora cerca de 5 minutos." },
  { t: "Verificamos a minuta adequada", d: "O sistema identifica, na nossa biblioteca de minutas validadas, a que corresponde ao seu caso." },
  { t: "Pague de forma segura", d: "MB WAY, cartão bancário ou referência Multibanco." },
  { t: "Receba o PDF pronto", d: "Documento personalizado para rever, imprimir, assinar e apresentar à entidade competente." },
];

const faqs = [
  {
    q: "A contestação garante que a multa é anulada?",
    a: "Não. Preparamos um documento personalizado a partir de minutas previamente elaboradas. A decisão cabe sempre à entidade competente e nenhum resultado pode ser garantido.",
  },
  {
    q: "Quem apresenta a defesa?",
    a: "O próprio cliente. Depois de rever, imprimir e assinar o documento, é o cliente que o apresenta à entidade indicada, dentro do prazo legal. Não submetemos documentos em seu nome.",
  },
  {
    q: "E se o meu caso não tiver uma minuta adequada?",
    a: "Não geramos contestações genéricas. Se não existir uma minuta compatível com o seu caso, é informado antes de qualquer pagamento.",
  },
  {
    q: "Posso contestar em nome de uma empresa?",
    a: "Sim. No início do formulário escolhe se apresenta a defesa em nome pessoal ou em nome de uma empresa, através do seu representante legal.",
  },
  {
    q: "Qual é o prazo para apresentar a defesa?",
    a: "O prazo conta a partir da notificação e depende do procedimento aplicável. Indicamos um prazo meramente indicativo, mas deve confirmá-lo sempre na notificação que recebeu.",
  },
  {
    q: "Como são tratados os meus dados?",
    a: "Os dados são encriptados, guardados em armazenamento privado e utilizados apenas para preparar o seu documento, sendo eliminados de acordo com a nossa política de conservação.",
  },
];

export default async function Home() {
  const price = await getPrice();
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink-950 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(60%_60%_at_80%_0%,#10b98155,transparent),radial-gradient(40%_50%_at_0%_100%,#3b82f633,transparent)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-400">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Contraordenações rodoviárias · Portugal
              </p>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
                Recebeu uma multa por excesso de velocidade? Prepare a sua contestação online.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
                Preencha os dados da sua multa e receba uma minuta de contestação personalizada, pronta para rever,
                assinar e apresentar.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/contestar" className="btn btn-accent px-7 py-4 text-base">
                  Preparar a minha contestação
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z" />
                  </svg>
                </Link>
                <span className="text-sm text-ink-300">Sem registo · cerca de 5 minutos</span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="rotate-1 rounded-2xl bg-white p-6 text-ink-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-ink-100 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-ink-400">Processo</p>
                    <p className="font-mono text-sm font-semibold">CJ-2026-7KQ2MD</p>
                  </div>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Documento pronto</span>
                </div>
                <ul className="mt-4 space-y-3 text-sm">
                  {["Dados da infração verificados", "Minuta compatível identificada", "Pagamento confirmado", "PDF gerado"].map((s) => (
                    <li key={s} className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-ink-950">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
                          <path d="M5 12.5l4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-ink-50 p-3">
                  <span className="grid h-10 w-9 place-items-center rounded-md bg-red-500 text-[10px] font-bold text-white">PDF</span>
                  <div className="text-sm">
                    <p className="font-medium">Defesa_CJ-2026-7KQ2MD.pdf</p>
                    <p className="text-ink-400">Pronto para rever e assinar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="border-b border-ink-100 bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
            {[
              ["Minutas previamente elaboradas", "Biblioteca privada, revista por profissionais jurídicos."],
              ["Dados protegidos", "Encriptação e armazenamento privado, em conformidade com o RGPD."],
              ["Pagamento seguro", "MB WAY, cartão ou Multibanco."],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-ink-500">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Como funciona</h2>
          <p className="mt-3 max-w-2xl text-ink-500">Um processo simples, totalmente online, sem necessidade de contactar ninguém.</p>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.t} className="card p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Preço */}
        <section id="preco" className="scroll-mt-20 bg-ink-50">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Preço simples e transparente</h2>
              <p className="mt-3 text-ink-500">
                Paga apenas se existir uma minuta adequada ao seu caso. Se não existir, é informado antes de qualquer pagamento.
              </p>
            </div>
            <div className="card p-8">
              <p className="text-sm font-medium text-ink-500">Contestação — excesso de velocidade</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight">
                {price != null ? eur(price) : "—"}
                <span className="ml-2 text-base font-normal text-ink-400">IVA incluído</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-600">
                {[
                  "Minuta personalizada com os seus dados",
                  "Documento em PDF pronto a imprimir e assinar",
                  "Envio por email e área privada de download",
                  "Pessoa singular ou empresa",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-brand-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/contestar" className="btn btn-primary mt-8 w-full py-3.5">
                Preparar a minha contestação
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-8 divide-y divide-ink-100 border-y border-ink-100">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-xl text-ink-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-500">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Avisos */}
        <section id="avisos" className="scroll-mt-20 border-t border-ink-100 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-lg font-semibold">Avisos legais</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-500">
              <li>O ContestaJá prepara um documento personalizado com base nos dados fornecidos pelo cliente e em minutas previamente elaboradas.</li>
              <li>O cliente deve verificar todos os dados antes de assinar o documento.</li>
              <li>A apresentação da defesa é da responsabilidade do cliente, salvo contratação expressa de outro serviço.</li>
              <li>Os prazos legais devem ser verificados pelo cliente na notificação recebida.</li>
              <li>A preparação do documento não garante o deferimento da defesa nem a anulação da coima.</li>
              <li>O ContestaJá não presta consulta jurídica nem representa o cliente perante qualquer entidade.</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
