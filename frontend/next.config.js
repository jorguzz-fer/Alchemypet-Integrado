/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // A proposta comercial é uma página estática própria, servida fora do
  // painel (sem login e sem o shell). O rewrite dá a ela a URL limpa
  // /integrado, mantendo o arquivo em public/.
  async rewrites() {
    return [{ source: '/integrado', destination: '/integrado.html' }];
  },
};

module.exports = nextConfig;
