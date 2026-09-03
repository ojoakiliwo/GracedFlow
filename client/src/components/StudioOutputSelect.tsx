import { STUDIO_OUTPUTS, type StudioOutputId } from "../lib/studioOutput";

export function StudioOutputSelect({
  value,
  onChange,
  disabled,
}: {
  value: StudioOutputId;
  onChange: (id: StudioOutputId) => void;
  disabled?: boolean;
}) {
  const current = STUDIO_OUTPUTS.find((row) => row.id === value) ?? STUDIO_OUTPUTS[0]!;
  return (
    <label className="flex min-w-[11rem] flex-col gap-0.5 text-[10px] uppercase tracking-wide text-ink-500">
      Output to Livepeer
      <select
        disabled={disabled}
        value={value}
        title={current.hint}
        onChange={(e) => onChange(e.target.value as StudioOutputId)}
        className="h-9 rounded-xl border border-white/15 bg-[#12141a] px-2 text-sm font-medium normal-case tracking-normal text-ink-100 disabled:opacity-60"
      >
        {STUDIO_OUTPUTS.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </select>
    </label>
  );
}
