import type { Metadata, Viewport } from "next"
import Image from "next/image"
import Link from "next/link"
import { MainNav } from "@/components/ui/MainNav"
import { UserMenu } from "@/components/ui/UserMenu"
import { auth } from "@/lib/auth"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://qcabecas.com.br"),
  title: "Quebra Cabeças — Inteligência se Aprende",
  description:
    "10 anos transformando o aprendizado. Aulas particulares, reforço escolar e orientação profissional — presenciais e online, para alunos de qualquer lugar.",
  openGraph: {
    title: "Quebra Cabeças — 10 Anos de Educação",
    description: "Aulas particulares, reforço escolar e orientação profissional — presenciais e online, para alunos de qualquer localidade.",
    locale: "pt_BR",
    type: "website",
    images: ["/images/logo-qc10-completo.png"],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
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
      <body className="bg-white text-neutral-900 antialiased overflow-x-hidden">
        {/* Header — Server Component; a navegação (com menu ☰ no celular) é o MainNav */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 h-16">
              {/* Logo */}
              <Link href="/" className="flex items-center shrink-0 hover:opacity-80 transition-opacity" aria-label="Quebra Cabeças — página inicial">
                <Image src="/images/logo-qc10.png" alt="Quebra Cabeças — 10 Anos" width={1001} height={258}
                  priority className="h-9 sm:h-10 w-auto" />
              </Link>

              <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                <MainNav role={user?.role} logado={!!user} />

                {/* Login ou menu do usuário */}
                {user ? (
                  <UserMenu name={user.name ?? "Usuário"} role={user.role ?? ""} />
                ) : (
                  <Link
                    href="/login"
                    className="bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors whitespace-nowrap"
                  >
                    <span className="sm:hidden">Entrar</span>
                    <span className="hidden sm:inline">Entrar no Portal</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer className="bg-neutral-900 text-neutral-400 mt-16 sm:mt-20 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Marca */}
              <div>
                <div className="mb-3 inline-block bg-white rounded-xl px-3 py-2">
                  <Image src="/images/logo-qc10.png" alt="Quebra Cabeças — 10 Anos" width={1001} height={258} className="h-9 w-auto" />
                </div>
                <p className="text-sm">Inteligência se Aprende</p>
                <p className="text-sm mt-1">Aulas presenciais e online — desde 2016</p>
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
                    Sede: R. Fernando Costa, 1051 — Vinhedo, SP
                  </li>
                  <li className="text-xs">Atendemos alunos de qualquer localidade</li>
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
                      href="https://www.facebook.com/quebracabecas/"
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
