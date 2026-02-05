/**
 * Default maximum recording duration in seconds before auto-stop.
 */
export const DEFAULT_MAX_RECORDING_DURATION_SECONDS = 6;

/**
 * Default minimum recording duration in seconds required before analysis.
 */
export const DEFAULT_MIN_RECORDING_DURATION_SECONDS = 5;

/**
 * Multiplier applied to RMS meter values to normalize UI level to a 0-1 range.
 */
export const METER_NORMALIZATION_MULTIPLIER = 4.5;

/**
 * RMS amplitude threshold (unitless linear amplitude) below which input is treated as silent.
 */
export const SILENT_RECORDING_RMS_THRESHOLD = 0.002;

/**
 * Number of attempts to retry syncing a recording blob from storage.
 */
export const STORAGE_SYNC_MAX_ATTEMPTS = 15;

/**
 * Delay between storage sync retry attempts in milliseconds.
 */
export const STORAGE_SYNC_RETRY_DELAY_MS = 200;
