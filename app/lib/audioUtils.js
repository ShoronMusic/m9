// 音声再生用のユーティリティ関数

// 完了音の再生
export const playSuccessSound = () => {
  try {
    // 完了音のパス（現在利用可能な音源のみ）
    const successSounds = [
      '/audio/success-chime.mp3'
    ];

    // 利用可能な音源から選択（現在は1つのみ）
    const randomSound = successSounds[Math.floor(Math.random() * successSounds.length)];
    
    // 音声オブジェクトを作成
    const audio = new Audio(randomSound);
    
    // 音量設定（0.0 ~ 1.0）
    audio.volume = 0.6;
    
    // 再生
    audio.play().catch(error => {
      console.log('SE音の再生に失敗しました:', error);
      // 音声再生に失敗しても処理は継続
    });
    
    // 再生完了後のクリーンアップ
    audio.onended = () => {
      audio.remove();
    };
    
  } catch (error) {
    console.log('SE音の再生でエラーが発生しました:', error);
    // エラーが発生しても処理は継続
  }
};

// エラー音の再生（現在は音声ファイルがないため、コンソールログのみ）
export const playErrorSound = () => {
  try {
    // エラー音ファイルがない場合は、コンソールログのみ
    console.log('🔊 エラー音を再生しようとしましたが、音声ファイルがありません');
    
    // 将来的にエラー音ファイルを追加した場合は、以下のコードを有効化
    // const audio = new Audio('/audio/error-buzz.mp3');
    // audio.volume = 0.4;
    // audio.play().catch(error => {
    //   console.log('エラー音の再生に失敗しました:', error);
    // });
    
  } catch (error) {
    console.log('エラー音の再生でエラーが発生しました:', error);
  }
};

// 音声の事前読み込み（現在利用可能な音源のみ）
export const preloadAudio = () => {
  const audioFiles = [
    '/audio/success-chime.mp3'
    // 将来的に追加する音声ファイル
    // '/audio/success-bell.mp3',
    // '/audio/success-pop.mp3',
    // '/audio/success-ding.mp3',
    // '/audio/error-buzz.mp3'
  ];
  
  audioFiles.forEach(file => {
    const audio = new Audio();
    audio.src = file;
    audio.load();
  });
};
