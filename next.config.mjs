/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 添加 serverExternalPackages 解决 libsql 兼容性问题
  serverExternalPackages: ["@libsql/client", "libsql"],
}

export default nextConfig
