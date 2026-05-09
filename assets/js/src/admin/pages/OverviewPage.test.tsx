import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OverviewPageLayout } from './OverviewPage';
import { CommandRootId } from './overviewSuggestionMeta';

vi.mock('@flux-plugins-common/components', () => ({
  UpsellCard: ({ intro }: { intro: string }) => <aside>{intro}</aside>,
}));

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

const rootLabels: Record<CommandRootId, string> = {
  nav: 'Navigate',
  edit: 'Edit',
  plugin: 'Plugin',
  user: 'User',
  menu: 'Menu',
  config: 'Config',
  aggregate: 'Aggregate',
  summary: 'Summary',
};

const baseProps = {
  adminUrl: '/wp-admin/',
  commandsRefSectionRef: { current: null },
  commandsUsedCount: 0,
  estimatesSeconds: {},
  hasUsage: false,
  licenseValid: false,
  leastUsed: ['nav', 'plugin', 'user'] as CommandRootId[],
  onViewAllCommands: () => undefined,
  rootLabels,
  shortcutLabel: 'Ctrl+K',
  snap: { counts: {}, totalSecondsSaved: 0, totalCommandRuns: 0 },
  totalSaved: 0,
  upsellBullets: ['AI summaries'],
};

describe('OverviewPageLayout', () => {
  it('keeps the command reference hidden until the overview toggle is expanded', () => {
    const html = render(<OverviewPageLayout {...baseProps} showCommandsRef={false} />);

    expect(html).toContain('View all commands');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-flux-one-overview-command-section');
    expect(html).not.toContain('flux-one-command-ref-search');
  });

  it('renders the command reference inside the left overview card when expanded', () => {
    const html = render(<OverviewPageLayout {...baseProps} showCommandsRef />);
    const cardIndex = html.indexOf('data-flux-one-overview-card');
    const sectionIndex = html.indexOf('data-flux-one-overview-command-section');
    const upsellIndex = html.indexOf('Unlock Flux One Pro features:');

    expect(html).toContain('Hide commands');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('flux-one-command-ref-search');
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    expect(sectionIndex).toBeGreaterThan(cardIndex);
    expect(upsellIndex).toBeGreaterThan(sectionIndex);
  });

  it('uses the same show/hide toggle behavior in the usage state', () => {
    const html = render(
      <OverviewPageLayout
        {...baseProps}
        hasUsage
        showCommandsRef
        snap={{ counts: {}, totalSecondsSaved: 120, totalCommandRuns: 3 }}
        totalSaved={120}
      />
    );

    expect(html).toContain('Hide commands');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-flux-one-overview-command-section');
  });
});
