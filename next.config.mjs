/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Use the compiler API so type checking also works in restricted workspaces.
  experimental: { useTypeScriptCli: false },
  allowedDevOrigins: ['192.168.0.61'],
};
export default nextConfig;
