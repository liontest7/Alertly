/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    turbo: {
      resolveAlias: {
        pg: { browser: './lib/browser-empty.js' },
        'pg-native': { browser: './lib/browser-empty.js' },
        '@prisma/client': { browser: './lib/browser-empty.js' },
        '@prisma/adapter-pg': { browser: './lib/browser-empty.js' },
      },
    },
  },
  allowedDevOrigins: ['*.pike.replit.dev', '*.sisko.replit.dev', '*.replit.dev'],
  devIndicators: {
    buildActivity: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        net: false,
        tls: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        pg: false,
        'pg-native': false,
        '@prisma/client': false,
      };
    }
    return config;
  },
  transpilePackages: ['@solana/wallet-adapter-react', '@solana/wallet-adapter-react-ui', '@solana/wallet-adapter-base', '@solana/wallet-adapter-wallets'],
}

export default nextConfig
