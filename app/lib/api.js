import path from 'path';
import fs from 'fs/promises';
import he from 'he'; // Import he for decoding HTML entities

// データディレクトリのルートパス (例: E:\md\public\data)
const DATA_ROOT = path.join(process.cwd(), 'public', 'data');
const ITEMS_PER_PAGE = 20; // Define items per page for pagination calculations
const DATA_DIR = process.env.DATA_DIR || 'https://xs867261.xsrv.jp/data/data';

// スタイルデータを取得（ページネーション対応）
export const getStyleData = async (styleSlug, pageNumber = 1) => {
	try {
		const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
		let styleData;

		if (isLocal) {
			// ローカル開発環境
			const filePath = path.join(DATA_ROOT, 'styles', 'pages', styleSlug, `${pageNumber}.json`);
			const data = await fs.readFile(filePath, 'utf8');
			styleData = JSON.parse(data);
		} else {
			// 本番環境
			const response = await fetch(`${DATA_DIR}/styles/pages/${styleSlug}/${pageNumber}.json`, {
				headers: {
					'Accept': 'application/json',
				},
			});
			if (!response.ok) {
				return null;
			}
			styleData = await response.json();
		}
		
		// Decode name and description
		if (styleData.name) styleData.name = he.decode(styleData.name);
		if (styleData.description) styleData.description = he.decode(styleData.description);

		// Process song thumbnails & categories
		if (styleData.songs && Array.isArray(styleData.songs)) {
			styleData.songs = styleData.songs.map(song => {
				// categoriesが配列の場合、数値要素を除外しオブジェクト型のみ残す
				if (Array.isArray(song.categories)) {
					song.categories = song.categories.filter(cat => typeof cat === "object" && cat !== null);
				}
				// Decode song title
				if (song.title && song.title.rendered) {
					song.title.rendered = he.decode(song.title.rendered);
				}
				// Process thumbnail URL
				if (song.featured_media_url) {
					if (song.featured_media_url.startsWith('http')) {
						const urlParts = song.featured_media_url.split('/');
						const filenameWithExt = urlParts.pop(); // e.g., image.jpg
						const filename = path.parse(filenameWithExt).name; // e.g., image
						song.featured_media_url = `/images/thum/${filename}.webp`; // Assume conversion to webp
					}
				}
				return song;
			});
		}
		
		// ページネーション処理
		const totalSongs = styleData.songs?.length || 0;
		const totalPages = Math.ceil(totalSongs / ITEMS_PER_PAGE);
		const startIdx = (pageNumber - 1) * ITEMS_PER_PAGE;
		const endIdx = startIdx + ITEMS_PER_PAGE;
		const pagedSongs = styleData.songs?.slice(startIdx, endIdx) || [];

		return {
			...styleData,
			posts: pagedSongs,
			songs: pagedSongs,
			totalSongs,
			totalPages,
			currentPage: pageNumber,
		};
	} catch (error) {
		console.error('Error reading style data:', error);
		// Return null or a default object instead of throwing error to allow notFound() handling
		return null; 
	}
};

// ジャンル詳細データを取得 (完全新構成)
export async function getGenreDetailData(genreSlug, pageNumber = 1) {
	const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
	
	try {
		let genreInfo, songsData;
		
		if (isLocal) {
			// ローカル開発環境
			const pagePath = path.join(DATA_ROOT, 'genres', 'pages', `${genreSlug}.json`);
			const songsPath = path.join(DATA_ROOT, 'genres', 'songs', `${genreSlug}.json`);
			const [pageFile, songsFile] = await Promise.all([
				fs.readFile(pagePath, 'utf-8'),
				fs.readFile(songsPath, 'utf-8')
			]);
			genreInfo = JSON.parse(pageFile);
			songsData = JSON.parse(songsFile);
		} else {
			// 本番環境
			const [pageResponse, songsResponse] = await Promise.all([
				fetch(`${DATA_DIR}/genres/pages/${genreSlug}.json`),
				fetch(`${DATA_DIR}/genres/songs/${genreSlug}.json`)
			]);
			
			if (!pageResponse.ok || !songsResponse.ok) {
				return null;
			}
			
			genreInfo = await pageResponse.json();
			songsData = await songsResponse.json();
		}
		
		const allSongs = Array.isArray(songsData.songs) ? songsData.songs : [];
		// ページネーション処理
		const totalSongs = allSongs.length;
		const totalPages = Math.ceil(totalSongs / ITEMS_PER_PAGE);
		const startIdx = (pageNumber - 1) * ITEMS_PER_PAGE;
		const endIdx = startIdx + ITEMS_PER_PAGE;
		const pagedSongs = allSongs.slice(startIdx, endIdx);
		return {
			name: genreInfo.name || genreSlug,
			slug: genreSlug,
			posts: pagedSongs,
			total: totalSongs,
			totalPages: totalPages,
			currentPage: pageNumber,
			description: genreInfo.description || '',
		};
	} catch (error) {
		console.error('[getGenreDetailData] error:', error);
		return null;
	}
}

// 他のAPI関数がここに追加される可能性があります
// (例: getArtistData, getSongData など)
// 必要であれば、これらの関数も DATA_ROOT を使うように修正できます。 