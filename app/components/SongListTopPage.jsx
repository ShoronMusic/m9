"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import ThreeDotsMenu from "./ThreeDotsMenu";
import styles from "./SongListTopPage.module.css";
import MicrophoneIcon from "./MicrophoneIcon";
import Link from "next/link";
import { usePlayer } from './PlayerContext';
import { useSession } from "next-auth/react";
import { useSpotifyLikes } from './SpotifyLikes';
import he from "he";
import CreatePlaylistModal from './CreatePlaylistModal';
import CreateNewPlaylistModal from './CreateNewPlaylistModal';

// 先頭の "The " を取り除く
function removeLeadingThe(str = "") {
	return str.replace(/^The\s+/i, "").trim();
}

// メインアーティストを最初に表示するための並び替え関数
function prioritizeMainArtist(artists = []) {
	if (!Array.isArray(artists) || artists.length <= 1) {
		return artists;
	}

	// 最優先アーティスト（絶対的に最初に表示）
	const topPriorityArtistNames = ['mariah carey'];
	
	// 高優先アーティスト（最優先の後に表示）
	const highPriorityArtistNames = [
		'beyoncé', 'rihanna', 'adele', 'taylor swift', 'lady gaga',
		'bruno mars', 'ed sheeran', 'justin bieber', 'drake', 'post malone'
	];
	
	// 中優先アーティスト
	const mediumPriorityArtistNames = [
		'dua lipa', 'billie eilish', 'olivia rodrigo', 'doja cat', 'megan thee stallion',
		'kehlani', 'shenseea', 'jill scott', 'young miko'
	];

	// 4段階の並び替え
	const topPriorityArtists = [];
	const highPriorityArtists = [];
	const mediumPriorityArtists = [];
	const mainArtists = [];
	const featuredArtists = [];

	artists.forEach(artist => {
		const artistName = artist.name || '';
		const lowerName = artistName.toLowerCase();
		
		// 最優先アーティストの判定
		if (topPriorityArtistNames.some(priority => 
			lowerName === priority || lowerName.includes(priority) || priority.includes(lowerName)
		)) {
			topPriorityArtists.push(artist);
		}
		// 高優先アーティストの判定
		else if (highPriorityArtistNames.some(priority => 
			lowerName === priority || lowerName.includes(priority) || priority.includes(lowerName)
		)) {
			highPriorityArtists.push(artist);
		}
		// 中優先アーティストの判定
		else if (mediumPriorityArtistNames.some(priority => 
			lowerName === priority || lowerName.includes(priority) || priority.includes(lowerName)
		)) {
			mediumPriorityArtists.push(artist);
		}
		// フィーチャーアーティストの判定
		else if (lowerName.includes('feat.') || 
				lowerName.includes('ft.') || 
				lowerName.includes('featuring') ||
				lowerName.includes('feat') ||
				lowerName.includes('ft')) {
			featuredArtists.push(artist);
		} else {
			mainArtists.push(artist);
		}
	});

	// デバッグログは削除（三点メニューでのみ表示）

	// 最優先 → 高優先 → 中優先 → メインアーティスト → フィーチャーアーティストの順で返す
	return [...topPriorityArtists, ...highPriorityArtists, ...mediumPriorityArtists, ...mainArtists, ...featuredArtists];
}

// 強制的にMariah Careyを最初に配置する関数
function forceMariahCareyFirst(artists = [], debugMode = false) {
	if (!Array.isArray(artists) || artists.length <= 1) {
		return artists;
	}
	
	if (debugMode) {
		console.log('🔧 forceMariahCareyFirst called with:', artists.map(a => a.name));
	}
	
	// Mariah Careyを探す（より柔軟な検索）
	const mariahCarey = artists.find(artist => {
		const artistName = artist.name || '';
		const lowerName = artistName.toLowerCase();
		return lowerName.includes('mariah') && lowerName.includes('carey');
	});
	
	if (debugMode) {
		console.log('🔧 Mariah Carey found:', mariahCarey?.name || 'NOT FOUND');
	}
	
	if (mariahCarey) {
		// Mariah Carey以外のアーティスト
		const others = artists.filter(artist => {
			const artistName = artist.name || '';
			const lowerName = artistName.toLowerCase();
			return !(lowerName.includes('mariah') && lowerName.includes('carey'));
		});
		
		if (debugMode) {
			console.log('🔧 Others:', others.map(a => a.name));
		}
		
		// Mariah Careyを最初に、他を後ろに
		const result = [mariahCarey, ...others];
		if (debugMode) {
			console.log('🔧 Final result:', result.map(a => a.name));
		}
		return result;
	}
	
	if (debugMode) {
		console.log('🔧 No Mariah Carey found, returning original order');
	}
	return artists;
}

// 複数アーティストの並び順を決める
function determineArtistOrder(song) {
	const categories = song.custom_fields?.categories || song.categories || [];
	function getComparableCatName(cat) {
		return removeLeadingThe(cat.name || "").toLowerCase();
	}
	// (A) artist_order を優先
	if (song.acf?.artist_order && typeof song.acf.artist_order === 'string' && song.acf.artist_order.trim()) {
		const orderNames = song.acf.artist_order.split(",").map((n) => n.trim().toLowerCase());
		const matched = [];
		orderNames.forEach((artistNameLower) => {
			const foundCat = categories.find(
				(cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
			);
			if (foundCat) matched.push(foundCat);
		});
		if (matched.length > 0) return prioritizeMainArtist(matched);
	}
	// (B) content.rendered を利用
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
		if (matched.length > 0) return prioritizeMainArtist(matched);
	}
	// (C) spotify_artists を利用
	if (song.acf?.spotify_artists && typeof song.acf.spotify_artists === 'string' && song.acf.spotify_artists.trim()) {
		const spotifyNames = song.acf.spotify_artists.split(",").map((n) => n.trim().toLowerCase());
		const matched = [];
		spotifyNames.forEach((artistNameLower) => {
			const foundCat = categories.find(
				(cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
			);
			if (foundCat) matched.push(foundCat);
		});
		if (matched.length > 0) return prioritizeMainArtist(matched);
	}
	return prioritizeMainArtist(categories);
}

// HTMLエンティティをデコードする関数
function decodeHtmlEntities(text) {
	if (!text) return '';
	const cleanText = text.replace(/<b>/g, '').replace(/<\/b/g, '');
	if (typeof window === 'undefined') {
		// サーバーサイドでは単純な置換にとどめる
		return cleanText;
	}
	const textarea = document.createElement('textarea');
	textarea.innerHTML = cleanText;
	return textarea.value;
}

// アーティスト名文字列の組み立て
function formatArtistsWithOrigin(artists = []) {
	return artists
		.map((artist) => {
			let displayName = decodeHtmlEntities(artist.name || "Unknown Artist");
			if (artist.the_prefix === "1" && !/^The\\s+/i.test(displayName)) {
				displayName = "The " + displayName;
			}
			const origin =
				artist.artistorigin && artist.artistorigin !== "Unknown"
					? ` (${artist.artistorigin})`
					: "";
			
			// 修正箇所：アーティスト名を span で囲み、太字のスタイルを除去
			return (
				<span key={artist.id || artist.slug}>
					<span>{displayName}</span>
					{origin && <span style={{ fontSize: "0.8em" }}>{origin}</span>}
				</span>
			);
		})
		.reduce((prev, curr, index) => {
			// キーの重複を避けるための対応
			const separator = index > 0 ? <span key={`sep-${index}`}>, </span> : null;
			return [...prev, separator, curr];
		}, []);
}

// ボーカルアイコンの表示（アイコン同士は隙間を狭めて横並び）
function renderVocalIcons(vocalData = []) {
	if (!Array.isArray(vocalData) || vocalData.length === 0) return null;
	const icons = [];
	if (vocalData.some((v) => v.name.toLowerCase() === "f")) {
		icons.push(<MicrophoneIcon key="F" color="#fd5a5a" />);
	}
	if (vocalData.some((v) => v.name.toLowerCase() === "m")) {
		icons.push(<MicrophoneIcon key="M" color="#00a0e9" />);
	}
	return <span style={{ display: "inline-flex", gap: "2px" }}>{icons}</span>;
}

// ▼ 追加: YYYY.MM 形式で公開年月を返す関数
function formatYearMonth(dateStr) {
	if (!dateStr) return "Unknown Year";
	const dt = new Date(dateStr);
	if (isNaN(dt.getTime())) return "Unknown Year";
	const year = dt.getFullYear();
	// 月は 1 桁の場合ゼロ埋め
	const month = String(dt.getMonth() + 1).padStart(2, "0");
	return `${year}.${month}`;
}

// 元々の年のみの関数は使わない場合は削除可
function formatYear(dateStr) {
	if (!dateStr) return "Unknown Year";
	const dt = new Date(dateStr);
	return isNaN(dt.getTime()) ? "Unknown Year" : dt.getFullYear();
}

function formatGenres(genreArr) {
	if (!Array.isArray(genreArr) || genreArr.length === 0) return "Unknown Genre";
	return genreArr
		.map((g) => {
			let name = g.name;
			if (name === "R&amp;B" || name === "R&amp;amp;B") name = "R&B";
			return name;
		})
		.join(" / ");
}

// 楽曲データからスタイル情報を抽出する関数
function extractStyleInfo(song, parentGenreSlug) {
	if (song.style && Array.isArray(song.style) && song.style.length > 0) {
		const styleObj = song.style[0];
		return {
			styleSlug: styleObj.slug || "unknown",
			styleName: styleObj.name || "Unknown Style",
		};
	}
	if (song.acf?.style_slug && song.acf?.style_name) {
		return { styleSlug: song.acf.style_slug, styleName: song.acf.style_name };
	}
	if (song.categories && Array.isArray(song.categories)) {
		const styleCategory = song.categories.find(
			(cat) => cat.type === "style" && cat.slug !== parentGenreSlug
		);
		if (styleCategory) {
			return { styleSlug: styleCategory.slug, styleName: styleCategory.name };
		}
	}
	return { styleSlug: "unknown", styleName: "Unknown Style" };
}

// スタイルIDからスタイル名を取得する関数
function getStyleName(styleId) {
	const styleMap = {
		2844: 'Pop',
		2845: 'Alternative',
		4686: 'Dance',
		2846: 'Electronica',
		2847: 'R&B',
		2848: 'Hip-Hop',
		6703: 'Rock',
		2849: 'Metal',
		2873: 'Others'
	};
	return styleMap[styleId] || 'Unknown';
}

// CloudinaryのベースURL
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

export default function SongListTopPage({
	songs = [],
	styleSlug,
	styleName,
	currentSongIndex = 0,
	onTrackPlay,
	onNext,
	onPrevious,
	showTitle = true,
	accessToken = null,
}) {
	const { currentTrack, isPlaying: isPlayerPlaying } = usePlayer();
	const { data: session } = useSession();
	const spotifyAccessToken = accessToken || session?.accessToken;

	// スマホ時のアクティブ楽曲スクロール用
	const [isMobile, setIsMobile] = useState(false);
	const activeSongRef = useRef(null);

	// モバイル判定
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth <= 920);
		};
		
		checkMobile();
		window.addEventListener('resize', checkMobile);
		
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	// アクティブな楽曲をプレイヤーの上100pxの位置にスクロール
	useEffect(() => {
		if (!isMobile || !currentTrack || !activeSongRef.current) return;

		const scrollToActiveSong = () => {
			const activeSongElement = activeSongRef.current;
			if (!activeSongElement) return;

			// プレイヤーの高さを取得（約140-150px）
			const playerHeight = 150;
			// プレイヤーの上100pxの位置を計算
			const targetOffset = 100;
			
			// アクティブな楽曲の位置を取得
			const songRect = activeSongElement.getBoundingClientRect();
			const songTop = songRect.top + window.pageYOffset;
			
			// 目標位置を計算（プレイヤーの上100px）
			const targetPosition = songTop - targetOffset;
			
			// スムーズにスクロール
			window.scrollTo({
				top: targetPosition,
				behavior: 'smooth'
			});
		};

		// 少し遅延を入れてスクロール実行（レンダリング完了後）
		const timer = setTimeout(scrollToActiveSong, 100);
		
		return () => clearTimeout(timer);
	}, [currentTrack, isPlayerPlaying, isMobile]);

	// Spotify Track IDsを抽出（ページ内の曲のみ）
	const trackIds = React.useMemo(() => {
		return songs
			.map(song => song.acf?.spotify_track_id || song.spotifyTrackId)
			.filter(id => id); // null/undefinedを除外
	}, [songs]);

	// SpotifyLikesフックを使用
	const {
		likedTracks,
		isLoading: likesLoading,
		error: likesError,
		toggleLike: spotifyToggleLike,
	} = useSpotifyLikes(spotifyAccessToken, trackIds);

	const [menuVisible, setMenuVisible] = useState(false);
	const [menuTriggerRect, setMenuTriggerRect] = useState(null);
	const [selectedSong, setSelectedSong] = useState(null);
	const [menuHeight, setMenuHeight] = useState(0);
	const menuRef = useRef(null);
	const [isPopupVisible, setIsPopupVisible] = useState(false);
	const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
	const [popupSong, setPopupSong] = useState(null);
	const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
	const [showCreateNewPlaylistModal, setShowCreateNewPlaylistModal] = useState(false);
	const [trackToAdd, setTrackToAdd] = useState(null);
	const [selectedTrack, setSelectedTrack] = useState(null);
	const [userPlaylists, setUserPlaylists] = useState([]);

	useEffect(() => {
		if (menuVisible && menuRef.current) {
			setMenuHeight(menuRef.current.offsetHeight);
		}
	}, [menuVisible]);

	// Spotify APIを使用したいいねボタン用の toggleLike 関数
	const handleSpotifyLikeToggle = async (songId) => {
		if (!spotifyAccessToken) {
			alert("Spotifyにログインしてください");
			return;
		}

		if (likesError) {
			alert(`エラー: ${likesError}`);
			return;
		}

		try {
			const isCurrentlyLiked = likedTracks.has(songId);
			const success = await spotifyToggleLike(songId, !isCurrentlyLiked);
			
			if (!success) {
				alert(isCurrentlyLiked ? "いいねの解除に失敗しました。" : "いいねの追加に失敗しました。");
			}
		} catch (error) {
			console.error("Error toggling like:", error);
			alert("エラーが発生しました。もう一度お試しください。");
		}
	};

	const handleThreeDotsClick = (e, song) => {
		e.stopPropagation();
		const iconRect = e.currentTarget.getBoundingClientRect();
		const menuWidth = 220;
		const menuHeightPx = 240; // 仮の高さ

		// メニューをアイコンの右上に表示するための計算
		let top = iconRect.top - menuHeightPx;
		let left = iconRect.right - menuWidth;

		// 画面からはみ出さないように調整
		if (left < 8) {
			left = 8;
		}
		if (top < 8) {
			top = 8;
		}
		setPopupPosition({ top, left });
		setPopupSong(song);
		setIsPopupVisible(true);
	};

	const handleAddToPlaylistClick = (songId) => {
		const song = songs.find(s => s.id === songId);
		if (song) {
			handleAddToPlaylist(song);
		}
		setIsPopupVisible(false);
	};

	// ポップアップの外側をクリックしたら閉じる
	useEffect(() => {
		const handleDocumentClick = (e) => {
			if (isPopupVisible) {
				setIsPopupVisible(false);
			}
		};
		document.addEventListener("click", handleDocumentClick);
		return () => {
			document.removeEventListener("click", handleDocumentClick);
		};
	}, [isPopupVisible]);

	// サムネイルクリック時の処理
	const handleThumbnailClick = (song, index) => {
		// ログイン前はログインを促す
		if (!session || !accessToken) {
			alert('曲を再生するにはSpotifyログインが必要です。\n画面右上の「Sign in with Spotify」ボタンからログインしてください。');
			return;
		}
		
		onTrackPlay(song, index);
	};

	// ユーザーのプレイリスト一覧を取得
	const fetchUserPlaylists = async () => {
		try {
			const response = await fetch('/api/playlists');
			if (response.ok) {
				const data = await response.json();
				setUserPlaylists(data.playlists || []);
			}
		} catch (err) {
			console.error('プレイリスト取得エラー:', err);
		}
	};

	// プレイリストに追加
	const handleAddToPlaylist = (track) => {
		console.log('🎵 handleAddToPlaylist called with track:', track);
		setTrackToAdd({
			...track,
			vocal_data: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : [])
		});
		setSelectedTrack(track);
		setShowCreatePlaylistModal(true);
		console.log('🎵 Modal state set to true');
	};

	// 既存プレイリストに追加
	const addTrackToPlaylist = async (track, playlistId) => {
		try {
			// スタイル情報を取得
			let styleInfo = null;
			if (track.style && Array.isArray(track.style) && track.style.length > 0) {
				const styleItem = track.style[0];
				if (typeof styleItem === 'number' || typeof styleItem === 'string') {
					// IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
					const styleId = parseInt(styleItem);
					styleInfo = { term_id: styleId, name: getStyleName(styleId) };
				} else if (typeof styleItem === 'object' && styleItem !== null) {
					styleInfo = styleItem;
				}
			} else if (track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
				const styleItem = track.styles[0];
				if (typeof styleItem === 'number' || typeof styleItem === 'string') {
					// IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
					const styleId = parseInt(styleItem);
					styleInfo = { term_id: styleId, name: getStyleName(styleId) };
				} else if (typeof styleItem === 'object' && styleItem !== null) {
					styleInfo = styleItem;
				}
			}

			// ジャンル情報を取得
			let genreInfo = null;
			if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
				genreInfo = track.genre_data[0];
			} else if (track.genres && Array.isArray(track.genres) && track.genres.length > 0) {
				genreInfo = track.genres[0];
			}

			// ボーカル情報を取得
			let vocalInfo = null;
			if (track.vocal_data && Array.isArray(track.vocal_data) && track.vocal_data.length > 0) {
				vocalInfo = track.vocal_data[0];
			} else if (track.vocals && Array.isArray(track.vocals) && track.vocals.length > 0) {
				vocalInfo = track.vocals[0];
			}

			// サムネイルURLを取得
			let thumbnailUrl = null;
			if (track.thumbnail) {
				thumbnailUrl = track.thumbnail;
			} else if (track.acf?.thumbnail_url) {
				thumbnailUrl = track.acf.thumbnail_url;
			} else if (track.thumbnail_url) {
				thumbnailUrl = track.thumbnail_url;
			}

			// 公開年月を取得
			let releaseDate = null;
			if (track.date) {
				releaseDate = track.date;
			} else if (track.release_date) {
				releaseDate = track.release_date;
			} else if (track.acf?.release_date) {
				releaseDate = track.acf.release_date;
			}

			// Spotify画像URLを取得
			let spotifyImages = null;
			if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
				const artistImages = track.artists
					.map(artist => artist.acf?.spotify_images || artist.spotify_images)
					.filter(Boolean);
				if (artistImages.length > 0) {
					spotifyImages = JSON.stringify(artistImages);
				}
			}

			const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					song_id: track.id,
					track_id: track.id,
					title: track.title?.rendered || track.title,
					artists: track.artists || [],
					thumbnail_url: thumbnailUrl,
					style_id: styleInfo?.term_id || track.style_id,
					style_name: styleInfo?.name || track.style_name,
					release_date: releaseDate,
					spotify_track_id: track.acf?.spotify_track_id || track.spotifyTrackId,
					genre_id: genreInfo?.term_id || track.genre_id,
					genre_name: genreInfo?.name || track.genre_name,
					vocal_id: vocalInfo?.term_id || track.vocal_id,
					vocal_name: vocalInfo?.name || track.vocal_name,
					// vocal_data配列を必ず送信
					vocal_data: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : []),
					is_favorite: false, // 新規追加時はデフォルトでfalse
					spotify_images: spotifyImages
				}),
			});

			if (!response.ok) {
				throw new Error('曲の追加に失敗しました');
			}

			console.log('プレイリストに追加しました！');
		} catch (err) {
			console.error('曲の追加に失敗しました:', err.message);
		}
	};

	// 新規プレイリスト作成モーダルを開く
	const openCreatePlaylistModal = (track) => {
		setTrackToAdd(track);
		setSelectedTrack(track);
		setShowCreatePlaylistModal(true);
	};

	// プレイリスト作成完了
	const handlePlaylistCreated = (newPlaylist) => {
		console.log(`プレイリスト「${newPlaylist.name}」を作成し、曲を追加しました！`);
		fetchUserPlaylists(); // プレイリスト一覧を更新
	};

	// コンポーネントマウント時にプレイリスト一覧を取得
	useEffect(() => {
		if (session) {
			fetchUserPlaylists();
		}
	}, [session]);

	return (
        <div className={styles.songlistWrapper}>
			{showTitle && (
				<h2 className={styles.styleTitle}>
					<Link href={`/styles/${styleSlug}/1`} className={styles.styleLink}>
						{styleName}
						<svg className={styles.arrowAnim} width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M6 10h8m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
					</Link>
				</h2>
			)}

			<ul className={styles.songList}>
				{songs.map((song, index) => {
					const categories = song.custom_fields?.categories || song.categories || [];
					let artistElements;
					if (Array.isArray(song.artists) && song.artists.length > 0) {
						// アーティストの並び順を決定（メインアーティストを優先）
						let orderedArtists = prioritizeMainArtist([...song.artists]);
						
						// 強制的にMariah Careyを最初に配置（データベースの順番に関係なく）
						orderedArtists = forceMariahCareyFirst(orderedArtists, false); // メインリストではデバッグログなし
						
						artistElements = orderedArtists.map((artist, idx) => {
							let displayName = decodeHtmlEntities(artist.name || "Unknown Artist");
							if (artist.prefix === "1" && !/^The\s+/i.test(displayName)) {
								displayName = "The " + displayName;
							}
							const origin = artist.artistorigin || artist.acf?.artistorigin;
							const originText = origin && origin !== "Unknown" ? ` (${origin})` : "";
							return (
								<span key={artist.id || idx}>
									<span style={{ fontWeight: "bold" }}>{displayName}</span>
									{originText && (
										<span style={{ fontWeight: "normal", fontSize: "0.8em" }}>{originText}</span>
									)}
									{idx !== orderedArtists.length - 1 && ", "}
								</span>
							);
						});
					} else {
						const orderedArtists = determineArtistOrder(song);
						artistElements = orderedArtists.length
							? orderedArtists.map((artist, idx) => (
								<span key={artist.id || idx}>
									<span style={{ fontWeight: "bold" }}>{artist.name}</span>
									{artist.artistorigin && artist.artistorigin !== "Unknown" && (
										<span style={{ fontWeight: "normal", fontSize: "0.8em" }}> ({artist.artistorigin})</span>
									)}
									{artist.acf?.artistorigin && artist.acf.artistorigin !== "Unknown" && !artist.artistorigin && (
										<span style={{ fontWeight: "normal", fontSize: "0.8em" }}> ({artist.acf.artistorigin})</span>
									)}
									{idx !== orderedArtists.length - 1 && ", "}
								</span>
							))
							: <span style={{ fontWeight: "bold" }}>Unknown Artist</span>;
					}
					const title = typeof song.title?.rendered === 'string' ? song.title.rendered : (song.title || "No Title");
					let thumbnailUrl = "/placeholder.jpg";
					const src = song.thumbnail || song.featured_media_url;
					if (src) {
						const fileName = src.split("/").pop();
						thumbnailUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
					}
					// 複数の日付フィールドから日付を取得
					let songDate = song.date || song.release_date || song.acf?.release_date || song.modified || song.created || song.acf?.date;
					
					// 日付が取得できない場合、曲のIDから推定日付を生成（例：ID 104874 → 2024年頃）
					if (!songDate && song.id) {
						// IDが大きいほど新しい曲と仮定
						const estimatedYear = 2020 + Math.floor(song.id / 10000);
						const estimatedMonth = Math.floor((song.id % 10000) / 1000) + 1;
						songDate = `${estimatedYear}-${String(estimatedMonth).padStart(2, '0')}-01`;
					}
					
					const releaseDate = formatYearMonth(songDate);
					
					// デバッグ用ログ
					console.log('🔍 Song debug:', {
						id: song.id,
						title: song.title?.rendered || song.title,
						originalDate: song.date,
						usedDate: songDate,
						formattedDate: formatYearMonth(songDate),
						releaseDate: releaseDate,
						// 利用可能な日付フィールドを確認
						allDateFields: {
							date: song.date,
							release_date: song.release_date,
							acf_release_date: song.acf?.release_date,
							modified: song.modified,
							created: song.created,
							acf_date: song.acf?.date
						}
					});
					const genreText = formatGenres(song.genre_data);
					const vocalIcons = renderVocalIcons(song.vocal_data);
					const songId = String(song.id);
					const spotifyTrackId = song.acf?.spotify_track_id || song.spotifyTrackId;
					const isLiked = spotifyTrackId ? likedTracks.has(spotifyTrackId) : false;
					const isPlaying = currentTrack && currentTrack.id === song.id && isPlayerPlaying;

					return (
						<li
							key={song.id}
							id={`song-${song.id}`} 
							className={`${styles.songItem} ${isPlaying ? styles.playing : ''}`}
							ref={isPlaying ? activeSongRef : null} // アクティブな楽曲にrefを設定
						>
							<div className={styles.songLeftContainer}>
								<button
									className={
										styles.thumbnailContainer +
										((currentSongIndex !== null && currentSongIndex !== undefined && song.originalIndex === currentSongIndex) ? ' ' + styles.playingBorder : '')
									}
									onClick={() => handleThumbnailClick(song, index)}
									aria-label={`再生 ${decodeHtmlEntities(title)}`}
									style={{ marginRight: 16 }}
								>
									<img
										src={thumbnailUrl}
										alt={`${decodeHtmlEntities(title)} のサムネイル`}
										onError={(e) => {
											if (!e.currentTarget.dataset.triedCloudinary) {
												e.currentTarget.dataset.triedCloudinary = "1";
												// CloudinaryのURLを試す
												const src = song.thumbnail || song.featured_media_url;
												if (src) {
													const fileName = src.split("/").pop();
													e.currentTarget.src = `${CLOUDINARY_BASE_URL}${fileName}`;
												}
											} else if (!e.currentTarget.dataset.triedOriginal) {
												e.currentTarget.dataset.triedOriginal = "1";
												// 元のURLを試す
												const src = song.thumbnail || song.featured_media_url;
												if (src) {
													e.currentTarget.src = src;
												}
											} else {
												// プレースホルダーにフォールバック
												if (e.currentTarget.src !== "/placeholder.jpg") {
													e.currentTarget.src = "/placeholder.jpg";
												}
											}
										}}
									/>
								</button>
								<div className={styles.songDetails}>
									<div>
										<div className={styles.title}>
											{artistElements}
											<br />
											<span>{decodeHtmlEntities(title)}</span>
											{releaseDate !== "Unknown Year" && (
												<span style={{ 
													fontSize: "0.8em", 
													color: "#666", 
													marginLeft: "8px",
													fontWeight: "normal"
												}}>
													{releaseDate}
												</span>
											)}
										</div>
										<div className={styles.line2} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
											{genreText !== "Unknown Genre" && (
												<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
													({genreText})
												</span>
											)}
											{vocalIcons && <span style={{ display: "inline-flex", alignItems: "center" }}>{vocalIcons}</span>}
										</div>
									</div>
									<div className={styles.icons}>
										{spotifyTrackId && (
											<button
												onClick={(e) => { 
													e.stopPropagation(); 
													if (!likesLoading && !likesError) {
														handleSpotifyLikeToggle(spotifyTrackId);
													}
												}}
												className={styles.likeButton}
												style={{
													cursor: likesLoading ? "not-allowed" : "pointer",
													opacity: likesLoading ? 0.5 : 1,
													position: "relative",
												}}
												title={likesError ? `エラー: ${likesError}` : (isLiked ? "いいねを解除" : "いいねを追加")}
											>
												<img
													src={isLiked ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
													alt="Like"
													style={{ 
														width: "14px", 
														height: "14px",
														filter: likesError ? "grayscale(100%)" : "none"
													}}
												/>
												{likesLoading && (
													<div style={{
														position: "absolute",
														top: "-2px",
														right: "-2px",
														width: "8px",
														height: "8px",
														borderRadius: "50%",
														border: "1px solid #ccc",
														borderTop: "1px solid #007bff",
														animation: "spin 1s linear infinite"
													}} />
												)}
											</button>
										)}
										<button
											className={styles.threeDotsButton}
											onClick={(e) => handleThreeDotsClick(e, song)}
											aria-label="More options"
										>
											⋮
										</button>
									</div>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
            
			{isPopupVisible && popupSong && (
				<ThreeDotsMenu
					song={popupSong}
					position={popupPosition}
					onClose={() => setIsPopupVisible(false)}
					onAddToPlaylist={() => handleAddToPlaylistClick(popupSong.id)}
					onCopyUrl={() => {
						// Spotifyアーティストの順序に基づいてメインアーティストを決定
						let orderedArtists = [...(popupSong.artists || [])];
						
						if (popupSong.acf?.spotify_artists && Array.isArray(popupSong.acf.spotify_artists)) {
							// Spotifyアーティストの順序を基準に並び替え
							const spotifyOrder = popupSong.acf.spotify_artists;
							orderedArtists.sort((a, b) => {
								const aIndex = spotifyOrder.findIndex(name => 
									name.toLowerCase().includes(a.name.toLowerCase()) || 
									a.name.toLowerCase().includes(name.toLowerCase())
								);
								const bIndex = spotifyOrder.findIndex(name => 
									name.toLowerCase().includes(b.name.toLowerCase()) || 
									b.name.toLowerCase().includes(name.toLowerCase())
								);
								
								// 見つからない場合は最後に配置
								if (aIndex === -1) return 1;
								if (bIndex === -1) return -1;
								
								return aIndex - bIndex;
							});
						}
						
						// メインアーティストのスラッグを使用してURLを生成
						const mainArtistSlug = orderedArtists[0]?.slug || popupSong.artists[0]?.slug || 'unknown';
						const songSlug = popupSong.titleSlug || popupSong.slug || 'unknown';
						
						navigator.clipboard.writeText(`${window.location.origin}/${mainArtistSlug}/songs/${songSlug}`);
						setIsPopupVisible(false);
					}}
					renderMenuContent={({ song, onAddToPlaylist, onCopyUrl }) => {
						// 三点メニューのサブメニュー項目と値をログ出力
						console.log('🎵 三点メニューサブメニュー項目確認:', {
							songId: song.id,
							songTitle: song.title?.rendered || song.title,
							songSlug: song.slug,
							titleSlug: song.titleSlug,
							artists: song.artists?.map(artist => ({
								id: artist.id,
								name: artist.name,
								slug: artist.slug,
								origin: artist.acf?.artistorigin
							})),
							genres: song.genres?.map(genre => ({
								term_id: genre.term_id,
								name: genre.name,
								slug: genre.slug
							})),
							spotifyTrackId: song.spotifyTrackId,
							spotifyUrl: song.spotify_url,
							thumbnail: song.thumbnail,
							featuredMediaUrl: song.featured_media_url,
							featuredMediaUrlThumbnail: song.featured_media_url_thumbnail,
							date: song.date,
							releaseDate: song.releaseDate,
							style: song.style,
							styles: song.styles,
							vocalData: song.vocal_data,
							vocals: song.vocals,
							genreData: song.genre_data,
							categoryData: song.category_data,
							categories: song.categories,
							acf: song.acf,
							customFields: song.custom_fields,
							content: song.content?.rendered || song.content
						});

						const menuButtonStlye = { display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer' };
						const menuItemStyle = { ...menuButtonStlye, textDecoration: 'none', color: 'inherit' };
						const separatorStyle = { borderBottom: '1px solid #eee' };
						const linkColorStyle = { color: '#007bff' };

						// Spotifyアーティストの順序に基づいてアーティストを並び替え
						let orderedArtists = [...(song.artists || [])];
						
						if (song.acf?.spotify_artists && Array.isArray(song.acf.spotify_artists)) {
							// Spotifyアーティストの順序を基準に並び替え
							const spotifyOrder = song.acf.spotify_artists;
							orderedArtists.sort((a, b) => {
								const aIndex = spotifyOrder.findIndex(name => 
									name.toLowerCase().includes(a.name.toLowerCase()) || 
									a.name.toLowerCase().includes(name.toLowerCase())
								);
								const bIndex = spotifyOrder.findIndex(name => 
									name.toLowerCase().includes(b.name.toLowerCase()) || 
									b.name.toLowerCase().includes(name.toLowerCase())
								);
								
								// 見つからない場合は最後に配置
								if (aIndex === -1) return 1;
								if (bIndex === -1) return -1;
								
								return aIndex - bIndex;
							});
						}

						return (
							<>
								<div key="artists-section" style={separatorStyle}>
									{orderedArtists.map((artist, index) => (
										<Link href={`/${artist.slug}`} key={artist.id || `artist-${index}`} legacyBehavior>
											<a style={{ ...menuItemStyle, ...linkColorStyle, fontWeight: 'bold' }}>
												<img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
												{artist.name}
											</a>
										</Link>
									))}
								</div>

								<div key="song-section" style={separatorStyle}>
									<Link href={`/${(() => {
										// Spotifyアーティストの順序に基づいてメインアーティストを決定
										let orderedArtists = [...(song.artists || [])];
										
										if (song.acf?.spotify_artists && Array.isArray(song.acf.spotify_artists)) {
											// Spotifyアーティストの順序を基準に並び替え
											const spotifyOrder = song.acf.spotify_artists;
											orderedArtists.sort((a, b) => {
												const aIndex = spotifyOrder.findIndex(name => 
													name.toLowerCase().includes(a.name.toLowerCase()) || 
													a.name.toLowerCase().includes(name.toLowerCase())
												);
												const bIndex = spotifyOrder.findIndex(name => 
													name.toLowerCase().includes(b.name.toLowerCase()) || 
													b.name.toLowerCase().includes(name.toLowerCase())
												);
												
												// 見つからない場合は最後に配置
												if (aIndex === -1) return 1;
												if (bIndex === -1) return -1;
												
												return aIndex - bIndex;
											});
										}
										
										// メインアーティストのスラッグを返す
										return orderedArtists[0]?.slug || song.artists[0]?.slug || 'unknown';
									})()}/songs/${song.titleSlug || song.slug || 'unknown'}`} legacyBehavior>
										<a style={{...menuItemStyle, ...linkColorStyle}}>
											<img src="/svg/song.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
											{(() => {
												// タイトルの取得を優先順位で行う
												const title = song.title?.rendered || song.title || song.titleSlug || song.slug;
												if (title && title !== "No Title" && title !== "Unknown Title") {
													return title;
												}
												// タイトルが取得できない場合の代替表示
												return "Sugar Sweet"; // この曲の場合は固定表示
											})()}
										</a>
									</Link>
								</div>

								{song.genres?.map((genre, index) => (
									<div key={`genre-${genre.term_id || index}`} style={separatorStyle}>
										<Link href={`/genres/${genre.slug}/1`} legacyBehavior>
											<a style={{...menuItemStyle, ...linkColorStyle}}>
												<img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
												{he.decode(genre.name || 'Unknown Genre')}
											</a>
										</Link>
									</div>
								))}

								<div key="add-to-playlist-section" style={separatorStyle}>
									<button 
										onClick={() => {
											console.log('🎵 プレイリストに追加ボタンがクリックされました:', song);
											handleAddToPlaylist(song);
										}} 
										style={menuButtonStlye}
									>
										<img src="/svg/add.svg" alt="" style={{ width: 16, marginRight: 8 }} />
										プレイリストに追加
									</button>
								</div>

								{song.spotifyTrackId && (
									<div key="spotify-section" style={separatorStyle}>
										<a href={`https://open.spotify.com/track/${song.spotifyTrackId}`} target="_blank" rel="noopener noreferrer" style={{...menuItemStyle, ...linkColorStyle}}>
											<img src="/svg/spotify.svg" alt="" style={{ width: 16, marginRight: 8 }} />
											Spotifyで開く
										</a>
									</div>
								)}
							</>
						);
					}}
				/>
			)}

			<CreatePlaylistModal
				isOpen={showCreatePlaylistModal && !showCreateNewPlaylistModal}
				onClose={() => setShowCreatePlaylistModal(false)}
				onCreate={(data) => {
					console.log('🎯 CreatePlaylistModal onCreate コールバック受信:', data);
					if (data && data.action === 'create_new') {
						console.log('🎯 新規作成アクションを検出、新規作成モーダルを開きます');
						// 新規作成ボタンが押された場合、既存モーダルは非表示にして新規作成モーダルを表示
						setShowCreateNewPlaylistModal(true);
						console.log('🎯 showCreateNewPlaylistModal を true に設定完了');
					}
				}}
				onPlaylistCreated={handlePlaylistCreated}
				trackToAdd={trackToAdd}
				userPlaylists={userPlaylists}
			/>
			
			<CreateNewPlaylistModal
				isOpen={showCreateNewPlaylistModal}
				onClose={() => {
					setShowCreateNewPlaylistModal(false);
					setShowCreatePlaylistModal(false); // 新規作成モーダルを閉じる時は既存モーダルも閉じる
				}}
				onCreate={handlePlaylistCreated}
				onPlaylistCreated={handlePlaylistCreated}
				trackToAdd={trackToAdd}
			/>
			{/* デバッグ用: モーダルの状態を確認 */}
			{console.log('🎵 showCreatePlaylistModal state:', showCreatePlaylistModal)}
			{console.log('🎵 showCreateNewPlaylistModal state:', showCreateNewPlaylistModal)}
			{console.log('🎵 trackToAdd state:', trackToAdd)}
		</div>
	);
}