"use client";

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  trailing?: React.ReactNode;
}

export function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 3,
  className,
  trailing,
}: FieldInputProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
          {label}
        </label>
        {trailing}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-2.5 py-1.5 text-sm bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-sm bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
        />
      )}
    </div>
  );
}
