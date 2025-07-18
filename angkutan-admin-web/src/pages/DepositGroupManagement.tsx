// src/pages/DepositGroupManagementPage.tsx
import React, { useState, useEffect } from 'react';
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
  deliveryOrder: {
    id: number;
    do_number: string;
    customer_name: string;
    final_amount: number;
    total_amount?: number; // <-- add this line
    payment_status: string;
    paid_amount: number;
    unpaid_amount: number;
  };
}

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

  // Calculate totals for the group
const totalTagihan = groupMembers.reduce((sum, m) => {
  const amt = Number(m.deliveryOrder.final_amount ?? m.deliveryOrder.total_amount ?? 0);
  return sum + amt;
}, 0);
const totalDibayar = groupMembers.reduce((sum, m) => sum + (m.deliveryOrder.paid_amount || 0), 0);
const totalBelumDibayar = groupMembers.reduce((sum, m) => sum + ((m.deliveryOrder.final_amount || 0) - (m.deliveryOrder.paid_amount || 0)), 0);

// Calculate residual saldo (saldo - total dibayar)
const residualSaldo = selectedGroup
  ? selectedGroup.balance - totalDibayar
  : 0;

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

  const fetchAvailableDOs = async () => {
    try {
      const response = await apiClient.get('/delivery-orders?payment_status=awaiting_confirmation');
      setAvailableDOs(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch available DOs:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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
        delivery_order_ids: selectedDOs
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
    await fetchAvailableDOs();
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tambahkan Delivery Order
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetchAvailableDOs();
                      setSelectedDOs([]);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-left text-gray-500"
                  >
                    {selectedDOs.length > 0 
                      ? `${selectedDOs.length} DO dipilih` 
                      : "Pilih DO untuk ditambahkan"}
                  </button>
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
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={!formData.group_name || !formData.balance}
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
                  <button
                    onClick={openAddDoModal}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    + Tambah DO
                  </button>
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
                        {groupMembers.map((member) => (
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(member.deliveryOrder.final_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                              {formatCurrency(member.deliveryOrder.paid_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                              {formatCurrency(
                                (member.deliveryOrder.final_amount ?? member.deliveryOrder.total_amount ?? 0)
                                - (member.deliveryOrder.paid_amount ?? 0)
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
                              <Link
                                to={`/delivery-orders/${member.deliveryOrder.id}/payments`}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                                target="_blank"
                              >
                                Bayar
                              </Link>
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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
    </div>
  );
};

export default DepositGroupManagementPage;