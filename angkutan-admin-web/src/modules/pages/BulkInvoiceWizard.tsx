import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import StepSelectDO from "../components/BulkInvoice/StepSelectDO";
import StepConfigure from "../components/BulkInvoice/StepConfigure";
import StepReview from "../components/BulkInvoice/StepReview";
import { paymentsApi } from "../payments/api";

interface InvoiceConfig {
  invoice_number: string;
  pph_percentage: number;
  due_date: string;
  notes: string;
}

const BulkInvoiceWizard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDOs, setSelectedDOs] = useState<number[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [customer, setCustomer] = useState("");
  const [config, setConfig] = useState<InvoiceConfig>({
    invoice_number: "",
    pph_percentage: 0.5,
    due_date: "",
    notes: "",
  });
  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([]);

  // Parse URL params for pre-selected DOs
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const dosParam = urlParams.get("dos");

    if (dosParam) {
      const preSelectedDOs = dosParam.split(",").map(Number).filter(Boolean);
      setSelectedDOs(preSelectedDOs);
    }
  }, [location]);

  // Fetch delivery order details when selection changes
  useEffect(() => {
    if (selectedDOs.length > 0) {
      fetchDeliveryOrderDetails();
    }
  }, [selectedDOs]);

  const fetchDeliveryOrderDetails = async () => {
    try {
      const response = await paymentsApi.getBulkEligibleDOs();
      const allDOs = response.data.data.eligible_dos;
      const selectedDetails = allDOs.filter((do_: { id: number }) =>
        selectedDOs.includes(do_.id)
      );
      setDeliveryOrders(selectedDetails);
    } catch (err) {
      console.error("Failed to fetch DO details:", err);
    }
  };

  const handleSelectionChange = (
    dos: number[],
    amount: number,
    customerName: string
  ) => {
    setSelectedDOs(dos);
    setTotalAmount(amount);
    setCustomer(customerName);
  };

  const handleConfigChange = (newConfig: InvoiceConfig) => {
    setConfig(newConfig);
  };

  const handleSuccess = (invoiceData: any) => {
    // Show success and redirect
    alert(
      `Bulk invoice created successfully! Invoice: ${invoiceData.bulk_invoice_number}`
    );
    navigate("/payments/invoices");
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Select Delivery Orders";
      case 2:
        return "Configure Invoice";
      case 3:
        return "Review & Create";
      default:
        return "Bulk Invoice";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Create Bulk Invoice
            </h1>
            <p className="text-gray-600 mt-2">
              Generate a single invoice for multiple delivery orders
            </p>
          </div>
          <button
            onClick={() => navigate("/payments")}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step <= currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {step < currentStep ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              {step < 3 && (
                <div
                  className={`flex-1 h-1 mx-4 ${
                    step < currentStep ? "bg-blue-600" : "bg-gray-300"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-sm text-gray-600">Select DOs</span>
          <span className="text-sm text-gray-600">Configure</span>
          <span className="text-sm text-gray-600">Review</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white shadow-lg rounded-lg p-8">
        <h2 className="text-xl font-semibold mb-6">{getStepTitle()}</h2>

        {currentStep === 1 && (
          <StepSelectDO
            preSelectedDOs={selectedDOs}
            onSelectionChange={handleSelectionChange}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <StepConfigure
            selectedDOs={selectedDOs}
            totalAmount={totalAmount}
            customer={customer}
            onConfigChange={handleConfigChange}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <StepReview
            selectedDOs={selectedDOs}
            totalAmount={totalAmount}
            customer={customer}
            config={config}
            deliveryOrders={deliveryOrders}
            onBack={() => setCurrentStep(2)}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default BulkInvoiceWizard;
