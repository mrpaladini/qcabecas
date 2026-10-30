import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "../auth.config"

/**
 * Proteção de rotas (Next 16: "proxy", antigo "middleware").
 * Fica em src/ porque o projeto usa a pasta src — o middleware.ts da raiz
 * nunca era carregado pelo Next.
 *
 *  - sem login            → /login (volta para a página pedida depois de entrar)
 *  - perfil errado        → /unauthorized
 *
 * As páginas, as Server Actions e a rota de download também conferem o login
 * por conta própria (defesa em camadas).
 */
const { auth } = NextAuth(authConfig)

const AREA_DO_PERFIL: Array<[prefixo: string, perfil: string]> = [
  ["/coordenador", "COORDENADOR"],
  ["/professor",   "PROFESSOR"],
  ["/aluno",       "ALUNO"],
]

export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const user = req.auth?.user as { role?: string } | undefined

  if (!user) {
    const login = new URL("/login", req.nextUrl)
    login.searchParams.set("callbackUrl", pathname + search)
    return NextResponse.redirect(login)
  }

  const area = AREA_DO_PERFIL.find(([prefixo]) => pathname === prefixo || pathname.startsWith(prefixo + "/"))
  if (area && user.role !== area[1]) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/aluno/:path*",
    "/professor/:path*",
    "/coordenador/:path*",
    "/dashboard/:path*",
  ],
}
