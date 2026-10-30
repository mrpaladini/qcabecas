import Link from "next/link"

// Destino de quem tenta abrir uma área que não é do seu perfil
export default function AcessoNegado() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <p className="text-4xl mb-3" aria-hidden="true">🔒</p>
        <h1 className="text-xl font-bold text-neutral-900">Acesso não permitido</h1>
        <p className="text-neutral-500 mt-2 text-sm">Esta área não está disponível para o seu perfil de acesso.</p>
        <Link href="/dashboard"
          className="inline-block mt-6 bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 text-sm">
          Ir para minha área
        </Link>
      </div>
    </div>
  )
}
