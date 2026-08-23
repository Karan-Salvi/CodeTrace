import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-canvas text-ink rounded-md border border-hairline shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardSoft = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-canvas-soft text-ink rounded-md p-lg border border-hairline",
        className
      )}
      {...props}
    />
  )
);
CardSoft.displayName = "CardSoft";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-lg pb-sm", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-lg pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

// A secondary, visually-distinct footer strip within a Card — for a
// helper note, an inline action bar, or both together (Settings.tsx's
// "32 characters max" + Save button pattern). Not a plain CardContent:
// the softer background and top border are what separate it from the
// card's main body.
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-canvas-soft border-t border-hairline px-lg md:px-xl py-md", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";
