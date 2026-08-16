import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("inline-flex items-center justify-center p-1", className)}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap px-[16px] py-[6px] text-[14px] font-medium leading-[20px] rounded-[64px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        active
          ? "bg-canvas text-ink shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a] border border-hairline"
          : "text-body hover:text-ink hover:bg-canvas-soft",
        className
      )}
      {...props}
    />
  )
);
TabsTrigger.displayName = "TabsTrigger";
