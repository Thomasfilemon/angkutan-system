import React, { useState, useEffect, useMemo } from "react";
import axios from "../api/axiosConfig";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

// Registrasi komponen ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// --- INTERFACE LENGKAP SESUAI DATA BACKEND ---
interface DashboardMetrics {
  grossIncome: number;
  netIncome: number;
  totalExpenses: number;
  revenueBuckets?: { paid: number; partial: number; completed: number };
  driverExpenses: {
    totalUangJalan: number;
    totalGajiDriver: number;
    totalOtherDriverExpenses: number;
  };
  vehicleExpenses: {
    totalServiceCost: number;
  };
  officeExpenses: {
    totalOfficeExpenses: number;
  };
  inventoryMetrics: {
    totalInventoryValue: number;
    totalPurchases: number;
    lowStockItems: number;
    categoryBreakdown?: { category: string; value: number; lowStock: number }[];
  };
  operationalMetrics: {
    activeDeliveries: number;
    completedDeliveries: number;
    totalVehicles: number;
    vehiclesInMaintenance: number;
    dailyTrend?: { date: string; active: number; completed: number }[];
  };
}

const Dashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE UNTUK FILTER TANGGAL ---
  const [filterType, setFilterType] = useState("preset"); // 'preset' atau 'custom'
  const [timeRange, setTimeRange] = useState("month"); // 'week', 'month', 'year'
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // --- NEW: Memoized function to process inventory data for the chart ---
  const inventoryChartData = useMemo(() => {
    const breakdown = metrics?.inventoryMetrics?.categoryBreakdown;
    if (!breakdown || breakdown.length === 0) {
      return { labels: [], data: [], colors: [] };
    }

    // Sort categories by value in descending order
    const sortedBreakdown = [...breakdown].sort((a, b) => b.value - a.value);

    const topN = 5;
    const labels: string[] = [];
    const data: number[] = [];
    const defaultColors = [
      "#9333EA", // purple
      "#F59E0B", // amber
      "#10B981", // emerald
      "#3B82F6", // blue
      "#EF4444", // red
    ];
    const othersColor = "#9CA3AF"; // Gray for "Others"

    if (sortedBreakdown.length > topN) {
      // Take the top 5
      const topItems = sortedBreakdown.slice(0, topN);
      labels.push(...topItems.map((item) => item.category));
      data.push(...topItems.map((item) => item.value));

      // Aggregate the rest into "Others"
      const otherItems = sortedBreakdown.slice(topN);
      const othersValue = otherItems.reduce((sum, item) => sum + item.value, 0);
      if (othersValue > 0) {
        labels.push("Others");
        data.push(othersValue);
      }

      // Assign colors
      const colors = [...defaultColors.slice(0, topItems.length)];
      if (othersValue > 0) {
        colors.push(othersColor);
      }
      return { labels, data, colors };
    } else {
      // If 5 or fewer categories, show all of them
      const labels = sortedBreakdown.map((item) => item.category);
      const data = sortedBreakdown.map((item) => item.value);
      const colors = defaultColors.slice(0, sortedBreakdown.length);
      return { labels, data, colors };
    }
  }, [metrics]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      let url = `/analytics/dashboard`;
      const params = new URLSearchParams();

      // Logika untuk menentukan parameter query
      if (filterType === "custom" && customStartDate && customEndDate) {
        params.append("startDate", customStartDate);
        params.append("endDate", customEndDate);
      } else {
        params.append("timeRange", timeRange);
      }

      url += `?${params.toString()}`;

      try {
        const res = await axios.get(url);
        setMetrics(res.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.error || err.message || "Gagal memuat data"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [timeRange, customStartDate, customEndDate, filterType]);

  // Tampilan Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  // Tampilan Error
  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 text-red-800 border border-red-200 rounded-lg shadow-md">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen font-sans">
      {/* Header & Kontrol Filter */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Ringkasan finansial dan operasional bisnis.
          </p>
        </div>
        <div className="flex items-center space-x-4 flex-wrap bg-white p-2 rounded-lg shadow-sm">
          {/* Filter Preset */}
          <select
            value={timeRange}
            onChange={(e) => {
              setTimeRange(e.target.value);
              setFilterType("preset");
            }}
            className="border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="week">7 Hari Terakhir</option>
            <option value="month">30 Hari Terakhir</option>
            <option value="year">1 Tahun Terakhir</option>
          </select>

          {/* Filter Tanggal Custom */}
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setFilterType("custom");
              }}
              className="border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setFilterType("custom");
              }}
              className="border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {metrics && (
        <>
          {/* --- BAGIAN 1: RINGKASAN FINANSIAL UTAMA --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Pendapatan Kotor"
              value={metrics.grossIncome}
              type="currency"
              color="green"
              note="Dari DO yang lunas"
            />
            {metrics.revenueBuckets && (
              <div className="bg-white p-6 rounded-lg shadow-md transition hover:shadow-lg">
                <h3 className="text-lg font-semibold text-gray-700">
                  Pendapatan (Paid/Partial/Completed)
                </h3>
                <div className="space-y-1 text-sm mt-2">
                  <div className="flex justify-between"><span>Paid</span><span className="font-semibold text-green-600">Rp {metrics.revenueBuckets!.paid.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Partial</span><span className="font-semibold text-amber-600">Rp {metrics.revenueBuckets!.partial.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Completed</span><span className="font-semibold text-blue-600">Rp {metrics.revenueBuckets!.completed.toLocaleString('id-ID')}</span></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Ringkasan status pembayaran</p>
              </div>
            )}
            <MetricCard
              title="Total Pengeluaran"
              value={metrics.totalExpenses}
              type="currency"
              color="red"
              note="Semua biaya operasional"
            />
            <MetricCard
              title="Pendapatan Bersih"
              value={metrics.netIncome}
              type="currency"
              color="blue"
              note="Profitabilitas bisnis"
            />
            <OperationalCard metrics={metrics.operationalMetrics} />
          </div>

          {/* --- BAGIAN 2: Rincian Pengeluaran & Profit --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Rincian Pengeluaran
              </h3>
              <div className="h-80">
                <Bar
                  data={{
                    labels: [
                      "Uang Jalan",
                      "Gaji Driver",
                      "Servis Kendaraan",
                      "Biaya Lain Driver",
                      "Biaya Kantor",
                    ],
                    datasets: [
                      {
                        label: "Total Pengeluaran (Rp)",
                        data: [
                          metrics.driverExpenses.totalUangJalan,
                          metrics.driverExpenses.totalGajiDriver,
                          metrics.vehicleExpenses.totalServiceCost,
                          metrics.driverExpenses.totalOtherDriverExpenses,
                          metrics.officeExpenses.totalOfficeExpenses,
                        ],
                        backgroundColor: [
                          "#EF4444",
                          "#F97316",
                          "#F59E0B",
                          "#EAB308",
                          "#84CC16",
                        ],
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={chartOptions.bar}
                />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Komposisi Profit
              </h3>
              <div className="h-80 flex items-center justify-center">
                <Doughnut
                  data={chartData(metrics).profitComposition}
                  options={chartOptions.doughnut}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Inventory Breakdown Doughnut */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Breakdown Inventaris
              </h3>
              <div className="h-80">
                <Doughnut
                  data={{
                    labels: inventoryChartData.labels,
                    datasets: [
                      {
                        data: inventoryChartData.data,
                        backgroundColor: inventoryChartData.colors,
                        borderColor: "#FFFFFF",
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={chartOptions.doughnut}
                />
              </div>
            </div>

            {/* Daily Trend Line */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Tren Harian Operasional
              </h3>
              <div className="h-80">
                <Line
                  data={{
                    labels: (metrics?.operationalMetrics.dailyTrend ?? []).map(
                      (item) => new Date(item.date).toLocaleDateString("id-ID")
                    ),
                    datasets: [
                      {
                        label: "Aktif",
                        data: (
                          metrics?.operationalMetrics.dailyTrend ?? []
                        ).map((item) => item.active),
                        borderColor: "#3B82F6",
                        fill: true,
                      },
                      {
                        label: "Selesai",
                        data: (
                          metrics?.operationalMetrics.dailyTrend ?? []
                        ).map((item) => item.completed),
                        borderColor: "#10B981",
                        fill: true,
                      },
                    ],
                  }}
                  options={chartOptions.line} // Tambah options.line mirip bar
                />
              </div>
            </div>
          </div>

          {/* --- BAGIAN 3: ANALITIK INVENTARIS & SUKU CADANG --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Nilai Inventaris"
              value={metrics.inventoryMetrics.totalInventoryValue}
              type="currency"
              color="purple"
              note="Total nilai stok saat ini"
            />
            <MetricCard
              title="Pembelian Suku Cadang"
              value={metrics.inventoryMetrics.totalPurchases}
              type="currency"
              color="indigo"
              note="Pengeluaran untuk stok baru"
            />
            <MetricCard
              title="Stok Menipis"
              value={metrics.inventoryMetrics.lowStockItems}
              type="number"
              color="yellow"
              note="Item di bawah batas minimum"
            />
          </div>
        </>
      )}
    </div>
  );
};

// Komponen pembantu untuk kartu metrik agar lebih rapi
const MetricCard = ({
  title,
  value,
  type,
  color,
  note,
}: {
  title: string;
  value: number;
  type: "currency" | "number";
  color: string;
  note: string;
}) => {
  const colors: { [key: string]: string } = {
    green: "text-green-600",
    red: "text-red-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
    indigo: "text-indigo-600",
    yellow: "text-yellow-500",
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md transition hover:shadow-lg">
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <p
        className={`text-3xl font-bold ${
          value < 0 ? "text-red-600" : colors[color]
        } mt-2`}
      >
        {type === "currency"
          ? `Rp ${Math.abs(value).toLocaleString()}`
          : Math.abs(value).toLocaleString()}
        {value < 0 && <span className="text-red-600 ml-1">(Rugi)</span>}
      </p>
      <p className="text-sm text-gray-500 mt-1">{note}</p>
    </div>
  );
};

// Komponen pembantu untuk kartu operasional
const OperationalCard = ({
  metrics,
}: {
  metrics: DashboardMetrics["operationalMetrics"];
}) => (
  <div className="bg-white p-6 rounded-lg shadow-md transition hover:shadow-lg">
    <h3 className="text-lg font-semibold text-gray-700 mb-4">
      Metrik Operasional
    </h3>
    <div className="flex justify-around text-center space-x-2">
      <div>
        <p className="text-3xl font-bold text-gray-800">
          {metrics.activeDeliveries}
        </p>
        <p className="text-xs text-gray-500">Pengiriman Aktif</p>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-800">
          {metrics.completedDeliveries}
        </p>
        <p className="text-xs text-gray-500">Pengiriman Selesai</p>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-800">
          {metrics.vehiclesInMaintenance}
        </p>
        <p className="text-xs text-gray-500">Dalam Servis</p>
      </div>
    </div>
  </div>
);

// Opsi default untuk chart
const chartOptions = {
  bar: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: string | number) =>
            `Rp ${Number(value).toLocaleString()}`,
        },
      },
    },
  },
  doughnut: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" as const } },
    cutout: "60%",
  },
  line: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const, // Fix: as const bikin TS tau ini exact "top"
      },
    },
    scales: { y: { beginAtZero: true } },
  },
};

// Data dinamis untuk chart
const chartData = (metrics: DashboardMetrics) => ({
  profitComposition: {
    labels: ["Pendapatan Bersih", "Total Pengeluaran"],
    datasets: [
      {
        data: [
          metrics.netIncome > 0 ? metrics.netIncome : 0,
          metrics.totalExpenses,
        ],
        backgroundColor: ["#3B82F6", "#EF4444"],
        borderColor: "#FFFFFF",
        borderWidth: 2,
      },
    ],
  },
});

export default Dashboard;
