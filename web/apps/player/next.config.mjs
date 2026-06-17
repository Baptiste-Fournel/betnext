/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages internes du monorepo sont livrés en TypeScript (pas de build) → Next les transpile.
  transpilePackages: ['@betnext/ui', '@betnext/api-contract'],
};
export default nextConfig;
