interface SectionGroupHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionGroupHeader({ title, subtitle }: SectionGroupHeaderProps) {
  return (
    <div className="pt-4 pb-1 px-1">
      <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">
        {title}
      </h3>
      {subtitle && (
        <p className="text-[10px] text-text-secondary mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
