import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

import { motion, type HTMLMotionProps } from "framer-motion";

export const EmptyState = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, ...props }, ref) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center bg-canvas-soft rounded-lg p-[48px] text-center border border-hairline/50 shadow-sm",
        className
      )}
      {...props}
    />
  )
);
EmptyState.displayName = "EmptyState";

export const EmptyStateIcon = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mb-md text-mute", className)}
      {...props}
    />
  )
);
EmptyStateIcon.displayName = "EmptyStateIcon";

export const EmptyStateTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-[20px] font-semibold tracking-[-0.6px] text-ink mb-xs", className)}
      {...props}
    />
  )
);
EmptyStateTitle.displayName = "EmptyStateTitle";

export const EmptyStateDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-[16px] font-normal text-body mb-lg max-w-[400px] mx-auto", className)}
      {...props}
    />
  )
);
EmptyStateDescription.displayName = "EmptyStateDescription";
