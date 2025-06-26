// src/App.tsx - Updated with all routes
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import MainLayout from "./components/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { useAuth } from "./components/AuthContext";
import VehiclesPage from "./pages/Vehicles";
import VehicleCreatePage from "./pages/VehicleCreate";
import VehicleEditPage from "./pages/VehicleEdit";
import DriversPage from "./pages/Drivers";
import DriverCreatePage from "./pages/DriverCreate";
import DriverEditPage from "./pages/DriverEdit";
import TripsPage from "./pages/Trips";
import PurchaseOrderCreatePage from "./pages/PurchaseOrderCreate";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetail";
import PurchaseOrderEditPage from "./pages/PurchaseOrderEdit";
import CreateDeliveryFromPO from "./pages/CreateDeliveryFromPO";
import DeliveryOrdersPage from "./pages/DeliveryOrders";
import DeliveryOrderDetailPage from "./pages/DeliveryOrderDetail";
import StockManagementPage from "./pages/StockManagement";
import StockCreatePage from "./pages/StockCreate";
import ServiceManagementPage from "./pages/ServiceManagement";
import ServiceCreatePage from "./pages/ServiceCreate";
import ServiceDetailPage from "./pages/ServiceDetail";
import ServiceEditPage from "./pages/ServiceEdit";
import RitaseDashboard from "./pages/Ritase/RitaseDashboard";
import POPaymentDetail from "./pages/Ritase/POPaymentDetail";
import DOPaymentManagement from "./pages/Ritase/DOPaymentManagement";
import ComprehensiveRitaseTable from "./pages/Ritase/ComprehensiveRitaseTable";
import POSpecificRitaseTable from "./pages/Ritase/POSpecificRitaseTable";

function App() {
  const { token } = useAuth();

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!token ? <Login /> : <Navigate to="/" replace />}
        />

        <Route
          path="/*"
          element={token ? <MainLayout /> : <Navigate to="/login" replace />}
        >
          <Route path="" element={<Dashboard />} />

          {/* Ritase dan Buku Kas */}
          <Route path="ritase" element={<RitaseDashboard />} />
          <Route
            path="ritase/comprehensive"
            element={<ComprehensiveRitaseTable />}
          />
          <Route path="ritase/po/:poId" element={<POPaymentDetail />} />
          <Route
            path="ritase/po/:poId/table"
            element={<POSpecificRitaseTable />}
          />
          <Route
            path="ritase/delivery-orders/:doId/payment"
            element={<DOPaymentManagement />}
          />

          {/* Vehicles Routes */}
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="vehicles/create" element={<VehicleCreatePage />} />
          <Route path="vehicles/edit/:id" element={<VehicleEditPage />} />

          {/* Drivers Routes */}
          <Route path="drivers" element={<DriversPage />} />
          <Route path="drivers/create" element={<DriverCreatePage />} />
          <Route path="drivers/edit/:id" element={<DriverEditPage />} />

          {/* Trips/Purchase Orders Routes */}
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/create-po" element={<PurchaseOrderCreatePage />} />
          <Route path="trips/po/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="trips/po/:id/edit" element={<PurchaseOrderEditPage />} />
          <Route
            path="trips/po/:poId/create-do"
            element={<CreateDeliveryFromPO />}
          />

          {/* Delivery Orders Routes */}
          <Route path="delivery-orders" element={<DeliveryOrdersPage />} />
          <Route
            path="delivery-orders/:id"
            element={<DeliveryOrderDetailPage />}
          />

          {/* Stock Management Routes */}
          <Route path="stock" element={<StockManagementPage />} />
          <Route path="stock/create" element={<StockCreatePage />} />
          <Route path="stock/edit/:id" element={<StockCreatePage />} />

          {/* Service Management Routes */}
          <Route path="services" element={<ServiceManagementPage />} />
          <Route path="services/create" element={<ServiceCreatePage />} />
          <Route path="services/:id" element={<ServiceDetailPage />} />
          <Route path="services/edit/:id" element={<ServiceEditPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
