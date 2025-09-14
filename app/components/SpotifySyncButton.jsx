'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Spotify同期ボタンコンポーネント
 * TuneDiveプレイリストをSpotifyプレイリストに同期する機能
 * 
 * 既存のSupabaseテーブル構造を活用:
 * - playlists.spotify_playlist_id: 同期先のSpotifyプレイリストID
 * - playlists.sync_status: 同期状態管理
 * - playlists.last_synced_at: 最終同期日時
 */
export default function SpotifySyncButton({ 
  playlist, 
  onSyncComplete,
  className = '',
  size = 'medium' // 'small', 'medium', 'large'
}) {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [hasSpotifyChanges, setHasSpotifyChanges] = useState(false);
  const [changeNotification, setChangeNotification] = useState(null);
  const [hasCheckedChanges, setHasCheckedChanges] = useState(false);

  // プレイリストの同期状態を取得
  useEffect(() => {
    if (playlist?.id && session?.accessToken) {
      fetchSyncStatus();
      // Spotify側の変更もチェック
      checkSpotifyChanges();
    }
  }, [playlist?.id, session?.accessToken]);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(
        `/api/spotify/sync?action=check_sync_status&playlistId=${playlist.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.sync_status);
        setLastSyncTime(data.last_synced_at);
      } else {
        console.error('同期状態取得失敗:', response.status);
      }
    } catch (error) {
      console.error('同期状態取得エラー:', error);
    }
  };

  const checkSpotifyChanges = async () => {
    try {
      setIsChecking(true);
      setHasCheckedChanges(true); // チェック実行済みフラグを設定
      console.log('=== SpotifySyncButton: 変更検知開始 ===');
      console.log('プレイリストID:', playlist?.id);
      console.log('セッション状態:', !!session?.accessToken);

      const response = await fetch(
        `/api/spotify/sync?action=check_spotify_changes&playlistId=${playlist.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('=== SpotifySyncButton: 変更検知結果 ===');
        console.log('検知結果:', data);
        
        setHasSpotifyChanges(data.hasChanges);
        
        if (data.hasChanges) {
          console.log('🔄 変更検知: 通知を表示');
          setChangeNotification({
            message: data.message,
            playlistName: data.playlistName,
            currentSnapshotId: data.currentSnapshotId,
            lastSnapshotId: data.lastSnapshotId
          });
        } else {
          console.log('✅ 変更なし: 通知を非表示');
          setChangeNotification(null);
        }
      } else {
        console.error('Spotify変更検知失敗:', response.status);
        alert('変更チェックに失敗しました');
      }
    } catch (error) {
      console.error('Spotify変更検知エラー:', error);
      alert('変更チェックエラー: ' + error.message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSpotifySync = async () => {
    if (!session || !session.accessToken) {
      alert('Spotifyログインが必要です');
      return;
    }

    if (!playlist?.id) {
      alert('プレイリスト情報が見つかりません');
      return;
    }

    setIsLoading(true);
    setSyncStatus('syncing');

    try {
      const response = await fetch('/api/spotify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_to_spotify',
          playlistId: playlist.id
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      setSyncStatus('synced');
      setLastSyncTime(result.sync_timestamp);
      
      // 成功メッセージを表示
      const successMessage = `Spotifyプレイリストへの同期が完了しました！
追加曲数: ${result.tracks_added}/${result.tracks_total}曲
${result.spotify_playlist_url ? `\nSpotifyで確認: ${result.spotify_playlist_url}` : ''}`;

      alert(successMessage);

      // コールバック実行
      if (onSyncComplete) {
        onSyncComplete({
          success: true,
          result: result,
          playlist: playlist
        });
      }

      // 親コンポーネントに通知（プレイリスト更新など）
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('playlistSynced', {
          detail: { playlistId: playlist.id, result: result }
        }));
      }

      // 同期後に変更検知を再実行
      setTimeout(() => {
        checkSpotifyChanges();
      }, 1000);

    } catch (error) {
      console.error('Spotify同期エラー:', error);
      setSyncStatus('error');
      alert(`同期エラー: ${error.message}`);
      
      if (onSyncComplete) {
        onSyncComplete({
          success: false,
          error: error.message,
          playlist: playlist
        });
      }
    } finally {
      setIsLoading(false);
      // 3秒後にステータスをクリア
      setTimeout(() => {
        setSyncStatus(null);
      }, 3000);
    }
  };

  const handleImportFromSpotify = async () => {
    if (!session || !session.accessToken) {
      alert('Spotifyログインが必要です');
      return;
    }

    // 既存プレイリストの場合は直接インポート（変更検知の有無に関わらず）
    if (playlist?.spotify_playlist_id) {
      // 既存プレイリストの変更を直接インポート
      await handleExistingPlaylistImport();
    } else {
      // 新規プレイリストインポート（従来の動作）
      await handleNewPlaylistImport();
    }
  };

  const handleExistingPlaylistImport = async () => {
    try {
      setIsLoading(true);
      setSyncStatus('importing');

      const importResponse = await fetch('/api/spotify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'import_existing_playlist_changes',
          playlistId: playlist.id,
          spotifyPlaylistId: playlist.spotify_playlist_id
        }),
      });

      if (!importResponse.ok) {
        const errorText = await importResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error(`HTTP ${importResponse.status}: ${errorText}`);
        }
        throw new Error(errorData.error || 'インポートに失敗しました');
      }

      const importResult = await importResponse.json();

      setSyncStatus('imported');
      setHasSpotifyChanges(false);
      setChangeNotification(null);
      
      alert(`「${playlist.name}」の変更をインポートしました！\nインポート曲数: ${importResult.tracks_imported}曲`);

      if (onSyncComplete) {
        onSyncComplete({
          success: true,
          result: importResult,
          action: 'import_changes'
        });
      }

      // インポート後に変更検知を再実行
      setTimeout(() => {
        checkSpotifyChanges();
      }, 1000);

      // ページをリロードしてUIを更新
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('既存プレイリストインポートエラー:', error);
      setSyncStatus('error');
      alert(`インポートエラー: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setSyncStatus(null);
      }, 3000);
    }
  };

  const handleNewPlaylistImport = async () => {
    // Spotifyプレイリスト一覧を取得
    try {
      const response = await fetch('/api/spotify/sync?action=get_spotify_playlists', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        throw new Error(errorData.error || 'Spotifyプレイリスト一覧の取得に失敗しました');
      }

      const data = await response.json();
      const playlists = data.playlists || [];

      if (playlists.length === 0) {
        alert('Spotifyにプレイリストが見つかりません');
        return;
      }

      // プレイリスト選択ダイアログ
      const playlistNames = playlists.map(p => p.name);
      const selectedName = prompt(
        `インポートするSpotifyプレイリストを選択してください:\n\n${playlistNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}\n\n番号を入力してください:`
      );

      if (!selectedName) return;

      const selectedIndex = parseInt(selectedName) - 1;
      if (selectedIndex < 0 || selectedIndex >= playlists.length) {
        alert('無効な選択です');
        return;
      }

      const selectedPlaylist = playlists[selectedIndex];

      // インポート実行
      setIsLoading(true);
      setSyncStatus('importing');

      const importResponse = await fetch('/api/spotify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'import_from_spotify',
          spotifyPlaylistId: selectedPlaylist.id
        }),
      });

      if (!importResponse.ok) {
        const errorText = await importResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error(`HTTP ${importResponse.status}: ${errorText}`);
        }
        throw new Error(errorData.error || 'インポートに失敗しました');
      }

      const importResult = await importResponse.json();

      setSyncStatus('imported');
      alert(`Spotifyプレイリスト「${selectedPlaylist.name}」のインポートが完了しました！\nインポート曲数: ${importResult.tracks_imported}曲`);

      if (onSyncComplete) {
        onSyncComplete({
          success: true,
          result: importResult,
          action: 'import'
        });
      }

      // インポート後に変更検知を再実行
      setTimeout(() => {
        checkSpotifyChanges();
      }, 1000);

    } catch (error) {
      console.error('Spotifyインポートエラー:', error);
      setSyncStatus('error');
      alert(`インポートエラー: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setSyncStatus(null);
      }, 3000);
    }
  };

  // サイズ別スタイル
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: '6px 12px',
          fontSize: '0.875rem'
        };
      case 'large':
        return {
          padding: '12px 24px',
          fontSize: '1.125rem'
        };
      default: // medium
        return {
          padding: '8px 16px',
          fontSize: '1rem'
        };
    }
  };

  // 同期状態に応じたボタンテキストとスタイル
  const getButtonConfig = () => {
    if (isLoading) {
      return {
        text: '同期中...',
        bgColor: '#1db954',
        disabled: true
      };
    }

    switch (syncStatus) {
      case 'synced':
        return {
          text: '✓ Spotifyプレイリスト同期済み',
          bgColor: '#1db954',
          disabled: false
        };
      case 'syncing':
        return {
          text: '同期中...',
          bgColor: '#1db954',
          disabled: true
        };
      case 'importing':
        return {
          text: 'インポート中...',
          bgColor: '#1db954',
          disabled: true
        };
      case 'imported':
        return {
          text: '✓ インポート済み',
          bgColor: '#1db954',
          disabled: false
        };
      case 'error':
        return {
          text: '✗ 同期エラー',
          bgColor: '#dc3545',
          disabled: false
        };
      default:
        return {
          text: 'Spotifyに同期',
          bgColor: '#1db954',
          disabled: false
        };
    }
  };

  const buttonConfig = getButtonConfig();

  if (status === 'loading') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
        <span className="ml-2 text-sm text-gray-600">読み込み中...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <span className="text-sm text-gray-500">Spotifyログインが必要です</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start space-y-2 ${className}`}>
      <div className="flex space-x-2">
        {/* メイン同期ボタン */}
        <button
          onClick={handleSpotifySync}
          disabled={isLoading || buttonConfig.disabled}
          style={{
            ...getSizeStyles(),
            backgroundColor: isLoading ? '#ccc' : buttonConfig.bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            opacity: isLoading ? 0.7 : 1
          }}
          onMouseOver={(e) => {
            if (!isLoading && !buttonConfig.disabled) {
              e.target.style.opacity = '0.9';
            }
          }}
          onMouseOut={(e) => {
            if (!isLoading && !buttonConfig.disabled) {
              e.target.style.opacity = '1';
            }
          }}
        >
          {isLoading && (
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #ffffff',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
          <img 
            src="/spotify-icon.svg" 
            alt="Spotify" 
            style={{ width: '16px', height: '16px' }}
            onError={(e) => {
              // Spotifyアイコンが見つからない場合はテキストで表示
              e.target.style.display = 'none';
            }}
          />
          {buttonConfig.text}
        </button>

        {/* インポートボタン - 変更検知時のみ表示 */}
        {hasSpotifyChanges && (
          <button
            onClick={handleImportFromSpotify}
            disabled={isLoading}
            style={{
              ...getSizeStyles(),
              backgroundColor: isLoading ? '#ccc' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            📥 インポート
          </button>
        )}

        {/* Spotifyプレイリストリンクボタン - 同期済みの場合のみ表示 */}
        {playlist?.spotify_playlist_id && (
          <button
            onClick={() => {
              const spotifyUrl = `https://open.spotify.com/playlist/${playlist.spotify_playlist_id}`;
              window.open(spotifyUrl, '_blank', 'noopener,noreferrer');
            }}
            style={{
              ...getSizeStyles(),
              backgroundColor: '#1db954',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: 1
            }}
            onMouseOver={(e) => {
              e.target.style.opacity = '0.9';
            }}
            onMouseOut={(e) => {
              e.target.style.opacity = '1';
            }}
          >
            <img 
              src="/icons/spotify_wh.svg" 
              alt="Spotify" 
              style={{ width: '16px', height: '16px' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            Spotifyで開く
          </button>
        )}

        {/* 手動変更チェックボタン - 変更がない場合は非表示 */}
        {(!hasCheckedChanges || hasSpotifyChanges) && (
          <button
            onClick={checkSpotifyChanges}
            disabled={isLoading || isChecking}
            style={{
              ...getSizeStyles(),
              backgroundColor: (isLoading || isChecking) ? '#ccc' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (isLoading || isChecking) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: (isLoading || isChecking) ? 0.7 : 1
            }}
          >
            {isChecking && (
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            🔍 {isChecking ? 'チェック中...' : 'チェック'}
          </button>
        )}
      </div>

      {/* 変更検知通知 */}
      {changeNotification && hasSpotifyChanges && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '8px',
          fontSize: '14px',
          color: '#92400e'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            🔄 Spotifyで変更が検出されました
          </div>
          <div style={{ fontSize: '13px' }}>
            {changeNotification.message}
          </div>
          <div style={{ marginTop: '6px' }}>
            <button
              onClick={checkSpotifyChanges}
              style={{
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              再チェック
            </button>
            <button
              onClick={handleImportFromSpotify}
              disabled={isLoading}
              style={{
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              📥 インポート
            </button>
          </div>
        </div>
      )}

      {/* 同期状態表示 */}
      {syncStatus && (
        <div style={{
          fontSize: '0.75rem',
          color: syncStatus.includes('完了') || syncStatus.includes('済み') ? '#28a745' : 
                 syncStatus.includes('エラー') ? '#dc3545' : '#007bff',
          marginTop: '4px'
        }}>
          {syncStatus}
          {lastSyncTime && (
            <div style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '2px' }}>
              最終同期: {new Date(lastSyncTime).toLocaleString('ja-JP')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// CSSアニメーション（必要に応じてグローバルCSSに追加）
const spinAnimation = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
