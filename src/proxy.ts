import { NextResponse, type NextRequest } from "next/server";

/** Verificação otimista: sem cookie de sessão, redireciona para o login. A autorização real é feita no servidor. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !request.cookies.has("cj_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
