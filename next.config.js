/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure we can handle redirects if necessary
  async redirects() {
    return [
      {
        source: '/',
        destination: '/lessons',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
