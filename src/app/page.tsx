import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  const servicos = [
    {
      icon: "📚",
      title: "Aulas Particulares",
      desc: "Resolução de dúvidas e preparação para avaliações com professores especialistas na disciplina.",
    },
    {
      icon: "🎯",
      title: "Reforço Escolar",
      desc: "Acompanhamento semanal focado no conteúdo da escola do aluno, com relatório de evolução.",
    },
    {
      icon: "✏️",
      title: "Lição de Casa",
      desc: "Orientação diária para criação de hábitos de estudo consistentes e duradouros.",
    },
    {
      icon: "🧭",
      title: "Orientação Profissional",
      desc: "Apoio especializado na escolha da carreira certa após o ensino médio.",
    },
  ]

  const depoimentos = [
    {
      nome: "Ana Paula, responsável",
      texto: "Minha filha melhorou mais em 3 meses de reforço do que em um ano tentando sozinha. A equipe é atenciosa e os professores são ótimos.",
    },
    {
      nome: "Lucas, aluno do 3º EM",
      texto: "A orientação profissional me ajudou a entender o que eu realmente queria para o meu futuro. Passei no vestibular com confiança.",
    },
    {
      nome: "Fernanda, responsável",
      texto: "O acompanhamento da lição de casa fez toda a diferença. Meu filho chegou a ver o estudo como algo prazeroso — algo impensável antes.",
    },
  ]

  return (
    <>
      {/* Hero — banner como fundo, conteúdo sobre a área clara */}
      <section className="relative overflow-hidden bg-white">
        {/* Tablet/notebook: banner como fundo */}
        <Image
          src="/images/banner-qc10.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hidden sm:block object-cover object-bottom"
        />
        {/* véu para garantir leitura do texto sobre o banner */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-b from-white/95 via-white/70 to-transparent" aria-hidden="true" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6 sm:pt-14 sm:pb-64 lg:pb-80 text-center">
          <Image
            src="/images/logo-qc10-completo.png"
            alt="Quebra Cabeças — 10 Anos. Celebrando 10 anos de educação que inspira, acolhe e transforma."
            width={1185}
            height={317}
            priority
            className="mx-auto w-full max-w-lg h-auto"
          />
          <h1 className="mt-6 sm:mt-8 text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-neutral-900">
            10 Anos Transformando<br className="hidden sm:block" /> o Aprendizado
          </h1>
          <p className="mt-5 text-base sm:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Na Quebra Cabeças, o aluno é o protagonista. Aulas particulares, reforço escolar e
            orientação profissional para todas as etapas escolares — do fundamental ao vestibular.
            <span className="block mt-2 font-semibold text-primary-700">
              Aulas presenciais e online: atendemos alunos de qualquer localidade.
            </span>
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/login"
              className="bg-primary-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-700 transition-colors shadow-lg"
            >
              Acessar o Portal
            </Link>
            <a
              href="https://wa.me/5519999663378?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20as%20aulas"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/90 border-2 border-primary-600 text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-colors"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>

        {/* Celular: banner inteiro abaixo do texto */}
        <Image
          src="/images/banner-qc10.jpg"
          alt=""
          width={1536}
          height={654}
          sizes="100vw"
          className="sm:hidden w-full h-auto"
        />
      </section>

      {/* Estatísticas */}
      <section className="bg-primary-800 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { valor: "10+", label: "Anos de experiência" },
              { valor: "500+", label: "Alunos atendidos" },
              { valor: "4", label: "Serviços especializados" },
              { valor: "100%", label: "Foco no aluno" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-extrabold text-anniversary-400">{stat.valor}</div>
                <div className="text-xs sm:text-sm text-primary-200 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="py-14 sm:py-20 px-4 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">Nossos Serviços</h2>
            <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
              Soluções completas de apoio educacional para estudantes de todas as etapas escolares.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {servicos.map((s) => (
              <div
                key={s.title}
                className="bg-white rounded-2xl p-6 border border-neutral-100 hover:shadow-lg transition-shadow"
              >
                <span className="text-4xl" aria-hidden="true">{s.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-14 sm:py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900">O que dizem nossos alunos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {depoimentos.map((d) => (
              <blockquote key={d.nome} className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6">
                <p className="text-neutral-700 leading-relaxed italic">"{d.texto}"</p>
                <footer className="mt-4 text-sm font-semibold text-primary-700">— {d.nome}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="py-14 sm:py-20 px-4 bg-primary-700">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold">Pronto para começar?</h2>
          <p className="mt-4 text-primary-100 text-lg">
            Entre em contato e marque uma conversa. O primeiro passo para o aprendizado começa aqui.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/5519999663378"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-colors"
            >
              WhatsApp: (19) 99966-3378
            </a>
            <a
              href="mailto:atendimento@qcabecas.com.br"
              className="border-2 border-white text-white font-semibold px-6 sm:px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors break-all"
            >
              atendimento@qcabecas.com.br
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
