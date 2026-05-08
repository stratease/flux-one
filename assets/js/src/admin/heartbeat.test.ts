/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushHeartbeat } from './heartbeat';
import { readPendingFromLocalStorage, writePendingToLocalStorage } from './usage-store';

vi.mock('@wordpress/api-fetch', () => ({
  default: vi.fn(),
}));

import apiFetch from '@wordpress/api-fetch';

describe('heartbeat', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (window as unknown as { fluxOneAdmin?: unknown }).fluxOneAdmin = {
      nonce: 'test-nonce',
      bootstrap: {
        commandUsage: {
          counts: {},
          estimatesSeconds: { nav: 5, menu: 30 },
          totalSecondsSaved: 0,
        },
      },
    };
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as unknown as { fluxOneAdmin?: unknown }).fluxOneAdmin;
  });

  it('flushHeartbeat clears queue only on success', async () => {
    writePendingToLocalStorage({ nav: 1 });
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network'));
    await flushHeartbeat();
    expect(readPendingFromLocalStorage()).toEqual({ nav: 1 });

    vi.mocked(apiFetch).mockResolvedValueOnce({
      success: true,
      data: { counts: { nav: 1 } },
    });
    await flushHeartbeat();
    expect(readPendingFromLocalStorage()).toEqual({});
  });

});
