import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  runId: text('run_id'),
  status: text('status', {
    enum: ['received', 'enriching', 'classifying', 'drafting', 'notifying', 'sent', 'failed'],
  })
    .notNull()
    .default('received'),
  email: text('email').notNull(),
  name: text('name').notNull(),
  company: text('company'),
  role: text('role'),
  phone: text('phone'),
  problem: text('problem').notNull(),
  // The prospect's selected "what are you looking for?" outcomes — the strongest
  // intent signal for the classifier, especially when the prose is thin.
  lookingFor: text('looking_for', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  stack: text('stack', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  timeline: text('timeline'),
  budget: text('budget'),
  teamSize: text('team_size'),
  contactPref: text('contact_pref'),
  referral: text('referral'),
  url: text('url'),
  dedupeHash: text('dedupe_hash').notNull(),
  enrichment: text('enrichment', { mode: 'json' }).$type<EnrichmentResult | null>(),
  classification: text('classification', { mode: 'json' }).$type<ClassificationResult | null>(),
  triageDraft: text('triage_draft'),
  // When markFailed runs, captures the in-flight status so the UI can show
  // which step failed. Null on non-failed rows and on rows that failed before
  // this column existed.
  failedAtStep: text('failed_at_step'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Fixed-window rate-limit counters. One row per (scope:identifier:window-start);
// `count` is incremented per request and the row expires after the window.
export const rateLimits = sqliteTable('rate_limits', {
  bucket: text('bucket').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

export type EnrichmentResult = {
  fetched: boolean;
  summary: string | null;
  signals: string[];
};

export type ClassificationResult = {
  engagementType: 'advisory' | 'build' | 'audit' | 'training' | 'unclear';
  fitScore: 0 | 1 | 2 | 3 | 4 | 5;
  rationale: string;
  suggestedCaseStudies: string[];
};
