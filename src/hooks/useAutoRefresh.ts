'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AutoRefreshState {
  isActive: boolean;
  isTradingHours: boolean;
  countdown: number;
  analysisCountdown: number;
  lastRefresh: number | null;
  lastAnalysis: number | null;
}

/** Check if current time is within A-share trading hours (CST) */
function isTradingTime(): boolean {
  const now = new Date();
  const day = now.getDay();
  // Weekend check
  if (day === 0 || day === 6) return false;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 60 + minutes;

  // Morning: 9:30 - 11:30
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  // Afternoon: 13:00 - 15:00
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;

  return (time >= morningStart && time <= morningEnd) || (time >= afternoonStart && time <= afternoonEnd);
}

export function useAutoRefresh(onRefresh: () => void, intervalSec = 60, analysisIntervalSec = 30) {
  const [state, setState] = useState<AutoRefreshState>({
    isActive: true,
    isTradingHours: isTradingTime(),
    countdown: intervalSec,
    analysisCountdown: analysisIntervalSec,
    lastRefresh: null,
    lastAnalysis: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const doRefresh = useCallback(() => {
    onRefreshRef.current();
    setState(prev => ({
      ...prev,
      countdown: intervalSec,
      lastRefresh: Date.now(),
    }));
  }, [intervalSec]);

  const toggle = useCallback(() => {
    setState(prev => ({ ...prev, isActive: !prev.isActive, countdown: intervalSec }));
  }, [intervalSec]);

  // Trading hours check every minute
  useEffect(() => {
    const checkTrading = () => {
      const trading = isTradingTime();
      setState(prev => ({
        ...prev,
        isTradingHours: trading,
        isActive: trading ? prev.isActive : false,
      }));
    };
    checkTrading();
    const timer = setInterval(checkTrading, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto refresh + countdown
  useEffect(() => {
    if (!state.isActive || !state.isTradingHours) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      intervalRef.current = null;
      countdownRef.current = null;
      return;
    }

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        countdown: Math.max(0, prev.countdown - 1),
        analysisCountdown: Math.max(0, prev.analysisCountdown - 1),
      }));
    }, 1000);

    // Refresh timer
    intervalRef.current = setInterval(() => {
      doRefresh();
    }, intervalSec * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [state.isActive, state.isTradingHours, intervalSec, doRefresh]);

  return { state, toggle, refresh: doRefresh };
}
