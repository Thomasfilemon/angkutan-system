// src/components/ui/SummaryCard.tsx
import React from "react";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { type: "up" | "down"; value: string };
  icon: string;
  colorScheme?: "blue" | "green" | "purple" | "yellow" | "orange";
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  colorScheme = "blue",
}) => {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600 text-blue-600 bg-blue-50",
    green: "from-green-500 to-green-600 text-green-600 bg-green-50",
    purple: "from-purple-500 to-purple-600 text-purple-600 bg-purple-50",
    yellow: "from-yellow-500 to-yellow-600 text-yellow-600 bg-yellow-50",
    orange: "from-orange-500 to-orange-600 text-orange-600 bg-orange-50",
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-3 rounded-lg ${
            colorClasses[colorScheme].split(" ")[2]
          } ${colorClasses[colorScheme].split(" ")[3]}`}
        >
          <span className="text-2xl">{icon}</span>
        </div>
        {trend && (
          <div
            className={`text-sm font-medium ${
              trend.type === "up" ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend.type === "up" ? "↗" : "↘"} {trend.value}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-2xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
          {value}
        </h3>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
};

export default SummaryCard;
