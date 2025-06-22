// app/TopPageClient.jsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import YouTubePlayer from "./components/YouTubePlayer";
import SongListTopPage from "./components/SongListTopPage";
import { config } from "./config/config";

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
	const [allSongs, setAllSongs] = useState([]);
	const [currentSongIndex, setCurrentSongIndex] = useState(null);
	const [currentVideoId, setCurrentVideoId] = useState(null);
	const [currentTrack, setCurrentTrack] = useState(null);
	const playerRef = useRef(null);
	const userInteractedRef = useRef(false);

	const styleSlugs = styleOrder;

	// propsからデータをセット
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
		setAllSongs(merged);
	}, [topSongsData]);

	// 曲再生管理
	const setTrack = useCallback((idx) => {
		userInteractedRef.current = true;
		const song = allSongs[idx];
		if (!song) return;
		// SongList.jsと同じアーティスト名組み立て
		const categories = song.custom_fields?.categories || song.categories || [];
		const orderedArtists = (() => {
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
			if (song.content?.rendered) {
				const contentParts = song.content.rendered.split(" - ");
				if (contentParts.length > 0) {
					const potentialArtistsStr = contentParts[0];
					const contentArtists = potentialArtistsStr.split(",").map((n) => n.trim().toLowerCase());
					const matched = [];
					contentArtists.forEach((artistNameLower) => {
						const foundCat = categories.find(
							(cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
						);
						if (foundCat) matched.push(foundCat);
					});
					if (matched.length > 0) return matched;
				}
			}
			return categories;
		})();
		const artistElementsText = orderedArtists.length
			? orderedArtists.map((artist) => {
				let displayName = artist.name || "Unknown Artist";
				if ((artist.the_prefix === "1" || artist.prefix === "1") && !/^The\s+/i.test(displayName)) {
					displayName = "The " + displayName;
				}
				const origin = (artist.artistorigin || artist.acf?.artistorigin) && (artist.artistorigin || artist.acf?.artistorigin) !== "Unknown"
					? ` (${artist.artistorigin || artist.acf?.artistorigin})`
					: "";
				return displayName + origin;
			}).join(", ")
			: "Unknown Artist";
		const videoId =
			song.acf?.ytvideoid ||
			song.acf?.youtube_id ||
			song.videoId ||
			song.youtube_id ||
			song.ytvideoid ||
			"";
		// サムネイルロジックを統一
		let thumbnailUrl = "/placeholder.jpg";
		const src = song.thumbnail || song.featured_media_url;
		if (src) {
			const fileName = src.split("/").pop().replace(/\.[a-zA-Z0-9]+$/, ".webp");
			thumbnailUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
		}
		setCurrentSongIndex(idx);
		setCurrentVideoId(videoId);
		setCurrentTrack({
			title: song.title?.rendered || song.title || "No Title",
			artist: Array.isArray(song.artists) && song.artists.length > 0
				? song.artists.map(a => a.name).join(", ")
				: (song.artist || "Unknown Artist"),
			thumbnail: thumbnailUrl,
			songId: song.id,
			styleSlug: song.styleSlug,
			styleName: song.styleName,
			videoId,
		});
	}, [allSongs]);

	const handleNextSong = () => {
		setTrack((currentSongIndex + 1) % allSongs.length);
	};
	const handlePreviousSong = () => {
		setTrack((currentSongIndex - 1 + allSongs.length) % allSongs.length);
	};

	// サムネイルクリック時
	const handleThumbnailClick = (idx) => {
		setTrack(idx);
	};

	return (
		<div className="topPageContainer">
			<h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
				New Songs Across 8 Styles
			</h2>
			<SongListTopPage
				songs={allSongs}
				currentSongIndex={currentSongIndex}
				setTrack={setTrack}
				onNext={handleNextSong}
				onPrevious={handlePreviousSong}
			/>
			{currentVideoId && currentTrack && (
				<YouTubePlayer
					ref={playerRef}
					videoId={currentVideoId}
					currentTrack={currentTrack}
					onEnd={handleNextSong}
					handlePreviousSong={handlePreviousSong}
					autoPlay={userInteractedRef.current}
					pageType="Home"
					posts={allSongs}
					styleSlug={currentTrack?.styleSlug || "unknown"}
					styleName={currentTrack?.styleName || "Unknown Style"}
				/>
			)}
		</div>
	);
}