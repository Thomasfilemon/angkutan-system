import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'driver',
    fullName: '',
    phone: '',
    email: '',
    address: '',
    idCardNumber: '',
    simNumber: '',
    licenseType: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const { register } = useAuth();

  const roles = [
    { label: 'Driver', value: 'driver' },
    { label: 'Admin', value: 'admin' },
  ];

  const updateFormData = (field: string, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectRole = (roleValue: string): void => {
    updateFormData('role', roleValue);
    setShowRolePicker(false);
  };

  const validateForm = (): boolean => {
    const { username, password, confirmPassword, fullName, phone, address } = formData;

    if (!username.trim() || !password.trim() || !fullName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    if (formData.role === 'driver' && !formData.idCardNumber.trim()) {
      Alert.alert('Error', 'ID Card Number is required for drivers');
      return false;
    }

    return true;
  };

  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) return;

    setIsLoading(true);
    
    const registrationData = {
      username: formData.username.trim(),
      password: formData.password,
      role: formData.role,
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      address: formData.address.trim(),
      idCardNumber: formData.idCardNumber.trim() || undefined,
      simNumber: formData.simNumber.trim() || undefined,
      licenseType: formData.licenseType.trim() || undefined,
    };

    const result = await register(registrationData);

    if (result.success) {
      Alert.alert(
        'Success',
        'Registration successful! You can now login.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } else {
      Alert.alert('Registration Failed', result.error || 'Unknown error');
    }
    setIsLoading(false);
  };

  const getRoleLabel = (value: string): string => {
    const role = roles.find(r => r.value === value);
    return role ? role.label : value;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Register</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {/* Custom Role Picker */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Role *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowRolePicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {getRoleLabel(formData.role)}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Role Selection Modal */}
          <Modal
            visible={showRolePicker}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowRolePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Role</Text>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleOption,
                      formData.role === role.value && styles.selectedRole
                    ]}
                    onPress={() => selectRole(role.value)}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      formData.role === role.value && styles.selectedRoleText
                    ]}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowRolePicker(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              value={formData.username}
              onChangeText={(value: string) => updateFormData('username', value)}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(value: string) => updateFormData('fullName', value)}
              placeholder="Enter full name"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(value: string) => updateFormData('phone', value)}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>

          {formData.role === 'admin' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value: string) => updateFormData('email', value)}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address}
              onChangeText={(value: string) => updateFormData('address', value)}
              placeholder="Enter address"
              multiline
              numberOfLines={3}
            />
          </View>

          {formData.role === 'driver' && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>ID Card Number *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.idCardNumber}
                  onChangeText={(value: string) => updateFormData('idCardNumber', value)}
                  placeholder="Enter ID card number"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>SIM Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.simNumber}
                  onChangeText={(value: string) => updateFormData('simNumber', value)}
                  placeholder="Enter SIM number"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>License Type</Text>
                <TextInput
                  style={styles.input}
                  value={formData.licenseType}
                  onChangeText={(value: string) => updateFormData('licenseType', value)}
                  placeholder="e.g., SIM B1"
                />
              </View>
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(value: string) => updateFormData('password', value)}
              placeholder="Enter password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              value={formData.confirmPassword}
              onChangeText={(value: string) => updateFormData('confirmPassword', value)}
              placeholder="Confirm password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Registering...' : 'Register'}
            </Text>
          </TouchableOpacity>

          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Login here
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  roleOption: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  selectedRole: {
    backgroundColor: '#007AFF',
  },
  roleOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  selectedRoleText: {
    color: 'white',
    fontWeight: '600',
  },
  cancelButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#ff4444',
    marginTop: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    textAlign: 'center',
    color: 'white',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  linkText: {
    color: '#666',
  },
  link: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
