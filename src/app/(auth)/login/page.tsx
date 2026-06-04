import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import { AniversarioBadge } from "@/components/ui/AniversarioBadge"

// Server Action de login — processa no servidor, sem expor lógica ao cliente
async function loginAction(formData: FormData) {
  "use server"

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await signIn("credentials", {
      email,
      password,
      // O middleware redireciona para o dashboard correto baseado no role após autenticação
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return redirect("/login?error=credenciais-invalidas")
    }
    // Re-lançar erros de redirect (comportamento esperado do Next.js)
    throw error
  }
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

// Server Component — searchParams é Promise no Next.js 16+
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const hasError = !!params.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-8 w-full max-w-md">
        {/* Logo e badge de 10 anos */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-2xl font-extrabold text-primary-700 tracking-tight">
              Quebra Cabeças
            </span>
            <AniversarioBadge size="sm" />
          </div>
          <p className="text-neutral-500 text-sm">Acesse o portal educacional</p>
        </div>

        {/* Mensagem de erro — exibida quando credenciais inválidas */}
        {hasError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm"
          >
            E-mail ou senha inválidos. Verifique seus dados e tente novamente.
          </div>
        )}

        {/* Formulário — action é uma Server Action, sem fetch no cliente */}
        <form action={loginAction} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700 mb-1.5"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-700 mb-1.5"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition-colors text-sm mt-2"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-400">
          Problemas para acessar?{" "}
          <a
            href="https://wa.me/5519999663378"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            Fale conosco
          </a>
        </p>
      </div>
    </div>
  )
}
