// src/components/ui/StatusBadge.tsx
import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "payment" | "delivery" | "general";
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "payment",
}) => {
  const getStatusConfig = () => {
    if (type === "payment") {
      const configs = {
        lunas: {
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          border: "border-emerald-200",
          icon: "✓",
          ring: "ring-emerald-200",
        },
        proses_tagihan: {
          bg: "bg-amber-50",
          text: "text-amber-700",
          border: "border-amber-200",
          icon: "⏳",
          ring: "ring-amber-200",
        },
        deposit: {
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
          icon: "◐",
          ring: "ring-blue-200",
        },
        awaiting_confirmation: {
          bg: "bg-orange-50",
          text: "text-orange-700",
          border: "border-orange-200",
          icon: "⏸",
          ring: "ring-orange-200",
        },
      };
      return (
        configs[status as keyof typeof configs] || {
          bg: "bg-gray-50",
          text: "text-gray-700",
          border: "border-gray-200",
          icon: "?",
          ring: "ring-gray-200",
        }
      );
    }

    // ✅ ADD: Delivery status configurations
    if (type === "delivery") {
      const configs = {
        completed: {
          bg: "bg-green-50",
          text: "text-green-700",
          border: "border-green-200",
          icon: "✅",
          ring: "ring-green-200",
        },
        assigned: {
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
          icon: "📋",
          ring: "ring-blue-200",
        },
        in_progress: {
          bg: "bg-yellow-50",
          text: "text-yellow-700",
          border: "border-yellow-200",
          icon: "🚛",
          ring: "ring-yellow-200",
        },
      };
      return (
        configs[status as keyof typeof configs] || {
          bg: "bg-gray-50",
          text: "text-gray-700",
          border: "border-gray-200",
          icon: "?",
          ring: "ring-gray-200",
        }
      );
    }

    // Default fallback
    return {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
      icon: "",
      ring: "ring-gray-200",
    };
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} transition-all duration-200 hover:shadow-sm hover:ring-2 ${config.ring}`}
      title={`Status: ${status.replace(/_/g, " ").toUpperCase()}`}
    >
      <span className="text-sm" role="img" aria-label={status}>
        {config.icon}
      </span>
      <span className="uppercase tracking-wide">
        {status.replace(/_/g, " ")}
      </span>
    </span>
  );
};

export default StatusBadge;
