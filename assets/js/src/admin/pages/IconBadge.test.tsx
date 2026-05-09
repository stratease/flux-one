import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IconBadge } from './IconBadge';

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe('IconBadge', () => {
  it('renders the provided child icon inside the badge wrapper', () => {
    const html = render(
      <IconBadge>
        <svg data-testid="badge-child" />
      </IconBadge>
    );
    expect(html).toContain('data-flux-one-icon-badge');
    expect(html).toContain('data-testid="badge-child"');
  });

  it('marks the wrapper as decorative for assistive tech', () => {
    const html = render(
      <IconBadge>
        <svg />
      </IconBadge>
    );
    expect(html).toContain('aria-hidden="true"');
  });

  it('accepts a custom tone without crashing the render path', () => {
    const html = render(
      <IconBadge tone="subtle">
        <svg />
      </IconBadge>
    );
    expect(html).toContain('data-flux-one-icon-badge');
  });

  it('respects a custom size by sizing the wrapper element', () => {
    const html = render(
      <IconBadge size={56}>
        <svg />
      </IconBadge>
    );
    expect(html).toMatch(/width:\s*56px/);
    expect(html).toMatch(/height:\s*56px/);
  });
});
