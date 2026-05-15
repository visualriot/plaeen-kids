import { useState, useRef, useEffect, ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @component Dropdown
 * @atomic atom
 * @figma Dropdown (Components / Atoms / Dropdown)
 *
 * @tokens
 *   color-accent, color-primary, color-secondary, color-muted, color-inverse,
 *   color-overlay, color-border-accent,
 *   font-size-caption, font-size-label,
 *   font-weight-semibold, font-weight-bold,
 *   line-height-label, tracking-label,
 *   gap-2, gap-3, p-4
 *
 * @variants filter, sort
 * @states default, open, selected, hover, focus
 * @transitions all 200ms ease
 */
export interface DropdownOption {
  id: string;
  name: string;
}

type DropdownVariant = "filter" | "sort";

interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  variant?: DropdownVariant;
  isMultiple?: boolean;
  showResetButton?: boolean;
  showApplyButton?: boolean;
  onApply?: () => void;
  onReset?: () => void;
  icon?: ReactNode;
  className?: string;
  menuClassName?: string;
  defaultValueId?: string;
  /** Pass a compound type class, e.g. "type-caption" or "type-label". Default: "type-caption" */
  fontSize?: string;
  width?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  selectedIds,
  onSelectionChange,
  variant = "filter",
  isMultiple = variant === "filter",
  showResetButton = variant === "filter",
  showApplyButton = variant === "filter",
  onApply,
  onReset,
  icon,
  className,
  menuClassName,
  defaultValueId,
  fontSize = "type-caption",
  width = "w-64",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === selectedIds[0]);
  const defaultOption = defaultValueId
    ? options.find((o) => o.id === defaultValueId)
    : options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (optionId: string) => {
    if (isMultiple) {
      onSelectionChange(
        selectedIds.includes(optionId)
          ? selectedIds.filter((id) => id !== optionId)
          : [...selectedIds, optionId],
      );
    } else {
      onSelectionChange([optionId]);
      if (!showApplyButton) {
        setIsOpen(false);
      }
    }
  };

  const handleReset = () => {
    onSelectionChange([]);
    if (onReset) onReset();
  };

  const handleApply = () => {
    if (onApply) onApply();
    setIsOpen(false);
  };

  const filterButtonClasses = cn(
    "rounded-lg border flex justify-between items-center px-4 py-2 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    "type-label",
    width,
    selectedIds.length !== 0 && isMultiple
      ? "bg-accent/20 border-accent text-accent"
      : isOpen
        ? "bg-accent/20 border-accent text-accent"
        : "bg-primary/5 border-primary/15 hover:text-accent hover:border-accent/50",
  );

  const sortButtonClasses = cn(
    "flex items-center justify-end gap-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    "type-label",
    width,
    "text-muted hover:text-secondary",
  );

  const optionClasses = cn(
    "w-full transition-all whitespace-nowrap flex items-center text-secondary type-body-sm gap-x-3 px-3 py-2 hover:bg-primary/10",
  );

  const buttonClasses =
    variant === "filter" ? filterButtonClasses : sortButtonClasses;

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="flex flex-row justify-center items-center space-x-1">
        {icon && variant === "sort" && <span className="shrink-0">{icon}</span>}
        {variant === "sort" && (
          <span className="type-label text-muted mr-2">{label}</span>
        )}

        <button onClick={() => setIsOpen(!isOpen)} className={buttonClasses}>
          {isMultiple ? (
            <div>
              <span className="type-label text-accent">{label}</span>
              {selectedIds.length > 0 && ` (${selectedIds.length})`}
            </div>
          ) : (
            <div className="flex flex-row justify-center items-center space-x-3">
              {icon && variant === "filter" && (
                <span className="shrink-0">{icon}</span>
              )}
              {selectedIds.length === 0 ? (
                <span className="type-label">{label}</span>
              ) : (
                <span className="type-label">{selectedOption?.name || defaultOption?.name}</span>
              )}
            </div>
          )}
          <ChevronDown size={12} />
        </button>
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-1 left-0 w-full bg-overlay shadow-lg z-50 flex flex-col overflow-hidden",
            variant === "filter"
              ? "rounded-lg border border-accent/30"
              : "rounded-md bg-primary/5 backdrop-blur-sm border-0",
            menuClassName,
          )}
        >
          <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-thumb-rounded-full scrollbar-track-transparent flex-1 max-h-80">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={cn(
                  optionClasses,
                  variant === "sort" && "hover:bg-primary/5",
                )}
              >
                {isMultiple && (
                  <div
                    className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200",
                      selectedIds.includes(option.id)
                        ? "bg-accent border-accent shadow-[0_0_6px_rgba(118,233,0,0.4)]"
                        : "border-primary/30",
                    )}
                  >
                    {selectedIds.includes(option.id) && (
                      <Check size={10} className="text-inverse" />
                    )}
                  </div>
                )}
                <span className="capitalize">
                  {option.name}
                </span>
              </button>
            ))}
          </div>

          {(showResetButton || showApplyButton) && (
            <div className="flex gap-0 border-t border-primary/10">
              {showResetButton && (
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-3 type-label text-muted hover:text-secondary transition-colors border-r border-primary/10"
                >
                  Reset
                </button>
              )}
              {showApplyButton && (
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-3 type-label text-accent hover:bg-accent/10 transition-colors"
                >
                  Apply
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
