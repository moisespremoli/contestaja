import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Logo } from "@/components/site";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/request";
import { audit } from "@/modules/audit";
import { createAdminSession, getAdmin } from "@/modules/auth/session";

export const metadata = { title: "Admin · Entrar", robots: { index: false } };
export const dynamic = "force-dynamic";

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

async function login(form: FormData) {
  "use server";
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) redirect("/admin/login?erro=limite");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.adminUser.findUnique({ where: { email } });
  // Comparação sempre executada para não revelar se o email existe.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) {
    await audit({ actorType: "ADMIN", action: "admin.login_failed", entityType: "AdminUser", entityId: email || "-", ip });
    redirect("/admin/login?erro=1");
  }
  await createAdminSession(user.id, user.role);
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorType: "ADMIN", actorId: user.id, action: "admin.login", entityType: "AdminUser", entityId: user.id, ip });
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdmin()) redirect("/admin");
  const { erro } = await searchParams;
  return (
    <main className="grid flex-1 place-items-center bg-ink-950 px-4">
      <form action={login} className="card w-full max-w-sm space-y-5 p-7">
        <Logo />
        <h1 className="text-lg font-semibold">Painel administrativo</h1>
        {erro && (
          <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">
            {erro === "limite" ? "Demasiadas tentativas. Aguarde alguns minutos." : "Credenciais inválidas."}
          </p>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">Palavra-passe</label>
          <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        <button className="btn btn-primary w-full">Entrar</button>
      </form>
    </main>
  );
}
