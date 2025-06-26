// app/(auth)/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import * as Notifications from 'expo-notifications';

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    username: "",
    password: "",
  });

  const { signIn } = useAuth();
  const router = useRouter();

  const validateFields = () => {
    const errors = { username: "", password: "" };
    let isValid = true;

    if (!username.trim()) {
      errors.username = "Username tidak boleh kosong";
      isValid = false;
    }

    if (!password.trim()) {
      errors.password = "Password tidak boleh kosong";
      isValid = false;
    } else if (password.length < 3) {
      errors.password = "Password minimal 3 karakter";
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleLogin = async () => {
    // Clear previous errors
    setErrorMessage("");
    setFieldErrors({ username: "", password: "" });

    if (!validateFields()) return;

    setIsLoading(true);

    try {
      console.log("🔄 Attempting login with:", { username: username.trim() });

      // --- GET EXPO PUSH TOKEN ---
      const { status: permissionStatus } = await Notifications.requestPermissionsAsync();
      let expoPushToken = null;

      if (permissionStatus === 'granted') {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        expoPushToken = tokenData.data;
      }

      // --- LOGIN + SEND PUSH TOKEN TO BACKEND ---
      const result = await signIn(username.trim(), password);

      console.log("📥 Login result:", result);

      if (result.success && result.user) {
        console.log("✅ Login successful, user role:", result.user.role);

        if (result.user.role === "admin" || result.user.role === "owner") {
          router.replace("/(admin)");
        } else if (result.user.role === "driver") {
          router.replace("/(tabs)");
        }
      } else {
        setErrorMessage(result.error || "Login failed.");
      }
    } catch (error: any) {
      console.error("💥 Login exception:", error);
      setErrorMessage("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setErrorMessage("");
    setFieldErrors({ username: "", password: "" });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.loginContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>Angkutan System</Text>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <FontAwesome5
                name="exclamation-circle"
                size={16}
                color="#dc2626"
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={clearError}
                style={styles.clearErrorButton}
              >
                <FontAwesome5 name="times" size={14} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {/* Username Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View
                style={[
                  styles.inputContainer,
                  fieldErrors.username ? styles.inputError : null,
                  username ? styles.inputFilled : null,
                ]}
              >
                <FontAwesome5
                  name="user"
                  size={16}
                  color={fieldErrors.username ? "#dc2626" : "#6b7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (fieldErrors.username) {
                      setFieldErrors((prev) => ({ ...prev, username: "" }));
                    }
                    if (errorMessage) clearError();
                  }}
                  placeholder="Masukkan username"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {fieldErrors.username ? (
                <Text style={styles.fieldErrorText}>
                  {fieldErrors.username}
                </Text>
              ) : null}
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  fieldErrors.password ? styles.inputError : null,
                  password ? styles.inputFilled : null,
                ]}
              >
                <FontAwesome5
                  name="lock"
                  size={16}
                  color={fieldErrors.password ? "#dc2626" : "#6b7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: "" }));
                    }
                    if (errorMessage) clearError();
                  }}
                  placeholder="Masukkan password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={isLoading}
                >
                  <FontAwesome5
                    name={showPassword ? "eye-slash" : "eye"}
                    size={16}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.password ? (
                <Text style={styles.fieldErrorText}>
                  {fieldErrors.password}
                </Text>
              ) : null}
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                isLoading ? styles.loginButtonDisabled : null,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.loginButtonText}>Logging in...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>
                Don&apos;t have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                <Text style={styles.registerLink}>Register here</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  loginContainer: {
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "500",
  },
  clearErrorButton: {
    padding: 4,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 12 : 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputFilled: {
    borderColor: "#3b82f6",
    backgroundColor: "#fafbff",
  },
  inputError: {
    borderColor: "#dc2626",
    backgroundColor: "#fffbfb",
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
    paddingVertical: 0, // Remove default padding
  },
  eyeButton: {
    padding: 8,
    marginLeft: 8,
  },
  fieldErrorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  loginButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  loginButtonDisabled: {
    backgroundColor: "#9ca3af",
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  registerText: {
    color: "#6b7280",
    fontSize: 14,
  },
  registerLink: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },
});
