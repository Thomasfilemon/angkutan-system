// src/components/ui/FilterChip.tsx
import React from "react";

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  colorScheme?: "blue" | "green" | "purple" | "yellow" | "orange" | "red";
}

const FilterChip: React.FC<FilterChipProps> = ({
  label,
  value,
  onRemove,
  colorScheme = "blue",
}) => {
  // ✅ FIXED: Predefined color classes for Tailwind safety
  const colorClasses = {
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      hover: "hover:bg-blue-100",
    },
    green: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
      hover: "hover:bg-green-100",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      hover: "hover:bg-purple-100",
    },
    yellow: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
      hover: "hover:bg-yellow-100",
    },
    orange: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
      hover: "hover:bg-orange-100",
    },
    red: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      hover: "hover:bg-red-100",
    },
  };

  const colors = colorClasses[colorScheme];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} border ${colors.border} transition-all duration-200 hover:shadow-sm`}
    >
      <span className="truncate max-w-xs">
        <span className="font-semibold">{label}:</span> {value}
      </span>
      <button
        onClick={onRemove}
        className={`${colors.hover} rounded-full p-0.5 transition-colors duration-150 hover:scale-110`}
        aria-label={`Remove ${label} filter`}
        title={`Remove ${label}: ${value}`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

export default FilterChip;
