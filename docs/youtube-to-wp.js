document.addEventListener('DOMContentLoaded', function() {
		var urlParams = new URLSearchParams(window.location.search);
		var title = urlParams.get('title');
		var artistString = urlParams.get('artist');
		var youtube_id = urlParams.get('youtube_id');
		var publish_date = urlParams.get('publish_date');

		console.log("Original Title:", title);
		console.log("Original Artist String:", artistString);
		console.log("YouTube ID:", youtube_id);
		console.log("Publish Date:", publish_date);

		var combinedTitle = title;
		var combinedContent = title;
		if (artistString) {
				var artists = artistString.split(',').map(function(artist) {
						return artist.replace(/\(\d+\)\s*/g, "").trim().replace(/^(the|THE|The)\s+/g, "").trim();
				});

				// アーティスト名がある場合、アーティスト名と曲名を結合
				combinedContent = artists.join(', ') + ' - ' + title;
		} else {
				// アーティスト表記がない場合に検索ワードからアーティストを取得
				var searchBox = document.querySelector('input#search');
				var searchQuery = '';
				if (searchBox && searchBox.value) {
						searchQuery = searchBox.value.replace(/\(\d+\)/g, '').trim();
				}
				var searchParts = searchQuery.split(' - ');
				if (searchParts.length > 1) {
						artistString = searchParts[0].trim();
						combinedContent = artistString + ' - ' + title;
				}
		}

		// 不要なテキストパターンの配列
		var unnecessaryTexts = ["Visualizer", "Official Video", "Lyric Video", "\\| Vevo", "\\| .*", "\\[Official Music Video\\]", "\\[Official Lyric Video\\]"];
		// 不要なテキストを削除する関数
		unnecessaryTexts.forEach(function(text) {
				var textRegex = new RegExp(text, "gi");
				if (title) {
						title = title.replace(textRegex, "");
				}
		});
		if (title) {
				title = title.replace(/(\(.*?\)|\[.*?\]|\{.*?\})\s*/g, "").trim();
				title = title.replace(/(Official\s*Music\s*Video|Official\s*Video|OFFICIAL\s*MUSIC\s*VIDEO|Official\s*Audio|Official\s*Visualizer)/gi, "").trim();
		}

		// タイトル欄に挿入（タイトルのみ）
		var titleField = document.getElementById('title');
		if (titleField && title) {
				titleField.value = decodeURIComponent(title).trim();
				console.log("Title Field Value:", titleField.value);
		}

		// 本文欄に挿入（アーティスト名 - タイトル）
		var contentTextArea = document.getElementById('content');
		if (contentTextArea) {
				if (artistString && title) {
						contentTextArea.value = (artistString + ' - ' + title).trim();
				} else if (title) {
						contentTextArea.value = decodeURIComponent(title).trim();
				}
				console.log("Content Text Area Value:", contentTextArea.value);
		}

		var categoryCheckboxes = document.querySelectorAll('#categorychecklist input[type="checkbox"]');
		if (artistString && artists) {
				artists.forEach(function(artist) {
						categoryCheckboxes.forEach(function(checkbox) {
								var label = checkbox.parentNode.textContent.trim();
								if (label.toLowerCase() === artist.toLowerCase()) {
										checkbox.checked = true;
								}
						});
				});
		}

		var youtubeIdField = document.getElementById('acf-field_64d689d5bfe08');
		if (youtube_id && youtubeIdField) {
				youtubeIdField.value = youtube_id;
		}

		var publishDateField = document.getElementById('acf-field_64d68f7092e73');
		if (publish_date && publishDateField) {
				publishDateField.value = publish_date;
		}
});
