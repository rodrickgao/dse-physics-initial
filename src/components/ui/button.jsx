import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:opacity-45 active:scale-[.98] [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        outline: "border border-border bg-card text-foreground hover:border-primary/25 hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        danger: "bg-destructive/10 text-destructive hover:bg-destructive/15",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-5",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
