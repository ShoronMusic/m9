// app/info/page.js
import React from "react";
import Link from 'next/link';
import styles from './InfoPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://xs867261.xsrv.jp/data/data';

async function getSongCount() {
	try {
		const res = await fetch(`${API_BASE_URL}/songs.json`);
		if (!res.ok) {
			console.error('[getSongCount] Error fetching songs.json:', res.status);
			return 0;
		}
		const data = await res.json();
		return Array.isArray(data) ? data.length : 0;
	} catch (error) {
		console.error('[getSongCount] Error:', error);
		return 0;
	}
}

async function getArtistCount() {
	try {
		const res = await fetch(`${API_BASE_URL}/stats/artists.json`);
		if (!res.ok) {
			console.error('[getArtistCount] Error fetching artist count:', res.status);
			return 0;
		}
		const data = await res.json();
		return data.count || 0;
	} catch (error) {
		console.error('[getArtistCount] Error:', error);
		return 0;
	}
}

async function getGenreCount() {
	try {
		const res = await fetch(`${API_BASE_URL}/stats/genres.json`);
		if (!res.ok) {
			console.error('[getGenreCount] Error fetching genre count:', res.status);
			return 0;
		}
		const data = await res.json();
		return data.count || 0;
	} catch (error) {
		console.error('[getGenreCount] Error:', error);
		return 0;
	}
}

export default function Info() {
	const songCount = '17,000';
	const artistCount = '5,700';
	const genreCount = '500';

	return (
		<div className={styles.infoContainer}>
			<main>
				        <h1>About TuneDive</h1>
				<hr />
				<div className={styles.infoPage}>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-music" style={{color:'#1e6ebb'}}></i> サイト概要</h2>
						        <p><b>TuneDive</b>は、幅広いジャンルとスタイルで{songCount}曲以上の洋楽を提供しています。{artistCount}人以上のアーティストと{genreCount}のジャンルを網羅しています。</p>
					</section>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-book-open" style={{color:'#1e6ebb'}}></i> サブスク時代のガイドブック</h2>
						<p>
							星の数ほどある楽曲から、好きなだけ聴き放題のサブスク時代。<br />
							お得で魅力的なサービスの到来に感謝しつつも、選択肢が増えた今、本当に「お気に入りの一曲」に出会えるチャンスは増えたのでしょうか？それとも…？<br />
							        そんな音楽の楽しみ方が大きく変わった今だからこそ、<b>TuneDive</b>は"音楽ガイドブック"として、あなたの新しい出会いをサポートします。<br />
        迷ったとき、もっと深く知りたいとき、ぜひ<b>TuneDive</b>を活用してください！
						</p>
					</section>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-water" style={{color:'#06b6d4'}}></i> Dive Deeper into Spotify Music</h2>
						<p>
							<b>TuneDive</b>は、Spotifyユーザーのための深堀音楽発見サイトです。<br />
							既存のSpotifyプレイリストを超えた音楽体験を提供し、あなたの音楽の世界をより深く、より広く広げます。<br />
							音楽の深層に潜り、新しいアーティスト、新しいジャンル、新しい発見を体験してください。<br />
							「音楽の深層に潜る」というコンセプトのもと、Spotifyの豊富な楽曲ライブラリを活用しながら、より深い音楽探求の旅をお楽しみいただけます。
						</p>
					</section>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-link"></i> つながりの発見</h2>
						<p>
							「この曲、いいな」と思ったら、アーティスト情報だけでなく、スタイルやジャンルにも注目してみてください。<br />スタイルやジャンル × 時代 を意識して聴くと、自分の好みが見えてきます。好きなジャンルが見つかると、同時代のアーチストから新たな発見に繋がり、視聴の幅が広かっていくと思います。
							        <b>TuneDive</b>では、デジタルだけでは難しいジャンル分けを人の手で丁寧に行っているので、ジャンルの精度が高いのが自慢です。<br />
							お気に入りの1曲をきっかけに、スタイルやジャンルをたどって"数珠つなぎ"のように次の曲・次の曲へと出会いが広がります。<br />
							ぜひ色々な曲を巡って、あなたの「好き」をどんどん増やしてください！<br />
							サイトへのご意見・ご感想もお待ちしています。
						</p>
					</section>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-star" style={{color:'#f7b731'}}></i> 主な特徴</h2>
						<ul>
							<li><i className="fas fa-list"></i> <b>スタイル別一覧:</b> 8つのスタイルで楽曲を分類</li>
							<li><i className="fas fa-tags"></i> <b>ジャンル別一覧:</b> {genreCount}以上のジャンルを探索</li>
							<li><i className="fas fa-user"></i> <b>アーティスト別一覧:</b> {artistCount}人以上のアーティスト</li>
							<li>
								<i className="fas fa-calendar-alt"></i>
								<b>年代グルーピング:</b>
								各一覧ページでは公開年ごとにグループ分け！年代を追って曲の移り変わりを比較
							</li>
							<li><i className="fas fa-search"></i> <b>インデックス検索:</b> アーティスト名の頭文字で検索</li>
							<li><i className="fab fa-spotify" style={{color:'#1db954'}}></i> <b>Spotifyプレイヤー:</b> サムネイルクリックで直接再生</li>
							<li>
								<i className="fas fa-play-circle"></i>
								各一覧ページのソングリストでは上からページをまたいで連続再生！<br />
								お気に入りのアーチストやスタイル、ジャンルをプレイリストとして視聴♫
							</li>
							<li><i className="fas fa-mobile-alt"></i> <b>レスポンシブデザイン:</b> PC/スマホ両対応</li>
							<li>
								<i className="fas fa-external-link-alt"></i>
								<b>ワンクリック外部リンク:</b>
								掲載曲ごとに
								<i className="fab fa-spotify" style={{color:'#1db954', marginLeft: '8px'}}></i> Spotify ページへも一発アクセス
							</li>
						</ul>
					</section>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-exclamation-triangle" style={{color:'#e17055'}}></i> ご注意</h2>
						<p>
							ジャンルやスタイルの分類は主観を含みます。また、公開年月やアーティスト情報なども、できる限り正確を期していますが、誤りが含まれる場合があります。<br />
							情報の正確性には努めておりますが、もし誤りやお気づきの点がございましたら、ぜひご連絡ください。
						</p>
					</section>
					<section className={styles.infoSection}>
						<h2><i className="fas fa-envelope" style={{color:'#1e6ebb'}}></i> お問い合わせ</h2>
						        <p><i className="fas fa-paper-plane"></i> Email: <a href="mailto:contact@tunedive.com">contact@tunedive.com</a></p>
						<p><i className="fas fa-user-shield"></i> <a href="/privacy">プライバシーポリシー</a></p>
					</section>
				</div>
			</main>
		</div>
	);
}