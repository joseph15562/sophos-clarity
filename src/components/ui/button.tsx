import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm backdrop-blur-md",
  {
    variants: {
      variant: {
        default:
          "border border-[#1b11c9]/25 bg-[#2006F7] text-white shadow-[0_14px_36px_rgba(32,6,247,0.32),0_0_40px_-8px_rgba(0,156,251,0.25),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-none hover:bg-[#1400d6] hover:border-[#1400d6] hover:shadow-[0_18px_44px_rgba(32,6,247,0.42),0_0_52px_-6px_rgba(0,237,255,0.2),inset_0_1px_0_rgba(255,255,255,0.28)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 active:translate-y-0 dark:bg-[#2006F7] dark:hover:bg-[#3a22ff] dark:hover:shadow-[0_18px_44px_rgba(32,6,247,0.5),0_0_56px_-4px_rgba(0,237,255,0.22)]",
        destructive:
          "border border-[#EA0022]/20 bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border/70 bg-white/72 dark:bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/25",
        secondary:
          "border border-border/70 bg-white/76 dark:bg-secondary text-secondary-foreground hover:bg-white/90 dark:hover:bg-secondary/90 hover:border-primary/20",
        ghost: "text-foreground hover:bg-accent/80 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline shadow-none backdrop-blur-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
