/**
 * Suite configuration panel row shape (matches REST / command panel payloads).
 *
 * @since 1.6.4
 */
export type SuiteConfigRow = {
  id: string;
  label: string;
  plugin: string;
  type: string;
  valueDisplay: string;
  /** Live value not yet merged from `config get` (hybrid panel open). */
  valuePending?: boolean;
  group?: string;
  groupLabel?: string;
  groupOrder?: number;
  min?: number;
  max?: number;
  choices?: string[];
};
