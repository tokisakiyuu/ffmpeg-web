import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { OpParamField, OpParams } from '../../types'
import { parseTimecode, toTimecode } from '../../lib/format'

interface ParamFieldProps {
  field: OpParamField
  params: OpParams
  disabled?: boolean
  onChange: (patch: Partial<OpParams>) => void
}

const inputBase =
  'w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 ' +
  'outline-none transition-colors focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'

export function ParamField({ field, params, disabled, onChange }: ParamFieldProps) {
  if (field.showIf && !field.showIf(params)) return null

  return (
    <div>
      {field.type === 'toggle' ? (
        <ToggleControl field={field} params={params} disabled={disabled} onChange={onChange} />
      ) : (
        <>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {field.label}
          </label>
          {field.type === 'select' && (
            <SelectControl field={field} params={params} disabled={disabled} onChange={onChange} />
          )}
          {field.type === 'number' && (
            <NumberControl field={field} params={params} disabled={disabled} onChange={onChange} />
          )}
          {field.type === 'text' && (
            <TextControl field={field} params={params} disabled={disabled} onChange={onChange} />
          )}
          {field.type === 'timerange' && (
            <TimerangeControl params={params} disabled={disabled} onChange={onChange} />
          )}
        </>
      )}
      {field.help && (
        <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">{field.help}</p>
      )}
    </div>
  )
}

function SelectControl({ field, params, disabled, onChange }: ParamFieldProps) {
  return (
    <select
      value={String(params[field.key] ?? '')}
      disabled={disabled}
      onChange={(e) => onChange({ [field.key]: e.target.value })}
      className={clsx(inputBase, 'appearance-none pr-8')}
      // inline chevron keeps the native select styleable without extra markup
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
      }}
    >
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function NumberControl({ field, params, disabled, onChange }: ParamFieldProps) {
  const value = params[field.key]
  return (
    <input
      type="number"
      value={typeof value === 'number' ? value : ''}
      min={field.min}
      max={field.max}
      step={field.step}
      placeholder={field.placeholder}
      disabled={disabled}
      onChange={(e) => {
        const n = e.target.valueAsNumber
        // skip empty/invalid intermediate input, keep last committed value
        if (Number.isFinite(n)) onChange({ [field.key]: n })
      }}
      className={inputBase}
    />
  )
}

function TextControl({ field, params, disabled, onChange }: ParamFieldProps) {
  return (
    <input
      type="text"
      value={String(params[field.key] ?? '')}
      placeholder={field.placeholder}
      disabled={disabled}
      onChange={(e) => onChange({ [field.key]: e.target.value })}
      className={inputBase}
    />
  )
}

/** timerange always maps to the startSec/endSec params by convention */
function TimerangeControl({
  params,
  disabled,
  onChange,
}: Omit<ParamFieldProps, 'field'>) {
  return (
    <div className="flex items-center gap-2">
      <TimecodeInput
        label="Start"
        seconds={typeof params.startSec === 'number' ? params.startSec : 0}
        disabled={disabled}
        onCommit={(sec) => onChange({ startSec: sec })}
      />
      <span className="text-xs text-zinc-400 dark:text-zinc-600">→</span>
      <TimecodeInput
        label="End"
        seconds={typeof params.endSec === 'number' ? params.endSec : 0}
        disabled={disabled}
        onCommit={(sec) => onChange({ endSec: sec })}
      />
    </div>
  )
}

function TimecodeInput({
  label,
  seconds,
  disabled,
  onCommit,
}: {
  label: string
  seconds: number
  disabled?: boolean
  onCommit: (sec: number) => void
}) {
  const [text, setText] = useState(() => toTimecode(seconds))
  const invalid = parseTimecode(text) === undefined

  // adopt external changes (reset, restored defaults) without fighting typing:
  // while the user types, valid commits keep params in sync so this is a no-op
  useEffect(() => {
    setText((prev) => (parseTimecode(prev) === seconds ? prev : toTimecode(seconds)))
  }, [seconds])

  return (
    <input
      type="text"
      aria-label={label}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value)
        const sec = parseTimecode(e.target.value)
        if (sec !== undefined) onCommit(sec)
      }}
      onBlur={() => {
        const sec = parseTimecode(text)
        if (sec !== undefined) setText(toTimecode(sec))
      }}
      placeholder="00:00:00.000"
      className={clsx(
        inputBase,
        'min-w-0 flex-1 font-mono text-xs',
        invalid && 'border-red-500 focus:border-red-500 dark:border-red-500',
      )}
    />
  )
}

function ToggleControl({ field, params, disabled, onChange }: ParamFieldProps) {
  const checked = params[field.key] === true
  return (
    <label
      className={clsx(
        'flex select-none items-center justify-between gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{field.label}</span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange({ [field.key]: e.target.checked })}
          className="peer sr-only"
        />
        <span
          className={clsx(
            'h-5 w-9 rounded-full transition-colors',
            checked ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700',
          )}
        />
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </span>
    </label>
  )
}
