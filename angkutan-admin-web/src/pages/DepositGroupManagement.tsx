// src/pages/DepositGroupManagement.tsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '../api/axiosConfig';

// ===== INTERFACES =====
interface DepositGroup {
  id: number;
  group_name: string;
  balance: number;
  target_quantity?: number;
  remaining_quantity?: number;
  deposited_amount?: number;
  unit?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  total_selisih_amount?: number;
  selisih_details?: string;
  selisih_status?: string;
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  unit_price: number;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  final_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: string;
  payment_id?: number;
}

interface GroupMember {
  id: number;
  group_id: number;
  delivery_order_id: number;
  quantity: number;
  deliveryOrder: DeliveryOrder;
}

interface LinkedPO {
  id: number;
  po_number: string;
  customer_name: string;
  total_quantity: number;
  unit: string;
  status: string;
  do_count: number;
  dos: Array<{
    id: number;
    do_number: string;
    status: string;
  }>;
}

interface SelisihCharge {
    id: number;
    adjustment_amount: number;
    reason: string;
    created_at: string;
    status: string; // e.g., 'pending', 'paid'
}
  
interface SelectedGroup extends DepositGroup {
    members: GroupMember[];
    linkedPOs?: LinkedPO[];
    selisih_charges?: SelisihCharge[]; // To hold selisih data
}

interface ExtraCharge {
  doNumber: string;
  customer: string;
  minQty: number;
  currentQty: number;
  extraQuantity: number;
  unitPrice: number;
  extraAmount: number;
  isPaid: boolean;
}

interface AvailablePO {
  id: number;
  po_number: string;
  customer_name: string;
  total_quantity: number;
  unit: string;
  status: string;
  remaining_quantity: number;
}

const DepositGroupManagement: React.FC = () => {
  // ===== STATE MANAGEMENT =====
  const [groups, setGroups] = useState<DepositGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const [availableDOs, setAvailableDOs] = useState<DeliveryOrder[]>([]);
  const [selectedDOs, setSelectedDOs] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddDOModal, setShowAddDOModal] = useState(false);
  const [showExtraCharges, setShowExtraCharges] = useState(false);
  const [showPaySelisihModal, setShowPaySelisihModal] = useState(false);
  const [selisihPaymentAmount, setSelisihPaymentAmount] = useState('');
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);

  // States for PO linking
  const [showLinkPOModal, setShowLinkPOModal] = useState(false);
  const [availablePOs, setAvailablePOs] = useState<AvailablePO[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null);

  // New form state for creating deposit groups
  const [newGroupForm, setNewGroupForm] = useState({
    group_name: '',
    target_quantity: '',
    deposited_amount: '',
    unit: 'ton',
    balance: ''
  });

  // ===== UTILITY FUNCTIONS =====
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const getUnitDisplay = (unit: string): string => {
    const unitMap = { kilogram: "kg", ton: "ton", kubik: "m³" };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      normal: 'bg-green-100 text-green-800',
      'butuh bayar': 'bg-red-100 text-red-800',
      'extra saldo': 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      fulfilled: 'bg-gray-100 text-gray-800',
      overdrawn: 'bg-red-100 text-red-800',
      confirmed: 'bg-blue-100 text-blue-800',
      partial: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      pending_selisih: 'bg-yellow-100 text-yellow-800' // New status
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // ===== API FUNCTIONS =====
  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/deposit-groups');
      setGroups(response.data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to fetch deposit groups');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId: number) => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/deposit-groups/${groupId}`);
      setSelectedGroup(response.data);
      calculateExtraCharges(response.data.members || []);
    } catch (error) {
      console.error('Error fetching group details:', error);
      toast.error('Failed to fetch group details');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableDOs = async () => {
    try {
      const response = await apiClient.get('/delivery-orders', {
        params: {
          status: 'completed',
          payment_status: 'proses_tagihan'
        }
      });
      
      // Filter DOs that are not already in a deposit group
      const dos = response.data?.data || response.data || [];
      const filtered = dos.filter((doItem: DeliveryOrder) => !doItem.payment_id);
      setAvailableDOs(filtered);
    } catch (error) {
      console.error('Error fetching available DOs:', error);
      toast.error('Failed to fetch available delivery orders');
    }
  };

  // Fetch available POs for linking
  const fetchAvailablePOs = async () => {
    try {
      const response = await apiClient.get('/purchase-orders/available-for-delivery');
      setAvailablePOs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching available POs:', error);
      toast.error('Failed to fetch available purchase orders');
    }
  };

  // Link PO to deposit group
  const linkPOToGroup = async () => {
    if (!selectedGroup || !selectedPOId) return;

    try {
      setIsLoading(true);
      await apiClient.post('/deposit-groups/link-po', {
        po_id: selectedPOId,
        group_id: selectedGroup.id
      });

      toast.success('PO linked to deposit group successfully');
      fetchGroupDetails(selectedGroup.id);
      setShowLinkPOModal(false);
      setSelectedPOId(null);
    } catch (error: any) {
      console.error('Error linking PO:', error);
      toast.error(error.response?.data?.message || 'Failed to link PO to deposit group');
    } finally {
      setIsLoading(false);
    }
  };

  const createGroup = async () => {
    try {
      setIsLoading(true);
      
      const payload = {
        group_name: newGroupForm.group_name,
        target_quantity: parseFloat(newGroupForm.target_quantity) || 0,
        deposited_amount: parseFloat(newGroupForm.deposited_amount) || 0,
        remaining_quantity: parseFloat(newGroupForm.target_quantity) || 0,
        unit: newGroupForm.unit,
        balance: parseFloat(newGroupForm.balance) || 0,
        status: 'active'
      };

      await apiClient.post('/deposit-groups', payload);
      toast.success('Deposit group created successfully!');
      fetchGroups();
      setShowCreateModal(false);
      setNewGroupForm({
        group_name: '',
        target_quantity: '',
        deposited_amount: '',
        unit: 'ton',
        balance: ''
      });
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast.error(error.response?.data?.message || 'Failed to create deposit group');
    } finally {
      setIsLoading(false);
    }
  };

  const addDOsToGroup = async () => {
    if (!selectedGroup || selectedDOs.length === 0) return;

    try {
      setIsLoading(true);
      
      for (const doId of selectedDOs) {
        const doItem = availableDOs.find(d => d.id === doId);
        if (doItem) {
          await apiClient.post('/deposit-groups/members', {
            group_id: selectedGroup.id,
            delivery_order_id: doId,
            quantity: doItem.minimal_load_quantity
          });
        }
      }

      toast.success('Delivery orders added successfully!');
      fetchGroupDetails(selectedGroup.id);
      setShowAddDOModal(false);
      setSelectedDOs([]);
    } catch (error: any) {
      console.error('Error adding DOs:', error);
      toast.error(error.response?.data?.message || 'Failed to add delivery orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuantityInputChange = async (memberId: number, newQuantity: number) => {
    try {
      await apiClient.put(`/deposit-groups/members/${memberId}`, {
        quantity: newQuantity
      });
      
      if (selectedGroup) {
        fetchGroupDetails(selectedGroup.id);
      }
      toast.success('Quantity updated successfully!');
    } catch (error: any) {
      console.error('Error updating quantity:', error);
      toast.error(error.response?.data?.message || 'Failed to update quantity');
    }
  };

  const handleGenerateSelisih = async (groupId: number) => {
    try {
      setIsLoading(true);
      const response = await apiClient.post(`/deposit-groups/${groupId}/generate-selisih`);
      toast.success(response.data.message || 'Tagihan selisih berhasil dibuat!');
      
      // Refresh the details to show the new selisih charge
      fetchGroupDetails(groupId);
    } catch (error: any) {
      console.error('Error generating selisih invoice:', error);
      toast.error(error.response?.data?.message || 'Gagal membuat tagihan selisih.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaySelisih = async () => {
    if (!selectedGroup || !selisihPaymentAmount) return;
    try {
        setIsLoading(true);
        const response = await apiClient.post(`/deposit-groups/${selectedGroup.id}/pay-selisih`, {
            payment_amount: parseFloat(selisihPaymentAmount)
        });
        toast.success(response.data.message);
        setShowPaySelisihModal(false);
        setSelisihPaymentAmount('');
        fetchGroupDetails(selectedGroup.id);
    } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to pay selisih.');
    } finally {
        setIsLoading(false);
    }
  };


  const payExtraCharge = async (memberId: number) => {
    try {
      setIsLoading(true);
      await apiClient.post(`/deposit-groups/members/${memberId}/pay-extra`);
      toast.success('Extra charge paid successfully!');
      
      if (selectedGroup) {
        fetchGroupDetails(selectedGroup.id);
      }
    } catch (error: any) {
      console.error('Error paying extra charge:', error);
      toast.error(error.response?.data?.message || 'Failed to pay extra charge');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateExtraCharges = (members: GroupMember[]) => {
    const charges: ExtraCharge[] = [];
    
    members.forEach(member => {
      const doItem = member.deliveryOrder;
      const extraQuantity = member.quantity - doItem.minimal_load_quantity;
      
      if (extraQuantity > 0) {
        charges.push({
          doNumber: doItem.do_number,
          customer: doItem.customer_name,
          minQty: doItem.minimal_load_quantity,
          currentQty: member.quantity,
          extraQuantity: extraQuantity,
          unitPrice: doItem.unit_price,
          extraAmount: extraQuantity * doItem.unit_price,
          isPaid: doItem.payment_status === 'lunas'
        });
      }
    });
    
    setExtraCharges(charges);
  };

  const toggleDOSelection = (doId: number) => {
    setSelectedDOs(prev => 
      prev.includes(doId) 
        ? prev.filter(id => id !== doId)
        : [...prev, doId]
    );
  };

  // ===== EFFECTS =====
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (showAddDOModal) {
      fetchAvailableDOs();
    }
  }, [showAddDOModal]);

  useEffect(() => {
    if (showLinkPOModal) {
      fetchAvailablePOs();
    }
  }, [showLinkPOModal]);

  // ===== RENDER =====
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Deposit Group Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          + Buat Group Baru
        </button>
      </div>

      {selectedGroup ? (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{selectedGroup.group_name}</h2>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ← Back to Groups
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Target Quantity</label>
                  <div className="font-medium">
                    {selectedGroup.target_quantity?.toLocaleString('id-ID') || 0} {getUnitDisplay(selectedGroup.unit || 'ton')}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Remaining Quantity</label>
                  <div className="font-medium">
                    {selectedGroup.remaining_quantity?.toLocaleString('id-ID') || 0} {getUnitDisplay(selectedGroup.unit || 'ton')}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Deposited Amount</label>
                  <div className="font-medium">{formatCurrency(selectedGroup.deposited_amount || 0)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Current Balance</label>
                  <div className="font-medium">{formatCurrency(selectedGroup.balance)}</div>
                </div>
              </div>
            </div>

            {/* Linked Purchase Orders Section */}
            {selectedGroup.linkedPOs && selectedGroup.linkedPOs.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-medium">📋 Linked Purchase Orders</h3>
                  <button
                    onClick={() => setShowLinkPOModal(true)}
                    className="bg-indigo-500 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
                  >
                    + Link PO
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PO Number
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          DOs Created
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedGroup.linkedPOs.map((po) => (
                        <tr key={po.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{po.po_number}</td>
                          <td className="px-4 py-2 text-gray-900">{po.customer_name}</td>
                          <td className="px-4 py-2 text-gray-900">
                            {po.total_quantity.toLocaleString('id-ID')} {getUnitDisplay(po.unit)}
                          </td>
                          <td className="px-4 py-2">
                            {getStatusBadge(po.status)}
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm">
                              {po.do_count} DOs
                              {po.dos.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {po.dos.map(d => d.do_number).join(', ')}
                                </div>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {po.do_count === 0 && (
                              <button 
                                className="text-blue-600 hover:text-blue-800 text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded"
                                onClick={() => {
                                  // Navigate to create DO from PO
                                  window.open(`/admin/purchase-orders/${po.id}/create-do`, '_blank');
                                }}
                              >
                                Create DO
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium">Delivery Orders dalam Group</h3>
                <div className="space-x-2">
                  {(!selectedGroup.linkedPOs || selectedGroup.linkedPOs.length === 0) && (
                    <button
                      onClick={() => setShowLinkPOModal(true)}
                      className="bg-indigo-500 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
                    >
                      + Link PO
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddDOModal(true)}
                    className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                  >
                    + Tambah DO
                  </button>
                  <button
                    onClick={() => setShowExtraCharges(!showExtraCharges)}
                    className="bg-purple-500 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
                  >
                    {showExtraCharges ? 'Hide' : 'Show'} Extra Charges
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DO Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Qty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Qty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                    {selectedGroup.members.map((member) => {
                      const doItem = member.deliveryOrder;
                      const displayQuantity = member.quantity;
                      const total = doItem.unit_price * displayQuantity;
                      
                      return (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doItem.do_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doItem.customer_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doItem.minimal_load_quantity.toLocaleString('id-ID')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                            {displayQuantity.toLocaleString('id-ID')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(doItem.unit_price)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(total)}</td>
                          {/*//. THIS IS THE FIX */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(doItem.paid_amount || 0)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(doItem.payment_status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* *** Selisih Charges Section *** */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium">Tagihan Selisih (Extra Quantity)</h3>
                    <button
                        onClick={() => handleGenerateSelisih(selectedGroup.id)}
                        className="bg-purple-500 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Generating...' : 'Generate Tagihan Selisih'}
                    </button>
                </div>
                {/* *** FIX: Show this section if status is 'pending' OR 'paid' *** */}
                {(selectedGroup.selisih_status === 'pending' || selectedGroup.selisih_status === 'paid') ? (
                    <div className="p-6">
                        <div className={`p-3 rounded-md border ${selectedGroup.selisih_status === 'paid' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-800">Total Tagihan: {formatCurrency(selectedGroup.total_selisih_amount || 0)}</p>
                                    <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{selectedGroup.selisih_details}</pre>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {/* *** FIX: Show status badge and conditionally show PAY button *** */}
                                    {getStatusBadge(selectedGroup.selisih_status)}
                                    {selectedGroup.selisih_status === 'pending' && (
                                        <button
                                            onClick={() => setShowPaySelisihModal(true)}
                                            className="bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold"
                                            disabled={isLoading}
                                        >
                                            BAYAR
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500">Tidak ada tagihan selisih untuk group ini.</p>
                    </div>
                )}
            </div>
        </div>
      ) : (
          <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Group</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deposited Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groups.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-gray-900">{group.group_name}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{group.target_quantity?.toLocaleString('id-ID') || 0} {getUnitDisplay(group.unit || 'ton')}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{group.remaining_quantity?.toLocaleString('id-ID') || 0} {getUnitDisplay(group.unit || 'ton')}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{formatCurrency(group.deposited_amount || 0)}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{formatCurrency(group.balance)}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(group.status || 'normal')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(group.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => fetchGroupDetails(group.id)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
      )}
        
      {/* Pay Selisih Modal */}
      {showPaySelisihModal && selectedGroup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Pay Selisih for {selectedGroup.group_name}</h3>
                    <p className="text-sm text-gray-600 mb-2">Total Tagihan: {formatCurrency(selectedGroup.total_selisih_amount || 0)}</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Payment Amount (Rp)</label>
                        <input
                            type="number"
                            value={selisihPaymentAmount}
                            onChange={(e) => setSelisihPaymentAmount(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Enter amount to pay"
                            min="0"
                        />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            onClick={() => setShowPaySelisihModal(false)}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePaySelisih}
                            disabled={isLoading || !selisihPaymentAmount}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                            {isLoading ? 'Paying...' : 'Pay'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}  

      
      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Deposit Group</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Group Name *</label>
                  <input
                    type="text"
                    value={newGroupForm.group_name}
                    onChange={(e) => setNewGroupForm({...newGroupForm, group_name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter group name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Target Quantity *</label>
                  <input
                    type="number"
                    value={newGroupForm.target_quantity}
                    onChange={(e) => setNewGroupForm({...newGroupForm, target_quantity: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter target quantity"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit *</label>
                  <select
                    value={newGroupForm.unit}
                    onChange={(e) => setNewGroupForm({...newGroupForm, unit: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="ton">Ton</option>
                    <option value="kubik">Kubik (m³)</option>
                    <option value="kilogram">Kilogram</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deposited Amount (Rp) *</label>
                  <input
                    type="number"
                    value={newGroupForm.deposited_amount}
                    onChange={(e) => setNewGroupForm({...newGroupForm, deposited_amount: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter deposited amount"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Initial Balance (Rp)</label>
                  <input
                    type="number"
                    value={newGroupForm.balance}
                    onChange={(e) => setNewGroupForm({...newGroupForm, balance: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter initial balance (optional)"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  disabled={isLoading || !newGroupForm.group_name || !newGroupForm.target_quantity || !newGroupForm.deposited_amount}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link PO Modal */}
      {showLinkPOModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Link Purchase Order to Deposit Group</h3>
              
              {availablePOs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">Tidak ada PO yang tersedia untuk di-link</p>
                  <p className="text-sm text-gray-400">Semua PO mungkin sudah terhubung dengan deposit group lain</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pilih
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PO Number
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Qty
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remaining Qty
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availablePOs.map((po) => (
                        <tr key={po.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input
                              type="radio"
                              name="selectedPO"
                              checked={selectedPOId === po.id}
                              onChange={() => setSelectedPOId(po.id)}
                              className="h-4 w-4 text-blue-600"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {po.po_number}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {po.customer_name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {po.total_quantity.toLocaleString('id-ID')} {getUnitDisplay(po.unit)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {po.remaining_quantity.toLocaleString('id-ID')} {getUnitDisplay(po.unit)}
                          </td>
                          <td className="px-4 py-2">
                            {getStatusBadge(po.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  {selectedPOId ? '1 PO selected' : 'No PO selected'}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowLinkPOModal(false);
                      setSelectedPOId(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={linkPOToGroup}
                    disabled={isLoading || !selectedPOId}
                    className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {isLoading ? 'Linking...' : 'Link PO'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add DOs Modal */}
      {showAddDOModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Delivery Orders to Group</h3>
              
              {availableDOs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">Tidak ada DO yang tersedia untuk ditambahkan</p>
                  <p className="text-sm text-gray-400">Semua DO mungkin sudah dimasukkan ke dalam group atau sudah lunas</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pilih
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          DO Number
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availableDOs.map((doItem) => (
                        <tr key={doItem.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selectedDOs.includes(doItem.id)}
                              onChange={() => toggleDOSelection(doItem.id)}
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {doItem.do_number}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {doItem.customer_name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {doItem.minimal_load_quantity.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {formatCurrency(doItem.final_amount || doItem.total_amount)}
                          </td>
                          <td className="px-4 py-2">
                            {getStatusBadge(doItem.payment_status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  {selectedDOs.length} DO(s) selected
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowAddDOModal(false);
                      setSelectedDOs([]);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addDOsToGroup}
                    disabled={isLoading || selectedDOs.length === 0}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {isLoading ? 'Adding...' : `Add ${selectedDOs.length} DO(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositGroupManagement;
