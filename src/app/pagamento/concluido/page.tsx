import { SiteHeader } from "@/components/site";

export const metadata = { title: "Pagamento", robots: { index: false } };

export default function PagamentoConcluido() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-16">
        <div className="card space-y-3 p-6">
          <h1 className="text-xl font-semibold">Pagamento processado</h1>
          <p className="text-ink-600">
            Volte à sua área do processo através do link que recebeu por email para acompanhar o estado. Assim que o pagamento for
            confirmado, receberá também o documento por email.
          </p>
        </div>
      </main>
    </>
  );
}
