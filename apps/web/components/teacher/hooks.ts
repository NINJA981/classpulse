'use client';
import { useEffect, useRef, useState } from 'react';
import type { LessonProgress, RecordingSession } from '@classpulse/shared';
import { connectSocket } from '@/lib/socket';

/** Current time in ms, re-rendering every `intervalMs` while `active`. */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, active]);
  return now;
}

/** Teacher-room `lesson:progress` pushes (the teacher is auto-joined to its user room). */
export function useLessonProgressEvents(handler: (progress: LessonProgress) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();
    const listener = (p: LessonProgress) => ref.current(p);
    socket.on('lesson:progress', listener);
    return () => {
      socket.off('lesson:progress', listener);
      socket.disconnect();
    };
  }, [enabled]);
}

/** Teacher-room `recording:update` pushes. */
export function useRecordingEvents(handler: (session: RecordingSession) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();
    const listener = (s: RecordingSession) => ref.current(s);
    socket.on('recording:update', listener);
    return () => {
      socket.off('recording:update', listener);
      socket.disconnect();
    };
  }, [enabled]);
}
