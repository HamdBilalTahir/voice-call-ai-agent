import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "flex h-9 w-full appearance-none rounded-lg border border-input bg-white pl-3 pr-8 py-2 text-sm text-foreground shadow-xs transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export { Select };
