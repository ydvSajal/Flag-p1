import { describe, expect, it } from 'vitest';
import {
  knockoutRounds,
  layoutFromVariant,
  liveStatus,
  optionScores,
  parseModuleConfig,
  playKnockout,
  seededShuffle,
  validateResponses,
} from './rules';

const V = ['a', 'b', 'c', 'd'];

describe('validateResponses', () => {
  it('U-01 grid with one pick is ok', () => {
    expect(validateResponses('grid', V, [{ variantId: 'a', signal: 'pick' }]).ok).toBe(true);
  });

  it('U-02 grid with zero, two, or a yes is an error', () => {
    expect(validateResponses('grid', V, []).ok).toBe(false);
    expect(
      validateResponses('grid', V, [
        { variantId: 'a', signal: 'pick' },
        { variantId: 'b', signal: 'pick' },
      ]).ok,
    ).toBe(false);
    expect(validateResponses('grid', V, [{ variantId: 'a', signal: 'yes' }]).ok).toBe(false);
  });

  it('U-03 this_or_that with one pick is ok', () => {
    expect(validateResponses('this_or_that', V, [{ variantId: 'c', signal: 'pick' }]).ok).toBe(true);
  });

  it('U-04 swipe with yes/no for every variant is ok, all no too', () => {
    const mixed = V.map((id, i) => ({ variantId: id, signal: i % 2 ? ('yes' as const) : ('no' as const) }));
    expect(validateResponses('swipe', V, mixed).ok).toBe(true);
    expect(validateResponses('yes_no', V, V.map((id) => ({ variantId: id, signal: 'no' as const }))).ok).toBe(true);
  });

  it('U-05 swipe/yes_no missing, duplicate, or pick is an error', () => {
    const three = V.slice(0, 3).map((id) => ({ variantId: id, signal: 'yes' as const }));
    expect(validateResponses('swipe', V, three).ok).toBe(false);
    expect(validateResponses('yes_no', V, [...three, { variantId: 'a', signal: 'no' }]).ok).toBe(false);
    expect(
      validateResponses('swipe', V, [...three, { variantId: 'd', signal: 'pick' }]).ok,
    ).toBe(false);
  });

  it('U-06 a variant from another set is an error', () => {
    expect(validateResponses('grid', V, [{ variantId: 'zz', signal: 'pick' }]).ok).toBe(false);
    expect(
      validateResponses('swipe', V, [...V.slice(0, 3), 'zz'].map((id) => ({ variantId: id, signal: 'yes' as const }))).ok,
    ).toBe(false);
  });
});

describe('seededShuffle', () => {
  it('U-07 same seed gives same order', () => {
    expect(seededShuffle(V, 'seed-1')).toEqual(seededShuffle(V, 'seed-1'));
  });

  it('U-08 spreads first position and always returns a permutation', () => {
    const firsts: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const out = seededShuffle(V, `set-${i}-tester`);
      expect([...out].sort()).toEqual([...V].sort());
      const first = out[0] as string;
      firsts[first] = (firsts[first] ?? 0) + 1;
    }
    for (const id of V) expect(firsts[id] ?? 0).toBeGreaterThanOrEqual(20);
  });
});

describe('knockoutRounds', () => {
  it('U-09 2, 3, 4 options give 1, 2, 3 rounds with one winner and every option seen', () => {
    for (const [n, rounds] of [
      [2, 1],
      [3, 2],
      [4, 3],
    ] as const) {
      const ids = V.slice(0, n);
      expect(knockoutRounds(ids)).toHaveLength(rounds);
      const seen = new Set<string>();
      const winner = playKnockout(ids, (l, r, i) => {
        seen.add(l);
        seen.add(r);
        return i % 2 ? l : r;
      });
      expect(ids).toContain(winner);
      expect(seen.size).toBe(n);
    }
  });
});

describe('optionScores', () => {
  it('U-10 picks plus yes over voters; zero voters is 0', () => {
    const responses = [
      ...Array.from({ length: 3 }, () => ({ variantId: 'A', signal: 'pick' as const })),
      ...Array.from({ length: 2 }, () => ({ variantId: 'A', signal: 'yes' as const })),
      ...Array.from({ length: 5 }, () => ({ variantId: 'B', signal: 'no' as const })),
    ];
    const [a, b] = optionScores(['A', 'B'], responses, 10);
    expect(a).toEqual({ variantId: 'A', positive: 5, score: 0.5 });
    expect(b).toEqual({ variantId: 'B', positive: 0, score: 0 });
    expect(optionScores(['A'], [], 0)[0]?.score).toBe(0);
  });
});

describe('liveStatus', () => {
  it('U-11 finished, voting, dropped', () => {
    const now = new Date('2026-11-28T10:00:00Z');
    const ago = (s: number) => new Date(now.getTime() - s * 1000);
    expect(liveStatus({ completedAt: ago(5), lastSeenAt: ago(5) }, now)).toBe('finished');
    expect(liveStatus({ completedAt: null, lastSeenAt: ago(30) }, now)).toBe('voting');
    expect(liveStatus({ completedAt: null, lastSeenAt: ago(121) }, now)).toBe('dropped');
  });
});

describe('parseModuleConfig', () => {
  it('U-12 valid, invalid, missing field, clamping', () => {
    expect(
      parseModuleConfig('{"title":"Pick a thumb","instructions":"Tap one","sets_per_session":3}', 'thumbnails'),
    ).toEqual({ title: 'Pick a thumb', instructions: 'Tap one', setsPerSession: 3 });
    expect(parseModuleConfig('{nope', 'captions')).toEqual({ title: 'Captions', instructions: '', setsPerSession: 5 });
    expect(parseModuleConfig('{"title":"X"}', 'captions')).toEqual({ title: 'X', instructions: '', setsPerSession: 5 });
    expect(parseModuleConfig('{"sets_per_session":0}', 'visuals').setsPerSession).toBe(1);
    expect(parseModuleConfig('{"sets_per_session":99}', 'visuals').setsPerSession).toBe(20);
    expect(parseModuleConfig(null, 'reel_captions').title).toBe('Reel captions');
  });

  it('layoutFromVariant maps unknown and disabled to grid', () => {
    expect(layoutFromVariant('swipe')).toBe('swipe');
    expect(layoutFromVariant('carousel')).toBe('grid');
    expect(layoutFromVariant(null)).toBe('grid');
    expect(layoutFromVariant('swipe', false)).toBe('grid');
  });
});
