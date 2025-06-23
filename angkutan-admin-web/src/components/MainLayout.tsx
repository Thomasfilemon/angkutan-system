// src/components/MainLayout.tsx
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/trips')) return 'Manajemen Trips';
    if (path.startsWith('/delivery-orders')) return 'Delivery Orders';
    if (path.startsWith('/vehicles')) return 'Manajemen Kendaraan';
    if (path.startsWith('/drivers')) return 'Manajemen Supir';
    if (path.startsWith('/stock')) return 'Manajemen Stok';
    if (path.startsWith('/services')) return 'Riwayat Servis';
    return 'Dashboard';
  };

  const isActiveLink = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-800 text-white p-4 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">Angkutan Sys</h1>
        <nav className="flex-grow">
          <ul>
            <li className="mb-4">
              <Link 
                to="/" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                📊 Dashboard
              </Link>
            </li>
            
            {/* Operations Section */}
            <li className="mb-2">
              <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                Operasional
              </div>
            </li>
            <li className="mb-4">
              <Link 
                to="/trips" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/trips') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                📋 Purchase Orders
              </Link>
            </li>
            <li className="mb-4">
              <Link 
                to="/delivery-orders" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/delivery-orders') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                🚚 Delivery Orders
              </Link>
            </li>

            {/* Fleet Management Section */}
            <li className="mb-2 mt-6">
              <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                Manajemen Armada
              </div>
            </li>
            <li className="mb-4">
              <Link 
                to="/vehicles" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/vehicles') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                🚛 Manajemen Kendaraan
              </Link>
            </li>
            <li className="mb-4">
              <Link 
                to="/drivers" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/drivers') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                👨‍💼 Manajemen Supir
              </Link>
            </li>
            <li className="mb-4">
              <Link 
                to="/services" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/services') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                🔧 Riwayat Servis
              </Link>
            </li>

            {/* Inventory Management Section */}
            <li className="mb-2 mt-6">
              <div className="text-xs uppercase text-gray-400 font-semibold mb-2 px-2">
                Inventaris
              </div>
            </li>
            <li className="mb-4">
              <Link 
                to="/stock" 
                className={`block p-2 rounded hover:bg-gray-700 ${
                  isActiveLink('/stock') ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                📦 Manajemen Stok
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-sm text-gray-400">
          <p>v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{getPageTitle()}</h2> 
          <div className="flex items-center">
            <span className="mr-4">Welcome, <strong className="font-semibold">{user?.username || 'User'}</strong></span>
            <button onClick={logout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
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
