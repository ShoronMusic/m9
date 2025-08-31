
document.addEventListener('DOMContentLoaded', function () {
	var spotifyButton = document.getElementById('spotify-button');
	if (spotifyButton) {
		spotifyButton.addEventListener('click', function (event) {
			event.preventDefault();
			var trackID = document.getElementById('acf-field_64d74d27b4956').value;
			if (!trackID) {
				alert('Spotify Track IDを入力してください。');
				return;
			}
			console.log('Spotifyボタンがクリックされました。Track ID:', trackID);
			fetchSpotifyData(trackID);
		});
	} else {
		console.error("Element with ID 'spotify-button' not found.");
	}
});

function fetchSpotifyData(trackID) {
	console.log('Spotifyデータの取得を開始:', trackID);
	
	// クライアント認証フローを使用
	const client_id = '409da5333f634c4fbdfa4982f884ebcf';
	const client_secret = '85f65c88f974475585ff92f54d91eea3';
	
	// クライアント認証でトークンを取得
	fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Authorization': 'Basic ' + btoa(client_id + ':' + client_secret),
		},
		body: 'grant_type=client_credentials',
	})
	.then(response => response.json())
	.then(data => {
		if (data.access_token) {
			console.log('アクセストークンを取得しました');
			fetchTrackAndAudioFeatures(trackID, data.access_token);
		} else {
			console.error('トークン取得に失敗:', data);
			alert('Spotify APIトークンの取得に失敗しました。');
		}
	})
	.catch(error => {
		console.error('トークン取得エラー:', error);
		alert('Spotify APIへの接続に失敗しました。');
	});
}

function fetchTrackAndAudioFeatures(trackID, access_token) {
	return Promise.all([
		fetch('https://api.spotify.com/v1/tracks/' + trackID, {
			headers: { 
				Authorization: 'Bearer ' + access_token,
				'Accept-Language': 'en' 
			},
		}).then((response) => {
			console.log('トラック情報取得レスポンス:', response.status, response.statusText);
			if (!response.ok) {
				throw new Error(`トラック情報取得エラー: ${response.status} ${response.statusText}`);
			}
			return response.json();
		}),
		
		fetch('https://api.spotify.com/v1/audio-features/' + trackID, {
			headers: { 
				Authorization: 'Bearer ' + access_token,
				'Accept-Language': 'en' 
			},
		}).then((response) => {
			console.log('Audio Features取得レスポンス:', response.status, response.statusText);
			if (!response.ok) {
				if (response.status === 403) {
					console.log('Audio Features APIで403エラー。基本情報のみ取得します。');
					return null; // Audio Featuresは取得できない場合
				}
				throw new Error(`Audio Features取得エラー: ${response.status} ${response.statusText}`);
			}
			return response.json();
		}),
	])
	.then(([trackData, audioFeatures]) => {
		console.log('トラックデータ:', trackData);
		console.log('Audio Features:', audioFeatures);
		
		// トラック情報を設定
		if (trackData) {
			// タイトル
			const titleField = document.getElementById('title');
			if (titleField && trackData.name) {
				titleField.value = trackData.name;
				console.log('タイトルを設定:', trackData.name);
			}
			
			// アーティスト
			if (trackData.artists && trackData.artists.length > 0) {
				const artistNames = trackData.artists.map(artist => artist.name).join(', ');
				const artistField = document.getElementById('acf-field_64d74d27b4956');
				if (artistField) {
					artistField.value = artistNames;
					console.log('アーティストを設定:', artistNames);
				}
			}
			
			// アルバム
			if (trackData.album && trackData.album.name) {
				const albumField = document.getElementById('acf-field_64d74d27b4956');
				if (albumField) {
					albumField.value = trackData.album.name;
					console.log('アルバムを設定:', trackData.album.name);
				}
			}
			
			// リリース日
			if (trackData.album && trackData.album.release_date) {
				const releaseDateField = document.getElementById('acf-field_64d74d27b4956');
				if (releaseDateField) {
					releaseDateField.value = trackData.album.release_date;
					console.log('リリース日を設定:', trackData.album.release_date);
				}
			}
		}
		
		// Audio Featuresを設定（利用可能な場合）
		if (audioFeatures) {
			// ダンス性
			if (audioFeatures.danceability !== undefined) {
				const danceabilityField = document.getElementById('acf-field_64d74d27b4956');
				if (danceabilityField) {
					danceabilityField.value = Math.round(audioFeatures.danceability * 100);
					console.log('ダンス性を設定:', Math.round(audioFeatures.danceability * 100));
				}
			}
			
			// エネルギーレベル
			if (audioFeatures.energy !== undefined) {
				const energyField = document.getElementById('acf-field_64d74d27b4956');
				if (energyField) {
					energyField.value = Math.round(audioFeatures.energy * 100);
					console.log('エネルギーレベルを設定:', Math.round(audioFeatures.energy * 100));
				}
			}
			
			// テンポ
			if (audioFeatures.tempo !== undefined) {
				const tempoField = document.getElementById('acf-field_64d74d27b4956');
				if (tempoField) {
					tempoField.value = Math.round(audioFeatures.tempo);
					console.log('テンポを設定:', Math.round(audioFeatures.tempo));
				}
			}
			
			// バレンス
			if (audioFeatures.valence !== undefined) {
				const valenceField = document.getElementById('acf-field_64d74d27b4956');
				if (valenceField) {
					valenceField.value = Math.round(audioFeatures.valence * 100);
					console.log('バレンスを設定:', Math.round(audioFeatures.valence * 100));
				}
			}
		}
		
		alert('Spotifyデータの取得が完了しました！');
	})
	.catch(error => {
		console.error('情報の取得中にエラーが発生しました:', error);
		alert(`エラーが発生しました: ${error.message}`);
	});
}

// spotifysearch 2023.09.21

// Spotifyで曲を検索する関数
function searchSpotifyTrack(artist, track) {
	console.log('Spotify検索開始:', artist, track);
	
	var access_token; // 外側のスコープで定義

	var data = new FormData();
	data.append('action', 'fetch_spotify_data');

	fetch(spotifyApiSettings.ajax_url, {
		method: 'POST',
		body: data,
	})
	.then((response) => response.json())
	.then((data) => {
		var client_id = data.client_id;
		var client_secret = data.client_secret;

		// Spotifyのトークン取得
		return fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': 'Basic ' + btoa(client_id + ':' + client_secret),
			},
			body: 'grant_type=client_credentials',
		});
	})
	.then((response) => response.json())
	.then((data) => {
		access_token = data.access_token;

		return fetch(`https://api.spotify.com/v1/search?q=track:${track}%20artist:${artist}&type=track&limit=1`, {
			headers: { 
				Authorization: 'Bearer ' + access_token,
				'Accept-Language': 'en' 
			},
		});
	})
	.then((response) => response.json())
	.then((data) => {
		if (data.tracks.items.length > 0) {
			var trackId = data.tracks.items[0].id;
			document.getElementById('acf-field_64d74d27b4956').value = trackId;
			console.log('検索結果のTrack ID:', trackId);
		} else {
			console.warn('No tracks found for the given artist and track name.');
		}
	})
	.catch((error) => {
		console.error('Error fetching track from Spotify:', error);
	});
}

// イベントリスナーの追加
document.addEventListener('DOMContentLoaded', function () {
	var spotifySearchButton = document.getElementById('spotify-search-button');
	if (spotifySearchButton) {
		spotifySearchButton.addEventListener('click', function (event) {
			event.preventDefault();
			
			// 記事の本文からアーチスト名と曲名を取得
			var content = document.getElementById('content').value;
			var parts = content.split(' - ');
			if (parts.length >= 2) {
				var artist = parts[0];
				var track = parts[1];
				
				// Spotify APIで曲を検索
				searchSpotifyTrack(artist, track);
			} else {
				console.warn('Could not parse artist and track name from content.');
			}
		});
	} else {
		console.error("Element with ID 'spotify-search-button' not found.");
	}
});

// spotifyimage取得 2023.09.21

document.addEventListener('DOMContentLoaded', function () {
	var btn = document.createElement('button');
	btn.textContent = 'Execute Actions';
	btn.addEventListener('click', function (event) {
		event.preventDefault();
		copyPostContentToClipboard();
		openSpotifyImageInNewTab();
	});

	// ボタンを投稿エディタに追加
	var postBox = document.getElementById('postdivrich');
	if (postBox) {
		postBox.appendChild(btn);
	}
});

function copyPostContentToClipboard() {
	var postContent = document.getElementById('content');
	if (!postContent) {
		console.error('The post content editor was not found.');
		return;
	}

	// コピー処理
	postContent.select();
	document.execCommand('copy');
}

function openSpotifyImageInNewTab() {
	var spotifyImageField = document.getElementById('acf-field_64d74d93b495b');
	if (!spotifyImageField || !spotifyImageField.value) {
		console.error('The Spotify image field was not found or is empty.');
		return;
	}

	// 新しいタブで開く
	window.open(spotifyImageField.value, '_blank');
}



