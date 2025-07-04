// app/TopPageClient.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import SongListTopPage from "./components/SongListTopPage";
import { config } from "./config/config";
import { usePlayer } from './components/PlayerContext';
import Link from "next/link";

// --- ヘルパー関数群 (SongList.jsから移植) ---
function removeLeadingThe(str = "") {
	return str.replace(/^The\s+/i, "").trim();
}

function determineArtistOrder(song) {
	// artists配列があればそれを優先
	if (Array.isArray(song.artists) && song.artists.length > 0) {
		return song.artists;
	}
	// TopPageでは `song.categories` が `song.artist_categories` の中にある
	const categories = song.artist_categories || [];

	function getComparableCatName(cat) {
		return removeLeadingThe(cat.name || "").toLowerCase();
	}

	// 1. artist_order を優先
	if (song.acf?.artist_order) {
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

	// 2. spotify_artists を次に優先
	if (song.acf?.spotify_artists) {
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

	// 3. 本文 (content.rendered) を次に優先
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

	// 4. 上記全てない場合は categories の元の順番
	return categories;
}

// --- TopPageClient本体 ---
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
	const { playTrack, setTrackList } = usePlayer();

	// propsからデータをセットし、正規化
	const allSongs = styleOrder
		.flatMap((slug) => {
			const entry = topSongsData.find((e) => e.styleSlug === slug);
			if (!entry || !entry.songs) return [];
			return entry.songs.map(song => ({
				...song,
				styleSlug: entry.styleSlug,
				styleName: styleDisplayMap[entry.styleSlug]
			}));
		})
		.map(song => {
			// --- ここで最終的なデータ整形を行う ---
			const finalArtists = determineArtistOrder(song);
			
			const spotify_track_id = song.spotify_track_id || song.spotifyTrackId || song.acf?.spotify_track_id || '';
			
			return {
				...song,
				// PlayerContextが期待するデータ構造に合わせる
				artists: finalArtists, // 整形済みのアーティスト配列
				title: { rendered: song.title },
				spotifyTrackId: spotify_track_id,
				// 他の必須プロパティもここに追加...
				thumbnail: song.thumbnail,
			};
		}).filter(song => song.spotifyTrackId);

	useEffect(() => {
		// スタイルごとの表示用データを作成
		const byStyle = {};
		allSongs.forEach(song => {
			if (!byStyle[song.styleSlug]) {
				byStyle[song.styleSlug] = [];
			}
			byStyle[song.styleSlug].push(song);
		});
		setSongsByStyle(byStyle);

		// PlayerContextに曲リストを設定
		if (allSongs.length > 0) {
			setTrackList(allSongs);
		}
	}, [topSongsData]); // topSongsDataの変更時にのみ実行

	// 曲再生管理（PlayerContextを使用）
	const handleTrackPlay = useCallback((song, index) => {
		// allSongsから正しいインデックスを探す
		const globalIndex = allSongs.findIndex(s => s.id === song.id);
		playTrack(song, globalIndex, allSongs, 'top-page');
	}, [playTrack, allSongs]);

	return (
		<div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
			<h1 style={{
				fontSize: '1.8rem',
				fontWeight: 800,
				marginBottom: '2rem',
				textAlign: 'left'
			}}>
				New Songs Across 8 Styles
			</h1>

			{styleOrder.map((styleSlug) => {
				const styleSongs = songsByStyle[styleSlug] || [];
				const styleName = styleDisplayMap[styleSlug];
				
				if (styleSongs.length === 0) return null;

				return (
					<div key={styleSlug} style={{ marginBottom: '40px' }}>
						<Link href={`/styles/${styleSlug}/1`} style={{ textDecoration: 'none' }}>
							<h2 style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '0.5rem',
								textAlign: 'left',
								fontSize: '1.8em',
								fontWeight: 700,
								margin: 0,
								color: '#007bff',
								letterSpacing: '-0.01em',
								lineHeight: 1.1,
								cursor: 'pointer'
							}}>
								{styleName}
								<span style={{ fontSize: '0.8em' }}>→</span>
							</h2>
						</Link>
						<div style={{ borderBottom: '1px solid #e0e0e0', marginTop: '1rem', marginBottom: '1rem' }} />

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
