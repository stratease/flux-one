import React, { useCallback, useId } from 'react';
import type { SuiteConfigRow } from './types';
import type { Suggestion } from '../../../command/types';

export type SuiteConfigFieldProps = {
  row: SuiteConfigRow;
  executeFromInput: (rawCommand: string, picked?: Suggestion | null) => void;
};

/**
 * Inline edit controls for one suite config row (maps catalog type → widget).
 *
 * @since 1.6.4
 */
export function SuiteConfigField({ row, executeFromInput }: SuiteConfigFieldProps) {
  const runSet = useCallback(
    (rawValue: string) => {
      const cmd = `config set ${row.id} ${rawValue}`;
      executeFromInput(cmd);
    },
    [executeFromInput, row.id]
  );

  let inner: React.ReactNode = null;
  switch (row.type) {
    case 'bool':
      inner = (
        <>
          <button type="button" className="flux-one-btn-small" disabled={!!row.valuePending} onClick={() => runSet('true')}>
            Set true
          </button>
          <button type="button" className="flux-one-btn-small" disabled={!!row.valuePending} onClick={() => runSet('false')}>
            Set false
          </button>
        </>
      );
      break;
    case 'int':
      inner = (
        <SuiteConfigIntField key={`${row.id}-${row.valueDisplay}-${row.valuePending ? 'p' : 'v'}`} row={row} onApply={(n) => runSet(String(n))} />
      );
      break;
    case 'enum':
      inner = (
        <SuiteConfigEnumField key={`${row.id}-${row.valueDisplay}-${row.valuePending ? 'p' : 'v'}`} row={row} onChange={(v) => runSet(v)} />
      );
      break;
    case 'secret':
      inner = (
        <SuiteConfigSecretField
          key={`${row.id}-${row.valuePending ? 'p' : 'v'}`}
          disabled={!!row.valuePending}
          onApply={(v) => runSet(v)}
        />
      );
      break;
    case 'string':
      inner = (
        <SuiteConfigTextField
          key={`${row.id}-${row.valueDisplay}-${row.valuePending ? 'p' : 'v'}`}
          defaultValue={row.valuePending ? '' : row.valueDisplay}
          disabled={!!row.valuePending}
          onApply={(v) => runSet(v)}
        />
      );
      break;
    default:
      inner = null;
  }

  return (
    <div data-flux-config-row={row.id} className="flux-one-suite-config-field-root">
      {inner}
    </div>
  );
}

type SuiteConfigIntFieldProps = {
  row: SuiteConfigRow;
  onApply: (value: number) => void;
};

function SuiteConfigIntField({ row, onApply }: SuiteConfigIntFieldProps) {
  const formId = useId();
  const parsed = parseInt(String(row.valueDisplay).trim(), 10);
  const fallback =
    row.valuePending || !Number.isFinite(parsed) ? row.min ?? 0 : parsed;

  return (
    <form
      className="flux-one-suite-config-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const raw = String(fd.get('value') ?? '').trim();
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n)) {
          return;
        }
        const min = row.min ?? Number.MIN_SAFE_INTEGER;
        const max = row.max ?? Number.MAX_SAFE_INTEGER;
        if (n < min || n > max) {
          return;
        }
        onApply(n);
      }}
    >
      <label htmlFor={formId} className="flux-one-visually-hidden">
        New value for {row.label}
      </label>
      <input
        id={formId}
        name="value"
        type="number"
        className="flux-one-suite-config-input"
        defaultValue={fallback}
        min={row.min}
        max={row.max}
        step={1}
        disabled={!!row.valuePending}
      />
      <button type="submit" className="flux-one-btn-small" disabled={!!row.valuePending}>
        Apply
      </button>
    </form>
  );
}

type SuiteConfigEnumFieldProps = {
  row: SuiteConfigRow;
  onChange: (value: string) => void;
};

function SuiteConfigEnumField({ row, onChange }: SuiteConfigEnumFieldProps) {
  const selId = useId();
  const choices = Array.isArray(row.choices) ? row.choices : [];
  const current = String(row.valueDisplay).trim();
  if (choices.length === 0) {
    return null;
  }
  const selected =
    row.valuePending || current === ''
      ? choices[0] ?? ''
      : choices.find((c) => String(c).toLowerCase() === current.toLowerCase()) ?? choices[0] ?? '';

  return (
    <div className="flux-one-suite-config-select-wrap">
      <label htmlFor={selId} className="flux-one-visually-hidden">
        Choose value for {row.label}
      </label>
      <select
        id={selId}
        className="flux-one-suite-config-select"
        value={selected}
        disabled={!!row.valuePending}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

type SuiteConfigTextFieldProps = {
  defaultValue: string;
  disabled?: boolean;
  onApply: (value: string) => void;
};

function SuiteConfigTextField({ defaultValue, disabled, onApply }: SuiteConfigTextFieldProps) {
  const fid = useId();
  return (
    <form
      className="flux-one-suite-config-inline-form flux-one-suite-config-inline-form--grow"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onApply(String(fd.get('value') ?? '').trim());
      }}
    >
      <label htmlFor={fid} className="flux-one-visually-hidden">
        New text value
      </label>
      <input id={fid} name="value" type="text" className="flux-one-suite-config-input" defaultValue={defaultValue} disabled={disabled} />
      <button type="submit" className="flux-one-btn-small" disabled={disabled}>
        Apply
      </button>
    </form>
  );
}

function SuiteConfigSecretField({ onApply, disabled }: { onApply: (value: string) => void; disabled?: boolean }) {
  const fid = useId();
  return (
    <form
      className="flux-one-suite-config-inline-form flux-one-suite-config-inline-form--grow"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onApply(String(fd.get('value') ?? ''));
      }}
    >
      <label htmlFor={fid} className="flux-one-visually-hidden">
        Secret value
      </label>
      <input id={fid} name="value" type="password" className="flux-one-suite-config-input" autoComplete="off" disabled={disabled} />
      <button type="submit" className="flux-one-btn-small" disabled={disabled}>
        Apply
      </button>
    </form>
  );
}
