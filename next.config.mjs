import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// 开发环境初始化
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
