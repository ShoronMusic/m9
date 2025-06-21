/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'i.scdn.co',  // Spotify
      'i.ytimg.com', // YouTube
      'yt3.ggpht.com', // YouTube
      'lh3.googleusercontent.com', // Google
      'firebasestorage.googleapis.com', // Firebase
    ],
  },
};

module.exports = nextConfig;