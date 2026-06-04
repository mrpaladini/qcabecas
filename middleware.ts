import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// Middleware usa apenas a config Edge-compatible (sem Prisma/bcrypt)
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    "/aluno/:path*",
    "/professor/:path*",
    "/coordenador/:path*",
  ],
}
