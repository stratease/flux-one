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
  wantsDestinations: boolean;
  wantsSuiteConfig: boolean;
  wantsEdit: boolean;
  /** @since 1.6.3 Public content navigation (`pnav`). */
  wantsPnav: boolean;
  /** Shared XHR index for `edit` and `pnav`. */
  wantsContentIndex: boolean;
};

export function getIntent(input: string): CommandIntent {
  const p = parseInput(input);
  const rt = getRouteTokens(p);
  const rt0 = rt[0] || '';
  const rt1 = rt[1] || '';
  const root = rt0 === 'summary' ? rt1 : rt0;
  const sub = rt0 === 'summary' ? (rt[2] || '') : rt1;
  const wantsEdit = root === 'edit';
  const wantsPnav = root === 'pnav';

  return {
    root,
    sub,
    wantsPlugins: root === 'plugin',
    wantsUsers: root === 'user',
    wantsMenus: root === 'menu',
    wantsDestinations: root === 'nav',
    wantsSuiteConfig: root === 'config',
    wantsEdit,
    wantsPnav,
    wantsContentIndex: wantsEdit || wantsPnav,
  };
}

