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
  // 開発環境用の設定
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
};

export default nextConfig; 