import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandsReferenceList } from './CommandsReferenceList';
import { COMMAND_DOCS, filterCommandDocs } from '../command/commandDocs';

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe('CommandsReferenceList', () => {
  it('renders the search input and every command row by default', () => {
    const html = render(<CommandsReferenceList />);
    expect(html).toContain('flux-one-command-ref-search');
    for (const row of COMMAND_DOCS) {
      expect(html).toContain(`>${row.canonical}<`);
    }
    expect(html).not.toContain('No matches.');
  });

  it('honors defaultQuery and renders only matching rows', () => {
    const expected = filterCommandDocs('email');
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(COMMAND_DOCS.length);

    const html = render(<CommandsReferenceList defaultQuery="email" />);
    for (const row of expected) {
      expect(html).toContain(`>${row.canonical}<`);
    }
    const omitted = COMMAND_DOCS.filter((row) => !expected.some((r) => r.canonical === row.canonical));
    for (const row of omitted) {
      expect(html).not.toContain(`>${row.canonical}<`);
    }
    expect(html).toContain('value="email"');
  });

  it('shows the empty-state copy when no rows match the default query', () => {
    const html = render(<CommandsReferenceList defaultQuery="zzznomatchzzz" />);
    expect(html).toContain('No matches.');
    expect(html).toContain('flux-one-command-ref-empty');
  });

  it('forwards a custom search input id when provided', () => {
    const html = render(<CommandsReferenceList searchInputId="overview-commands-filter" />);
    expect(html).toContain('id="overview-commands-filter"');
  });

  it('applies the root modifier class to root-kind rows', () => {
    const html = render(<CommandsReferenceList />);
    const rootRow = COMMAND_DOCS.find((r) => r.kind === 'root');
    expect(rootRow).toBeTruthy();
    expect(html).toContain('flux-one-command-ref-canonical--root');
  });
});
