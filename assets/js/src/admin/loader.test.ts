import { afterEach, describe, expect, it, vi } from 'vitest';
import { openOverlay } from './loader';

type TestWindow = {
  __fluxOneOpenOnLoad?: boolean;
  __fluxOneOpenPrefill?: string;
  CustomEvent: typeof CustomEvent;
  dispatchEvent: ReturnType<typeof vi.fn>;
};

function installWindow(): TestWindow {
  const win: TestWindow = {
    CustomEvent,
    dispatchEvent: vi.fn(() => true),
  };
  (globalThis as any).window = win;
  (globalThis as any).document = {
    querySelector: vi.fn(() => ({ dataset: { fluxOneAdminBundle: '1' } })),
  };
  return win;
}

describe('openOverlay', () => {
  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    vi.restoreAllMocks();
  });

  it('stores prefill input before loading and dispatches it after loading', async () => {
    const win = installWindow();

    const promise = openOverlay({ input: 'nav ' });

    expect(win.__fluxOneOpenOnLoad).toBe(true);
    expect(win.__fluxOneOpenPrefill).toBe('nav ');

    await promise;

    expect(win.dispatchEvent).toHaveBeenCalledTimes(1);
    const evt = win.dispatchEvent.mock.calls[0][0] as CustomEvent<{ input: string }>;
    expect(evt.type).toBe('flux-one-open');
    expect(evt.detail.input).toBe('nav ');
  });

  it('opens without touching prefill when no input is provided', async () => {
    const win = installWindow();

    await openOverlay();

    expect(win.__fluxOneOpenOnLoad).toBe(true);
    expect(win.__fluxOneOpenPrefill).toBeUndefined();
    expect(win.dispatchEvent).toHaveBeenCalledTimes(1);
    const evt = win.dispatchEvent.mock.calls[0][0] as Event;
    expect(evt.type).toBe('flux-one-open');
  });
});
