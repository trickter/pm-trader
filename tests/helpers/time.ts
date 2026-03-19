import { vi } from "vitest";

// Mock timers for testing time-dependent logic
export function mockDate(date: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(date);
  return () => {
    vi.useRealTimers();
  };
}

// Advance time by ms milliseconds
export function advanceTime(ms: number) {
  vi.advanceTimersByTime(ms);
}

// Create a date offset from now
export function dateOffset(ms: number): Date {
  return new Date(Date.now() + ms);
}

// Create a date in the past
export function dateAgo(ms: number): Date {
  return new Date(Date.now() - ms);
}
