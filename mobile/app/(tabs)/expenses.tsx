// app/(tabs)/expenses.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

interface Expense {
  id: number;
  trip_id: number;
  jenis: string;
  amount: number;
  receipt_url?: string;
  created_at: string;
}

interface Trip {
  id: number;
  status: string;
}

export default function ExpensesScreen() {
  const { user, token } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    jenis: 'BBM',
    amount: '',
    receipt_url: '',
  });

  const API_BASE_URL = 'https://localhost:3000/api';
  const expenseTypes = ['BBM', 'Tol', 'Parkir', 'Lainnya'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Get active trip
      const tripsResponse = await axios.get(
        `${API_BASE_URL}/trips?driver_id=${user?.id}&status=on_progress,otw,perjalanan_pulang`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (tripsResponse.data.length > 0) {
        const trip = tripsResponse.data[0];
        setActiveTrip(trip);

        // Get expenses for active trip
        const expensesResponse = await axios.get(
          `${API_BASE_URL}/driver-expenses?trip_id=${trip.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setExpenses(expensesResponse.data);
      } else {
        // Get all expenses for driver if no active trip
        const expensesResponse = await axios.get(
          `${API_BASE_URL}/driver-expenses?driver_id=${user?.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setExpenses(expensesResponse.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to fetch expenses');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll permission is required to upload receipts');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setExpenseForm(prev => ({ ...prev, receipt_url: result.assets[0].uri }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setExpenseForm(prev => ({ ...prev, receipt_url: result.assets[0].uri }));
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add a receipt',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitExpense = async () => {
    if (!activeTrip) {
      Alert.alert('Error', 'No active trip found');
      return;
    }

    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('trip_id', activeTrip.id.toString());
      formData.append('driver_id', user?.id?.toString() || '');
      formData.append('jenis', expenseForm.jenis);
      formData.append('amount', expenseForm.amount);

      if (expenseForm.receipt_url) {
        formData.append('receipt', {
          uri: expenseForm.receipt_url,
          type: 'image/jpeg',
          name: 'receipt.jpg',
        } as any);
      }

      await axios.post(`${API_BASE_URL}/driver-expenses`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Expense added successfully');
      setModalVisible(false);
      setExpenseForm({ jenis: 'BBM', amount: '', receipt_url: '' });
      fetchData();
    } catch (error) {
      console.error('Error submitting expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Trip Expenses</Text>
            {activeTrip && (
              <Text style={styles.tripId}>Trip #{activeTrip.id}</Text>
            )}
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.totalLabel}>Total Expenses</Text>
            <Text style={styles.totalAmount}>{formatCurrency(getTotalExpenses())}</Text>
            <Text style={styles.expenseCount}>{expenses.length} items</Text>
          </View>
        </View>

        {/* Expenses List */}
        <View style={styles.expensesList}>
          {expenses.map((expense, index) => (
            <View key={expense.id} style={[styles.expenseItem, index > 0 && styles.expenseItemBorder]}>
              <View style={styles.expenseHeader}>
                <Text style={styles.expenseType}>{expense.jenis}</Text>
                <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
              </View>
              <Text style={styles.expenseDate}>
                Trip #{expense.trip_id} - {formatDate(expense.created_at)}
              </Text>
              {expense.receipt_url && (
                <TouchableOpacity style={styles.receiptButton}>
                  <Ionicons name="image" size={16} color="#3b82f6" />
                  <Text style={styles.receiptButtonText}>View Receipt</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {expenses.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt" size={64} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No Expenses Yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first expense for this trip
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Expense Button */}
      {activeTrip && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.addButtonText}>Add New Expense</Text>
        </TouchableOpacity>
      )}

      {/* Expense Form Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type</Text>
                <View style={styles.typeSelector}>
                  {expenseTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        expenseForm.jenis === type && styles.typeOptionSelected
                      ]}
                      onPress={() => setExpenseForm(prev => ({ ...prev, jenis: type }))}
                    >
                      <Text style={[
                        styles.typeOptionText,
                        expenseForm.jenis === type && styles.typeOptionTextSelected
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={expenseForm.amount}
                  onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Receipt (Optional)</Text>
                <TouchableOpacity style={styles.imageButton} onPress={showImagePicker}>
                  <Ionicons name="camera" size={20} color="#6b7280" />
                  <Text style={styles.imageButtonText}>Take Photo</Text>
                </TouchableOpacity>
                {expenseForm.receipt_url && (
                  <Image source={{ uri: expenseForm.receipt_url }} style={styles.previewImage} />
                )}
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={submitExpense}>
                <Text style={styles.submitButtonText}>Submit Expense</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tripId: {
    fontSize: 12,
    color: '#6b7280',
  },
  summaryContent: {
    padding: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 4,
  },
  expenseCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expensesList: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 80,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expenseItem: {
    padding: 16,
  },
  expenseItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  expenseDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  receiptButtonText: {
    color: '#3b82f6',
    fontSize: 12,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  typeOptionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  typeOptionTextSelected: {
    color: 'white',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  imageButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
