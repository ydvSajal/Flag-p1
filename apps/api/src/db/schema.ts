import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Better Auth core `user` columns, so Better Auth can adopt this table later (LOCAL-DEV deviation note). */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  isAnonymous: boolean('is_anonymous').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['tester', 'creator'] }).notNull().default('tester'),
    wave: smallint('wave').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check('profiles_role_check', sql`${t.role} in ('tester','creator')`),
    check('profiles_wave_check', sql`${t.wave} in (1,2,3)`),
  ],
);

export const variantSets = pgTable(
  'variant_sets',
  {
    id: uuid('id').primaryKey(),
    // ponytail: nullable + set null (TRD says not null) so DELETE /me can remove a creator while their soft-deleted sets keep results.
    creatorId: text('creator_id').references(() => user.id, { onDelete: 'set null' }),
    module: text('module', { enum: ['thumbnails', 'captions', 'reel_captions', 'visuals'] }).notNull(),
    title: text('title').notNull(),
    status: text('status', { enum: ['active', 'deleted'] }).notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [
    check('variant_sets_module_check', sql`${t.module} in ('thumbnails','captions','reel_captions','visuals')`),
    check('variant_sets_title_check', sql`char_length(${t.title}) between 1 and 120`),
    check('variant_sets_status_check', sql`${t.status} in ('active','deleted')`),
    index('variant_sets_module_status_idx').on(t.module, t.status),
  ],
);

export const variants = pgTable(
  'variants',
  {
    id: uuid('id').primaryKey(),
    setId: uuid('set_id')
      .notNull()
      .references(() => variantSets.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['image', 'text'] }).notNull(),
    imageKey: text('image_key'),
    text: text('text'),
    position: smallint('position').notNull(),
  },
  (t) => [
    unique('variants_set_position_unique').on(t.setId, t.position),
    check('variants_kind_check', sql`${t.kind} in ('image','text')`),
    check('variants_text_check', sql`${t.text} is null or char_length(${t.text}) between 1 and 280`),
    check('variants_position_check', sql`${t.position} between 0 and 3`),
    check(
      'variants_payload_check',
      sql`(${t.kind} = 'image' and ${t.imageKey} is not null) or (${t.kind} = 'text' and ${t.text} is not null)`,
    ),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    testerId: text('tester_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    module: text('module', { enum: ['thumbnails', 'captions', 'reel_captions', 'visuals'] }).notNull(),
    layout: text('layout', { enum: ['grid', 'swipe', 'this_or_that', 'yes_no'] }).notNull(),
    targetCount: smallint('target_count').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    check('sessions_layout_check', sql`${t.layout} in ('grid','swipe','this_or_that','yes_no')`),
    check('sessions_target_check', sql`${t.targetCount} between 1 and 20`),
    uniqueIndex('sessions_one_open_idx').on(t.testerId, t.module).where(sql`${t.completedAt} is null`),
    index('sessions_last_seen_idx').on(t.lastSeenAt),
  ],
);

export const setResults = pgTable(
  'set_results',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    setId: uuid('set_id')
      .notNull()
      .references(() => variantSets.id),
    testerId: text('tester_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    layout: text('layout', { enum: ['grid', 'swipe', 'this_or_that', 'yes_no'] }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('set_results_tester_set_unique').on(t.testerId, t.setId),
    check('set_results_duration_check', sql`${t.durationMs} between 0 and 600000`),
    index('set_results_set_idx').on(t.setId),
    index('set_results_session_idx').on(t.sessionId),
  ],
);

export const responses = pgTable(
  'responses',
  {
    setResultId: uuid('set_result_id')
      .notNull()
      .references(() => setResults.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id),
    signal: text('signal', { enum: ['pick', 'yes', 'no'] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.setResultId, t.variantId] }),
    check('responses_signal_check', sql`${t.signal} in ('pick','yes','no')`),
  ],
);
