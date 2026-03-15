/**
 * Time helpers for rate limits.
 *
 * Converts user-friendly durations into milliseconds and clamps values
 * so storage and algorithms always receive safe inputs.
 */

import ms, { type StringValue } from 'ms';
import type { DurationLike } from '../types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Resolve a duration input into milliseconds with a fallback.
 *
 * @param value - Duration input as ms or string.
 * @param fallback - Fallback value used when parsing fails.
 * @returns Parsed duration in milliseconds.
 */
export function resolveDuration(
  value: DurationLike | undefined,
  fallback: number,
): number {
  if (value == null) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    /**
     * Allow week/month units so config can use human-friendly windows.
     */
    const custom = parseExtendedDuration(value);
    if (custom != null) return custom;
    const parsed = ms(value as StringValue);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Parse week/month duration strings that ms does not support.
 *
 * @param value - Raw duration string.
 * @returns Parsed duration in ms or null when invalid.
 */
function parseExtendedDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(w|week|weeks|mo|month|months)$/i,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2].toLowerCase();
  const multiplier =
    unit === 'w' || unit === 'week' || unit === 'weeks' ? WEEK_MS : MONTH_MS;

  return Math.round(amount * multiplier);
}

/**
 * Clamp a number to a minimum value to avoid zero/negative windows.
 *
 * @param value - Value to clamp.
 * @param min - Minimum allowed value.
 * @returns The clamped value.
 */
export function clampAtLeast(value: number, min: number): number {
  return value < min ? min : value;
}
