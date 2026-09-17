import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || '5172';
const role = process.env.NEXT_PUBLIC_APP_ROLE || 'default';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Give each server instance its own isolated build directory to prevent concurrent Webpack module ID collision
  distDir: process.env.NODE_ENV === 'production' ? '.next' : `.next-${role}-${port}`,
  reactStrictMode: false,
  transpilePackages: ['lucide-react', 'recharts'],
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
