import fs from 'fs';
import path from 'path';

export async function getSongsByArtistId(artistId) {
  try {
    const songsPath = path.join(process.cwd(), 'public', 'data', 'artists', `${artistId}-songs.json`);
    if (fs.existsSync(songsPath)) {
      const songsData = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
      return songsData;
    }
    return [];
  } catch (error) {
    console.error(`Error reading songs for artist ${artistId}:`, error);
    return [];
  }
}

export async function getArtistDataForPage(slug) {
  try {
    const artistPath = path.join(process.cwd(), 'public', 'data', 'artists', `${slug}.json`);
    if (fs.existsSync(artistPath)) {
      const artistData = JSON.parse(fs.readFileSync(artistPath, 'utf8'));
      return { artistData };
    }
    return null;
  } catch (error) {
    console.error(`Error reading artist data for ${slug}:`, error);
    return null;
  }
} 