This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Banco de dados (produção — Hostinger)

O banco de produção é um MySQL hospedado na Hostinger, no mesmo servidor da aplicação.

| Item | Valor |
|---|---|
| Host | `127.0.0.1` |
| Porta | `3306` |
| Banco | `u677463664_qcdb` |
| Usuário | `u677463664_qcadmin` |
| Senha | não fica no repositório — ver `env_hostinger.txt` (local) ou hPanel → Bancos de dados |
| phpMyAdmin | https://auth-db812.hstgr.io/index.php?route=/database/structure&db=u677463664_qcdb |

String de conexão (variável `DATABASE_URL` nas variáveis de ambiente do site no hPanel):

```
mysql://u677463664_qcadmin:SENHA_CODIFICADA@127.0.0.1:3306/u677463664_qcdb
```

- Caracteres especiais da senha precisam ser codificados na URL (`!` → `%21`, `@` → `%40`).
- `127.0.0.1` só funciona para a aplicação rodando na Hostinger. Para acessar do computador
  local (ex.: `npx prisma db pull`), libere o IP em hPanel → Bancos de dados → MySQL remoto
  e use o host remoto informado lá.
- Para levar dados do banco local: gere `qcabecas_export.sql` com `exportar-banco.bat` e
  importe pelo phpMyAdmin no banco `u677463664_qcdb`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
