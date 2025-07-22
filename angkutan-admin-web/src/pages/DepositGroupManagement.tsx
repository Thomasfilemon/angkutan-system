// src/pages/DepositGroupManagementPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import { toast } from 'react-toastify';

interface DepositGroup {
  id: number;
  group_name: string;
  balance: number;
  created_at: string;
  updated_at: string;
  status: string; // 'butuh bayar', 'extra saldo', 'normal'
}

interface GroupMember {
  id: number;
  group_id: number;
  delivery_order_id: number;
  quantity: number;
  deliveryOrder: {
    id: number;
    do_number: string;
    customer_name: string;
    final_amount: number;
    total_amount?: number;
    payment_status: string;
    paid_amount: number;
    minimal_load_quantity: number;
    unit_price: number;
    actual_load_quantity?: number;
    // Add payment ID reference
    payment_id?: number; // ADD THIS
  };
}

// Add this above your component
interface ExtraCharge {
  memberId: number;
  doId: number;
  doNumber: string;
  customer: string;
  minQty: number;
  currentQty: number;
  extraQuantity: number;
  unitPrice: number;
  extraAmount: number;
  isPaid: boolean;
  paymentId?: number;
}

// Move this outside your component
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Then delete the duplicate inside your component

const DepositGroupManagementPage = () => {
  const [groups, setGroups] = useState<DepositGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DepositGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddDoModal, setShowAddDoModal] = useState(false);
  const [availableDOs, setAvailableDOs] = useState<any[]>([]);
  const [selectedDOs, setSelectedDOs] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    group_name: '',
    balance: '',
  });
  const [availablePOs, setAvailablePOs] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null);
  const [editingQuantities, setEditingQuantities] = useState<Record<number, number>>({});
  // At the top of your component
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedExtraCharge, setSelectedExtraCharge] = useState<ExtraCharge | null>(null);

  useEffect(() => {
    if (showDetailModal && selectedGroup && groupMembers.length > 0) {
      const initialQuantities = groupMembers.reduce((acc, member) => {
        acc[member.id] = member.quantity;
        return acc;
      }, {} as Record<number, number>);
      setEditingQuantities(initialQuantities);
    }
  }, [groupMembers, showDetailModal, selectedGroup]);

  const handlePayExtra = async (memberId: number, extraAmount: number) => {
    try {
      const response = await apiClient.post(
        `/deposit-groups/members/${memberId}/pay-extra`
      );
      
      if (response.data.success) {
        toast.success(`Extra charge paid: ${formatCurrency(extraAmount)}`);
        if (selectedGroup) {
          fetchGroupDetails(selectedGroup.id);
        }
      }
    } catch (err) {
      toast.error('Failed to pay extra charge');
      console.error(err);
    }
  };

  // Inside DepositGroupManagementPage component
  const extraCharges = useMemo(() => {
    if (!groupMembers || groupMembers.length === 0) return [];

    return groupMembers
      .filter(member => {
        const minQty = member.deliveryOrder.minimal_load_quantity;
        const currentQty = member.quantity;
        return currentQty > minQty;
      })
      .map(member => {
        const doItem = member.deliveryOrder;
        const minQty = doItem.minimal_load_quantity;
        const currentQty = member.quantity;
        const extraQuantity = currentQty - minQty;
        const unitPrice = doItem.unit_price;
        const extraAmount = extraQuantity * unitPrice;
        
        // Check if extra is paid
        const totalAmount = minQty * unitPrice + extraAmount;
        const isPaid = doItem.paid_amount >= totalAmount;

        return {
          memberId: member.id,
          doId: doItem.id,
          doNumber: doItem.do_number,
          customer: doItem.customer_name,
          minQty,
          currentQty,
          extraQuantity,
          unitPrice,
          extraAmount,
          isPaid,
          paymentId: doItem.payment_id // Use the payment_id from deliveryOrder
        };
      });
  }, [groupMembers]);

  const handleQuantityInputChange = (memberId: number, value: number) => {
    setEditingQuantities(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleFinalizeQuantity = async (memberId: number, doId: number) => {
    const newQuantity = editingQuantities[memberId];
    const member = groupMembers.find(m => m.id === memberId);
    
    if (!member || newQuantity === undefined) return;
    
    try {
      await apiClient.put(`/deposit-groups/members/${memberId}`, {
        quantity: newQuantity
      });
      
      toast.success('Quantity updated');
      if (selectedGroup) fetchGroupDetails(selectedGroup.id);
    } catch (err) {
      toast.error('Failed to update quantity');
      console.error(err);
    }
  };

  // src/pages/DepositGroupManagementPage.tsx
  const cleanNumber = (value: string | number): number => {
    if (typeof value === "string") {
      // Only handle European format with ',' as decimal
      if (value.includes(',') && !value.includes('.')) {
        const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
        return parseFloat(cleaned) || 0;
      }

      // If it already uses dot as decimal, just parse it
      return parseFloat(value) || 0;
    }
    return Number(value) || 0;
  };

  // Use cleanNumber in all calculations
  // Update these calculations:
  // Replace your current calculations with these:
  const totalTagihan = groupMembers.reduce((sum, member) => {
    return sum + (member.deliveryOrder.unit_price * member.quantity);
  }, 0);

  const totalDibayar = groupMembers.reduce((sum, m) => {
    return sum + m.deliveryOrder.paid_amount;
  }, 0);

  const totalBelumDibayar = totalTagihan - totalDibayar;

  const residualSaldo = selectedGroup ? selectedGroup.balance - totalDibayar : 0;

  const totalExtraCharges = extraCharges.reduce((sum, charge) => sum + charge.extraAmount, 0);

  const [loadingPOs, setLoadingPOs] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/deposit-groups');
      setGroups(response.data || []);
    } catch (err) {
      setError('Failed to fetch deposit groups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId: number) => {
    try {
      const response = await apiClient.get(`/deposit-groups/${groupId}`);
      setSelectedGroup(response.data);
      setGroupMembers(response.data.members || []);
    } catch (err) {
      setError('Failed to fetch group details');
      console.error(err);
    }
  };

  const fetchAvailablePOs = async () => {
    try {
      setLoadingPOs(true);
      const response = await apiClient.get('/purchase-orders');
      // Use .data.data just like Trips.tsx
      const orders = response.data.success
        ? response.data.data
        : response.data || [];
      setAvailablePOs(orders);
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    } finally {
      setLoadingPOs(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      fetchAvailablePOs();
      // fetchAvailableDOs();
    }
  }, [showCreateModal]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      'butuh bayar': { text: 'Butuh Bayar', color: 'bg-red-100 text-red-800' },
      'extra saldo': { text: 'Extra Saldo', color: 'bg-green-100 text-green-800' },
      'normal': { text: 'Normal', color: 'bg-blue-100 text-blue-800' },
    };
    
    const statusInfo = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const handleCreateGroup = async () => {
    try {
      const payload = {
        group_name: formData.group_name,
        balance: parseFloat(formData.balance),
        ...(selectedPOId ? { purchase_order_id: selectedPOId } : { delivery_order_ids: selectedDOs })
      };
      
      const response = await apiClient.post('/deposit-groups', payload);
      
      setGroups([...groups, response.data]);
      setShowCreateModal(false);
      resetForm();
      toast.success('Group created successfully');
    } catch (err) {
      console.error('Error creating group:', err);
      toast.error('Failed to create group');
    }
  };

  const handleAddDOToGroup = async () => {
    if (!selectedGroup || selectedDOs.length === 0) return;
    
    try {
      await Promise.all(selectedDOs.map(doId => 
        apiClient.post('/deposit-groups/members', {
          group_id: selectedGroup.id,
          delivery_order_id: doId
        }))
      );
      
      fetchGroupDetails(selectedGroup.id);
      setShowAddDoModal(false);
      setSelectedDOs([]);
      toast.success('DOs added to group successfully');
    } catch (err) {
      console.error('Error adding DOs to group:', err);
      toast.error('Failed to add DOs to group');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!window.confirm('Are you sure you want to remove this DO from the group?')) return;
    
    try {
      await apiClient.delete(`/deposit-groups/members/${memberId}`);
      
      if (selectedGroup) {
        fetchGroupDetails(selectedGroup.id);
      }
      toast.success('DO removed from group');
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error('Failed to remove DO from group');
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      const payload = {
        group_name: formData.group_name || selectedGroup.group_name,
        balance: parseFloat(formData.balance) || selectedGroup.balance
      };
      
      const response = await apiClient.put(`/deposit-groups/${selectedGroup.id}`, payload);
      
      // Update in groups list
      setGroups(groups.map(g => g.id === selectedGroup.id ? response.data : g));
      
      // Update in selected group
      setSelectedGroup(response.data);
      
      toast.success('Group updated successfully');
    } catch (err) {
      console.error('Error updating group:', err);
      toast.error('Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!window.confirm('Are you sure you want to delete this group and all its DOs?')) return;
    
    try {
      await apiClient.delete(`/deposit-groups/${groupId}`);
      setGroups(groups.filter(g => g.id !== groupId));
      
      if (selectedGroup && selectedGroup.id === groupId) {
        setShowDetailModal(false);
        setSelectedGroup(null);
      }
      
      toast.success('Group deleted successfully');
    } catch (err) {
      console.error('Error deleting group:', err);
      toast.error('Failed to delete group');
    }
  };

  const handlePOSelect = async (poId: number | null) => {
    // Reset state if no PO is selected
    if (!poId) {
      setSelectedDOs([]);
      setAvailableDOs([]);
      return;
    }

    try {
      // Fetch PO data from the API
      const response = await apiClient.get(`/purchase-orders/${poId}`);
      console.log('PO Response:', response.data);

      // Access the PO data
      const poData = response.data.data;

      // Extract poDeliveryOrders, default to empty array if missing
      const poDeliveryOrders = poData.poDeliveryOrders || [];
      
      if (poDeliveryOrders.length === 0) {
        console.warn('No Delivery Orders found for this PO');
        setAvailableDOs([]);
        setSelectedDOs([]);
        return;
      }

      // Optionally filter DOs (e.g., exclude completed ones if status is available)
      const availableDOs = poDeliveryOrders.filter((doItem: any) => {
        // If 'status' field exists, adjust this logic based on your DO statuses
        return doItem.status ? !['completed', 'cancelled'].includes(doItem.status) : true;
      });

      // Update state with parsed DOs
      setAvailableDOs(availableDOs);
      setSelectedDOs(availableDOs.map((doItem: any) => doItem.id));
    } catch (err) {
      console.error('Failed to fetch PO data:', err);
      toast.error('Failed to load Delivery Orders');
    }
  };

  const resetForm = () => {
    setFormData({
      group_name: '',
      balance: '',
    });
    setSelectedDOs([]);
  };

  const openDetailModal = (group: DepositGroup) => {
    setSelectedGroup(group);
    setFormData({
      group_name: group.group_name,
      balance: group.balance.toString()
    });
    fetchGroupDetails(group.id);
    setShowDetailModal(true);
  };

  const openAddDoModal = async () => {
    // await fetchAvailableDOs();
    setShowAddDoModal(true);
  };

  const toggleDOSelection = (doId: number) => {
    setSelectedDOs(prev => 
      prev.includes(doId) 
        ? prev.filter(id => id !== doId) 
        : [...prev, doId]
    );
  };

  if (loading) return <div className="text-center p-8">Loading deposit groups...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Deposit Group</h1>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          + Buat Group Baru
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Groups Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dibuat
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groups.map((group) => (
                <tr 
                  key={group.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetailModal(group)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {group.group_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(group.balance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getStatusBadge(group.status || 'normal')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(group.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailModal(group);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Detail
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td className="px-6 py-2 font-bold text-right" colSpan={2}>TOTAL</td>
                <td className="px-6 py-2 font-bold text-blue-700">{formatCurrency(totalTagihan)}</td>
                <td className="px-6 py-2 font-bold text-green-700">{formatCurrency(totalDibayar)}</td>
                <td className="px-6 py-2 font-bold text-red-700">{formatCurrency(totalBelumDibayar)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {groups.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum Ada Deposit Group</h3>
            <p className="text-gray-500 mb-4">
              Mulai dengan membuat group deposit pertama Anda untuk mengelola saldo DO.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Buat Group Baru
            </button>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Buat Deposit Group Baru</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Group *</label>
                  <input
                    type="text"
                    value={formData.group_name}
                    onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Nama group"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal *</label>
                  <input
                    type="number"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Purchase Order</label>
                  {loadingPOs ? (
                    <div className="text-center py-2 text-gray-500">Memuat PO...</div>
                  ) : (
                    <select
                      value={selectedPOId ?? ''}
                      onChange={e => handlePOSelect(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">-- Pilih PO --</option>
                      {availablePOs.length === 0 ? (
                        <option disabled>Tidak ada PO tersedia</option>
                      ) : (
                        availablePOs.map(po => (
                          <option key={po.id} value={po.id}>
                            {po.po_number} - {po.customer_name}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Atau Pilih Delivery Order Manual
                  </label>
                  {selectedPOId ? (
                    <div className="max-h-40 overflow-y-auto border rounded">
                      {availableDOs.length > 0 ? (
                        availableDOs.map(doItem => (
                          <div key={doItem.id} className="flex items-center px-2 py-1">
                            <input
                              type="checkbox"
                              checked={true} // Auto-selected
                              disabled // Read-only since PO is selected
                            />
                            <span className="ml-2">
                              {doItem.do_number} - {doItem.customer_name} (
                              {formatCurrency(doItem.final_amount || doItem.total_amount || 0)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 italic">No Delivery Orders available for this PO</div>
                      )}
                    </div>
                  ) : availableDOs.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">
                      Tidak ada DO yang tersedia
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto border rounded">
                      {availableDOs.map(doItem => (
                        <div key={doItem.id} className="flex items-center px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedDOs.includes(doItem.id)}
                            onChange={() => toggleDOSelection(doItem.id)}
                          />
                          <span className="ml-2">
                            {doItem.do_number} - {doItem.customer_name} (
                            {formatCurrency(doItem.final_amount || doItem.total_amount || 0)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Batal
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={!formData.group_name || !formData.balance || (selectedPOId === null && selectedDOs.length === 0)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Group Detail Modal */}
      {showDetailModal && selectedGroup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 lg:w-3/4 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedGroup.group_name}</h3>
                  <p className="text-lg font-semibold">
                    Saldo: <span className="text-blue-600">{formatCurrency(selectedGroup.balance)}</span>
                  </p>
                  <div className="mt-1">
                    {getStatusBadge(selectedGroup.status || 'normal')}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {/* <button
                    onClick={openAddDoModal}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    + Tambah DO
                  </button> */}
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold mb-3">Ringkasan Group</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Total Tagihan</div>
                    <div className="font-bold text-blue-700">{formatCurrency(totalTagihan)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Dibayar</div>
                    <div className="font-bold text-green-700">{formatCurrency(totalDibayar)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Extra</div>
                    <div className="font-bold text-purple-600">{formatCurrency(totalExtraCharges)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Belum Dibayar</div>
                    <div className="font-bold text-red-700">{formatCurrency(totalBelumDibayar)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Saldo Residual</div>
                    <div className="font-bold text-purple-700">{formatCurrency(residualSaldo)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold mb-3">Edit Group</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Group</label>
                    <input
                      type="text"
                      value={formData.group_name}
                      onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saldo</label>
                    <input
                      type="number"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleUpdateGroup}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Update Group
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-3">Delivery Orders dalam Group</h4>
                
                {groupMembers.length === 0 ? (
                  // ...existing empty state...
                  <div className="text-center py-6 text-gray-500">
                    <p>Tidak ada DO dalam group ini</p>
                    <button
                      onClick={openAddDoModal}
                      className="mt-3 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Tambah DO
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            DO Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Min Qty
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dibayar
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Belum Dibayar
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupMembers.map((member) => {
                          const doItem = member.deliveryOrder;
                          return (
                          <tr key={member.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                              <Link 
                                to={`/delivery-orders/${member.deliveryOrder.id}`}
                                className="hover:underline"
                                target="_blank"
                              >
                                {member.deliveryOrder.do_number}
                              </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {member.deliveryOrder.customer_name}
                            </td>
                            <td>{formatCurrency(member.deliveryOrder.unit_price * member.quantity)}</td>
                            {/* Add Minimal Qty cell */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {doItem.minimal_load_quantity} {/* Display minimal quantity */}
                            </td>
                            {/* New Quantity Column */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editingQuantities[member.id] || member.quantity}
                                  onChange={(e) => handleQuantityInputChange(
                                    member.id,
                                    parseFloat(e.target.value) || 0
                                  )}
                                  className="w-24 px-2 py-1 border rounded mr-2"
                                />
                                <button
                                  onClick={() => handleFinalizeQuantity(member.id, doItem.id)}
                                  className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded"
                                >
                                  Finalize
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {doItem.unit_price} {/* Display minimal quantity */}
                            </td>
                            <td>{formatCurrency(member.deliveryOrder.paid_amount)}</td>
                            <td>
                              {formatCurrency(
                                (member.deliveryOrder.unit_price * member.quantity) - 
                                member.deliveryOrder.paid_amount
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                member.deliveryOrder.payment_status === 'lunas' 
                                  ? 'bg-green-100 text-green-800'
                                  : member.deliveryOrder.payment_status === 'deposit'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {member.deliveryOrder.payment_status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                              {/* <Link
                                to={`/delivery-orders/${member.deliveryOrder.id}/payments`}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                                target="_blank"
                              >
                                Bayar
                              </Link> */}
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Hapus
                              </button>
                              {/* NEW: Finalize Price Button */}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Total Summary */}
                    <div className="mt-4 p-4 bg-gray-50 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total Tagihan:</span>
                        <span className="text-lg font-bold text-blue-700">
                          {formatCurrency(totalTagihan)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {extraCharges.length > 0 && (
                <div className="mt-8 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      {extraCharges.length > 0 && (
                        <div className="mt-8">
                          <h4 className="text-lg font-semibold mb-3">Tagihan Extra</h4>
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  DO Number
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Customer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Minimal Qty
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Final Qty
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Extra Qty
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Unit Price
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Tagihan Extra
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {extraCharges.map((charge) => (
                                <tr key={charge.memberId}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                    {charge.doNumber}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {charge.customer}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {charge.minQty}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {charge.currentQty}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                                    +{charge.extraQuantity}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {formatCurrency(charge.unitPrice)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600">
                                    {formatCurrency(charge.extraAmount)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {charge.isPaid ? (
                                      <button
                                        onClick={() => {
                                          setSelectedExtraCharge(charge);
                                          setShowInvoiceModal(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-900"
                                      >
                                        View Invoice
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handlePayExtra(charge.memberId, charge.extraAmount)}
                                        className="bg-green-500 hover:bg-green-700 text-white text-xs py-1 px-2 rounded"
                                      >
                                        Pay
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {/* Total row */}
                              <tr className="bg-gray-50">
                                <td 
                                  colSpan={6} 
                                  className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right"
                                >
                                  Total Tagihan Extra:
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-700">
                                  {formatCurrency(
                                    extraCharges.reduce((sum, charge) => sum + charge.extraAmount, 0)
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <div>
                  <button
                    onClick={() => handleDeleteGroup(selectedGroup.id)}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Hapus Group
                  </button>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add DO to Group Modal */}
      {showAddDoModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 lg:w-3/4 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Tambahkan DO ke Group: {selectedGroup?.group_name}
                </h3>
                <button
                  onClick={() => setShowAddDoModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {availableDOs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>Tidak ada DO yang tersedia untuk ditambahkan</p>
                  <p className="text-sm mt-2">
                    Semua DO mungkin sudah dimasukkan ke dalam group atau sudah lunas
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pilih
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          DO Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availableDOs.map((doItem) => (
                        <tr key={doItem.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedDOs.includes(doItem.id)}
                              onChange={() => toggleDOSelection(doItem.id)}
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {doItem.do_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doItem.customer_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(doItem.final_amount || doItem.total_amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              doItem.payment_status === 'lunas' 
                                ? 'bg-green-100 text-green-800'
                                : doItem.payment_status === 'deposit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {doItem.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddDoModal(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Batal
                </button>
                <button
                  onClick={handleAddDOToGroup}
                  disabled={selectedDOs.length === 0}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  Tambahkan {selectedDOs.length} DO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showInvoiceModal && selectedExtraCharge && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-xl font-bold">Extra Charge Invoice</h3>
              <button 
                onClick={() => setShowInvoiceModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <InvoiceViewer extraCharge={selectedExtraCharge} />
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => window.print()}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
              >
                Print
              </button>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InvoiceViewer: React.FC<{ extraCharge: ExtraCharge }> = ({ extraCharge }) => {
  // Calculate totals
  const minimalAmount = extraCharge.minQty * extraCharge.unitPrice;
  const totalAmount = minimalAmount + extraCharge.extraAmount;

  return (
    <div className="invoice-container p-4 bg-white">
      <div className="invoice-header border-b pb-4 mb-4">
        <div className="flex justify-between">
          <div>
            <h2 className="text-2xl font-bold">INVOICE EXTRA CHARGE</h2>
            <p className="text-gray-500">
              No: EXTRA-{extraCharge.doNumber}-{new Date().getTime()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">PT Angkutan Kodo</p>
            <p className="text-sm">Jl. Contoh No. 123, Jakarta</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h4 className="font-semibold">Bill To:</h4>
          <p>{extraCharge.customer}</p>
        </div>
        <div className="text-right">
          <p><span className="font-semibold">Date:</span> {new Date().toLocaleDateString('id-ID')}</p>
          <p><span className="font-semibold">DO Number:</span> {extraCharge.doNumber}</p>
        </div>
      </div>
      
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2 border">Description</th>
            <th className="text-center p-2 border">Quantity</th>
            <th className="text-center p-2 border">Unit Price</th>
            <th className="text-right p-2 border">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 border">Minimal Load Quantity</td>
            <td className="p-2 border text-center">{extraCharge.minQty}</td>
            <td className="p-2 border text-center">{formatCurrency(extraCharge.unitPrice)}</td>
            <td className="p-2 border text-right">{formatCurrency(minimalAmount)}</td>
          </tr>
          <tr>
            <td className="p-2 border">Extra Quantity</td>
            <td className="p-2 border text-center">+{extraCharge.extraQuantity}</td>
            <td className="p-2 border text-center">{formatCurrency(extraCharge.unitPrice)}</td>
            <td className="p-2 border text-right">{formatCurrency(extraCharge.extraAmount)}</td>
          </tr>
          <tr className="font-semibold bg-gray-50">
            <td className="p-2 border" colSpan={3}>TOTAL</td>
            <td className="p-2 border text-right">{formatCurrency(totalAmount)}</td>
          </tr>
        </tbody>
      </table>
      
      <div className="text-center mt-8">
        <div className="inline-block border-t-2 border-black pt-4">
          <p>Received By:</p>
          <p className="mt-8">(__________________________)</p>
          <p className="text-sm mt-2">Signature</p>
        </div>
      </div>
    </div>
  );
};

export default DepositGroupManagementPage;