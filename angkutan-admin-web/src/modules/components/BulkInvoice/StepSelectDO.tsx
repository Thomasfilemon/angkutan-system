import React, { useState, useEffect } from "react";
import { paymentsApi } from "../../payments/api";

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  amount: number;
  payment_status: string;
  created_at: string;
}

interface StepSelectDOProps {
  preSelectedDOs?: number[];
  onSelectionChange: (
    selectedDOs: number[],
    totalAmount: number,
    customer: string
  ) => void;
  onNext: () => void;
}

const StepSelectDO: React.FC<StepSelectDOProps> = ({
  preSelectedDOs = [],
  onSelectionChange,
  onNext,
}) => {
  const [eligibleDOs, setEligibleDOs] = useState<DeliveryOrder[]>([]);
  const [groupedDOs, setGroupedDOs] = useState<{
    [key: string]: DeliveryOrder[];
  }>({});
  const [selectedDOs, setSelectedDOs] = useState<number[]>(preSelectedDOs);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEligibleDOs();
  }, []);

  useEffect(() => {
    if (selectedDOs.length > 0) {
      const selectedOrders = eligibleDOs.filter((do_) =>
        selectedDOs.includes(do_.id)
      );
      const totalAmount = selectedOrders.reduce(
        (sum, do_) => sum + do_.amount,
        0
      );
      const customer = selectedOrders[0]?.customer_name || "";
      onSelectionChange(selectedDOs, totalAmount, customer);
    }
  }, [selectedDOs, eligibleDOs]);

  const fetchEligibleDOs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await paymentsApi.getBulkEligibleDOs();
      setEligibleDOs(response.data.data.eligible_dos);
      setGroupedDOs(response.data.data.grouped_by_customer);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to fetch eligible delivery orders"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDOSelection = (doId: number, customerName: string) => {
    setSelectedDOs((prev) => {
      // If no customer selected yet, set customer
      if (prev.length === 0) {
        setSelectedCustomer(customerName);
        return [doId];
      }

      // If different customer, show warning and don't select
      if (selectedCustomer !== customerName) {
        alert(`Cannot mix customers. Current selection: ${selectedCustomer}`);
        return prev;
      }

      // Toggle selection for same customer
      if (prev.includes(doId)) {
        const newSelection = prev.filter((id) => id !== doId);
        if (newSelection.length === 0) {
          setSelectedCustomer("");
        }
        return newSelection;
      } else {
        return [...prev, doId];
      }
    });
  };

  const handleCustomerGroupSelect = (customer: string) => {
    const customerDOs = groupedDOs[customer];
    if (selectedCustomer === customer) {
      // Deselect all from this customer
      setSelectedDOs([]);
      setSelectedCustomer("");
    } else {
      // Select all from this customer
      setSelectedDOs(customerDOs.map((do_) => do_.id));
      setSelectedCustomer(customer);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
        <button
          onClick={fetchEligibleDOs}
          className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Select Delivery Orders for Bulk Invoice
        </h3>
        <p className="text-sm text-gray-600">
          Choose multiple delivery orders from the same customer to create a
          bulk invoice.
        </p>
      </div>

      {/* Selection Summary */}
      {selectedDOs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Current Selection</h4>
              <p className="text-sm text-blue-700">
                {selectedDOs.length} delivery orders from {selectedCustomer}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-blue-900">
                Rp{" "}
                {eligibleDOs
                  .filter((do_) => selectedDOs.includes(do_.id))
                  .reduce((sum, do_) => sum + do_.amount, 0)
                  .toLocaleString("id-ID")}
              </div>
              <div className="text-sm text-blue-700">Total Amount</div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Groups */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Available Delivery Orders</h4>

        {Object.keys(groupedDOs).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-lg font-medium">No eligible delivery orders</p>
            <p className="text-sm">
              All delivery orders may already have invoices or are not ready for
              billing.
            </p>
          </div>
        ) : (
          Object.entries(groupedDOs).map(([customer, dos]) => (
            <div key={customer} className="border border-gray-200 rounded-lg">
              {/* Customer Header */}
              <div
                className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedCustomer === customer
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50"
                }`}
                onClick={() => handleCustomerGroupSelect(customer)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedCustomer === customer}
                      onChange={() => {}} // Handled by div click
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3"
                    />
                    <h5 className="font-medium text-gray-900">{customer}</h5>
                  </div>
                  <div className="text-sm text-gray-500">
                    {dos.length} delivery orders • Rp{" "}
                    {dos
                      .reduce((sum, do_) => sum + do_.amount, 0)
                      .toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              {/* Delivery Orders List */}
              <div className="divide-y divide-gray-200">
                {dos.map((do_) => (
                  <div
                    key={do_.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                      selectedDOs.includes(do_.id) ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleDOSelection(do_.id, customer)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedDOs.includes(do_.id)}
                          onChange={() => {}} // Handled by div click
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {do_.do_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {do_.item_name} •{" "}
                            {new Date(do_.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          Rp {do_.amount.toLocaleString("id-ID")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {do_.payment_status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end pt-6 border-t">
        <button
          onClick={onNext}
          disabled={selectedDOs.length < 2}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Next: Configure Invoice ({selectedDOs.length} selected)
        </button>
      </div>
    </div>
  );
};

export default StepSelectDO;
