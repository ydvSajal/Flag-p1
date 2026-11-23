import { z } from 'zod';
import { LAYOUTS, LIMITS, LIVE_STATUSES, MODULES, OPTION_KINDS, ROLES, SIGNALS } from './constants';

export const moduleKeySchema = z.enum(MODULES);
export const layoutSchema = z.enum(LAYOUTS);
export const signalSchema = z.enum(SIGNALS);
export const roleSchema = z.enum(ROLES);
export const optionKindSchema = z.enum(OPTION_KINDS);
export const liveStatusSchema = z.enum(LIVE_STATUSES);

export const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

/* /api/me */
export const meSchema = z.object({
  id: z.string(),
  role: roleSchema,
  wave: z.number().int().min(1).max(3),
  consented: z.boolean(),
  isAnonymous: z.boolean(),
  isAdmin: z.boolean(),
  name: z.string().optional(),
});
export type Me = z.infer<typeof meSchema>;

export const consentResponseSchema = z.object({ consented: z.literal(true) });

/* /api/modules */
export const moduleInfoSchema = z.object({
  key: moduleKeySchema,
  title: z.string(),
  instructions: z.string(),
  setsPerSession: z.number().int(),
  setsLeft: z.number().int(),
  openSessionId: z.string().optional(),
});
export type ModuleInfo = z.infer<typeof moduleInfoSchema>;

export const modulesResponseSchema = z.object({
  votingEnabled: z.boolean(),
  modules: z.array(moduleInfoSchema),
});
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;

/* /api/sessions */
export const createSessionBodySchema = z.object({
  module: moduleKeySchema,
  layout: layoutSchema,
});
export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

export const sessionSchema = z.object({
  id: z.string(),
  module: moduleKeySchema,
  layout: layoutSchema,
  targetCount: z.number().int(),
  doneCount: z.number().int(),
  resumed: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionDetailSchema = sessionSchema.extend({ completed: z.boolean() });
export type SessionDetail = z.infer<typeof sessionDetailSchema>;

export const variantViewSchema = z.object({
  id: z.string(),
  kind: optionKindSchema,
  imageUrl: z.string().optional(),
  text: z.string().optional(),
});
export type VariantView = z.infer<typeof variantViewSchema>;

export const setViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  variants: z.array(variantViewSchema),
});
export type SetView = z.infer<typeof setViewSchema>;

export const nextSetsResponseSchema = z.object({
  doneCount: z.number().int(),
  targetCount: z.number().int(),
  sets: z.array(setViewSchema),
});
export type NextSetsResponse = z.infer<typeof nextSetsResponseSchema>;

/* /api/set-results */
export const responseItemSchema = z.object({
  variantId: z.string(),
  signal: signalSchema,
});
export type ResponseItem = z.infer<typeof responseItemSchema>;

export const setResultBodySchema = z.object({
  id: z.uuid(),
  sessionId: z.string(),
  setId: z.string(),
  durationMs: z.number().int().min(0).max(LIMITS.durationMsMax),
  responses: z.array(responseItemSchema).min(1).max(LIMITS.optionsMax),
});
export type SetResultBody = z.infer<typeof setResultBodySchema>;

export const setResultResponseSchema = z.object({
  doneCount: z.number().int(),
  targetCount: z.number().int(),
  sessionComplete: z.boolean(),
});
export type SetResultResponse = z.infer<typeof setResultResponseSchema>;

/* /api/uploads/sign */
export const uploadSignBodySchema = z.object({
  files: z
    .array(z.object({ contentType: z.string(), size: z.number().int().min(1) }))
    .min(1)
    .max(LIMITS.uploadsMaxFiles),
});
export type UploadSignBody = z.infer<typeof uploadSignBodySchema>;

export const uploadSignResponseSchema = z.object({
  uploads: z.array(z.object({ key: z.string(), putUrl: z.string() })),
});
export type UploadSignResponse = z.infer<typeof uploadSignResponseSchema>;

/* /api/sets */
export const optionInputSchema = z.object({
  kind: optionKindSchema,
  imageKey: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(LIMITS.textMax).optional(),
});
export type OptionInput = z.infer<typeof optionInputSchema>;

export const createSetBodySchema = z
  .object({
    module: moduleKeySchema,
    title: z.string().trim().min(1).max(LIMITS.setTitleMax),
    options: z.array(optionInputSchema).min(LIMITS.optionsMin).max(LIMITS.optionsMax),
  })
  .refine((b) => b.options.every((o) => o.kind === b.options[0]?.kind), {
    message: 'All options must be the same kind',
    path: ['options'],
  })
  .refine(
    (b) =>
      b.options.every((o) => (o.kind === 'image' ? !!o.imageKey && !o.text : !!o.text && !o.imageKey)),
    { message: 'Image options need imageKey, text options need text', path: ['options'] },
  );
export type CreateSetBody = z.infer<typeof createSetBodySchema>;

export const createSetResponseSchema = z.object({ id: z.string() });

export const mySetSchema = z.object({
  id: z.string(),
  module: moduleKeySchema,
  title: z.string(),
  createdAt: z.string(),
  voters: z.number().int(),
  preview: z.array(variantViewSchema),
});
export type MySet = z.infer<typeof mySetSchema>;

export const mySetsResponseSchema = z.object({ sets: z.array(mySetSchema) });
export type MySetsResponse = z.infer<typeof mySetsResponseSchema>;

export const optionResultSchema = z.object({
  variantId: z.string(),
  kind: optionKindSchema,
  imageUrl: z.string().optional(),
  text: z.string().optional(),
  positive: z.number().int(),
  score: z.number(),
});
export type OptionResult = z.infer<typeof optionResultSchema>;

export const layoutResultSchema = z.object({
  layout: layoutSchema,
  voters: z.number().int(),
  options: z.array(z.object({ variantId: z.string(), positive: z.number().int(), score: z.number() })),
});

export const setResultsResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  module: moduleKeySchema,
  voters: z.number().int(),
  options: z.array(optionResultSchema),
  byLayout: z.array(layoutResultSchema).optional(),
});
export type SetResultsResponse = z.infer<typeof setResultsResponseSchema>;

/* /api/admin */
export const splitSchema = z.object({
  grid: z.number().int(),
  swipe: z.number().int(),
  this_or_that: z.number().int(),
  yes_no: z.number().int(),
});
export type Split = z.infer<typeof splitSchema>;

export const liveVisitorSchema = z.object({
  shortId: z.string(),
  wave: z.number().int(),
  layout: layoutSchema,
  module: moduleKeySchema,
  doneCount: z.number().int(),
  targetCount: z.number().int(),
  status: liveStatusSchema,
  lastSeenAt: z.string(),
});
export type LiveVisitor = z.infer<typeof liveVisitorSchema>;

export const liveResponseSchema = z.object({
  now: z.string(),
  counters: z.object({
    onSite: z.number().int(),
    sessionsToday: z.number().int(),
    finishedToday: z.number().int(),
  }),
  split: splitSchema,
  visitors: z.array(liveVisitorSchema),
});
export type LiveResponse = z.infer<typeof liveResponseSchema>;

export const layoutStatsSchema = z.object({
  layout: layoutSchema,
  visitors: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
  completionRate: z.number(),
  avgDurationMs: z.number(),
});
export type LayoutStats = z.infer<typeof layoutStatsSchema>;

export const overviewResponseSchema = z.object({
  visitorsByWave: z.object({ '1': z.number().int(), '2': z.number().int(), '3': z.number().int() }),
  byLayout: z.array(layoutStatsSchema),
  responsesTotal: z.number().int(),
  links: z.object({ flag: z.string(), experiment: z.string(), identities: z.string() }),
});
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
