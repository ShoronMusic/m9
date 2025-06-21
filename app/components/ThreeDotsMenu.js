"use client";
import React, { useEffect, forwardRef } from "react";
import PropTypes from "prop-types";

const ThreeDotsMenu = forwardRef(function ThreeDotsMenu({
	song,
	triggerRect,
	onClose,
	onExternalLinkClick,
	renderMenuContent,
	onAddToPlaylist,
}, ref) {
	// 固定表示用のデフォルト位置を定義
	const defaultRect = { bottom: 100, right: 50 };
	// triggerRect が渡されなければ defaultRect を使用する
	const usedRect = triggerRect || defaultRect;
	// 固定位置で表示するスタイル（position: absolute を使用）
	const style = {
		position: "absolute",
		top: usedRect.top,
		left: usedRect.left,
		backgroundColor: "#fff",
		border: "1px solid #ccc",
		padding: "10px",
		boxShadow: "0 0 10px rgba(0,0,0,0.1)",
		zIndex: 10,
	};

	// ドキュメントクリックで自動的に閉じる（onClose コールバックを呼ぶ）
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (!e.target.closest(".three-dots-menu")) {
				onClose();
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, [onClose]);

	return (
		<div className="three-dots-menu" style={style} ref={ref}>
			{renderMenuContent ? (
				renderMenuContent(song, onExternalLinkClick)
			) : (
				<DefaultMenuContent
					song={song}
					onExternalLinkClick={onExternalLinkClick}
					onAddToPlaylist={onAddToPlaylist}
				/>
			)}
		</div>
	);
});

ThreeDotsMenu.propTypes = {
	song: PropTypes.object.isRequired,
	triggerRect: PropTypes.object, // 任意（固定位置を利用する場合は defaultRect が適用されます）
	onClose: PropTypes.func.isRequired,
	onExternalLinkClick: PropTypes.func,
	renderMenuContent: PropTypes.func,
	onAddToPlaylist: PropTypes.func.isRequired,
};

export default ThreeDotsMenu;

// デフォルトのメニュー内容コンポーネント
function DefaultMenuContent({ song, onExternalLinkClick, onAddToPlaylist }) {
	// アーティスト順序決定ロジック（SongListと同じ）
	function removeLeadingThe(str = "") {
		return str.replace(/^The\s+/i, "").trim();
	}
	function determineArtistOrder(song) {
		const categories = song.categories || [];
		function getComparableCatName(cat) {
			return removeLeadingThe((cat.name || "").toLowerCase().trim());
		}
		// (A) artist_order を優先
		if (song.acf?.artist_order) {
			const orderNames = song.acf.artist_order.split(",").map((n) => n.trim().toLowerCase());
			const matched = [];
			orderNames.forEach((artistName) => {
				const artistNameLower = removeLeadingThe(artistName.toLowerCase().trim());
				categories.forEach(cat => {
					console.log("[ThreeDotsMenu][artist_order] 比較:", getComparableCatName(cat), artistNameLower);
				});
				const foundCat = categories.find(
					(cat) => getComparableCatName(cat) === artistNameLower
				);
				if (foundCat) matched.push(foundCat);
			});
			if (matched.length > 0) return matched;
		}
		// (B) content.rendered を利用
		if (song.content?.rendered) {
			let contentStr = song.content.rendered.split("-")[0];
			contentStr = stripHtmlTags(contentStr); // タグ除去
			const contentArtists = contentStr.split(",").map((n) => n.trim().toLowerCase());
			const matched = [];
			contentArtists.forEach((artistName) => {
				const artistNameLower = removeLeadingThe(artistName.toLowerCase().trim());
				categories.forEach(cat => {
					console.log("[ThreeDotsMenu][content.rendered] 比較:", getComparableCatName(cat), artistNameLower);
				});
				const foundCat = categories.find(
					(cat) => getComparableCatName(cat) === artistNameLower
				);
				if (foundCat) matched.push(foundCat);
			});
			if (matched.length > 0) return matched;
		}
		// (C) spotify_artists を利用
		if (song.acf?.spotify_artists) {
			const spotifyNames = song.acf.spotify_artists.split(",").map((n) => n.trim().toLowerCase());
			const matched = [];
			spotifyNames.forEach((artistName) => {
				const artistNameLower = removeLeadingThe(artistName.toLowerCase().trim());
				categories.forEach(cat => {
					console.log("[ThreeDotsMenu][spotify_artists] 比較:", getComparableCatName(cat), artistNameLower);
				});
				const foundCat = categories.find(
					(cat) => getComparableCatName(cat) === artistNameLower
				);
				if (foundCat) matched.push(foundCat);
			});
			if (matched.length > 0) return matched;
		}
		return categories;
	}

	// HTMLタグを除去する関数
	function stripHtmlTags(str) {
		return str.replace(/<[^>]*>/g, "");
	}

	// デバッグ用ログ
	const orderedArtists = determineArtistOrder(song);
	console.log("[ThreeDotsMenu] song:", song);
	console.log("[ThreeDotsMenu] determineArtistOrder:", orderedArtists);

	return (
		<>
			{/* アーティストリンク */}
			<div style={{ marginBottom: "4px" }}>
				{song.categories &&
					song.categories.map((artist, idx) => (
						<div key={artist.term_id ? `artist-${artist.term_id}` : `artist-${artist.slug || idx}`}
							style={{ marginBottom: "4px" }}>
							<a
								href={`/${artist.slug}/`}
								onClick={onExternalLinkClick}
								style={{
									display: "flex",
									alignItems: "flex-start",
									textDecoration: "none",
									color: "#1e6ebb",
								}}
							>
								<img
									src="/svg/musician.png"
									alt="Musician"
									style={{
										width: "16px",
										height: "16px",
										marginRight: "4px",
										flexShrink: 0,
									}}
								/>
								<span>{artist.name}</span>
							</a>
						</div>
					))}
			</div>
			<hr />
			{/* タイトルリンク */}
			<div style={{ marginBottom: "4px" }}>
				{(() => {
					const orderedArtists = determineArtistOrder(song);
					return orderedArtists[0] ? (
						<a
							href={`/${orderedArtists[0].slug}/songs/${song.slug}/`}
							onClick={onExternalLinkClick}
							style={{
								display: "flex",
								alignItems: "flex-start",
								textDecoration: "none",
								color: "#1e6ebb",
							}}
						>
							<img
								src="/svg/song.png"
								alt="Song"
								style={{
									width: "16px",
									height: "16px",
									marginRight: "4px",
									flexShrink: 0,
								}}
							/>
							<span>{song.title?.rendered || "No Title"}</span>
						</a>
					) : null;
				})()}
			</div>
			<hr />
			{/* ジャンルリンク */}
			<div style={{ marginBottom: "4px" }}>
				{song.genre &&
					song.genre.map((g) => (
						<div key={g.term_id} style={{ marginBottom: "4px" }}>
							<a
								href={`/genres/${g.slug}/1`}
								onClick={onExternalLinkClick}
								style={{
									display: "flex",
									alignItems: "flex-start",
									textDecoration: "none",
									color: "#1e6ebb",
								}}
							>
								<img
									src="/svg/genre.png"
									alt="Genre"
									style={{
										width: "16px",
										height: "16px",
										marginRight: "4px",
										flexShrink: 0,
									}}
								/>
								<span>{g.name}</span>
							</a>
						</div>
					))}
			</div>
			<hr />
			{/* YouTubeリンク */}
			<div style={{ marginBottom: "4px" }}>
				{song.acf?.ytvideoid && (
					<a
						href={`https://www.youtube.com/watch?v=${song.acf.ytvideoid}`}
						target="_blank"
						rel="noopener noreferrer"
						onClick={onExternalLinkClick}
						style={{
							display: "flex",
							alignItems: "flex-start",
							textDecoration: "none",
							color: "#1e6ebb",
						}}
					>
						<img
							src="/svg/youtube.svg"
							alt="YouTube"
							style={{
								width: "20px",
								height: "20px",
								marginRight: "4px",
								flexShrink: 0,
							}}
						/>
						<span>YouTube</span>
						<img
							src="/svg/new-window.svg"
							alt="New Window"
							style={{
								width: "16px",
								height: "16px",
								marginLeft: "4px",
								verticalAlign: "middle",
							}}
						/>
					</a>
				)}
			</div>
			<hr />
			{/* Spotifyリンク */}
			<div>
				{song.acf?.spotify_track_id && (
					<a
						href={`https://open.spotify.com/track/${song.acf.spotify_track_id}`}
						target="_blank"
						rel="noopener noreferrer"
						onClick={onExternalLinkClick}
						style={{
							display: "flex",
							alignItems: "flex-start",
							textDecoration: "none",
							color: "#1e6ebb",
						}}
					>
						<img
							src="/svg/spotify.svg"
							alt="Spotify"
							style={{
								width: "20px",
								height: "20px",
								marginRight: "4px",
								flexShrink: 0,
							}}
						/>
						<span>Spotify</span>
						<img
							src="/svg/new-window.svg"
							alt="New Window"
							style={{
								width: "16px",
								height: "16px",
								marginLeft: "4px",
								verticalAlign: "middle",
							}}
						/>
					</a>
				)}
			</div>
			<hr />
			{/* プレイリストに追加ボタン */}
			<div style={{ marginBottom: "4px", cursor: "pointer" }}>
				<button
					onClick={() => {
						onAddToPlaylist(song.id);
						if (onExternalLinkClick) onExternalLinkClick();
					}}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "6px 10px",
						background: "transparent",
						border: "none",
						cursor: "pointer",
						color: "#1e6ebb",
					}}
				>
					<img
						src="/svg/add.svg"
						alt="Add"
						style={{ width: "16px", height: "16px" }}
					/>
					<span>プレイリストに追加</span>
				</button>
			</div>
		</>
	);
}

DefaultMenuContent.propTypes = {
	song: PropTypes.object.isRequired,
	onExternalLinkClick: PropTypes.func,
	onAddToPlaylist: PropTypes.func.isRequired,
};
