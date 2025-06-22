"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import ThreeDotsMenu from "./ThreeDotsMenu";
import styles from "./SongListTopPage.module.css";
import MicrophoneIcon from "./MicrophoneIcon";
import { firestore, auth } from "./firebase";
import { getThumbnailPath } from '@/lib/utils';
import {
	collection,
	getDocs,
	getDoc,
	doc,
	updateDoc,
	setDoc,
	arrayUnion,
	arrayRemove,
	query,
	where,
} from "firebase/firestore";
import SaveToPlaylistPopup from "./SaveToPlaylistPopup";
import Link from "next/link";
import { usePlayer } from './PlayerContext';

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

// Firestore から視聴回数を取得する関数
async function fetchViewCounts(songs) {
	const cachedViewCounts = typeof window !== "undefined" ? localStorage.getItem("viewCounts") : null;
	const cachedUserViewCounts =
		typeof window !== "undefined" ? localStorage.getItem("userViewCounts") : null;
	const viewCountsData = {};
	const userViewCountsData = {};
	if (cachedViewCounts) {
		Object.assign(viewCountsData, JSON.parse(cachedViewCounts));
	}
	if (cachedUserViewCounts) {
		Object.assign(userViewCountsData, JSON.parse(cachedUserViewCounts));
	}
	const songIds = songs.map((song) => String(song.id)).filter(Boolean);
	if (songIds.length > 0) {
		const chunkedIds = [];
		for (let i = 0; i < songIds.length; i += 30) {
			chunkedIds.push(songIds.slice(i, i + 30));
		}
		const promises = chunkedIds.map((chunk) => {
			const songViewsQuery = query(
				collection(firestore, "songViews"),
				where("__name__", "in", chunk)
			);
			return getDocs(songViewsQuery);
		});
		const snapshots = await Promise.all(promises);
		snapshots.forEach((snapshot) => {
			snapshot.forEach((docSnap) => {
				const data = docSnap.data();
				viewCountsData[docSnap.id] = data.totalViewCount || 0;
			});
		});
		if (auth.currentUser) {
			const userId = auth.currentUser.uid;
			const userViewPromises = songIds.map(async (songId) => {
				const userViewsRef = doc(firestore, `usersongViews/${songId}/userViews/${userId}`);
				const userViewDoc = await getDoc(userViewsRef);
				if (userViewDoc.exists()) {
					const userData = userViewDoc.data();
					userViewCountsData[songId] = userData.viewCount2 || 0;
				} else {
					userViewCountsData[songId] = 0;
				}
			});
			await Promise.all(userViewPromises);
		}
		if (typeof window !== "undefined") {
			localStorage.setItem("viewCounts", JSON.stringify(viewCountsData));
			localStorage.setItem("userViewCounts", JSON.stringify(userViewCountsData));
		}
	}
	return { viewCountsData, userViewCountsData };
}

export default function SongListTopPage({
	songs = [],
	styleSlug,
	styleName,
	currentSongIndex = 0,
	onTrackPlay,
	onNext,
	onPrevious,
	showTitle = true,
}) {
	const { currentTrack } = usePlayer();
	const [menuVisible, setMenuVisible] = useState(false);
	const [menuTriggerRect, setMenuTriggerRect] = useState(null);
	const [selectedSong, setSelectedSong] = useState(null);
	const [likedSongs, setLikedSongs] = useState({});
	const [likeCounts, setLikeCounts] = useState({});
	const [viewCounts, setViewCounts] = useState({});
	const [userViewCounts, setUserViewCounts] = useState({});
	const [showSavePopup, setShowSavePopup] = useState(false);
	const [selectedSongId, setSelectedSongId] = useState(null);
	const [menuHeight, setMenuHeight] = useState(0);
	const menuRef = useRef(null);

	useEffect(() => {
		const unsubscribe = auth.onAuthStateChanged(async (user) => {
			await fetchLikes(user ? user.uid : null);
		});
		return () => unsubscribe();
	}, [songs]);

	useEffect(() => {
		(async () => {
			const { viewCountsData, userViewCountsData } = await fetchViewCounts(songs);
			setViewCounts(viewCountsData);
			setUserViewCounts(userViewCountsData);
		})();
	}, [songs]);
    
    useEffect(() => {
		if (menuVisible && menuRef.current) {
			setMenuHeight(menuRef.current.offsetHeight);
		}
	}, [menuVisible]);

	const fetchLikes = async (userId = null) => {
		const likeCountsData = {};
		const likedSongsData = {};
		try {
			const querySnapshot = await getDocs(collection(firestore, "likes"));
			querySnapshot.forEach((docSnap) => {
				const data = docSnap.data();
				likeCountsData[docSnap.id] = data.likeCount || 0;
				if (userId && data.userIds && data.userIds.includes(userId)) {
					likedSongsData[docSnap.id] = true;
				}
			});
			setLikeCounts(likeCountsData);
			setLikedSongs(likedSongsData);
		} catch (error) {
			console.error("Error fetching likes:", error);
			setLikeCounts({});
			setLikedSongs({});
		}
	};

	const toggleLike = async (songId) => {
		if (!auth.currentUser) {
			alert("ログインしてください");
			return;
		}
		const userId = auth.currentUser.uid;
		const likeRef = doc(firestore, "likes", songId);
		try {
			if (likedSongs[songId]) {
				// いいね解除
				await updateDoc(likeRef, {
					userIds: arrayRemove(userId),
					likeCount: Math.max((likeCounts[songId] || 0) - 1, 0),
				});
				setLikedSongs((prev) => ({ ...prev, [songId]: false }));
				setLikeCounts((prev) => ({
					...prev,
					[songId]: Math.max((prev[songId] || 0) - 1, 0),
				}));
			} else {
				// 初回の場合、ドキュメントがなければ作成
				const docSnapshot = await getDoc(likeRef);
				if (!docSnapshot.exists()) {
					await setDoc(likeRef, { userIds: [], likeCount: 0 });
				}
				// いいね追加
				await updateDoc(likeRef, {
					userIds: arrayUnion(userId),
					likeCount: (likeCounts[songId] || 0) + 1,
				});
				setLikedSongs((prev) => ({ ...prev, [songId]: true }));
				setLikeCounts((prev) => ({
					...prev,
					[songId]: (prev[songId] || 0) + 1,
				}));
			}
		} catch (error) {
			console.error("Error toggling like:", error);
			alert("エラーが発生しました。もう一度お試しください。");
		}
	};

	const handleThreeDotsClick = (e, song, categories) => {
		e.stopPropagation();
		const iconRect = e.currentTarget.getBoundingClientRect();
		const menuWidth = 200; // ポップアップの想定幅(px)
		const windowWidth = window.innerWidth;
		let left = iconRect.right + window.scrollX;
		if (left + menuWidth > windowWidth) {
			left = windowWidth - menuWidth - 8; // 8pxは余白
			if (left < 0) left = 0;
		}
		setMenuTriggerRect({
			top: iconRect.bottom + window.scrollY - menuHeight,
			left
		});
		setSelectedSong({ ...song, genre: song.genre_data, categories });
		setMenuVisible(true);
	};

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
					const likeCount = likeCounts[songId] || 0;
					const isLiked = likedSongs[songId] || false;
					const viewCount = viewCounts[songId] || 0;
					const userViewCount = userViewCounts[songId] || 0;
					const isPlaying = currentTrack && currentTrack.id === song.id;
					const itemStyle = {
						backgroundColor: isPlaying ? '#e6f7ff' : 'transparent',
						borderRadius: isPlaying ? '8px' : '0'
					};

					return (
						<li 
							key={song.id} 
							id={`song-${song.id}`} 
							className={styles.songItem}
							style={itemStyle}
						>
							<div className="ranking-thumbnail-container"></div>
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
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
									<div className={styles.songInfo}>
										<div className={styles.title}>
											<div style={{ marginRight: "auto", display: "block" }}>
												{artistElements}
												<br />
												<span>{decodeHtmlEntities(title)}</span>
											</div>
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
									<div className={styles.metaInfo} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
										<span
											className={styles.likeIcon}
											onClick={(e) => {
												e.stopPropagation();
												toggleLike(String(song.id));
											}}
										>
											<img
												src={isLiked ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
												alt="Like"
												className={styles.likeIcon}
												style={{ width: "14px", height: "14px" }}
											/>
											{likeCount > 0 && (
												<span className={styles.likeCount} style={{ fontSize: "10px", marginLeft: "2px" }}>
													{likeCount}
												</span>
											)}
										</span>
										{viewCount > 0 && (
											<span className={styles.viewCount} style={{ fontSize: "10px", color: "#666", display: "inline-flex", alignItems: "center" }}>
												({viewCount}{userViewCount > 0 ? ` / ${userViewCount}` : ""})
											</span>
										)}
									</div>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
            
			{menuVisible && selectedSong &&
				ReactDOM.createPortal(
					<ThreeDotsMenu
						ref={menuRef}
						song={selectedSong}
						triggerRect={menuTriggerRect}
						onClose={() => setMenuVisible(false)}
						onAddToPlaylist={() => {
							setSelectedSongId(selectedSong.id);
							setShowSavePopup(true);
							setMenuVisible(false);
						}}
					/>,
					document.body
				)
			}
			{showSavePopup && (
				<SaveToPlaylistPopup
					songId={selectedSongId}
					onClose={() => setShowSavePopup(false)}
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
};