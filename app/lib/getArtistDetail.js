import path from 'path';
import { readFile } from 'fs/promises';
import { DATA_ROOT } from './constants';

export async function getArtistsByLetter(letter) {
  try {
    const filePath = path.join(DATA_ROOT, 'artists.json');
    const data = await readFile(filePath, 'utf8');
    const artists = JSON.parse(data);

    // 数字の場合は0-9で始まるものをすべて含める
    if (letter === '0-9') {
      return artists.filter(artist => {
        const firstChar = artist.name.charAt(0).toLowerCase();
        return !isNaN(parseInt(firstChar));
      });
    }

    // アルファベットの場合は該当する文字で始まるものを抽出
    return artists.filter(artist => 
      artist.name.charAt(0).toLowerCase() === letter.toLowerCase()
    );
  } catch (error) {
    console.error(`Error reading artists for letter ${letter}:`, error);
    return [];
  }
}

export async function getArtistDetail(slug) {
  try {
    const filePath = path.join(DATA_ROOT, 'artists', `${slug}.json`);
    const data = await readFile(filePath, 'utf8');
    const artistData = JSON.parse(data);

    // Get songs data
    const songsPath = path.join(DATA_ROOT, 'artists', `${artistData.id}-songs.json`);
    const songsData = await readFile(songsPath, 'utf8');
    const songs = JSON.parse(songsData);

    return {
      ...artistData,
      songs,
    };
  } catch (error) {
    console.error(`Error reading artist data for ${slug}:`, error);
    return null;
  }
}

export async function getAllArtists() {
  try {
    const filePath = path.join(DATA_ROOT, 'artists.json');
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading all artists:', error);
    return [];
  }
}

export async function getAllArtistSlugs() {
  try {
    const filePath = path.join(DATA_ROOT, 'artists.json');
    const data = await readFile(filePath, 'utf8');
    const artists = JSON.parse(data);
    return artists.map(artist => artist.slug);
  } catch (error) {
    console.error('Error reading artist slugs:', error);
    return [];
  }
} 