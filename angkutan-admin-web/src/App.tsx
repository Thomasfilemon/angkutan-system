// src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { useAuth } from './components/AuthContext';
import VehiclesPage from './pages/Vehicles';
import VehicleCreatePage from './pages/VehicleCreate';
import VehicleEditPage from './pages/VehicleEdit';
import DriversPage from './pages/Drivers';
import DriverCreatePage from './pages/DriverCreate';
import DriverEditPage from './pages/DriverEdit';
import TripsPage from './pages/Trips';
import PurchaseOrderCreatePage from './pages/PurchaseOrderCreate';

function App() {
  const { token } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/" replace />} />
        
        <Route path="/*" element={token ? <MainLayout /> : <Navigate to="/login" replace />}>
          <Route path="" element={<Dashboard />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="vehicles/create" element={<VehicleCreatePage />} />
          <Route path="vehicles/edit/:id" element={<VehicleEditPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="drivers/create" element={<DriverCreatePage />} />
          <Route path="drivers/edit/:id" element={<DriverEditPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/create-po" element={<PurchaseOrderCreatePage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
