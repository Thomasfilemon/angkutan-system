// src/components/MainLayout.tsx
import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return "Dashboard";
    if (path.startsWith("/trips")) return "Manajemen Trips";
    if (path.startsWith("/delivery-orders")) return "Delivery Orders";
    if (path.startsWith("/big-dos")) return "Big Delivery Orders";
    if (path.startsWith("/vehicles/tires")) return "Manajemen Ban";
    if (path.startsWith("/vehicles")) return "Manajemen Kendaraan";
    if (path.startsWith("/drivers")) return "Manajemen Supir";
    if (path.startsWith("/stock")) return "Manajemen Stok";
    if (path.startsWith("/services")) return "Riwayat Servis";
    if (path.startsWith("/cash")) return "Buku Kas";
    if (path.startsWith("/ritase")) return "Dashboard Ritase";
    if (path.startsWith("/buku-kas")) return "Buku Kas";
    return "Dashboard";
  };

  const isActiveLink = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const toggleSidebar = () => {
    setSidebarMinimized(!sidebarMinimized);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarMinimized ? "w-16" : "w-64"
        } flex-shrink-0 bg-gray-800 text-white p-4 flex flex-col transition-all duration-300 ease-in-out`}
      >
        {/* Header with toggle button */}
        <div className="flex items-center justify-between mb-8">
          <h1
            className={`text-2xl font-bold ${
              sidebarMinimized ? "hidden" : "block"
            }`}
          >
            Angkutan Sys
          </h1>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded hover:bg-gray-700 focus:outline-none"
            title={sidebarMinimized ? "Expand sidebar" : "Minimize sidebar"}
          >
            {sidebarMinimized ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex-grow overflow-y-auto">
          <ul>
            {/* Dashboard */}
            <li className="mb-4">
              <Link
                to="/"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Dashboard"
              >
                <span className="text-xl mr-3">📊</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Dashboard
                </span>
              </Link>
            </li>

            {/* Reports & Analytics Section */}
            <li className="mb-2 mt-6">
              <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                Laporan & Analitik
              </div>
            </li>
            <li className="mb-4">
              <Link
                to="/ritase/comprehensive"
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/ritase/comprehensive")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                📊 Dashboard Ritase
              </Link>
            </li>

            <li className="mb-4">
              <Link
                to="/payments"
                className={`block p-2 rounded hover:bg-gray-700 ${
                  location.pathname.startsWith("/payments")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                💰 Payments
              </Link>
            </li>

            {/* Operations Section */}
            {!sidebarMinimized && (
              <li className="mb-2">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                  Operasional
                </div>
              </li>
            )}
            <li className="mb-4">
              <Link
                to="/trips"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/trips")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Purchase Orders"
              >
                <span className="text-xl mr-3">📋</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Purchase Orders
                </span>
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/delivery-orders"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/delivery-orders")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Delivery Orders"
              >
                <span className="text-xl mr-3">🚚</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Delivery Orders
                </span>
              </Link>
            </li>

            <li className="mb-4">
              <Link
                to="/big-dos"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/big-dos")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Big Delivery Orders"
              >
                <span className="text-xl mr-3">🚛</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Big DOs
                </span>
              </Link>
            </li>

            {/* Fleet Management Section */}
            {!sidebarMinimized && (
              <li className="mb-2 mt-6">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                  Manajemen Armada
                </div>
              </li>
            )}
            <li className="mb-4">
              <Link
                to="/vehicles"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/vehicles") &&
                  !location.pathname.startsWith("/vehicles/tires")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Manajemen Kendaraan"
              >
                <span className="text-xl mr-3">🚛</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Manajemen Kendaraan
                </span>
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/vehicles/tires"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/vehicles/tires")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Manajemen Ban"
              >
                <span className="text-xl mr-3">🛞</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Manajemen Ban
                </span>
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/drivers"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/drivers")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Manajemen Supir"
              >
                <span className="text-xl mr-3">👨‍💼</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Manajemen Supir
                </span>
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/services"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/services")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Riwayat Servis"
              >
                <span className="text-xl mr-3">🔧</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Riwayat Servis
                </span>
              </Link>
            </li>

            {/* Inventory Management Section */}
            {!sidebarMinimized && (
              <li className="mb-2 mt-6">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                  Inventaris
                </div>
              </li>
            )}
            <li className="mb-4">
              <Link
                to="/stock"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/stock")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Manajemen Stok"
              >
                <span className="text-xl mr-3">📦</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Manajemen Stok
                </span>
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/tire-inventory"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/tire-inventory")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Inventaris Ban"
              >
                <span className="text-xl mr-3">🛞</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Inventaris Ban
                </span>
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/vehicles/tires/removed"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/vehicles/tires/removed")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Ban Bekas"
              >
                <span className="text-xl mr-3">🔄</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Ban Bekas
                </span>
              </Link>
            </li>

            {/* NEW: Accounting Section */}
            {!sidebarMinimized && (
              <li className="mb-2 mt-6">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                  Akuntansi
                </div>
              </li>
            )}
            <li className="mb-4">
              <Link
                to="/cash"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  isActiveLink("/cash")
                    ? "bg-gray-700 border-l-4 border-blue-500"
                    : ""
                }`}
                title="Buku Kas"
              >
                <span className="text-xl mr-3">💰</span>
                <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                  Buku Kas
                </span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer */}
        <div
          className={`text-sm text-gray-400 mt-4 ${
            sidebarMinimized ? "text-center" : ""
          }`}
        >
          <p className={`${sidebarMinimized ? "hidden" : "block"}`}>v1.0.0</p>
          {sidebarMinimized && <p className="text-xs">v1.0</p>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{getPageTitle()}</h2>
          <div className="flex items-center">
            <span className="mr-4 hidden sm:inline">
              Welcome,{" "}
              <strong className="font-semibold">
                {user?.username || "User"}
              </strong>
            </span>
            <span className="mr-4 sm:hidden">
              <strong className="font-semibold">
                {user?.username || "User"}
              </strong>
            </span>
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </header>
        <div className="p-8 overflow-y-auto bg-gray-50 flex-grow">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
