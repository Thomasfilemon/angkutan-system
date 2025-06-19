// src/components/MainLayout.tsx

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

const MainLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-800 text-white p-4 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">Angkutan Sys</h1>
        <nav className="flex-grow">
          <ul>
            <li className="mb-4">
              <Link to="/" className="block p-2 rounded hover:bg-gray-700">Dashboard</Link>
            </li>
            <li className="mb-4">
                <Link to="/trips" className="block p-2 rounded hover:bg-gray-700">Manajemen Trips</Link>
            </li>
            <li className="mb-4">
              <Link to="/vehicles" className="block p-2 rounded hover:bg-gray-700">Manajemen Kendaraan</Link>
            </li>
            <li className="mb-4">
                <Link to="/drivers" className="block p-2 rounded hover:bg-gray-700">Manajemen Supir</Link>
            </li>
          </ul>
        </nav>
        <div className="text-sm">
          <p>v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white shadow p-4 flex justify-between items-center">
          {/* We will make this header dynamic later */}
          <h2 className="text-xl font-semibold">Dashboard</h2> 
          <div className="flex items-center">
            <span className="mr-4">Welcome, <strong className="font-semibold">{user?.username || 'User'}</strong></span>
            <button onClick={logout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
              Logout
            </button>
          </div>
        </header>
        <div className="p-8 overflow-y-auto bg-gray-50 flex-grow">
          {/* --- THIS IS THE CRITICAL LINE --- */}
          <Outlet /> 
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
