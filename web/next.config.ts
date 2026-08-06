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
