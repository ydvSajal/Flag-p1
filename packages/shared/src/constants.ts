export const MODULES = ['thumbnails', 'captions', 'reel_captions', 'visuals'] as const;
export type ModuleKey = (typeof MODULES)[number];

export const LAYOUTS = ['grid', 'swipe', 'this_or_that', 'yes_no'] as const;
export type Layout = (typeof LAYOUTS)[number];

export const SIGNALS = ['pick', 'yes', 'no'] as const;
export type Signal = (typeof SIGNALS)[number];

export const ROLES = ['tester', 'creator'] as const;
export type Role = (typeof ROLES)[number];

export const WAVES = [1, 2, 3] as const;
export type Wave = (typeof WAVES)[number];

export const OPTION_KINDS = ['image', 'text'] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export const LIVE_STATUSES = ['finished', 'voting', 'dropped'] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

/** What each module holds. Thumbnails and visuals are images, captions are text. */
export const MODULE_KIND: Record<ModuleKey, OptionKind> = {
  thumbnails: 'image',
  captions: 'text',
  reel_captions: 'text',
  visuals: 'image',
};

export const MODULE_LABEL: Record<ModuleKey, string> = {
  thumbnails: 'Thumbnails',
  captions: 'Captions',
  reel_captions: 'Reel captions',
  visuals: 'Visuals',
};

/** Flagsmith feature key for each module (one flag per module). */
export const MODULE_FLAG: Record<ModuleKey, string> = {
  thumbnails: 'module_thumbnails',
  captions: 'module_captions',
  reel_captions: 'module_reel_captions',
  visuals: 'module_visuals',
};

export const FLAG_VOTING_LAYOUT = 'voting_layout';
export const FLAG_VOTING_ENABLED = 'voting_enabled';
export const EVENT_SESSION_COMPLETED = 'session_completed';

/** Layouts a Flagsmith variation can name. `grid` is the control (no variation key). */
export const EXPERIMENT_VARIANTS = ['swipe', 'this_or_that', 'yes_no'] as const;

export const LIMITS = {
  setTitleMax: 120,
  textMax: 280,
  optionsMin: 2,
  optionsMax: 4,
  /** Server limit, applied to the (already resized) file that is uploaded. */
  uploadMaxBytes: 5 * 1024 * 1024,
  /** Client limit on the original file picked by the creator, before it is resized to 1600 px. */
  uploadSourceMaxBytes: 25 * 1024 * 1024,
  uploadsMaxFiles: 4,
  uploadTypes: ['image/png', 'image/jpeg', 'image/webp'],
  setsPerSessionDefault: 5,
  setsPerSessionMin: 1,
  setsPerSessionMax: 20,
  durationMsMax: 600_000,
  liveWindowMs: 60 * 60 * 1000,
  droppedAfterMs: 2 * 60 * 1000,
  liveMaxRows: 200,
  setResultsPerMinute: 60,
  uploadsPerMinute: 20,
  nextSetsBatch: 2,
  flagCacheMs: 10_000,
  flagRefreshMs: 15_000,
} as const;
