// src/components/ui/TableSkeleton.tsx
import React from "react";

const TableSkeleton = () => (
  <div className="animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-1/2"></div>
        </div>
      ))}
    </div>
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b bg-gray-50">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 flex items-center space-x-4">
            <div className="h-4 bg-gray-100 rounded flex-1"></div>
            <div className="h-4 bg-gray-100 rounded w-24"></div>
            <div className="h-4 bg-gray-100 rounded w-32"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TableSkeleton;
