import { parseInput } from './normalize';
import { getRouteTokens } from './suggest';

export type CommandIntent = {
  /** Canonical first token (after alias + summary prefix handling). */
  root: string;
  /** Canonical second token (if any). */
  sub: string;
  wantsPlugins: boolean;
  wantsUsers: boolean;
  wantsMenus: boolean;
  wantsSites: boolean;
  wantsDestinations: boolean;
  wantsSuiteConfig: boolean;
  wantsEdit: boolean;
};

export function getIntent(input: string): CommandIntent {
  const p = parseInput(input);
  const rt = getRouteTokens(p);
  const rt0 = rt[0] || '';
  const rt1 = rt[1] || '';
  const root = rt0 === 'summary' ? rt1 : rt0;
  const sub = rt0 === 'summary' ? (rt[2] || '') : rt1;
  return {
    root,
    sub,
    wantsPlugins: root === 'plugin',
    wantsUsers: root === 'user',
    wantsMenus: root === 'menu',
    wantsSites: false,
    wantsDestinations: root === 'nav',
    wantsSuiteConfig: root === 'config',
    wantsEdit: root === 'edit',
  };
}

