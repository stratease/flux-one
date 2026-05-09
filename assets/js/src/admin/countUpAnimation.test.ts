import { describe, expect, it } from 'vitest';
import { computeCountUpValue } from './countUpAnimation';

const TARGET = 1000;
const DELAY = 400;
const DURATION = 2200;

describe('computeCountUpValue', () => {
  it('stays at zero while inside the delay window', () => {
    expect(computeCountUpValue(0, TARGET, DELAY, DURATION)).toEqual({ value: 0, done: false });
    expect(computeCountUpValue(DELAY - 1, TARGET, DELAY, DURATION)).toEqual({ value: 0, done: false });
  });

  it('starts ticking after the delay has elapsed', () => {
    const at100 = computeCountUpValue(DELAY + 100, TARGET, DELAY, DURATION).value;
    expect(at100).toBeGreaterThan(0);
    expect(at100).toBeLessThan(TARGET);
  });

  it('locks to the target and reports done at delay + duration', () => {
    expect(computeCountUpValue(DELAY + DURATION, TARGET, DELAY, DURATION)).toEqual({
      value: TARGET,
      done: true,
    });
    expect(computeCountUpValue(DELAY + DURATION + 5000, TARGET, DELAY, DURATION)).toEqual({
      value: TARGET,
      done: true,
    });
  });

  it('returns target immediately when target is zero', () => {
    expect(computeCountUpValue(0, 0, DELAY, DURATION)).toEqual({ value: 0, done: true });
  });

  it('returns target immediately when duration is non-positive', () => {
    expect(computeCountUpValue(0, TARGET, DELAY, 0)).toEqual({ value: TARGET, done: true });
    expect(computeCountUpValue(0, TARGET, DELAY, -50)).toEqual({ value: TARGET, done: true });
  });

  it('treats negative delay as zero', () => {
    const out = computeCountUpValue(0, TARGET, -100, DURATION);
    expect(out.value).toBe(0);
    expect(out.done).toBe(false);
  });

  it('eases out (cubic) so growth slows toward the end', () => {
    const half = computeCountUpValue(DELAY + DURATION / 2, TARGET, DELAY, DURATION).value;
    expect(half).toBeGreaterThan(TARGET / 2);
  });
});
