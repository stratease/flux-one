import { describe, expect, it } from 'vitest';
import { getRootToken } from './normalize';

describe('getRootToken', () => {
  it('maps canonical commands to usage roots', () => {
    expect(getRootToken('summary email')).toBe('summary');
    expect(getRootToken('plugin update foo')).toBe('plugin');
    expect(getRootToken('nav dashboard')).toBe('nav');
    expect(getRootToken('aggregate email')).toBe('aggregate');
    expect(getRootToken('edit p hello')).toBe('edit');
    expect(getRootToken('config list')).toBe('config');
  });
});
