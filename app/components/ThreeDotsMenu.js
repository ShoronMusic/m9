"use client";
import React, { useEffect, forwardRef, useRef } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import { mergeRefs } from "react-merge-refs";
import styles from "./ThreeDotsMenu.module.css";

const ThreeDotsMenu = forwardRef(function ThreeDotsMenu({
	song,
	position,
	onClose,
	onAddToPlaylist,
	onCopyUrl,
	renderMenuContent,
}, ref) {
	const menuRef = useRef(null);

	// ドキュメントクリックで自動的に閉じる（onClose コールバックを呼ぶ）
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (menuRef.current && !menuRef.current.contains(event.target)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [onClose]);

	return ReactDOM.createPortal(
		<div
			ref={mergeRefs([ref, menuRef])}
			className={styles.menu}
			style={{ top: position.top, left: position.left }}
			onClick={(e) => e.stopPropagation()}
		>
			{/* renderMenuContentが提供されていればそれを優先して使用 */}
			{renderMenuContent ? renderMenuContent({ song, onAddToPlaylist, onCopyUrl }) : (
				// フォールバック（通常は使われない）
				<button onClick={onAddToPlaylist}>プレイリストに追加</button>
			)}
		</div>,
		document.body
	);
});

ThreeDotsMenu.propTypes = {
	song: PropTypes.object.isRequired,
	position: PropTypes.object.isRequired,
	onClose: PropTypes.func.isRequired,
	onAddToPlaylist: PropTypes.func.isRequired,
	onCopyUrl: PropTypes.func,
	renderMenuContent: PropTypes.func,
};

export default ThreeDotsMenu;
