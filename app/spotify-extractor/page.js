import SpotifyExtractorClient from './SpotifyExtractorClient';

export default function SpotifyExtractorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        🎵 Spotify Playlist Extractor
      </h1>
      <SpotifyExtractorClient />
    </div>
  );
}
