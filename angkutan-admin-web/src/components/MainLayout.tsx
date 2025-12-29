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
    if (path.startsWith("/vehicles/tires")) return "Manajemen Ban";
    if (path.startsWith("/vehicles")) return "Manajemen Kendaraan";
    if (path.startsWith("/drivers")) return "Manajemen Supir";
    if (path.startsWith("/stock/usage-recap")) return "Stok Skali Lewat Recap";
    if (path.startsWith("/stock")) return "Manajemen Stok";
    if (path.startsWith("/services")) return "Riwayat Servis";
    if (path.startsWith("/cash")) return "Buku Kas";
    if (path.startsWith("/ritase")) return "Dashboard Ritase";
    if (path.startsWith("/ritase/profitability"))
      return "DO Profitability Report";
    if (path.startsWith("/buku-kas")) return "Buku Kas";
    if (path.startsWith("/tempo")) return "Buku Tempo";
    if (path.startsWith("/tempoDetails")) return "Detail Pembelian";
    if (path.startsWith("/deposit-groups")) return "Pembayaran Deposit";
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

            {/* Laporan & Pembayaran Section (Dropdown) */}
            <li className="mb-4 mt-6">
              <details className="group">
                <summary className="flex items-center p-2 rounded hover:bg-gray-700 cursor-pointer select-none">
                  <span className="text-xl mr-3">📈</span>
                  <span className={`${sidebarMinimized ? "hidden" : "block"}`}>Laporan & Pembayaran</span>
                  <span className="ml-auto text-xs text-gray-300 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-300 hidden group-open:inline">▲</span>
                </summary>
                {!sidebarMinimized && (
                  <ul className="ml-8 mt-2 space-y-2">
                    <li>
                      <Link
                        to="/ritase/comprehensive"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/ritase/comprehensive") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Ritase"
                      >
                        Ritase
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/payments"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          location.pathname.startsWith("/payments") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Payments"
                      >
                        Payments
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/deposit-groups"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          location.pathname.startsWith("/deposit-groups") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Deposit Payments"
                      >
                        Deposit Payments
                      </Link>
                    </li>
                  </ul>
                )}
              </details>
            </li>

            {/* Administration Section (Admin highest role) */}
            {(user?.role === "admin" || user?.role === "owner") && (
              <li className="mb-4 mt-6">
                <details className="group">
                  <summary className="flex items-center p-2 rounded hover:bg-gray-700 cursor-pointer select-none">
                    <span className="text-xl mr-3">👤</span>
                    <span className={`${sidebarMinimized ? "hidden" : "block"}`}>
                      Administration
                    </span>
                    <span className="ml-auto text-xs text-gray-300 group-open:hidden">
                      ▼
                    </span>
                    <span className="ml-auto text-xs text-gray-300 hidden group-open:inline">
                      ▲
                    </span>
                  </summary>
                  {!sidebarMinimized && (
                    <ul className="ml-8 mt-2 space-y-2">
                      <li>
                        <Link
                          to="/users"
                          className={`block p-2 rounded hover:bg-gray-700 ${
                            isActiveLink("/users")
                              ? "bg-gray-700 border-l-4 border-blue-500"
                              : ""
                          }`}
                          title="User Management"
                        >
                          User Management
                        </Link>
                      </li>
                    </ul>
                  )}
                </details>
              </li>
            )}

            {/* Operations Section */}
            {!sidebarMinimized && (
              <li className="mb-2">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                  Operasional
                </div>
              </li>
            )}
            {/* Collapsible dropdown for DO/PO etc */}
            <li className="mb-4">
              <details className="group">
                <summary className="flex items-center p-2 rounded hover:bg-gray-700 cursor-pointer select-none">
                  <span className="text-xl mr-3">📦</span>
                  <span className={`${sidebarMinimized ? "hidden" : "block"}`}>Orders & Ritase</span>
                  <span className="ml-auto text-xs text-gray-300 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-300 hidden group-open:inline">▲</span>
                </summary>
                {!sidebarMinimized && (
                  <ul className="ml-8 mt-2 space-y-2">
                    <li>
                      <Link
                        to="/trips"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/trips") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Purchase Orders"
                      >
                        Purchase Orders
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/delivery-orders"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/delivery-orders") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Delivery Orders"
                      >
                        Delivery Orders
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/ritase/profitability"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/ritase/profitability") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="DO Profitability"
                      >
                        DO Profitability
                      </Link>
                    </li>
                  </ul>
                )}
              </details>
            </li>

            {/* Fleet Management Section - Dropdown */}
            <li className="mb-4 mt-6">
              <details className="group">
                <summary className="flex items-center p-2 rounded hover:bg-gray-700 cursor-pointer select-none">
                  <span className="text-xl mr-3">🚛</span>
                  <span className={`${sidebarMinimized ? "hidden" : "block"}`}>Manajemen Armada</span>
                  <span className="ml-auto text-xs text-gray-300 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-300 hidden group-open:inline">▲</span>
                </summary>
                {!sidebarMinimized && (
                  <ul className="ml-8 mt-2 space-y-2">
                    <li>
                      <Link
                        to="/vehicles"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/vehicles") && !location.pathname.startsWith("/vehicles/tires")
                            ? "bg-gray-700 border-l-4 border-blue-500"
                            : ""
                        }`}
                        title="Manajemen Kendaraan"
                      >
                        Manajemen Kendaraan
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/vehicles/expenditure"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/vehicles/expenditure") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Pengeluaran Per Mobil"
                      >
                        Pengeluaran Per Mobil
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/vehicles/tires"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/vehicles/tires") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Manajemen Ban"
                      >
                        Manajemen Ban
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/drivers"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/drivers") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Manajemen Supir"
                      >
                        Manajemen Supir
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/services"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/services") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Riwayat Servis"
                      >
                        Riwayat Servis
                      </Link>
                    </li>
                  </ul>
                )}
              </details>
            </li>

            {/* Inventory Management Section - Dropdown */}
            <li className="mb-4 mt-6">
              <details className="group">
                <summary className="flex items-center p-2 rounded hover:bg-gray-700 cursor-pointer select-none">
                  <span className="text-xl mr-3">📦</span>
                  <span className={`${sidebarMinimized ? "hidden" : "block"}`}>Inventaris</span>
                  <span className="ml-auto text-xs text-gray-300 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-300 hidden group-open:inline">▲</span>
                </summary>
                {!sidebarMinimized && (
                  <ul className="ml-8 mt-2 space-y-2">
                    <li>
                      <Link
                        to="/stock"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/stock") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Manajemen Stok"
                      >
                        Stok
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/stock/usage-recap"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/stock/usage-recap") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Stok Skali Lewat Recap"
                      >
                        Stok Skali Lewat Recap
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/tire-inventory"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/tire-inventory") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Inventaris Ban"
                      >
                        Inventaris Ban
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/vehicles/tires/removed"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/vehicles/tires/removed") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Ban Bekas"
                      >
                        Ban Bekas
                      </Link>
                    </li>
                  </ul>
                )}
              </details>
            </li>

            {/* Buku Kas & Tempo Section - Dropdown */}
            <li className="mb-4 mt-6">
              <details className="group">
                <summary className="flex items-center p-2 rounded hover:bg-gray-700 cursor-pointer select-none">
                  <span className="text-xl mr-3">💼</span>
                  <span className={`${sidebarMinimized ? "hidden" : "block"}`}>Buku Kas & Tempo</span>
                  <span className="ml-auto text-xs text-gray-300 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-300 hidden group-open:inline">▲</span>
                </summary>
                {!sidebarMinimized && (
                  <ul className="ml-8 mt-2 space-y-2">
                    <li>
                      <Link
                        to="/cash"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          (isActiveLink("/cash") || isActiveLink("/tempo")) ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Buku Kas"
                      >
                        Buku Kas
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/tempoDetails"
                        className={`block p-2 rounded hover:bg-gray-700 ${
                          isActiveLink("/tempoDetails") ? "bg-gray-700 border-l-4 border-blue-500" : ""
                        }`}
                        title="Detail Pembelian"
                      >
                        Detail Pembelian
                      </Link>
                    </li>
                  </ul>
                )}
              </details>
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
