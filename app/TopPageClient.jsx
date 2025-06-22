// app/TopPageClient.jsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import SongListTopPage from "./components/SongListTopPage";
import { config } from "./config/config";
import { usePlayer } from './components/PlayerContext';

// --- ヘルパー関数群 ---
// 先頭の "The " を取り除く
function removeLeadingThe(str = "") {
	return str.replace(/^The\s+/i, "").trim();
}

// 複数アーティストの並び順を決める
function determineArtistOrder(song) {
	const categories = song.categories || [];
	function getComparableCatName(cat) {
		return removeLeadingThe(cat.name || "").toLowerCase();
	}
	if (song.acf?.artist_order && typeof song.acf.artist_order === 'string') {
		const orderNames = song.acf.artist_order.split(",").map((n) => n.trim().toLowerCase());
		const matched = [];
		orderNames.forEach((artistNameLower) => {
			const foundCat = categories.find(
				(cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
			);
			if (foundCat) matched.push(foundCat);
		});
		if (matched.length > 0) return matched;
	}
	if (song.content?.rendered) {
		const contentStr = song.content.rendered.split("-")[0];
		const contentArtists = contentStr.split(",").map((n) => n.trim().toLowerCase());
		const matched = [];
		contentArtists.forEach((artistNameLower) => {
			const foundCat = categories.find(
				(cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
			);
			if (foundCat) matched.push(foundCat);
		});
		if (matched.length > 0) return matched;
	}
	if (song.acf?.spotify_artists && typeof song.acf.spotify_artists === 'string') {
		const spotifyNames = song.acf.spotify_artists.split(",").map((n) => n.trim().toLowerCase());
		const matched = [];
		spotifyNames.forEach((artistNameLower) => {
			const foundCat = categories.find(
				(cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
			);
			if (foundCat) matched.push(foundCat);
		});
		if (matched.length > 0) return matched;
	}
	return categories;
}

// 実際に表示するアーティスト名を組み立てる
function formatArtistsWithOrigin(artists = []) {
	return artists
		.map((artist) => {
			let displayName = artist.name || "Unknown Artist";
			if (artist.the_prefix === "1" && !/^The\s+/i.test(displayName)) {
				displayName = "The " + displayName;
			}
			const origin =
				artist.artistorigin && artist.artistorigin !== "Unknown"
					? ` (${artist.artistorigin})`
					: "";
			return displayName + origin;
		})
		.join(", ");
}

// スタイル順序はconfig.style.listの順序に従う
const styleOrder = config.style.list.map((s) => s.id);
const styleDisplayMap = Object.fromEntries(config.style.list.map((s) => [s.id, s.name]));

// API で各スタイルの曲を3件ずつ取得
async function fetchSongsByStyle(styleSlug) {
	const styleId = styleIdMap[styleSlug];
	if (!styleId) return [];
	const endpoint = `https://sub.music8.jp/wp-json/custom/v1/songlist?style_id=${styleId}&per_page=3&page=1`;
	try {
		const res = await axios.get(endpoint);
		return res.data.posts || [];
	} catch (error) {
		console.error(`Error fetching ${styleSlug} songs:`, error);
		return [];
	}
}

// ★ 楽曲データからスタイル情報を抽出する関数
function extractStyleInfo(song, parentGenreSlug) {
	
	// 1. song.style が存在する場合
	if (song.style && Array.isArray(song.style) && song.style.length > 0) {
		const styleObj = song.style[0];
		return {
			styleSlug: styleObj.slug || "unknown",
			styleName: styleObj.name || "Unknown Style",
		};
	}

	// 2. ACF に style_slug, style_name がある場合
	if (song.acf?.style_slug && song.acf?.style_name) {
		return { styleSlug: song.acf.style_slug, styleName: song.acf.style_name };
	}

	// 3. カテゴリから style を探す
	if (song.categories && Array.isArray(song.categories)) {
		const styleCategory = song.categories.find(
			(cat) => cat.type === "style" && cat.slug !== parentGenreSlug
		);
		if (styleCategory) {
			return { styleSlug: styleCategory.slug, styleName: styleCategory.name };
		}
	}

	console.warn("⚠️ No valid style found, returning unknown.");
	return { styleSlug: "unknown", styleName: "Unknown Style" };
}

const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

export default function TopPageClient({ topSongsData = [] }) {
	const [songsByStyle, setSongsByStyle] = useState({});
	const [normalizedSongs, setNormalizedSongs] = useState([]);
	const { playTrack, setTrackList } = usePlayer();

	const styleSlugs = styleOrder;

	// propsからデータをセットし、正規化
	useEffect(() => {
		// topSongsDataをstyleOrder順に並べ替え
		const sorted = styleOrder
			.map((slug) => topSongsData.find((entry) => entry.styleSlug === slug))
			.filter(Boolean);
		const byStyle = {};
		const merged = [];
		for (const entry of sorted) {
			byStyle[entry.styleSlug] = entry.songs;
			(entry.songs || []).forEach((song) => {
				merged.push({ ...song, styleSlug: entry.styleSlug, styleName: styleDisplayMap[entry.styleSlug] });
			});
		}
		setSongsByStyle(byStyle);

		// StylePageClient.jsxと同じデータ正規化ロジックを適用
		const normalized = merged.map(song => {
			let artists = [];
			if (Array.isArray(song.artists) && song.artists.length > 0) {
				artists = song.artists.map(a => ({
					...a,
					acf: {
						...(a.acf || {}),
						artistorigin: a.artistorigin || a.acf?.artistorigin || song.acf?.artist_acf?.artistorigin || "",
					}
				}));
			} else if (song.artist) {
				artists = [{
					name: song.artist,
					acf: {
						...(song.acf?.artist_acf || {}),
						artistorigin: song.acf?.artist_acf?.artistorigin || "",
					},
					id: song.artist_id || undefined,
					slug: song.artist_slug || undefined,
				}];
			}
			
			// Spotify IDを優先的に使用
			const spotify_track_id = song.spotify_track_id || song.spotifyTrackId || song.acf?.spotify_track_id || song.acf?.spotifyTrackId || '';
			
			// YouTube IDはフォールバックとして保持
			const ytvideoid = song.ytvideoid || song.youtube_id || song.acf?.ytvideoid || song.acf?.youtube_id || song.videoId || '';
			
			return {
				...song,
				title: { rendered: song.title },
				artists,
				acf: {
					...song.acf,
					spotify_track_id,
					ytvideoid,
					youtube_id: ytvideoid,
				},
				date: song.releaseDate || song.date || song.post_date || '',
				thumbnail: song.thumbnail,
				youtubeId: ytvideoid,
				spotifyTrackId: spotify_track_id,
				genre_data: song.genres,
				vocal_data: song.vocals,
				style: song.styles,
				slug: song.titleSlug || song.slug || (typeof song.title === 'string' ? song.title.toLowerCase().replace(/ /g, "-") : (song.title?.rendered ? song.title.rendered.toLowerCase().replace(/ /g, "-") : song.id)),
				content: { rendered: song.content },
			};
		}).filter(song => {
			// Spotify IDがある楽曲のみを表示
			const hasSpotifyId = song.acf?.spotify_track_id || song.spotifyTrackId;
			return hasSpotifyId;
		});

		setNormalizedSongs(normalized);
		
		// PlayerContextに曲リストを設定
		setTrackList(normalized);
	}, [topSongsData, setTrackList]);

	// 曲再生管理（PlayerContextを使用）
	const handleTrackPlay = useCallback((song, index) => {
		playTrack(song, index, normalizedSongs, 'top-page');
	}, [playTrack, normalizedSongs]);

	return (
		<div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
			{styleSlugs.map((styleSlug) => {
				const styleSongs = songsByStyle[styleSlug] || [];
				const styleName = styleDisplayMap[styleSlug];
				
				if (styleSongs.length === 0) return null;

				return (
					<div key={styleSlug} style={{ marginBottom: '40px' }}>
						<div style={{ textAlign: 'left', marginBottom: '24px' }}>
							<div style={{ fontSize: '0.85em', color: '#888', marginBottom: '2px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
								STYLE
							</div>
							<h2 style={{
								textAlign: 'left',
								fontSize: '1.8em',
								fontWeight: 700,
								margin: 0,
								color: '#222',
								letterSpacing: '-0.01em',
								lineHeight: 1.1
							}}>
								{styleName}
							</h2>
							<div style={{ borderBottom: '2px solid #e0e0e0', width: '60px', margin: '12px 0 12px 0' }} />
						</div>

						<SongListTopPage
							songs={styleSongs}
							styleSlug={styleSlug}
							styleName={styleName}
							onTrackPlay={handleTrackPlay}
							showTitle={false}
						/>
					</div>
				);
			})}
		</div>
	);
}
