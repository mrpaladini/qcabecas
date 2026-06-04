import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

// Em dev: unsafe-eval necessário para React source maps e Turbopack
// Em prod: eval() bloqueado — React nunca usa eval em produção
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "310mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS apenas em produção (localhost não tem HTTPS)
          ...(isDev ? [] : [
            { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          ]),
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
