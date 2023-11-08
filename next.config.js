const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
  },
  images: {
    domains: ['img.pokemondb.net'],
  },  
  experimental: {
    serverActions: true,
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: "/functions/(.*)",
        headers: [          
          { key: "Access-Control-Allow-Origin", value: "*" }
        ]
      }
    ]
  }
}

module.exports = nextConfig
