import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "error";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "secondary", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-xs py-0 text-[12px] font-normal leading-[16px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          {
            "bg-primary text-on-primary": variant === "default",
            "bg-canvas-soft text-body": variant === "secondary",
            "bg-link-bg-soft text-link-deep": variant === "success",
            "bg-warning-soft text-warning-deep": variant === "warning",
            "bg-error-soft text-error-deep": variant === "error",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
