"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import ThreeDotsMenu from "./ThreeDotsMenu";
import styles from "./SongListTopPage.module.css";
import MicrophoneIcon from "./MicrophoneIcon";
import SaveToPlaylistPopup from "./SaveToPlaylistPopup";
import Link from "next/link";
import { usePlayer } from './PlayerContext';
import { useSession } from "next-auth/react";
import { useSpotifyLikes } from './SpotifyLikes';
import he from "he";

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
	// (A) artist_order を優先
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
		if (matched.length > 0) return matched;
	}
	// (C) spotify_artists を利用
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
	if (!dateStr) return "";
	const dt = new Date(dateStr);
	if (isNaN(dt.getTime())) return "";
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
	const [showSavePopup, setShowSavePopup] = useState(false);
	const [selectedSongId, setSelectedSongId] = useState(null);
	const [menuHeight, setMenuHeight] = useState(0);
	const menuRef = useRef(null);
	const [isPopupVisible, setIsPopupVisible] = useState(false);
	const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
	const [popupSong, setPopupSong] = useState(null);

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

	const handleThreeDotsClick = (e, song, categories) => {
		console.log("Three dots clicked!", song);
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
		const numericId = typeof songId === 'string' ? parseInt(songId, 10) : songId;
		if (isNaN(numericId)) {
			console.error('Invalid song ID:', songId);
			return;
		}
		setSelectedSongId(numericId);
		setShowSavePopup(true);
		setIsPopupVisible(false);
	};

	const closeSavePopup = () => {
		setShowSavePopup(false);
		setSelectedSongId(null);
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
						artistElements = song.artists.map((artist, idx) => {
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
									{idx !== song.artists.length - 1 && ", "}
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
					const title = song.title?.rendered || song.title || "No Title";
					let thumbnailUrl = "/placeholder.jpg";
					const src = song.thumbnail || song.featured_media_url;
					if (src) {
						const fileName = src.split("/").pop().replace(/\.[a-zA-Z0-9]+$/, ".webp");
						thumbnailUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
					}
					const releaseDate = formatYearMonth(song.date) !== "Unknown Year"
						? formatYearMonth(song.date)
						: "不明な年";
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
						>
							<div className={styles.songLeftContainer}>
								<button
									className={
										styles.thumbnailContainer +
										((currentSongIndex !== null && currentSongIndex !== undefined && song.originalIndex === currentSongIndex) ? ' ' + styles.playingBorder : '')
									}
									onClick={() => onTrackPlay(song, index)}
									aria-label={`再生 ${decodeHtmlEntities(title)}`}
									style={{ marginRight: 16 }}
								>
									<img
										src={thumbnailUrl}
										alt={`${decodeHtmlEntities(title)} のサムネイル`}
										onError={(e) => {
											const wpWebp = (src) => src ? src.replace(/\.[a-zA-Z0-9]+$/, ".webp") : "";
											if (!e.currentTarget.dataset.triedWp) {
												e.currentTarget.dataset.triedWp = "1";
												e.currentTarget.src = wpWebp(song.thumbnail || song.featured_media_url || "");
											} else {
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
										</div>
										<div className={styles.line2} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
											<span style={{ fontSize: "0.85em" }}>{releaseDate}</span>
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
											onClick={(e) => handleThreeDotsClick(e, song, song.categories)}
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
						navigator.clipboard.writeText(`${window.location.origin}/${popupSong.artists[0]?.slug}/songs/${popupSong.titleSlug}`);
						setIsPopupVisible(false);
					}}
					renderMenuContent={({ song, onAddToPlaylist, onCopyUrl }) => {
						const menuButtonStlye = { display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer' };
						const menuItemStyle = { ...menuButtonStlye, textDecoration: 'none', color: 'inherit' };
						const separatorStyle = { borderBottom: '1px solid #eee' };
						const linkColorStyle = { color: '#007bff' };

						return (
							<>
								<div style={separatorStyle}>
									{song.artists?.map(artist => (
										<Link href={`/${artist.slug}`} key={artist.id} legacyBehavior>
											<a style={{ ...menuItemStyle, ...linkColorStyle, fontWeight: 'bold' }}>
												<img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
												{artist.name}
											</a>
										</Link>
									))}
								</div>

								<div style={separatorStyle}>
									<Link href={`/${song.artists[0]?.slug}/songs/${song.titleSlug}`} legacyBehavior>
										<a style={{...menuItemStyle, ...linkColorStyle}}>
											<img src="/svg/song.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
											{song.title?.rendered || "No Title"}
										</a>
									</Link>
								</div>

								{song.genres?.map(genre => (
									<div key={genre.term_id} style={separatorStyle}>
										<Link href={`/genres/${genre.slug}/1`} legacyBehavior>
											<a style={{...menuItemStyle, ...linkColorStyle}}>
												<img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
												{genre.name}
											</a>
										</Link>
									</div>
								))}

								<div style={separatorStyle}>
									<button onClick={onAddToPlaylist} style={menuButtonStlye}>
										<img src="/svg/add.svg" alt="" style={{ width: 16, marginRight: 8 }} />
										プレイリストに追加
									</button>
								</div>

								{song.spotifyTrackId && (
									<div style={separatorStyle}>
										<a href={`https://open.spotify.com/track/${song.spotifyTrackId}`} target="_blank" rel="noopener noreferrer" style={{...menuItemStyle, ...linkColorStyle}}>
											<img src="/svg/spotify.svg" alt="" style={{ width: 16, marginRight: 8 }} />
											Spotifyで開く
										</a>
									</div>
								)}

								<div>
									<button onClick={onCopyUrl} style={menuButtonStlye}>
										<img src="/svg/copy.svg" alt="" style={{ width: 16, marginRight: 8 }} />
										曲のURLをコピー
									</button>
								</div>
							</>
						)
					}}
				/>
			)}
			{showSavePopup && (
				<SaveToPlaylistPopup
					songId={selectedSongId}
					onClose={closeSavePopup}
				/>
			)}
		</div>
	);
}

SongListTopPage.propTypes = {
	songs: PropTypes.array,
	styleSlug: PropTypes.string,
	styleName: PropTypes.string,
	currentSongIndex: PropTypes.number,
	onTrackPlay: PropTypes.func,
	onNext: PropTypes.func,
	onPrevious: PropTypes.func,
	showTitle: PropTypes.bool,
	accessToken: PropTypes.string,
};