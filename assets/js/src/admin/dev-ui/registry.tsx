import React from 'react';
import { FluxOneModal } from '../../ui/FluxOneModal';
import { EmailAggregateView, type EmailAggregatePayload, type EmailSummaryMap } from '../../ui/EmailAggregateView';
import { Skeleton, SkeletonText } from '../../ui/skeleton';
import { CommandCentralHeader } from '../../ui/command-central/CommandCentralHeader';
import { RecentAdminPages } from '../../ui/command-central/RecentAdminPages';
import { StructuredListPanels } from '../../ui/command-central/StructuredListPanels';
import { MenuListPanel } from '../../ui/command-central/MenuListPanel';
import { SuiteConfigPanel } from '../../ui/command-central/suite-config/SuiteConfigPanel';
import { SuiteConfigField } from '../../ui/command-central/suite-config/SuiteConfigField';
import type { SuiteConfigRow } from '../../ui/command-central/suite-config/types';
import { CommandCentralMount } from '../../ui/CommandCentralMount';
import { CommandsReferenceList } from '../../ui/CommandsReferenceList';

export type DevUiRegistryItem = {
  name: string;
  file: string;
  render: () => React.ReactNode;
};

function mockEmailAggregatePayload(): EmailAggregatePayload {
  return {
    meta: { days: 7, page: 1, totalPages: 1, total: 2, eventsCount: 2 },
    events: [
      {
        id: 101,
        source: 'wp_mail',
        type: 'email',
        subject: 'Welcome to Flux One',
        createdAt: '2026-05-08 12:00:00',
        payload: { to: ['admin@example.com'], messagePreview: 'Welcome! This is a test email preview.', message: 'Hello!\n\nThis is a plaintext email body.\n' },
      },
      {
        id: 102,
        source: 'wp_mail',
        type: 'email',
        subject: 'Password reset',
        createdAt: '2026-05-08 12:05:00',
        payload: {
          to: ['admin@example.com'],
          messagePreview: 'Reset link…',
          messageHtml: '&lt;p&gt;Click &lt;a href=&quot;#&quot;&gt;here&lt;/a&gt; to reset.&lt;/p&gt;',
          messageIsHtml: true,
        },
      },
    ],
    summaries: {
      by_event_id: {
        '101': { summary: 'Operator onboard email. Nothing urgent.', isUrgent: false, summarizedAt: '2026-05-08 12:01:00' },
      },
      urgent_event_ids: [],
    },
  };
}

function mockEmailSummaryMap(): EmailSummaryMap {
  return {
    101: { summary: 'Operator onboard email. Nothing urgent.', isUrgent: false, summarizedAt: '2026-05-08 12:01:00' },
  };
}

function mockSuiteConfigRows(): SuiteConfigRow[] {
  return [
    {
      id: 'wp.blogname',
      label: 'Site title',
      plugin: 'WordPress Core',
      type: 'string',
      valueDisplay: 'Example Site',
      group: 'general',
      groupLabel: 'General',
      groupOrder: 10,
    },
    {
      id: 'wp.posts_per_page',
      label: 'Blog pages show at most',
      plugin: 'WordPress Core',
      type: 'int',
      valueDisplay: '10',
      min: 1,
      max: 100,
      group: 'reading',
      groupLabel: 'Reading',
      groupOrder: 20,
    },
    {
      id: 'flux.suite.feature_flag',
      label: 'Suite feature flag',
      plugin: 'Flux Suite',
      type: 'bool',
      valueDisplay: 'false',
      group: 'flux',
      groupLabel: 'Flux',
      groupOrder: 30,
    },
    {
      id: 'wp.permalink_structure',
      label: 'Permalink structure',
      plugin: 'WordPress Core',
      type: 'enum',
      valueDisplay: '/%postname%/',
      choices: ['Plain', '/%postname%/', '/%year%/%monthnum%/%postname%/'],
      group: 'permalinks',
      groupLabel: 'Permalinks',
      groupOrder: 40,
    },
  ];
}

function ModalDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flux-one-flex-row-gap" style={{ alignItems: 'center' }}>
      <button type="button" className="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      <FluxOneModal open={open} onClose={() => setOpen(false)} title="FluxOneModal demo">
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0 }}>Modal body content. Use this page to check spacing, typography, and focus behavior.</p>
          <div className="flux-one-flex-row-gap">
            <button type="button" className="button button-primary" onClick={() => setOpen(false)}>
              Primary action
            </button>
            <button type="button" className="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </FluxOneModal>
    </div>
  );
}

function SuiteConfigFieldDemo() {
  const row: SuiteConfigRow = {
    id: 'wp.blogdescription',
    label: 'Tagline',
    plugin: 'WordPress Core',
    type: 'string',
    valueDisplay: 'Just another WordPress site',
    groupLabel: 'General',
    groupOrder: 10,
  };
  return <SuiteConfigField row={row} executeFromInput={() => undefined} />;
}

export const DEV_UI_REGISTRY: DevUiRegistryItem[] = [
  {
    name: 'FluxOneModal',
    file: 'assets/js/src/ui/FluxOneModal.tsx',
    render: () => <ModalDemo />,
  },
  {
    name: 'EmailAggregateView',
    file: 'assets/js/src/ui/EmailAggregateView.tsx',
    render: () => (
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Grouped</div>
          <EmailAggregateView data={mockEmailAggregatePayload()} mode="grouped" emailSummaries={mockEmailSummaryMap()} />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Flat master-detail</div>
          <EmailAggregateView data={mockEmailAggregatePayload()} mode="flat_all" emailSummaries={mockEmailSummaryMap()} />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Flat (skeleton)</div>
          <EmailAggregateView data={mockEmailAggregatePayload()} mode="flat_all" emailSummaries={mockEmailSummaryMap()} showListDetailSkeleton />
        </div>
      </div>
    ),
  },
  {
    name: 'Skeleton',
    file: 'assets/js/src/ui/skeleton/Skeleton.tsx',
    render: () => (
      <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <Skeleton variant="text" width="80%" height={12} />
        <Skeleton variant="text" width="60%" height={12} />
        <Skeleton variant="rect" width="100%" height={60} radius={8} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Skeleton variant="circle" width={32} height={32} radius={16} />
          <Skeleton variant="text" width="70%" height={12} />
        </div>
      </div>
    ),
  },
  {
    name: 'SkeletonText',
    file: 'assets/js/src/ui/skeleton/SkeletonText.tsx',
    render: () => <SkeletonText lines={5} />,
  },
  {
    name: 'skeleton index exports',
    file: 'assets/js/src/ui/skeleton/index.ts',
    render: () => (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 600 }}>Exports:</div>
        <div>
          <code>Skeleton</code>, <code>SkeletonText</code>
        </div>
      </div>
    ),
  },
  {
    name: 'CommandCentralHeader',
    file: 'assets/js/src/ui/command-central/CommandCentralHeader.tsx',
    render: () => (
      <CommandCentralHeader
        label="Flux One (Dev)"
        kind="dev"
        commandsModalTriggerRef={{ current: null }}
        onOpenCommandReference={() => undefined}
        onCloseOverlay={() => undefined}
      />
    ),
  },
  {
    name: 'RecentAdminPages',
    file: 'assets/js/src/ui/command-central/RecentAdminPages.tsx',
    render: () => (
      <RecentAdminPages
        items={[
          { label: 'Dashboard', url: '/wp-admin/index.php' },
          { label: 'Plugins', url: '/wp-admin/plugins.php' },
          { label: 'Users', url: '/wp-admin/users.php' },
        ]}
      />
    ),
  },
  {
    name: 'StructuredListPanels',
    file: 'assets/js/src/ui/command-central/StructuredListPanels.tsx',
    render: () => (
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Plugins panel</div>
          <StructuredListPanels
            structuredPanelRef={{ current: null }}
            panelId="plugins"
            panelData={[
              { pluginFile: 'hello-dolly/hello.php', name: 'Hello Dolly', active: true, updateAvailable: false },
              { pluginFile: 'akismet/akismet.php', name: 'Akismet', active: false, updateAvailable: true },
            ]}
            adminBase="/wp-admin/"
            executeFromInput={() => undefined}
          />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Users panel</div>
          <StructuredListPanels
            structuredPanelRef={{ current: null }}
            panelId="users"
            panelData={[
              { id: 1, email: 'admin@example.com', displayName: 'Admin' },
              { id: 2, email: 'editor@example.com', displayName: 'Editor' },
            ]}
            adminBase="/wp-admin/"
            executeFromInput={() => undefined}
            currentUserId={1}
          />
        </div>
      </div>
    ),
  },
  {
    name: 'MenuListPanel',
    file: 'assets/js/src/ui/command-central/MenuListPanel.tsx',
    render: () => (
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="notice notice-info inline" style={{ margin: 0 }}>
          <p style={{ margin: 0 }}>
            MenuListPanel can call REST endpoints when a menu id is selected. This demo renders with no menus so no XHR runs.
          </p>
        </div>
        <MenuListPanel structuredPanelRef={{ current: null }} menus={[]} adminBase="/wp-admin/" />
      </div>
    ),
  },
  {
    name: 'SuiteConfigPanel',
    file: 'assets/js/src/ui/command-central/suite-config/SuiteConfigPanel.tsx',
    render: () => (
      <SuiteConfigPanel
        structuredPanelRef={{ current: null }}
        rows={mockSuiteConfigRows()}
        executeFromInput={() => undefined}
        focusedRowId="wp.posts_per_page"
      />
    ),
  },
  {
    name: 'SuiteConfigField',
    file: 'assets/js/src/ui/command-central/suite-config/SuiteConfigField.tsx',
    render: () => <SuiteConfigFieldDemo />,
  },
  {
    name: 'suite-config types',
    file: 'assets/js/src/ui/command-central/suite-config/types.ts',
    render: () => (
      <div>
        <code>SuiteConfigRow</code> (type-only export)
      </div>
    ),
  },
  {
    name: 'CommandCentralMount',
    file: 'assets/js/src/ui/CommandCentralMount.tsx',
    render: () => (
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="notice notice-warning inline" style={{ margin: 0 }}>
          <p style={{ margin: 0 }}>Full mount (interactive, uses window events + queries). Dev-only.</p>
        </div>
        <CommandCentralMount kind="dev" />
      </div>
    ),
  },
  {
    name: 'CommandsReferenceList',
    file: 'assets/js/src/ui/CommandsReferenceList.tsx',
    render: () => (
      <div className="flux-one-theme" style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Default (all rows)</div>
          <CommandsReferenceList />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Filtered (defaultQuery=&quot;email&quot;)</div>
          <CommandsReferenceList defaultQuery="email" />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Empty state (no matches)</div>
          <CommandsReferenceList defaultQuery="zzznomatchzzz" />
        </div>
      </div>
    ),
  },
];

