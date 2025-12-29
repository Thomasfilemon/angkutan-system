import React from "react";
import { Link } from "react-router-dom";

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-xl px-8 py-10 max-w-lg w-full text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Not Authorized
        </h1>
        <p className="text-gray-600 mb-6">
          You don&apos;t have permission to access this page or perform this
          action. If you think this is a mistake, please contact your system
          administrator.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;


