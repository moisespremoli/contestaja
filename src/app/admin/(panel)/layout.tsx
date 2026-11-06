import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site";
import { destroyAdminSession, requireAdmin } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await destroyAdminSession();
  redirect("/admin/login");
}

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/processos", label: "Processos" },
  { href: "/admin/minutas", label: "Minutas" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/cupoes", label: "Cupões" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col bg-ink-50 md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-ink-950 p-5 text-ink-200 md:w-60">
        <Logo light />
        <nav className="flex gap-1 overflow-x-auto text-sm md:flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden text-xs md:block">
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-ink-400">{user.email} · {user.role}</p>
          <form action={logout}>
            <button className="mt-3 text-ink-300 underline hover:text-white">Terminar sessão</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
