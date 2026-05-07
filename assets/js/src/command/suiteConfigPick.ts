import type { SuiteConfigRow } from '../ui/command-central/suite-config/types';
import type { IndexData } from './suggest';

/**
 * Parses `config set {id}` with no value segment (optional trailing space).
 *
 * @since 1.5.0
 */
export function parseIncompleteConfigSet(input: string): string | null {
  const t = input.trim();
  const m = /^config\s+set\s+(\S+)(?:\s+(.*))?$/i.exec(t);
  if (!m) {
    return null;
  }
  const rest = (m[2] ?? '').trim();
  if (rest !== '') {
    return null;
  }
  return m[1];
}

/**
 * Maps a suite-config index row to a panel row (live value may be filled later).
 *
 * @since 1.5.0
 */
export function suiteConfigRowFromIndex(
  row: NonNullable<IndexData['suiteConfig']>[number],
  valueDisplay: string,
  valuePending?: boolean
): SuiteConfigRow {
  const out: SuiteConfigRow = {
    id: row.id,
    label: row.label,
    plugin: row.plugin,
    type: row.type,
    valueDisplay: valueDisplay || '',
  };
  if (valuePending === true) {
    out.valuePending = true;
  }
  if (row.group !== undefined) {
    out.group = row.group;
  }
  if (row.groupLabel !== undefined) {
    out.groupLabel = row.groupLabel;
  }
  if (row.groupOrder !== undefined) {
    out.groupOrder = row.groupOrder;
  }
  if (row.min !== undefined) {
    out.min = row.min;
  }
  if (row.max !== undefined) {
    out.max = row.max;
  }
  if (row.choices !== undefined) {
    out.choices = row.choices;
  }
  return out;
}
