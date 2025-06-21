export const config = {
  songsPerPage: 10,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.example.com',
  youtubeApiKey: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
  defaultThumbnail: '/placeholder.jpg',
  playerSettings: {
    autoplay: 1,
    controls: 0,
    modestbranding: 1,
    rel: 0
  }
}; 