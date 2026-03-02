"use client";

interface ArrayFieldEditorProps<T extends Record<string, string>> {
  items: T[];
  onChange: (items: T[]) => void;
  fields: { key: keyof T; label: string; placeholder?: string; wide?: boolean }[];
  emptyItem: T;
  addLabel?: string;
}

export function ArrayFieldEditor<T extends Record<string, string>>({
  items,
  onChange,
  fields,
  emptyItem,
  addLabel = "Add item",
}: ArrayFieldEditorProps<T>) {
  function updateItem(index: number, key: keyof T, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { ...emptyItem }]);
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="relative border border-border-default rounded-md p-3 bg-bg-base/50"
        >
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="absolute top-2 right-2 text-text-secondary hover:text-red-400 transition-colors"
            title="Remove"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="grid grid-cols-2 gap-2 pr-6">
            {fields.map((field) => (
              <div
                key={String(field.key)}
                className={field.wide ? "col-span-2" : ""}
              >
                <label className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={item[field.key] ?? ""}
                  onChange={(e) =>
                    updateItem(idx, field.key, e.target.value)
                  }
                  placeholder={field.placeholder}
                  className="w-full mt-0.5 px-2 py-1.5 text-sm bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        {addLabel}
      </button>
    </div>
  );
}
