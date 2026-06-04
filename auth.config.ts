import type { NextAuthConfig } from "next-auth"

// Configuração Edge-compatible — sem Prisma, sem bcryptjs
// Usada pelo middleware (Edge Runtime) para verificar sessões e proteger rotas
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const role = (auth?.user as any)?.role as string | undefined
      const pathname = nextUrl.pathname

      // Rotas públicas — sempre permitidas
      const isPublicPath =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon")

      if (isPublicPath) return true

      // Sem sessão → redirecionar para login
      if (!isLoggedIn) return false

      // Verificar role por prefixo
      if (pathname.startsWith("/coordenador") && role !== "COORDENADOR") return false
      if (pathname.startsWith("/professor") && role !== "PROFESSOR") return false
      if (pathname.startsWith("/aluno") && role !== "ALUNO") return false

      return true
    },
    jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  providers: [], // Providers definidos em lib/auth.ts (Node.js only)
}
