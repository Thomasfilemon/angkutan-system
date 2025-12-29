import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import MainLayout from "./components/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { useAuth, UserRole } from "./components/AuthContext";
import { Toaster } from "react-hot-toast";

const VehiclesPage = lazy(() => import("./pages/Vehicles"));
const VehicleCreatePage = lazy(() => import("./pages/VehicleCreate"));
const VehicleEditPage = lazy(() => import("./pages/VehicleEdit"));
const TireManagementPage = lazy(() => import("./pages/TireManagement"));
const DriversPage = lazy(() => import("./pages/Drivers"));
const DriverCreatePage = lazy(() => import("./pages/DriverCreate"));
const DriverEditPage = lazy(() => import("./pages/DriverEdit"));
const TripsPage = lazy(() => import("./pages/Trips"));
const PurchaseOrderCreatePage = lazy(() => import("./pages/PurchaseOrderCreate"));
const PurchaseOrderDetailPage = lazy(() => import("./pages/PurchaseOrderDetail"));
const PurchaseOrderEditPage = lazy(() => import("./pages/PurchaseOrderEdit"));
const DeliveryOrderCreatePage = lazy(() => import("./pages/DeliveryOrderCreatePage"));
const CreateDeliveryFromPO = lazy(() => import("./pages/CreateDeliveryFromPO"));
const DeliveryOrdersPage = lazy(() => import("./pages/DeliveryOrders"));
const DeliveryOrderDetailPage = lazy(() => import("./pages/DeliveryOrderDetail"));
const EditDeliveryOrder = lazy(() => import("./pages/EditDeliveryOrder"));
const BigDOListPage = lazy(() => import("./pages/BigDOListPage"));
const BigDOCreatePage = lazy(() => import("./pages/BigDOCreatePage"));
const BigDODetailPage = lazy(() => import("./pages/BigDODetailPage"));
const StockManagementPage = lazy(() => import("./pages/StockManagement"));
const StockCreatePage = lazy(() => import("./pages/StockCreate"));
const ServiceManagementPage = lazy(() => import("./pages/ServiceManagement"));
const ServiceCreatePage = lazy(() => import("./pages/ServiceCreate"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetail"));
const ServiceEditPage = lazy(() => import("./pages/ServiceEdit"));
const RitaseDashboard = lazy(() => import("./pages/Ritase/RitaseDashboard"));
const POPaymentDetail = lazy(() => import("./pages/Ritase/POPaymentDetail"));
const DOPaymentManagement = lazy(() => import("./pages/Ritase/DOPaymentManagement"));
const TireInventoryPage = lazy(() => import("./pages/TireInventory"));
const TireInventoryCreatePage = lazy(() => import("./pages/TireInventoryCreate"));
const TireInventoryEditPage = lazy(() => import("./pages/TireInventoryEdit"));
const RemovedTiresPage = lazy(() => import("./pages/RemovedTires"));
const StockBatchesPage = lazy(() => import("./pages/StockBatches"));
const CashManagementPage = lazy(() => import("./pages/CashManagement"));
const TempoManagementPage = lazy(() => import("./pages/CashTempoManagement"));
const CashComposerPage = lazy(() => import("./pages/CashComposer"));
const TempoComposerPage = lazy(() => import("./pages/TempoComposer"));
const StockHistoryPage = lazy(() => import("./pages/StockHistory"));
const VehicleServiceHistory = lazy(() => import("./pages/VehicleServiceHistory"));
const VehicleExpenditureAnalytics = lazy(() => import("./pages/VehicleExpenditureAnalytics"));
const PaymentsRoutes = lazy(() => import("./modules/payments/routes"));
const InvoiceDetail = lazy(() => import("./pages/Ritase/InvoiceDetail"));
const DepositGroupManagement = lazy(() => import("./pages/DepositGroupManagement"));
const DOProfitabilityReport = lazy(() => import("./pages/Ritase/DOProfitabilityReport"));
const TempoDetailsPage = lazy(() => import("./pages/TempoDetails"));
const StockUsageRecapPage = lazy(() => import("./pages/StockUsageRecapPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagement"));
const UnauthorizedPage = lazy(() => import("./pages/Unauthorized"));

const ComprehensiveRitaseTable = lazy(
  () => import("./pages/Ritase/ComprehensiveRitaseTable")
);
const POSpecificRitaseTable = lazy(
  () => import("./pages/Ritase/POSpecificRitaseTable")
);

type RequireRolesProps = {
  roles: UserRole[];
  children: React.ReactElement;
};

const RequireRoles: React.FC<RequireRolesProps> = ({
  roles,
  children,
}) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

function App() {
  const { token } = useAuth();

  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="text-gray-600 text-sm">Loading dashboard…</div>
          </div>
        }
      >
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

          <Route
            path="ritase/delivery-orders/:doId/invoices/:invoiceId"
            element={<InvoiceDetail />}
          />
          <Route path="ritase/profitability" element={<DOProfitabilityReport />} />

          <Route path="payments/*" element={<PaymentsRoutes />} />

          {/* Vehicles Routes */}
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="vehicles/create" element={<VehicleCreatePage />} />
          <Route path="vehicles/edit/:id" element={<VehicleEditPage />} />
          <Route path="vehicles/expenditure" element={<VehicleExpenditureAnalytics />} />
          {/* Tire Management Routes */}
          <Route path="vehicles/tires" element={<TireManagementPage />} />

          <Route path="tire-inventory" element={<TireInventoryPage />} />
          <Route
            path="tire-inventory/create"
            element={<TireInventoryCreatePage />}
          />
          <Route
            path="tire-inventory/edit/:id"
            element={<TireInventoryEditPage />}
          />
          <Route path="vehicles/tires/removed" element={<RemovedTiresPage />} />
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
            path="delivery-orders/create"
            element={<DeliveryOrderCreatePage />}
          />
          <Route
            path="delivery-orders/:id"
            element={<DeliveryOrderDetailPage />}
          />
          <Route
            path="delivery-orders/:id/edit"
            element={<EditDeliveryOrder />}
          />

          <Route path="big-dos" element={<BigDOListPage />} />
          <Route path="big-dos/create" element={<BigDOCreatePage />} />
          <Route path="big-dos/:id" element={<BigDODetailPage />} />

          {/* Stock Management Routes */}
          <Route path="stock" element={<StockManagementPage />} />
          <Route path="stock/create" element={<StockCreatePage />} />
          <Route path="stock/edit/:id" element={<StockCreatePage />} />
          <Route path="stock/usage-recap" element={<StockUsageRecapPage />} />

          {/* === PERBAIKAN DI SINI === */}
          {/* Path dibuat relatif dengan menghapus '/' di awal */}
          <Route path="stock/history/:id" element={<StockHistoryPage />} />
          <Route path="stock/:id/batches" element={<StockBatchesPage />} />

          {/* ========================= */}

          {/* Service Management Routes */}
          <Route
            path="vehicles/:id/services"
            element={<VehicleServiceHistory />}
          />
          <Route path="services" element={<ServiceManagementPage />} />
          <Route path="services/create" element={<ServiceCreatePage />} />
          <Route path="services/:id" element={<ServiceDetailPage />} />
          <Route path="services/edit/:id" element={<ServiceEditPage />} />
          <Route path="cash" element={<CashManagementPage />} />
          <Route path="cash/composer" element={<CashComposerPage />} />
          <Route path="tempo" element={<CashManagementPage />} />
          <Route path="tempo/composer" element={<TempoComposerPage />} />
          <Route path="tempoDetails" element={<TempoDetailsPage />} />
          <Route path="deposit-groups" element={<DepositGroupManagement />} />
          <Route
            path="users"
            element={
              <RequireRoles roles={['admin', 'owner']}>
                <UserManagementPage />
              </RequireRoles>
            }
          />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
