import React from 'react';

export type RecentNavItem = { label: string; url?: string; command?: string };

export type RecentAdminPagesProps = {
  items: RecentNavItem[];
};

/**
 * Dashboard widget strip of recent admin links.
 *
 * @since 1.3.0
 */
export function RecentAdminPages({ items }: RecentAdminPagesProps) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="flux-one-recent-nav flux-one-recent-nav-block">
      <div className="flux-one-recent-nav-title">Recent admin pages</div>
      <div className="flux-one-recent-nav-links">
        {items.map((item, i) => {
          const href = item.url && typeof item.url === 'string' ? item.url : '';
          if (!href) {
            return null;
          }
          return (
            <a key={`${href}-${item.label}-${i}`} href={href} className="button button-small">
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
