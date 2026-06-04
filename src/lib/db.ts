import { PrismaClient } from "@prisma/client"

// Padrão singleton para evitar múltiplas conexões durante hot reload em desenvolvimento
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // "query" removido — logs de queries expõem emails e dados pessoais de alunos (LGPD)
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
