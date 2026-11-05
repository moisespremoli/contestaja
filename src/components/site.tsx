import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ContestaJá — página inicial">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-ink-950">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path d="M5 12.5l4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`text-lg font-semibold tracking-tight ${light ? "text-white" : "text-ink-900"}`}>
        Contesta<span className="text-brand-500">Já</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-100/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-ink-600 md:flex">
          <Link href="/#como-funciona" className="hover:text-ink-900">Como funciona</Link>
          <Link href="/#preco" className="hover:text-ink-900">Preço</Link>
          <Link href="/#faq" className="hover:text-ink-900">Perguntas frequentes</Link>
        </nav>
        <Link href="/contestar" className="btn btn-primary !py-2.5">
          Preparar contestação
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink-100 bg-ink-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-500 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p>Serviço digital de preparação de documentos. Não é um escritório de advogados nem presta consulta jurídica.</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink-800">Informação</p>
          <ul className="space-y-1.5">
            <li><Link href="/privacidade" className="hover:text-ink-900">Política de privacidade</Link></li>
            <li><Link href="/termos" className="hover:text-ink-900">Termos do serviço</Link></li>
            <li><Link href="/#avisos" className="hover:text-ink-900">Avisos legais</Link></li>
          </ul>
        </div>
        <p className="text-xs leading-relaxed">
          A preparação do documento não garante o deferimento da defesa. O cliente deve verificar os dados, assinar e
          apresentar a defesa dentro do prazo legal aplicável.
        </p>
      </div>
      <div className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">© {new Date().getFullYear()} ContestaJá</div>
    </footer>
  );
}
