import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteção de ambiente de teste: com SITE_BASIC_AUTH="utilizador:palavra-passe" todo o site pede credenciais
 * (exceto os pedidos servidor-a-servidor dos pagamentos e a verificação de saúde).
 */
function basicAuthBlocked(request: NextRequest) {
  const expected = process.env.SITE_BASIC_AUTH;
  const { pathname } = request.nextUrl;
  if (!expected || pathname.startsWith("/api/payments/") || pathname === "/api/health") return false;
  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  return !(scheme === "Basic" && value && atob(value) === expected);
}

export function proxy(request: NextRequest) {
  if (basicAuthBlocked(request)) {
    return new NextResponse("Acesso restrito (ambiente de teste).", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="ContestaJa (teste)", charset="UTF-8"' },
    });
  }
  // Verificação otimista: sem cookie de sessão, redireciona para o login. A autorização real é feita no servidor.
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !request.cookies.has("cj_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
