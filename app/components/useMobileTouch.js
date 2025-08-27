'use client';

import { useState, useRef, useCallback } from 'react';

export const useMobileTouch = (options = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    onDoubleTap,
    minSwipeDistance = 50,
    longPressDelay = 500,
    doubleTapDelay = 300
  } = options;

  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0, time: 0 });
  const [isLongPress, setIsLongPress] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  
  const longPressTimerRef = useRef(null);
  const touchStartTimeRef = useRef(0);

  // タッチ開始時の処理
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    const now = Date.now();
    
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: now
    });
    
    touchStartTimeRef.current = now;
    
    // 長押しタイマーを開始
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      if (onLongPress) {
        onLongPress(e);
      }
    }, longPressDelay);
  }, [onLongPress, longPressDelay]);

  // タッチ移動時の処理
  const handleTouchMove = useCallback((e) => {
    // 長押しタイマーをリセット
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 長押し状態をリセット
    if (isLongPress) {
      setIsLongPress(false);
    }
  }, [isLongPress]);

  // タッチ終了時の処理
  const handleTouchEnd = useCallback((e) => {
    const touch = e.changedTouches[0];
    const now = Date.now();
    
    setTouchEnd({
      x: touch.clientX,
      y: touch.clientY,
      time: now
    });
    
    // 長押しタイマーをクリア
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 長押し状態をリセット
    if (isLongPress) {
      setIsLongPress(false);
      return; // 長押しの場合はスワイプ処理をスキップ
    }
    
    // スワイプ距離を計算
    const distanceX = touchStart.x - touch.clientX;
    const distanceY = touchStart.y - touch.clientY;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    
    // スワイプ処理
    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0 && onSwipeLeft) {
        onSwipeLeft(e);
      } else if (distanceX < 0 && onSwipeRight) {
        onSwipeRight(e);
      }
    } else if (!isHorizontalSwipe && Math.abs(distanceY) > minSwipeDistance) {
      if (distanceY > 0 && onSwipeUp) {
        onSwipeUp(e);
      } else if (distanceY < 0 && onSwipeDown) {
        onSwipeDown(e);
      }
    }
    
    // ダブルタップ処理
    const timeDiff = now - lastTap;
    if (timeDiff < doubleTapDelay && timeDiff > 0) {
      if (onDoubleTap) {
        onDoubleTap(e);
      }
      setLastTap(0);
    } else {
      setLastTap(now);
    }
  }, [
    touchStart,
    lastTap,
    isLongPress,
    minSwipeDistance,
    doubleTapDelay,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onDoubleTap
  ]);

  // タッチキャンセル時の処理
  const handleTouchCancel = useCallback(() => {
    // 長押しタイマーをクリア
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 長押し状態をリセット
    setIsLongPress(false);
  }, []);

  // タッチイベントハンドラーを返す
  const touchHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel
  };

  // 現在のタッチ状態を返す
  const touchState = {
    isLongPress,
    touchStart,
    touchEnd
  };

  return {
    touchHandlers,
    touchState,
    isLongPress
  };
};
