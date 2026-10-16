import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    { options, value, defaultValue, placeholder, onChange, className, disabled },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<string | undefined>(
      value ?? defaultValue,
    );

    const selectedLabel =
      options.find((opt) => opt.value === selected)?.label ??
      placeholder ??
      "Select...";

    const handleSelect = (val: string) => {
      setSelected(val);
      setOpen(false);
      onChange?.(val);
    };

    React.useEffect(() => {
      if (value !== undefined && value !== selected) {
        setSelected(value);
      }
    }, [value]);

    return (
      <div className="relative inline-block w-full">
        <button
          type="button"
          ref={ref}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input",
            "bg-background px-3 py-2 text-sm transition-colors",
            "placeholder:text-muted-foreground focus-within:outline-none",
            "focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed",
            "disabled:opacity-50",
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
        </button>

        {open && (
          <div
            className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover"
            style={{ maxHeight: "10rem" }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "flex w-full cursor-pointer select-none items-center px-2 py-1.5 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  opt.value === selected && "bg-accent text-accent-foreground",
                  opt.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {opt.disabled ? null : (
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      opt.value === selected ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
