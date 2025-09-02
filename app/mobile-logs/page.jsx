'use client';

import { useState, useEffect } from 'react';
import { SimpleMobileLogger } from '../components/SimpleMobileLogger';

export default function MobileLogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    level: '',
    type: '',
    device: '',
    limit: 50
  });

  // ログを取得
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.level) params.append('level', filters.level);
      if (filters.type) params.append('type', filters.type);
      if (filters.device) params.append('device', filters.device);
      params.append('limit', filters.limit);
      
      const response = await fetch(`/api/mobile-logs?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
        setStats(data.stats);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ログをクリア
  const clearLogs = async () => {
    if (confirm('すべてのログを削除しますか？')) {
      try {
        const response = await fetch('/api/mobile-logs?action=clear', {
          method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
          setLogs([]);
          setStats({});
          alert('ログがクリアされました');
        } else {
          alert('ログのクリアに失敗しました');
        }
      } catch (err) {
        alert('エラーが発生しました: ' + err.message);
      }
    }
  };

  // 古いログをクリーンアップ
  const cleanupLogs = async () => {
    try {
      const response = await fetch('/api/mobile-logs?action=cleanup', {
        method: 'GET'
      });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchLogs(); // ログを再取得
      } else {
        alert('クリーンアップに失敗しました');
      }
    } catch (err) {
      alert('エラーが発生しました: ' + err.message);
    }
  };

  // テストログを送信
  const sendTestLog = async (level, type, message) => {
    try {
      const response = await fetch('/api/mobile-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          type,
          message,
          details: {
            test: true,
            timestamp: new Date().toISOString()
          }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('テストログが送信されました');
        fetchLogs(); // ログを再取得
      } else {
        alert('テストログの送信に失敗しました');
      }
    } catch (err) {
      alert('エラーが発生しました: ' + err.message);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getDeviceIcon = (deviceInfo) => {
    if (deviceInfo?.isMobile) return '📱';
    if (deviceInfo?.isTablet) return '📱';
    if (deviceInfo?.isDesktop) return '💻';
    return '❓';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SimpleMobileLogger />
      
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">📱 スマホログ監視</h1>
            <div className="flex gap-2">
              <a
                href="https://app.axiom.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                🔍 Axiomで確認
              </a>
              <button
                onClick={() => window.open('https://app.axiom.co/', '_blank')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                📊 ダッシュボード
              </button>
            </div>
          </div>
          
          {/* 統計情報 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.error || 0}</div>
              <div className="text-sm text-red-600">エラー</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.warning || 0}</div>
              <div className="text-sm text-yellow-600">警告</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.info || 0}</div>
              <div className="text-sm text-blue-600">情報</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.total || 0}</div>
              <div className="text-sm text-gray-600">総数</div>
            </div>
          </div>

          {/* デバイス統計 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{stats.mobile || 0}</div>
              <div className="text-sm text-green-600">📱 モバイル</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.tablet || 0}</div>
              <div className="text-sm text-purple-600">📱 タブレット</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-indigo-600">{stats.desktop || 0}</div>
              <div className="text-sm text-indigo-600">💻 デスクトップ</div>
            </div>
          </div>

          {/* フィルター */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <select
              value={filters.level}
              onChange={(e) => setFilters({...filters, level: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">すべてのレベル</option>
              <option value="error">エラー</option>
              <option value="warning">警告</option>
              <option value="info">情報</option>
            </select>
            
            <select
              value={filters.type}
              onChange={(e) => setFilters({...filters, type: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">すべてのタイプ</option>
              <option value="javascript_error">JavaScriptエラー</option>
              <option value="warning">警告</option>
              <option value="info">情報</option>
            </select>
            
            <select
              value={filters.device}
              onChange={(e) => setFilters({...filters, device: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">すべてのデバイス</option>
              <option value="mobile">モバイル</option>
              <option value="tablet">タブレット</option>
              <option value="desktop">デスクトップ</option>
            </select>
            
            <select
              value={filters.limit}
              onChange={(e) => setFilters({...filters, limit: parseInt(e.target.value)})}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={25}>25件</option>
              <option value={50}>50件</option>
              <option value={100}>100件</option>
              <option value={200}>200件</option>
            </select>
          </div>

          {/* Axiomクエリ例 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">🔍 Axiomでのスマホエラー監視クエリ例</h3>
            <div className="space-y-2 text-sm">
              <div className="bg-white p-2 rounded border">
                <strong>スマホエラーのみ:</strong>
                <code className="block mt-1 text-xs bg-gray-100 p-1 rounded">
                  deviceInfo.isMobile == true AND level == "error"
                </code>
              </div>
              <div className="bg-white p-2 rounded border">
                <strong>JavaScriptエラー:</strong>
                <code className="block mt-1 text-xs bg-gray-100 p-1 rounded">
                  type == "javascript_error" AND deviceInfo.deviceType == "mobile"
                </code>
              </div>
              <div className="bg-white p-2 rounded border">
                <strong>ネットワークエラー:</strong>
                <code className="block mt-1 text-xs bg-gray-100 p-1 rounded">
                  type == "network_error" AND deviceInfo.isMobile == true
                </code>
              </div>
              <div className="bg-white p-2 rounded border">
                <strong>iOSデバイス:</strong>
                <code className="block mt-1 text-xs bg-gray-100 p-1 rounded">
                  deviceInfo.os == "iOS" AND level == "error"
                </code>
              </div>
            </div>
          </div>

          {/* 操作ボタン */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={fetchLogs}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              🔄 更新
            </button>
            <button
              onClick={() => sendTestLog('info', 'test', 'テストログ（情報）')}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            >
              ✅ テスト（情報）
            </button>
            <button
              onClick={() => sendTestLog('warning', 'test', 'テストログ（警告）')}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
            >
              ⚠️ テスト（警告）
            </button>
            <button
              onClick={() => sendTestLog('error', 'test', 'テストログ（エラー）')}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              ❌ テスト（エラー）
            </button>
            <button
              onClick={cleanupLogs}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"
            >
              🧹 クリーンアップ
            </button>
            <button
              onClick={clearLogs}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              🗑️ 全削除
            </button>
          </div>
        </div>

        {/* ログ一覧 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">ログ一覧</h2>
          
          {loading && (
            <div className="text-center py-8">
              <div className="text-gray-500">読み込み中...</div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-red-600">エラー: {error}</div>
            </div>
          )}
          
          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500">ログがありません</div>
            </div>
          )}
          
          {!loading && !error && logs.length > 0 && (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">{log.type}</span>
                      <span className="text-lg">{getDeviceIcon(log.deviceInfo)}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                  
                  <div className="text-gray-900 mb-2">{log.message}</div>
                  
                  {log.details && Object.keys(log.details).length > 0 && (
                    <details className="mb-2">
                      <summary className="text-sm text-gray-600 cursor-pointer">詳細情報</summary>
                      <pre className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {log.deviceInfo && (
                    <div className="text-xs text-gray-500">
                      <div>デバイス: {log.deviceInfo.platform}</div>
                      <div>画面: {log.deviceInfo.screenWidth}×{log.deviceInfo.screenHeight}</div>
                      <div>ビューポート: {log.deviceInfo.viewportWidth}×{log.deviceInfo.viewportHeight}</div>
                      <div>言語: {log.deviceInfo.language}</div>
                      <div>オンライン: {log.deviceInfo.online ? 'はい' : 'いいえ'}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
