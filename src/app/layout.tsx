import type { Metadata } from "next"
import Link from "next/link"
import { AniversarioBadge } from "@/components/ui/AniversarioBadge"
import { UserMenu } from "@/components/ui/UserMenu"
import { auth } from "@/lib/auth"
import "./globals.css"

export const metadata: Metadata = {
  title: "Quebra Cabeças — Inteligência se Aprende",
  description:
    "10 anos transformando o aprendizado em Vinhedo, SP. Aulas particulares, reforço escolar e orientação profissional.",
  openGraph: {
    title: "Quebra Cabeças — 10 Anos de Educação",
    description: "Aulas particulares, reforço escolar e orientação profissional em Vinhedo, SP.",
    locale: "pt_BR",
    type: "website",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const user = session?.user as any

  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className="bg-white text-neutral-900 antialiased">
        {/* Header — Server Component, sem 'use client' */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo + Badge */}
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <span className="text-xl font-extrabold text-primary-700 tracking-tight">
                  Quebra Cabeças
                </span>
                <AniversarioBadge size="sm" />
              </Link>

              {/* Navegação */}
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
                {!user && (
                  <>
                    <Link href="/#servicos" className="hover:text-primary-700 transition-colors">Serviços</Link>
                    <Link href="/#contato" className="hover:text-primary-700 transition-colors">Contato</Link>
                  </>
                )}
                {user?.role === "COORDENADOR" && (
                  <>
                    <Link href="/coordenador/agendamentos" className="hover:text-primary-700 transition-colors">Agendamentos</Link>
                    <Link href="/coordenador/alunos" className="hover:text-primary-700 transition-colors">Alunos</Link>
                    <Link href="/coordenador/professores" className="hover:text-primary-700 transition-colors">Professores</Link>
                    <Link href="/coordenador/coordenadores" className="hover:text-primary-700 transition-colors">Coordenadores</Link>
                    <Link href="/coordenador/disciplinas" className="hover:text-primary-700 transition-colors">Disciplinas</Link>
                    <Link href="/coordenador/salas" className="hover:text-primary-700 transition-colors">Salas</Link>
                    <Link href="/coordenador/calendario" className="hover:text-primary-700 transition-colors">Calendário</Link>
                    <Link href="/coordenador/relatorio" className="hover:text-primary-700 transition-colors">Relatório</Link>
                    {/* Dropdown Finanças */}
                    <div className="relative group">
                      <button className="hover:text-primary-700 transition-colors flex items-center gap-1 font-semibold">
                        Finanças <span className="text-xs opacity-60">▾</span>
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-neutral-200 rounded-xl shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 overflow-hidden">
                        <Link href="/coordenador/financas/contas-a-receber"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                          <span>💰</span> Contas a Receber
                        </Link>
                        <Link href="/coordenador/financas/contas-a-pagar"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-700 transition-colors border-t border-neutral-100">
                          <span>💳</span> Contas a Pagar
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </nav>

              {/* Login ou menu do usuário */}
              {user ? (
                <UserMenu name={user.name ?? "Usuário"} role={user.role ?? ""} />
              ) : (
                <Link
                  href="/login"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Entrar no Portal
                </Link>
              )}
            </div>
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer className="bg-neutral-900 text-neutral-400 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Marca */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-white font-bold text-lg">Quebra Cabeças</span>
                  <AniversarioBadge size="sm" />
                </div>
                <p className="text-sm">Inteligência se Aprende</p>
                <p className="text-sm mt-1">Vinhedo, SP — desde 2016</p>
              </div>

              {/* Contato */}
              <div>
                <h3 className="text-white font-semibold mb-3">Contato</h3>
                <ul className="space-y-1 text-sm">
                  <li>
                    <a href="tel:+5519999663378" className="hover:text-white transition-colors">
                      (19) 99966-3378
                    </a>
                  </li>
                  <li>
                    <a href="mailto:atendimento@qcabecas.com.br" className="hover:text-white transition-colors">
                      atendimento@qcabecas.com.br
                    </a>
                  </li>
                  <li className="text-xs mt-2">
                    R. Fernando Costa, 1051 — Vinhedo, SP
                  </li>
                </ul>
              </div>

              {/* Redes sociais */}
              <div>
                <h3 className="text-white font-semibold mb-3">Redes Sociais</h3>
                <ul className="space-y-1 text-sm">
                  <li>
                    <a
                      href="https://www.instagram.com/qcabecas/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Instagram @qcabecas
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.facebook.com/quebracabecasoficial/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Facebook
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-neutral-800 mt-8 pt-6 text-xs text-center">
              © {new Date().getFullYear()} Quebra Cabeças — Todos os direitos reservados
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
