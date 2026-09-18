import { cn } from "../../lib/utils";

export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-4 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}
