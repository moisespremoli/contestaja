import { SiteHeader } from "@/components/site";
import { db } from "@/lib/db";
import { Wizard } from "./wizard";

export const metadata = { title: "Preparar contestação" };
export const dynamic = "force-dynamic";

export default async function ContestarPage() {
  const category = await db.infractionCategory.findUnique({ where: { code: "EXCESSO_VELOCIDADE" } });
  const priceLabel = category
    ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(category.priceCents / 100)
    : "—";
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-ink-50/60 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto mb-8 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contestação — excesso de velocidade</h1>
          <p className="mt-2 text-ink-500">Tenha a notificação consigo. Os seus dados são encriptados e usados apenas para preparar o documento.</p>
        </div>
        <Wizard priceLabel={priceLabel} />
      </main>
    </>
  );
}
