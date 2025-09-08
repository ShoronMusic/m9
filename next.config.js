import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  staticPageGenerationTimeout: 0,
  output: 'standalone',
  images: {
    unoptimized: true,
    path: '/images',
    domains: ['xs867261.xsrv.jp'],
  },
  transpilePackages: ["undici"],
  pageExtensions: ['jsx', 'js', 'tsx', 'ts'],
  env: {
    DATA_DIR: process.env.NODE_ENV === 'production' 
      ? 'https://xs867261.xsrv.jp/data/data'
      : `file://${path.join(process.cwd(), 'public', 'data')}`,
    REMOTE_DATA_URL: 'https://xs867261.xsrv.jp/data/data',
    IMAGES_DIR: path.join(process.cwd(), 'public', 'images'),
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
        net: false,
        tls: false,
        http2: false,
        child_process: false,
      };
    }
    return config;
  },
  compress: true,
  poweredByHeader: false,
  swcMinify: true,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@mui/icons-material',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
      'date-fns',
      'lodash',
      'react-icons'
    ],
    missingSuspenseWithCSRBailout: false,
  },
  // キャッシュ設定を追加
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Vercelの警告を解決するための設定
  trailingSlash: false,
  // 静的ファイルのルーティングを優先
  async rewrites() {
    return [
      {
        source: '/googledeedf735df5190d2.html',
        destination: '/googledeedf735df5190d2.html',
      },
    ];
  },
  // 静的ファイルの配信を確実にする
  async redirects() {
    return [
      {
        source: '/googledeedf735df5190d2.html/1',
        destination: '/googledeedf735df5190d2.html',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.spotify.com https://open.spotify.com https://sdk.scdn.co https://www.googletagmanager.com https://www.google-analytics.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https: https://fonts.gstatic.com; connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://www.google-analytics.com https://analytics.google.com; frame-src https://accounts.spotify.com https://sdk.scdn.co;"
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ]
      }
    ];
  }
};

export default nextConfig;