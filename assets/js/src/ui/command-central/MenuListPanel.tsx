import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { Skeleton } from '../skeleton/Skeleton';

export type MenuIndexRow = { id: number; name: string; slug?: string };
export type MenuItemRow = {
  id: number;
  title: string;
  type: string;
  url: string;
  parentId: number;
  order: number;
};

type MenuDetailPayload = {
  menu: { id: number; name: string };
  items: MenuItemRow[];
};

function normalizeSiblingOrders(items: MenuItemRow[]): MenuItemRow[] {
  const byParent = new Map<number, MenuItemRow[]>();
  for (const it of items) {
    const p = it.parentId || 0;
    if (!byParent.has(p)) {
      byParent.set(p, []);
    }
    byParent.get(p)!.push({ ...it });
  }
  const out: MenuItemRow[] = [];
  for (const [, group] of byParent) {
    group.sort((a, b) => a.order - b.order);
    group.forEach((row, idx) => {
      out.push({ ...row, order: idx });
    });
  }
  return out;
}

function sortFlatByTree(items: MenuItemRow[]): MenuItemRow[] {
  const byParent = new Map<number, MenuItemRow[]>();
  for (const it of items) {
    const p = it.parentId || 0;
    if (!byParent.has(p)) {
      byParent.set(p, []);
    }
    byParent.get(p)!.push(it);
  }
  for (const [, g] of byParent) {
    g.sort((a, b) => a.order - b.order);
  }
  const ordered: MenuItemRow[] = [];
  const walk = (parentId: number) => {
    const kids = byParent.get(parentId) || [];
    for (const k of kids) {
      ordered.push(k);
      walk(k.id);
    }
  };
  walk(0);
  return ordered;
}

function depthMap(items: MenuItemRow[]): Map<number, number> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const memo = new Map<number, number>();
  const depthOf = (id: number): number => {
    if (memo.has(id)) {
      return memo.get(id)!;
    }
    const it = byId.get(id);
    if (!it || !it.parentId) {
      memo.set(id, 0);
      return 0;
    }
    const d = depthOf(it.parentId) + 1;
    memo.set(id, d);
    return d;
  };
  for (const i of items) {
    depthOf(i.id);
  }
  return memo;
}

export type MenuListPanelProps = {
  structuredPanelRef: React.RefObject<HTMLDivElement | null>;
  menus: MenuIndexRow[];
  adminBase: string;
};

/**
 * Command Bar nav menu editor (list pick + item tree).
 *
 * @since 1.4.0
 * @since 1.4.2 Add custom link via form submit (Enter) and shared control styling tokens.
 */
export function MenuListPanel({ structuredPanelRef, menus, adminBase }: MenuListPanelProps) {
  const queryClient = useQueryClient();
  const [selectedMenuId, setSelectedMenuId] = useState<number>(() => menus[0]?.id ?? 0);
  const [localItems, setLocalItems] = useState<MenuItemRow[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMenuId <= 0 && menus.length) {
      setSelectedMenuId(menus[0].id);
    }
  }, [menus, selectedMenuId]);

  const menuQuery = useQuery({
    queryKey: ['flux-one', 'menu', 'detail', selectedMenuId],
    queryFn: async () => {
      const raw = await api.getMenu(selectedMenuId);
      const inner = (raw as { data?: MenuDetailPayload })?.data ?? (raw as MenuDetailPayload);
      return inner;
    },
    enabled: selectedMenuId > 0,
  });

  useEffect(() => {
    const items = menuQuery.data?.items;
    if (Array.isArray(items)) {
      setLocalItems(items.map((i) => ({ ...i })));
    }
  }, [menuQuery.data?.items, menuQuery.dataUpdatedAt]);

  const serverSnapshot = useMemo(() => {
    const items = menuQuery.data?.items;
    return Array.isArray(items) ? JSON.stringify(items) : '';
  }, [menuQuery.data?.items, menuQuery.dataUpdatedAt]);

  const isDirty = useMemo(() => {
    if (!serverSnapshot) {
      return false;
    }
    return JSON.stringify(localItems) !== serverSnapshot;
  }, [localItems, serverSnapshot]);

  const flatDisplay = useMemo(() => sortFlatByTree(normalizeSiblingOrders(localItems)), [localItems]);
  const depths = useMemo(() => depthMap(localItems), [localItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeSiblingOrders(localItems);
      const payload = normalized.map((r) => ({ id: r.id, parentId: r.parentId || 0, order: r.order }));
      return api.saveMenuItems(selectedMenuId, payload);
    },
    onSuccess: async () => {
      setPanelError(null);
      await queryClient.invalidateQueries({ queryKey: ['flux-one', 'menu', 'detail', selectedMenuId] });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Save failed.';
      setPanelError(msg);
    },
  });

  const addMutation = useMutation({
    mutationFn: () => api.addMenuCustomItem(selectedMenuId, { title: customTitle.trim(), url: customUrl.trim() }),
    onSuccess: async () => {
      setCustomTitle('');
      setCustomUrl('');
      setPanelError(null);
      await queryClient.invalidateQueries({ queryKey: ['flux-one', 'menu', 'detail', selectedMenuId] });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Add failed.';
      setPanelError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => api.deleteMenuItem(selectedMenuId, itemId),
    onSuccess: async () => {
      setPanelError(null);
      await queryClient.invalidateQueries({ queryKey: ['flux-one', 'menu', 'detail', selectedMenuId] });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Remove failed.';
      setPanelError(msg);
    },
  });

  const siblingsOf = useCallback(
    (itemId: number) => {
      const target = localItems.find((i) => i.id === itemId);
      if (!target) {
        return [];
      }
      const pid = target.parentId || 0;
      return normalizeSiblingOrders(localItems)
        .filter((i) => (i.parentId || 0) === pid)
        .sort((a, b) => a.order - b.order);
    },
    [localItems]
  );

  const moveUp = (itemId: number) => {
    const sibs = siblingsOf(itemId);
    const idx = sibs.findIndex((s) => s.id === itemId);
    if (idx <= 0) {
      return;
    }
    const a = sibs[idx - 1];
    const b = sibs[idx];
    setLocalItems((prev) => {
      const next = prev.map((row) => {
        if (row.id === a.id) {
          return { ...row, order: b.order };
        }
        if (row.id === b.id) {
          return { ...row, order: a.order };
        }
        return row;
      });
      return normalizeSiblingOrders(next);
    });
  };

  const moveDown = (itemId: number) => {
    const sibs = siblingsOf(itemId);
    const idx = sibs.findIndex((s) => s.id === itemId);
    if (idx < 0 || idx >= sibs.length - 1) {
      return;
    }
    const a = sibs[idx];
    const b = sibs[idx + 1];
    setLocalItems((prev) => {
      const next = prev.map((row) => {
        if (row.id === a.id) {
          return { ...row, order: b.order };
        }
        if (row.id === b.id) {
          return { ...row, order: a.order };
        }
        return row;
      });
      return normalizeSiblingOrders(next);
    });
  };

  const indent = (itemId: number) => {
    const sibs = siblingsOf(itemId);
    const idx = sibs.findIndex((s) => s.id === itemId);
    if (idx <= 0) {
      return;
    }
    const newParent = sibs[idx - 1];
    setLocalItems((prev) => {
      const next = prev.map((row) => (row.id === itemId ? { ...row, parentId: newParent.id } : row));
      return normalizeSiblingOrders(next);
    });
  };

  const outdent = (itemId: number) => {
    const row = localItems.find((i) => i.id === itemId);
    if (!row || !row.parentId) {
      return;
    }
    const parent = localItems.find((i) => i.id === row.parentId);
    const newParent = parent ? parent.parentId || 0 : 0;
    setLocalItems((prev) => {
      const next = prev.map((r) => (r.id === itemId ? { ...r, parentId: newParent } : r));
      return normalizeSiblingOrders(next);
    });
  };

  const busy = saveMutation.isPending || addMutation.isPending || deleteMutation.isPending;

  const handleAddCustomSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !customTitle.trim() || !customUrl.trim()) {
      return;
    }
    addMutation.mutate();
  };

  return (
    <div ref={structuredPanelRef} className="flux-one-structured-results flux-one-menu-panel">
      <div className="flux-one-structured-panel">
        <div className="flux-one-structured-panel-title">Menus</div>
        <p className="flux-one-menu-panel-hint">
          Create or delete whole menus in{' '}
          <a href={`${adminBase}nav-menus.php`} target="_blank" rel="noreferrer">
            Appearance → Menus
          </a>
          .
        </p>
        {panelError ? (
          <div className="flux-one-notice flux-one-notice--error flux-one-menu-panel-error" role="alert">
            {panelError}
          </div>
        ) : null}
        {menus.length === 0 ? (
          <div className="flux-one-body-copy">No menus yet. Add one in Appearance → Menus.</div>
        ) : (
          <div className="flux-one-menu-panel-layout">
            <div className="flux-one-menu-panel-master">
              <div className="flux-one-menu-panel-subtitle">Menu</div>
              <select
                className="flux-one-menu-select"
                value={selectedMenuId}
                onChange={(e) => setSelectedMenuId(Number(e.target.value))}
                disabled={busy}
                aria-label="Select nav menu"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flux-one-menu-panel-detail">
              {menuQuery.isFetching && !menuQuery.data ? (
                <div className="flux-one-menu-tree-skeleton" aria-busy>
                  <Skeleton height={14} className="flux-one-menu-skel-row" />
                  <Skeleton height={14} className="flux-one-menu-skel-row" />
                  <Skeleton height={14} className="flux-one-menu-skel-row" />
                </div>
              ) : menuQuery.isError ? (
                <div className="flux-one-notice flux-one-notice--error" role="alert">
                  Could not load menu. Try again or use Appearance → Menus.
                </div>
              ) : (
                <>
                  <div className="flux-one-menu-add-custom">
                    <div className="flux-one-menu-panel-subtitle">Add custom link</div>
                    <form className="flux-one-menu-add-form" onSubmit={handleAddCustomSubmit}>
                      <div className="flux-one-menu-add-row">
                        <input
                          type="text"
                          className="flux-one-menu-input"
                          placeholder="Label"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          disabled={busy}
                          aria-label="Custom link label"
                        />
                        <input
                          type="url"
                          className="flux-one-menu-input"
                          placeholder="https://"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          disabled={busy}
                          aria-label="Custom link URL"
                        />
                        <button
                          type="submit"
                          className="flux-one-btn-small"
                          disabled={busy || !customTitle.trim() || !customUrl.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </form>
                  </div>
                  <div className="flux-one-menu-tree-toolbar">
                    <button
                      type="button"
                      className="flux-one-btn-small flux-one-btn-small--primary"
                      disabled={busy || !isDirty}
                      onClick={() => saveMutation.mutate()}
                    >
                      Save order
                    </button>
                    <button
                      type="button"
                      className="flux-one-btn-small"
                      disabled={busy || !isDirty}
                      onClick={() => {
                        const items = menuQuery.data?.items;
                        setLocalItems(Array.isArray(items) ? items.map((i) => ({ ...i })) : []);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  {flatDisplay.length === 0 ? (
                    <div className="flux-one-body-copy flux-one-menu-empty">No items in this menu yet.</div>
                  ) : (
                    <ul className="flux-one-menu-tree" role="tree">
                      {flatDisplay.map((row) => {
                        const d = depths.get(row.id) ?? 0;
                        return (
                          <li
                            key={row.id}
                            className="flux-one-menu-tree-item"
                            role="treeitem"
                            style={{ paddingLeft: `${12 + d * 16}px` }}
                          >
                            <span className="flux-one-menu-tree-title">{row.title || '(no title)'}</span>
                            <span className="flux-one-menu-tree-actions">
                              <button
                                type="button"
                                className="flux-one-btn-small"
                                disabled={busy}
                                onClick={() => moveUp(row.id)}
                                aria-label={`Move up ${row.title}`}
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                className="flux-one-btn-small"
                                disabled={busy}
                                onClick={() => moveDown(row.id)}
                                aria-label={`Move down ${row.title}`}
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                className="flux-one-btn-small"
                                disabled={busy}
                                onClick={() => indent(row.id)}
                                aria-label={`Nest under previous ${row.title}`}
                              >
                                Nest
                              </button>
                              <button
                                type="button"
                                className="flux-one-btn-small"
                                disabled={busy}
                                onClick={() => outdent(row.id)}
                                aria-label={`Unnest ${row.title}`}
                              >
                                Unnest
                              </button>
                              <button
                                type="button"
                                className="flux-one-btn-small"
                                disabled={busy}
                                onClick={() => deleteMutation.mutate(row.id)}
                                aria-label={`Remove ${row.title}`}
                              >
                                Remove
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
