import type { ComponentType, SVGProps } from 'react';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

export type CommandRootId =
  | 'nav'
  | 'edit'
  | 'plugin'
  | 'user'
  | 'menu'
  | 'config'
  | 'aggregate'
  | 'summary';

export type SuggestionMetaEntry = {
  id: CommandRootId;
  canonical: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Canonical root + decorative icon for each Overview suggestion chip.
 *
 * Canonical strings mirror `CommandRouter` roots so chip clicks prefill
 * Command Bar with the same token typed users would enter manually.
 *
 * @since 1.6.0
 */
export const OVERVIEW_SUGGESTION_META: readonly SuggestionMetaEntry[] = [
  { id: 'nav', canonical: 'nav', Icon: NearMeOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'edit', canonical: 'edit', Icon: EditOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'plugin', canonical: 'plugin', Icon: ExtensionOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'user', canonical: 'user', Icon: PersonOutlineOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'menu', canonical: 'menu', Icon: MenuOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'config', canonical: 'config', Icon: SettingsOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'aggregate', canonical: 'aggregate', Icon: AssessmentOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
  { id: 'summary', canonical: 'summary', Icon: DescriptionOutlinedIcon as unknown as ComponentType<SVGProps<SVGSVGElement>> },
] as const;

/**
 * Index map of suggestion metadata by id (avoids linear scans at render time).
 *
 * @since 1.6.0
 */
export const OVERVIEW_SUGGESTION_META_BY_ID: Readonly<Record<CommandRootId, SuggestionMetaEntry>> =
  OVERVIEW_SUGGESTION_META.reduce((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {} as Record<CommandRootId, SuggestionMetaEntry>);

/**
 * Build the CustomEvent dispatched when a suggestion chip is clicked.
 *
 * Command Bar's mount listens for `flux-one-open` and reads `detail.input` to
 * prefill the input on open.
 *
 * @since 1.6.0
 */
export function buildSuggestionPrefillEvent(canonical: string): CustomEvent<{ input: string }> {
  const trimmed = String(canonical || '').trim();
  const input = trimmed.length > 0 ? `${trimmed} ` : '';
  return new CustomEvent('flux-one-open', { detail: { input } });
}
