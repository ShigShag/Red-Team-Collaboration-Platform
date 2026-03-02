"use client";

interface FieldToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

/**
 * Compact checkbox toggle for enabling/disabling fields in the report.
 * Designed to be used in the `trailing` prop of FieldInput.
 */
export function FieldToggle({ checked, onChange, label = "Include in PDF" }: FieldToggleProps) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3 h-3 rounded border-border-default text-accent focus:ring-accent/30 bg-bg-base cursor-pointer"
      />
      <span className="text-[9px] text-text-muted group-hover:text-text-secondary transition-colors select-none">
        {label}
      </span>
    </label>
  );
}
