"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  loading?: boolean;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  title?: string;
}

export function RefreshButton({
  onRefresh,
  loading: externalLoading,
  label,
  variant = "outline",
  size = "sm",
  title = "Refresh",
}: RefreshButtonProps) {
  const [internalSpinning, setInternalSpinning] = useState(false);
  const spinning = externalLoading || internalSpinning;

  const handleClick = async () => {
    setInternalSpinning(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setInternalSpinning(false), 400);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={spinning}
      title={title}
    >
      <RefreshCw
        className={`h-4 w-4 ${label ? "mr-2" : ""} ${
          spinning ? "animate-spin" : ""
        }`}
      />
      {label}
    </Button>
  );
}
