import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Sin esto, Turbopack detecta el package-lock.json suelto en el home del
  // usuario (fuera de este repo) y confunde la raiz del workspace, buscando
  // node_modules en el lugar equivocado ("Cannot find module 'next-intl'").
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Next trunca el body de los requests proxeados a 10MB por default. Los
  // APKs reales superan eso facil, asi que subimos el limite por encima
  // de FORENSE_MAX_FILE_SIZE del backend (100MB por default) para que el
  // backend sea el que decide si el archivo es demasiado grande, no Next.
  experimental: {
    proxyClientMaxBodySize: "500mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
