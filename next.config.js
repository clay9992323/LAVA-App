/** @type {import('next').NextConfig} */
const nextConfig = {
  // For Firebase Hosting static export (uncomment the next line when deploying)
  // output: 'export',
  // distDir: 'out',
  
  // Disable file system caching to avoid OneDrive issues
  experimental: {
    outputFileTracingRoot: undefined,
    esmExternals: false,
  },
  // Disable build optimization that can cause issues with OneDrive
  swcMinify: false,
  // Disable file watching that causes OneDrive issues
  webpack: (config, { dev }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // Disable file watching in development to avoid OneDrive issues
    if (dev) {
      config.watchOptions = {
        poll: false,
        ignored: [
          '**/.next/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/.DS_Store',
          '**/.vscode/**',
          '**/.idea/**',
        ],
      };
    }
    
    return config;
  },
}

module.exports = nextConfig















