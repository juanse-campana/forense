import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        critical: "bg-[#EF4444]/15 text-[#EF4444]",
        high: "bg-[#F87171]/15 text-[#F87171]",
        medium: "bg-[#F59E0B]/15 text-[#F59E0B]",
        low: "bg-[#3B82F6]/15 text-[#3B82F6]",
        info: "bg-[#6B7280]/15 text-[#6B7280]",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
