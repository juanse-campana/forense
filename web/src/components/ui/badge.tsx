import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        // Rampa de severidad con tonos distinguibles entre si (rojo -> naranja -> amarillo -> azul -> gris),
        // no solo variaciones de un mismo rojo (critical/high antes eran casi indistinguibles).
        critical: "bg-[#EF4444]/15 text-[#EF4444]",
        high: "bg-[#F97316]/15 text-[#F97316]",
        medium: "bg-[#EAB308]/15 text-[#EAB308]",
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
