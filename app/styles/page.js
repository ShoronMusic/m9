// src/app/styles/page.js

import Link from 'next/link';
import Layout from '../components/Layout';
import fs from 'fs/promises';
import path from 'path';
import styles from './StylesPage.module.css'; // CSS Modules のインポート
import StyleBanner from '../components/StyleBanner'; // バナーコンポーネントをインポート
import he from 'he'; // Import the 'he' library for decoding
import { STYLE_CONFIG } from '../config/config'; // 追加

export const metadata = {
	title: 'Styles List | Music8',
	description:
		'Browse through our categorized list of music styles including Pop, Dance, Alternative, Electronica, R&B, Hip-hop, and Rock. By listening to your favorite style playlists on Music8, you can keep up with the latest tracks.',
};

// スタイルサマリーデータを取得する関数 (Modified to decode names)
async function getStylesSummaryData() {
	try {
		const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
		const baseUrl = isRemote
			? process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/"
			: `file://${path.join(process.cwd(), "public", "data")}`;

		if (isRemote) {
			const res = await fetch(`${baseUrl}/styles_summary.json`);
			if (res.ok) {
				const stylesData = await res.json();
				const desiredOrder = STYLE_CONFIG.list.map(style => style.id);
				return stylesData
					.filter(style => desiredOrder.includes(style.slug))
					.map(style => ({
						...style,
						name: he.decode(style.name || '')
					}))
					.sort((a, b) => desiredOrder.indexOf(a.slug) - desiredOrder.indexOf(b.slug));
			}
			return [];
		} else {
			const filePath = path.join(process.cwd(), "public", "data", "styles_summary.json");
			const fileContent = await fs.readFile(filePath, 'utf-8');
			const stylesData = JSON.parse(fileContent);
			const desiredOrder = STYLE_CONFIG.list.map(style => style.id);
			return stylesData
				.filter(style => desiredOrder.includes(style.slug))
				.map(style => ({
					...style,
					name: he.decode(style.name || '')
				}))
				.sort((a, b) => desiredOrder.indexOf(a.slug) - desiredOrder.indexOf(b.slug));
		}
	} catch (error) {
		console.error('Error reading styles summary data:', error);
		return [];
	}
}

async function StylesPage() {
	// スタイルサマリーデータを取得
	const stylesData = await getStylesSummaryData();

	return (
        <Layout pageTitle="Styles List">
            <div className={styles.styleListContainer}>
				<h1>Styles List</h1>
				<div className={styles.bannerGrid}>
					{stylesData.map((styleData) => (
						// Pass decoded data to the banner component
						(<StyleBanner key={styleData.slug} style={styleData} updateDate={styleData.updateDate} />)
					))}
				</div>
			</div>
        </Layout>
    );
}

// The old function getStylesWithSongCountsAndDate is no longer needed and removed.

export default StylesPage;