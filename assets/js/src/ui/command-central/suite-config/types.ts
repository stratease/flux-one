/**
 * Suite configuration panel row shape (matches REST / command panel payloads).
 *
 * @since 1.7.0
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
