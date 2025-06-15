import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Button, Alert, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

// --- CHANGE 1: Import your new apiClient and remove unused imports ---
import apiClient from '../../src/services/api'; // Adjust the path if necessary

// Interfaces for type safety (no changes needed here)
interface Expense {
  id: number;
  delivery_order_id: number | null;
  driver_id: number;
  jenis: string;
  amount: number;
  receipt_url: string | null;
  created_at: string;
}

interface ExpenseForm {
  jenis: string;
  amount: string;
  receipt_url: string;
  receipt_file?: ImagePicker.ImagePickerAsset;
}

const ExpensesScreen = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    jenis: 'BBM',
    amount: '',
    receipt_url: '',
  });

  const fetchData = async () => {
    try {
      // --- CHANGE 2: Simplify the API call using apiClient ---
      // No need to get token or set headers manually. The URL is now relative.
      const response = await apiClient.get('/driver-expenses');

      if (Array.isArray(response.data)) {
        setExpenses(response.data);
      } else {
        console.error("API did not return an array for expenses:", response.data);
        setExpenses([]);
      }
    } catch (error) {
      // The interceptor will handle token errors, which will likely result in a 401/403
      console.error('Failed to fetch expenses:', error);
      Alert.alert('Error', 'Failed to fetch expenses. Please try logging in again.');
    } finally {
      setLoading(false);
    }
  };
  
  // useFocusEffect and other state logic remains the same
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [])
  );

  const handleInputChange = (name: keyof ExpenseForm, value: string) => {
    setExpenseForm(prev => ({ ...prev, [name]: value }));
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setExpenseForm(prev => ({
        ...prev,
        receipt_url: result.assets[0].uri,
        receipt_file: result.assets[0],
      }));
    }
  };

  const submitExpense = async () => {
    if (!expenseForm.amount) {
      Alert.alert('Validation Error', 'Amount is required.');
      return;
    }

    const formData = new FormData();
    formData.append('jenis', expenseForm.jenis);
    formData.append('amount', expenseForm.amount);
    
    if (expenseForm.receipt_file) {
      const uriParts = expenseForm.receipt_file.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      formData.append('receipt', {
        uri: expenseForm.receipt_file.uri,
        name: `receipt-${Date.now()}.${fileType}`,
        type: `image/${fileType}`,
      } as any);
    }

    try {
      // --- CHANGE 3: Simplify the POST request ---
      // No need for token. Override Content-Type for file upload.
      const response = await apiClient.post('/driver-expenses', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const newExpense = response.data;
      setExpenses(prevExpenses => [...prevExpenses, newExpense]);
      
      Alert.alert('Success', 'Expense added successfully');
      setModalVisible(false);
      setExpenseForm({ jenis: 'BBM', amount: '', receipt_url: '' });
      
    } catch (error) {
      console.error('Failed to add expense:', error);
      Alert.alert('Error', 'Failed to add expense.');
    }
  };

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + Number(expense.amount), 0);
  };
  
  // The rest of the component (render functions and styles) remains unchanged.
  // ... (renderExpense, JSX, and styles are exactly the same as before) ...
  const renderExpense = ({ item }: { item: Expense }) => (
    <View style={styles.expenseItem}>
      <View>
        <Text style={styles.expenseType}>{item.jenis}</Text>
        <Text style={styles.expenseDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.expenseAmount}>Rp {Number(item.amount).toLocaleString()}</Text>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.totalTitle}>Total Expenses</Text>
        <Text style={styles.totalAmount}>Rp {getTotalExpenses().toLocaleString()}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.addButtonText}>+ Add Expense</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpense}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={<Text style={styles.emptyText}>No expenses recorded yet.</Text>}
        contentContainerStyle={styles.list}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Add New Expense</Text>
            <TextInput
              style={styles.input}
              placeholder="Type (e.g., BBM, Tol)"
              value={expenseForm.jenis}
              onChangeText={val => handleInputChange('jenis', val)}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              value={expenseForm.amount}
              onChangeText={val => handleInputChange('amount', val)}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              <Text style={styles.imagePickerText}>Select Receipt Image</Text>
            </TouchableOpacity>
            {expenseForm.receipt_url && (
              <Image source={{ uri: expenseForm.receipt_url }} style={styles.receiptImage} />
            )}
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} color="#ff6347" />
              <Button title="Submit" onPress={submitExpense} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f7' },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalTitle: { fontSize: 16, color: '#666' },
  totalAmount: { fontSize: 32, fontWeight: 'bold', color: '#1a237e', marginVertical: 5 },
  addButton: { backgroundColor: '#1e88e5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginTop: 10 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  list: { padding: 10 },
  expenseItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseType: { fontSize: 16, fontWeight: 'bold' },
  expenseDate: { fontSize: 12, color: '#888' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#43a047' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#666' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  imagePicker: { backgroundColor: '#e0e0e0', padding: 10, borderRadius: 5, width: '100%', alignItems: 'center', marginBottom: 10 },
  imagePickerText: { color: '#333' },
  receiptImage: { width: 100, height: 100, borderRadius: 5, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
});

export default ExpensesScreen;
