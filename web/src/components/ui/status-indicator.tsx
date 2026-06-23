import * as React from "react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "completed" | "running" | "failed" | "pending";
}

const statusColors = {
  completed: "#4edea3",
  running: "#8ed5ff",
  failed: "#EF4444",
  pending: "#6B7280",
};

const StatusIndicator = React.forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ className, status, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn("inline-block h-2 w-2 rounded-full", className)}
        style={{ backgroundColor: statusColors[status] }}
        {...props}
      />
    );
  }
);
StatusIndicator.displayName = "StatusIndicator";

export { StatusIndicator };
