// mobile/app/trip-detail/[id].tsx

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import LoadConfirmationModal from "../../components/LoadConfirmationModal";
import {
  getDeliveryOrderDetails,
  createDriverExpense,
  confirmLoad,
} from "../../src/services/api";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

// Interface untuk data yang akan kita terima
interface Expense {
  id: number;
  jenis: string;
  amount: string;
  receipt_url: string | null;
  created_at: string;
  notes?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  type: "load" | "unload";
}

interface DeliveryOrderDetails {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  trip_allowance: number;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  load_location: string;
  unload_location: string;
  load_latitude: string; // Add these fields
  load_longitude: string;
  unload_latitude: string;
  unload_longitude: string;
  surat_jalan_photo_url?: string;
  expenses_total: number;
  remaining_allowance: number;
  expenses: Expense[];
  status: string;
  created_at: string;
  financial_summary?: {
    trip_allowance: number;
    total_for_driver: number;
    expenses_total: number;
    remaining_allowance: number;
  };
}

interface ExpenseForm {
  jenis: string;
  amount: string;
  notes: string;
}

const TripDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<DeliveryOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // REF untuk prevent multiple calls
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  // State untuk form expense
  // Add component state here
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [showLoadConfirmation, setShowLoadConfirmation] = useState(false);
  const [submittingLoad, setSubmittingLoad] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    jenis: "",
    amount: "",
    notes: "",
  });
  const [receiptImage, setReceiptImage] = useState<any>(null);

  const expenseTypes = [
    { label: "BBM/Solar", value: "bbm" },
    { label: "Tol", value: "tol" },
    { label: "Parkir", value: "parkir" },
    { label: "Makan", value: "makan" },
    { label: "Lain-lain", value: "lainnya" },
  ];

  const fetchTripDetails = useCallback(async () => {
    if (!id || isLoadingRef.current) {
      console.log("Skipping fetch - already loading or no ID");
      return;
    }

    isLoadingRef.current = true;

    try {
      console.log(`Fetching trip details for ID: ${id}`);
      const response = await getDeliveryOrderDetails(id);

      // Check if component is still mounted
      if (mountedRef.current) {
        setTrip(response.data);
        console.log(`Trip loaded - Status: ${response.data.status}`);
      }
    } catch (error: any) {
      if (mountedRef.current) {
        console.error("Error fetching trip:", error);

        // Handle specific error types
        if (error.response?.status === 401) {
          Alert.alert("Session Expired", "Please login again.", [
            {
              text: "OK",
              onPress: () => {
                // This should be handled by interceptor, but just in case
                router.replace("/(auth)/login");
              },
            },
          ]);
        } else if (error.response?.status === 403) {
          Alert.alert(
            "Access Denied",
            "You don't have permission to view this delivery order."
          );
        } else if (error.response?.status === 404) {
          Alert.alert("Not Found", "Delivery order not found.");
        } else {
          Alert.alert(
            "Error",
            error.response?.data?.message || "Failed to load trip details."
          );
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      isLoadingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // useFocusEffect dengan proper dependency dan cleanup
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, starting fetch...");
      setLoading(true);
      fetchTripDetails();

      // Cleanup function
      return () => {
        console.log("Screen unfocused, cleaning up...");
        isLoadingRef.current = false;
      };
    }, [fetchTripDetails])
  );

  // Effect untuk cleanup saat unmount
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isLoadingRef.current = false;
    };
  }, []);

  // FUNGSI REFRESH yang di-throttle
  const onRefresh = useCallback(() => {
    if (isLoadingRef.current) {
      console.log("Refresh skipped - already loading");
      return;
    }

    setRefreshing(true);
    fetchTripDetails();
  }, [fetchTripDetails]);

  // Handle image picker
  const pickImage = async () => {
    try {
      console.log("Starting image picker..."); // Debug log

      // Request permission untuk akses media library
      // Request permission for mobile only
      if (Platform.OS !== "web") {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        console.log("Permission result:", permissionResult); // Debug log

        if (permissionResult.granted === false) {
          Alert.alert(
            "Permission Diperlukan",
            "Aplikasi memerlukan izin untuk mengakses galeri foto. Silakan berikan izin di pengaturan aplikasi.",
            [{ text: "OK" }]
          );
          return;
        }
      }

      // Launch image library dengan konfigurasi yang lebih robust
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      console.log("Image picker result:", result); // Debug log

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        console.log("Selected image:", selectedImage); // Debug log
        setReceiptImage(selectedImage);
        if (Platform.OS === "web") {
          window.alert("Foto struk berhasil dipilih!");
        } else {
          Alert.alert("Berhasil", "Foto struk berhasil dipilih!");
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      if (Platform.OS === "web") {
        window.alert("Gagal memilih gambar. Silakan coba lagi.");
      } else {
        Alert.alert("Error", "Gagal memilih gambar. Silakan coba lagi.");
      }
    }
  };

  const takePicture = async () => {
    try {
      console.log("Starting camera..."); // Debug log

      // Request permission untuk akses kamera
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();

      console.log("Camera permission result:", permissionResult); // Debug log

      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Diperlukan",
          "Aplikasi memerlukan izin untuk mengakses kamera. Silakan berikan izin di pengaturan aplikasi.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      console.log("Camera result:", result); // Debug log

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const takenImage = result.assets[0];
        console.log("Taken image:", takenImage); // Debug log
        setReceiptImage(takenImage);

        // Berikan feedback visual bahwa foto sudah diambil
        Alert.alert("Berhasil", "Foto struk berhasil diambil!");
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert(
        "Error",
        "Terjadi kesalahan saat mengambil foto. Silakan coba lagi."
      );
    }
  };

  const showImagePicker = () => {
    if (Platform.OS === "web") {
      // Untuk web, gunakan input file HTML
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement | null;
        if (target && target.files && target.files[0]) {
          const file = target.files[0];
          setReceiptImage({
            uri: URL.createObjectURL(file),
            fileName: file.name,
            type: file.type,
          });
          Alert.alert("Berhasil", "Foto struk berhasil dipilih!");
        }
      };
      input.click();
    } else {
      Alert.alert(
        "Pilih Foto Struk",
        "Bagaimana cara Anda ingin menambahkan foto?",
        [
          { text: "Kamera", onPress: takePicture },
          { text: "Galeri", onPress: pickImage },
          { text: "Batal", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  };

  const getNavigationTarget = (): LocationData | null => {
    if (!trip) return null;

    const loadLat = parseFloat(trip.load_latitude);
    const loadLng = parseFloat(trip.load_longitude);
    const unloadLat = parseFloat(trip.unload_latitude);
    const unloadLng = parseFloat(trip.unload_longitude);

    // Smart routing based on DO status
    switch (trip.status) {
      case "assigned":
      case "otw_to_load_location":
        return {
          latitude: loadLat,
          longitude: loadLng,
          address: trip.load_location,
          type: "load",
        };
      case "at_load_location":
        // Show both locations but prioritize unload for navigation
        return {
          latitude: unloadLat,
          longitude: unloadLng,
          address: trip.unload_location,
          type: "unload",
        };
      case "otw_to_unload_location":
      case "at_unload_location":
        return {
          latitude: unloadLat,
          longitude: unloadLng,
          address: trip.unload_location,
          type: "unload",
        };
      default:
        return null;
    }
  };

  const handleBack = () => {
    try {
      // Check if we can go back
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback: navigate to driver dashboard
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.log("Back navigation failed, using fallback Error: ", error);
      // Ultimate fallback
      router.replace("/(tabs)");
    }
  };

  const handleOpenMap = () => {
    if (!trip) return;

    router.push({
      pathname: "/trip-map-view",
      params: {
        doId: trip.id.toString(),
        loadLat: trip.load_latitude,
        loadLng: trip.load_longitude,
        loadAddress: trip.load_location,
        unloadLat: trip.unload_latitude,
        unloadLng: trip.unload_longitude,
        unloadAddress: trip.unload_location,
        status: trip.status,
        doNumber: trip.do_number,
      },
    });
  };

  const handleNavigate = async (app: "google" | "waze") => {
    const target = getNavigationTarget();
    if (!target) {
      Alert.alert("Error", "No navigation target available");
      return;
    }

    let url = "";

    if (app === "google") {
      if (Platform.OS === "ios") {
        url = `http://maps.apple.com/?q=${target.latitude},${target.longitude}`;
      } else {
        url = `geo:${target.latitude},${target.longitude}?q=${
          target.latitude
        },${target.longitude}(${
          target.type === "load" ? "Loading" : "Unloading"
        } Location)`;
      }
    } else if (app === "waze") {
      url = `https://waze.com/ul?ll=${target.latitude},${target.longitude}&navigate=yes`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Error",
          `${app === "google" ? "Maps" : "Waze"} app not installed`
        );
      }
    } catch (error) {
      console.error("Failed to open navigation app:", error);
      Alert.alert("Error", "Failed to open navigation app");
    }
  };

  const getNavigationIcon = () => {
    const target = getNavigationTarget();
    if (!target) return "map-marker-alt";

    return target.type === "load" ? "arrow-up" : "arrow-down";
  };

  const resetExpenseForm = () => {
    setExpenseForm({ jenis: "", amount: "", notes: "" });
    setReceiptImage(null);
  };

  const validateExpenseForm = () => {
    if (!expenseForm.jenis) {
      Alert.alert("Error", "Pilih jenis pengeluaran");
      return false;
    }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      Alert.alert("Error", "Masukkan jumlah pengeluaran yang valid");
      return false;
    }
    if (trip && parseFloat(expenseForm.amount) > trip.remaining_allowance) {
      Alert.alert("Error", "Jumlah pengeluaran melebihi sisa uang jalan");
      return false;
    }
    return true;
  };

  // CHECK apakah DO sudah completed
  const isTripCompleted = trip?.status === "completed";

  const handleSubmitExpense = async () => {
    // TAMBAH CHECK: Prevent expense creation untuk completed trips
    if (isTripCompleted) {
      Alert.alert(
        "Tidak Dapat Menambah Pengeluaran",
        "Perjalanan ini sudah selesai. Pengeluaran tidak dapat ditambahkan lagi.",
        [{ text: "OK" }]
      );
      return;
    }

    if (!validateExpenseForm() || !trip) return;

    // WEB COMPATIBILITY: Gunakan confirm() untuk web
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Apakah Anda yakin ingin menyimpan pengeluaran ini?"
      );
      if (confirmed) {
        await submitExpenseToServer();
      }
    } else {
      // Mobile specific alert
      // 1. KONFIRMASI DAHULU SEBELUM MENYIMPAN
      Alert.alert(
        "Konfirmasi Penyimpanan",
        "Apakah Anda yakin ingin menyimpan pengeluaran ini?",
        [
          {
            text: "Batal",
            style: "cancel",
            // Jika batal, biarkan user edit form lagi - tidak ada action
          },
          {
            text: "Oke",
            style: "default",
            onPress: async () => {
              // 2. JIKA USER KONFIRMASI, BARU LAKUKAN SUBMIT
              await submitExpenseToServer();
            },
          },
        ]
      );
    }
  };

  // FUNCTION BARU - Pisahkan logic submit ke server
  const submitExpenseToServer = async () => {
    if (!trip) return;

    setSubmittingExpense(true);
    console.log("Starting expense submission process..."); // Add debug log

    try {
      let imageData = null;
      if (receiptImage) {
        console.log("Receipt image:", receiptImage); // Log receipt data

        // Ensure we have the proper structure based on platform
        imageData =
          Platform.OS === "web"
            ? receiptImage // On web, we should already have the right format
            : {
                uri: receiptImage.uri,
                type: receiptImage.type || "image/jpeg",
                name: receiptImage.fileName || "receipt.jpg",
              };
      }

      const expenseData = {
        delivery_order_id: trip.id,
        jenis: expenseForm.jenis,
        amount: parseFloat(expenseForm.amount),
        notes: expenseForm.notes,
        receipt: imageData,
      };
      console.log("Submitting expense data:", expenseData); // Log the data being sent

      const response = await createDriverExpense(expenseData);

      console.log("Expense submission response:", response.data); // Log response

      // Success handling
      // 3. TUTUP MODAL DAHULU, BARU SHOW SUCCESS MESSAGE
      setShowExpenseModal(false);
      resetExpenseForm();
      // 4. REFRESH DATA DI BACKGROUND
      await fetchTripDetails();

      // 5. SHOW SUCCESS NOTIFICATION SETELAH MODAL TERTUTUP
      if (Platform.OS === "web") {
        window.alert(
          "✅ Pengeluaran berhasil disimpan dan saldo telah diperbarui."
        );
      } else {
        setTimeout(() => {
          Alert.alert(
            "✅ Berhasil!",
            "Pengeluaran berhasil disimpan dan saldo telah diperbarui.",
            [{ text: "OK" }]
          );
        }, 300); // Delay sedikit untuk smooth transition
      }
    } catch (error: any) {
      console.error("Error submitting expense:", error); // Error logging

      // Full error details
      if (error.response) {
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
      }

      // Error notification
      if (Platform.OS === "web") {
        window.alert(
          "❌ Gagal Menyimpan: " +
            (error.response?.data?.message ||
              error.message ||
              "Terjadi kesalahan")
        );
      } else {
        // 6. JIKA ERROR, MODAL TETAP TERBUKA DAN SHOW ERROR
        Alert.alert(
          "❌ Gagal Menyimpan",
          error.response?.data?.message ||
            error.message ||
            "Terjadi kesalahan saat menyimpan pengeluaran. Silakan coba lagi.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setSubmittingExpense(false);
    }
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <View style={styles.expenseItem}>
      <FontAwesome5 name="receipt" size={20} color="#3498db" />
      <View style={styles.expenseDetails}>
        <Text style={styles.expenseType}>{item.jenis}</Text>
        <Text style={styles.expenseDate}>
          {new Date(item.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
        {item.notes && <Text style={styles.expenseNotes}>{item.notes}</Text>}
      </View>
      <Text style={styles.expenseAmount}>
        -Rp {Number(item.amount).toLocaleString("id-ID")}
      </Text>
      {item.receipt_url && (
        <FontAwesome5
          name="camera"
          size={16}
          color="#27ae60"
          style={{ marginLeft: 8 }}
        />
      )}
    </View>
  );

  const handleLoadConfirmation = async (loadData: {
    actual_load_quantity: number;
    surat_jalan_photo: any;
  }) => {
    if (!trip) return;

    setSubmittingLoad(true);
    try {
      // Add debug logs
      console.log("Calling confirmLoad with:", {
        doId: trip.id,
        loadData
      });

      await confirmLoad(trip.id, loadData);
      setShowLoadConfirmation(false);
      await fetchTripDetails();
      Alert.alert(
        "Berhasil!",
        "Muatan berhasil dikonfirmasi. Perjalanan ke lokasi bongkar dimulai.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Confirm load error:", error);
      
      let errorMessage = "Gagal mengkonfirmasi muatan";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setSubmittingLoad(false);
    }
  };

  const getStatusActions = () => {
    if (!trip) return null;

    switch (trip.status) {
      case "at_load_location":
        return (
          <TouchableOpacity
            style={[styles.statusActionButton, { backgroundColor: "#e67e22" }]}
            onPress={() => setShowLoadConfirmation(true)}
          >
            <FontAwesome5 name="clipboard-check" size={20} color="#fff" />
            <Text style={styles.statusActionText}>
              Konfirmasi Muatan & Berangkat
            </Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Memuat detail perjalanan...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centered}>
        <Text>Detail trip tidak ditemukan.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
      >
        {/* ✅ Header Card - Clean & Consistent */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <FontAwesome5 name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detail Perjalanan</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.headerContent}>
            <View style={styles.headerRow}>
              <Text style={styles.doNumber}>{trip.do_number}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(trip.status) },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {getStatusText(trip.status)}
                </Text>
              </View>
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.customerName}>{trip.customer_name}</Text>
              <Text style={styles.itemName}>{trip.item_name}</Text>
            </View>
          </View>
        </View>

        {/* ✅ Saldo Card - Tetap Konsisten dengan Pattern */}
        <View
          style={[styles.saldoCard, isTripCompleted && styles.completedCard]}
        >
          {isTripCompleted && (
            <View style={styles.completedBadge}>
              <FontAwesome5 name="check-circle" size={24} color="#fff" />
              <Text style={styles.completedText}>PERJALANAN SELESAI</Text>
            </View>
          )}
          <Text style={styles.saldoTitle}>Sisa Uang Jalan</Text>
          <Text style={styles.saldoAmount}>
            Rp {Number(trip.remaining_allowance).toLocaleString("id-ID")}
          </Text>
          <View style={styles.saldoBreakdown}>
            <Text style={styles.breakdownText}>
              Uang Jalan: Rp{" "}
              {Number(trip.trip_allowance).toLocaleString("id-ID")}
            </Text>
            <Text style={styles.breakdownText}>
              Total Pengeluaran: Rp{" "}
              {Number(trip.expenses_total).toLocaleString("id-ID")}
            </Text>
          </View>
        </View>

        {/* KARTU DETAIL TRIP */}
        <View style={styles.detailCard}>
          <Text style={styles.cardTitle}>Detail Perjalanan</Text>
          <Text style={styles.detailText}>DO: {trip.do_number}</Text>
          <Text style={styles.detailText}>Customer: {trip.customer_name}</Text>
          <Text style={styles.detailText}>
            Rute: {trip.load_location} → {trip.unload_location}
          </Text>
          <View style={styles.statusContainer}>
            <Text style={styles.detailText}>Status: </Text>
            <View style={[styles.statusBadge, getStatusStyle(trip.status)]}>
              <Text style={styles.statusBadgeText}>
                {getStatusText(trip.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* 📍 Location, Navigation & Details Card */}
        <View style={styles.detailCard}>
          <Text style={styles.cardTitle}>📍 Lokasi & Navigasi</Text>

          {/* Load Location */}
          <TouchableOpacity
            style={styles.locationItem}
            onPress={() =>
              router.push({
                pathname: "/map-view",
                params: {
                  lat: trip.load_latitude,
                  lng: trip.load_longitude,
                  title: trip.load_location,
                  type: "load",
                },
              })
            }
          >
            <FontAwesome5 name="arrow-up" size={16} color="#3498db" />
            <View style={styles.locationText}>
              <Text style={styles.locationLabel}>Loading Location:</Text>
              <Text style={styles.locationValue}>{trip.load_location}</Text>
              <Text style={styles.coordinatesText}>
                {parseFloat(trip.load_latitude).toFixed(6)},{" "}
                {parseFloat(trip.load_longitude).toFixed(6)}
              </Text>
            </View>
            <FontAwesome5 name="map-marker-alt" size={16} color="#3498db" />
          </TouchableOpacity>

          {/* Unload Location */}
          <TouchableOpacity
            style={styles.locationItem}
            onPress={() =>
              router.push({
                pathname: "/map-view",
                params: {
                  lat: trip.unload_latitude,
                  lng: trip.unload_longitude,
                  title: trip.unload_location,
                  type: "unload",
                },
              })
            }
          >
            <FontAwesome5 name="arrow-down" size={16} color="#e74c3c" />
            <View style={styles.locationText}>
              <Text style={styles.locationLabel}>Unloading Location:</Text>
              <Text style={styles.locationValue}>{trip.unload_location}</Text>
              <Text style={styles.coordinatesText}>
                {parseFloat(trip.unload_latitude).toFixed(6)},{" "}
                {parseFloat(trip.unload_longitude).toFixed(6)}
              </Text>
            </View>
            <FontAwesome5 name="map-marker-alt" size={16} color="#e74c3c" />
          </TouchableOpacity>

          {/* Divider */}
          <View
            style={{ height: 1, backgroundColor: "#eee", marginVertical: 16 }}
          />

          {/* Map Preview Button */}
          <TouchableOpacity
            style={styles.mapPreviewButton}
            onPress={handleOpenMap}
          >
            <View style={styles.mapPreviewContent}>
              <FontAwesome5 name="map" size={32} color="#3b82f6" />
              <View style={styles.mapPreviewText}>
                <Text style={styles.mapPreviewTitle}>Lihat Rute</Text>
                <Text style={styles.mapPreviewSubtitle}>
                  Lihat lokasi muat dan bongkar
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color="#6b7280" />
            </View>
          </TouchableOpacity>

          {/* Current Navigation Target */}
          {getNavigationTarget() && (
            <View style={styles.navigationTarget}>
              <View style={styles.navigationHeader}>
                <FontAwesome5
                  name={getNavigationIcon()}
                  size={20}
                  color={
                    getNavigationTarget()?.type === "load"
                      ? "#3498db"
                      : "#e74c3c"
                  }
                />
                <Text style={styles.navigationTitle}>
                  Tujuan Berikutnya:{" "}
                  {getNavigationTarget()?.type === "load"
                    ? "Loading"
                    : "Unloading"}
                </Text>
              </View>
              <Text style={styles.navigationAddress}>
                {getNavigationTarget()?.address}
              </Text>
              {/* Navigation Buttons */}
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={[styles.navButton, styles.googleButton]}
                  onPress={() => handleNavigate("google")}
                >
                  <FontAwesome5 name="directions" size={16} color="#fff" />
                  <Text style={styles.navButtonText}>
                    {Platform.OS === "ios" ? "Apple Maps" : "Google Maps"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navButton, styles.wazeButton]}
                  onPress={() => handleNavigate("waze")}
                >
                  <FontAwesome5 name="route" size={16} color="#fff" />
                  <Text style={styles.navButtonText}>Waze</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* RIWAYAT PENGELUARAN */}
        <View style={styles.historyCard}>
          <Text style={styles.cardTitle}>
            Riwayat Pengeluaran
            {isTripCompleted && (
              <Text style={styles.readOnlyIndicator}> (Final)</Text>
            )}
          </Text>
          <FlatList
            data={trip.expenses}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {isTripCompleted
                  ? "Tidak ada pengeluaran yang tercatat untuk perjalanan ini."
                  : "Belum ada pengeluaran."}
              </Text>
            }
          />
          {/* PESAN INFO untuk completed trip */}
          {isTripCompleted && (
            <View style={styles.infoContainer}>
              <FontAwesome5 name="info-circle" size={16} color="#3498db" />
              <Text style={styles.infoText}>
                Perjalanan ini telah selesai. Data pengeluaran bersifat final
                dan tidak dapat diubah.
              </Text>
            </View>
          )}
        </View>

        {getStatusActions()}

        <View style={{ alignItems: "center", marginVertical: 6 }}>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#eee",
              paddingHorizontal: 20,
              paddingVertical: 5,
              borderRadius: 8,
            }}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="arrow-left" size={16} color="#333" />
            <Text style={{ marginLeft: 8, fontSize: 16, color: "#333" }}>
              Kembali
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FLOATING ACTION BUTTON - Sembunyikan untuk completed trips */}
      {!isTripCompleted && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowExpenseModal(true)}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* MODAL FORM EXPENSE */}
      <Modal
        visible={showExpenseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tambah Pengeluaran</Text>
            <TouchableOpacity onPress={() => setShowExpenseModal(false)}>
              <FontAwesome5 name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.formLabel}>Jenis Pengeluaran *</Text>
            <View style={styles.pickerContainer}>
              {Platform.OS === "web" ? (
                <select
                  value={expenseForm.jenis}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, jenis: e.target.value })
                  }
                  style={styles.webSelect}
                >
                  <option value="">Pilih jenis pengeluaran</option>
                  {expenseTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              ) : (
                <View style={styles.pickerButtons}>
                  {expenseTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.pickerButton,
                        expenseForm.jenis === type.value &&
                          styles.pickerButtonActive,
                      ]}
                      onPress={() =>
                        setExpenseForm({ ...expenseForm, jenis: type.value })
                      }
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          expenseForm.jenis === type.value &&
                            styles.pickerButtonTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Text style={styles.formLabel}>Jumlah (Rp) *</Text>
            <TextInput
              style={styles.formInput}
              value={expenseForm.amount}
              onChangeText={(value) =>
                setExpenseForm({ ...expenseForm, amount: value })
              }
              placeholder="Contoh: 50000"
              keyboardType="numeric"
            />
            <Text style={styles.formLabel}>Keterangan (Opsional)</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={expenseForm.notes}
              onChangeText={(value) =>
                setExpenseForm({ ...expenseForm, notes: value })
              }
              placeholder="Catatan tambahan..."
              multiline
              numberOfLines={3}
            />
            <Text style={styles.formLabel}>Foto Struk (Opsional)</Text>
            {receiptImage ? (
              <View style={styles.imageContainer}>
                <View style={styles.imagePreviewContainer}>
                  <Text style={styles.imageSelected}>
                    ✓ Foto struk telah dipilih
                  </Text>
                  <Text style={styles.imageDetails}>
                    {receiptImage.fileName || "receipt.jpg"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeImageButton}
                  onPress={showImagePicker}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeImageText}>Ganti Foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={showImagePicker}
                activeOpacity={0.7}
              >
                <FontAwesome5 name="camera" size={20} color="#3b82f6" />
                <Text style={styles.imagePickerText}>
                  Ambil/Pilih Foto Struk
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  // Tambah konfirmasi jika user sudah isi form
                  if (
                    expenseForm.jenis ||
                    expenseForm.amount ||
                    expenseForm.notes ||
                    receiptImage
                  ) {
                    Alert.alert(
                      "Tutup Form?",
                      "Data yang sudah diisi akan hilang. Yakin ingin menutup form?",
                      [
                        { text: "Tidak", style: "cancel" },
                        {
                          text: "Ya, Tutup",
                          style: "destructive",
                          onPress: () => {
                            setShowExpenseModal(false);
                            resetExpenseForm();
                          },
                        },
                      ]
                    );
                  } else {
                    setShowExpenseModal(false);
                  }
                }}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submittingExpense && styles.disabledButton,
                  // Tambah style visual jika form belum lengkap
                  (!expenseForm.jenis || !expenseForm.amount) &&
                    styles.incompleteButton,
                ]}
                onPress={handleSubmitExpense}
                disabled={
                  submittingExpense || !expenseForm.jenis || !expenseForm.amount
                }
              >
                {submittingExpense ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                      Menyimpan...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>
                    Simpan Pengeluaran
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <LoadConfirmationModal
        visible={showLoadConfirmation}
        onClose={() => setShowLoadConfirmation(false)}
        onConfirm={handleLoadConfirmation}
        minimalQuantity={trip?.minimal_load_quantity || 0}
        isLoading={submittingLoad}
      />
    </>
  );
};

// HELPER FUNCTIONS
const getStatusColor = (status: string) => {
  const colorMap: { [key: string]: string } = {
    assigned: "#6c757d",
    otw_to_load_location: "#f59e42",
    at_load_location: "#3498db",
    otw_to_unload_location: "#e67e22",
    at_unload_location: "#e74c3c",
    otw_to_destination: "#ffc107",
    at_destination: "#17a2b8",
    otw_to_base: "#fd7e14",
    completed: "#28a745",
    cancelled: "#dc3545",
  };
  return colorMap[status] || "#6c757d";
};

const getStatusText = (status: string) => {
  const statusMap = {
    assigned: "Ditugaskan",
    otw_to_destination: "Menuju Tujuan",
    at_destination: "Di Tujuan",
    otw_to_base: "Perjalanan Pulang",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };
  return statusMap[status as keyof typeof statusMap] || status;
};

const getStatusStyle = (status: string) => {
  const styleMap = {
    assigned: { backgroundColor: "#6c757d" },
    otw_to_destination: { backgroundColor: "#ffc107" },
    at_destination: { backgroundColor: "#17a2b8" },
    otw_to_base: { backgroundColor: "#fd7e14" },
    completed: { backgroundColor: "#28a745" },
    cancelled: { backgroundColor: "#dc3545" },
  };
  return (
    styleMap[status as keyof typeof styleMap] || { backgroundColor: "#6c757d" }
  );
};

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 20, // Untuk status bar (atau sesuaikan)
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    zIndex: 10,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  customerName: {
    fontSize: 16,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  itemName: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "500",
    marginBottom: 2,
  },
  doNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    letterSpacing: 1,
    marginBottom: 2,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  locationValue: {
    fontSize: 15,
    color: "#222",
    fontWeight: "500",
    marginBottom: 2,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
  },
  locationText: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 14,
    color: "#333",
    fontWeight: "bold",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    width: 36,
  },

  // Update existing headerCard style
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCard: {
    backgroundColor: "#2563eb",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  headerInfo: {
    gap: 4,
  },
  statusActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
  saldoCard: {
    backgroundColor: "#3b82f6",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  saldoTitle: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    opacity: 0.8,
  },
  saldoAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  saldoBreakdown: { gap: 4 },
  breakdownText: {
    fontSize: 14,
    color: "#e2e8f0",
    textAlign: "center",
  },
  detailCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyCard: {
    backgroundColor: "white",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20, // Extra space for FAB
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1f2937",
  },
  detailText: { fontSize: 14, color: "#555", marginBottom: 4 },
  expenseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  expenseDetails: { flex: 1, marginLeft: 12 },
  expenseType: { fontSize: 16, fontWeight: "500", color: "#333" },
  expenseDate: { fontSize: 12, color: "#888" },
  expenseNotes: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 2,
  },
  expenseAmount: { fontSize: 16, fontWeight: "bold", color: "#e74c3c" },
  emptyText: { textAlign: "center", color: "#888", paddingVertical: 20 },

  // STYLES BARU untuk completed trip
  completedCard: {
    backgroundColor: "#10b981",
  },

  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 8,
  },

  completedText: {
    fontSize: 14,
    color: "#bfdbfe",
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },

  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  readOnlyIndicator: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },

  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 15,
    padding: 12,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#3498db",
  },

  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#1976d2",
    lineHeight: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },

  mapPreviewButton: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  mapPreviewContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  mapPreviewText: {
    flex: 1,
    marginLeft: 16,
  },
  mapPreviewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  mapPreviewSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  navigationTarget: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  navigationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 12,
  },
  navigationAddress: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  navigationButtons: {
    flexDirection: "row",
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleButton: {
    backgroundColor: "#4285f4",
  },
  wazeButton: {
    backgroundColor: "#33ccff",
  },
  navButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
  coordinatesText: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 2,
  },

  // FAB styles
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#27ae60",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  modalContent: { flex: 1, padding: 20 },

  // Form styles
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  // Picker styles
  pickerContainer: { marginBottom: 20 },
  webSelect: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pickerButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  pickerButtonActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  pickerButtonText: { fontSize: 14, color: "#666" },
  pickerButtonTextActive: { color: "#fff", fontWeight: "600" },

  // Image picker styles
  imagePickerText: {
    fontSize: 16,
    color: "#3b82f6",
    marginLeft: 10,
    fontWeight: "500",
  },
  imageContainer: { alignItems: "center", marginBottom: 30 },

  changeImageText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  incompleteButton: {
    backgroundColor: "#bdc3c7", // Abu-abu jika form belum lengkap
  },

  imagePreviewContainer: {
    alignItems: "center",
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#e8f5e8",
    borderRadius: 8,
  },

  imageSelected: {
    fontSize: 16,
    color: "#27ae60",
    fontWeight: "600",
    marginBottom: 4,
  },

  imageDetails: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },

  imagePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 20,
    marginBottom: 30,
    backgroundColor: "#f8f9fa",
    // Tambahkan shadow untuk better visual feedback
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  changeImageButton: {
    backgroundColor: "#6c757d",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    // Tambahkan shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal actions
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, color: "#666", fontWeight: "600" },
  submitButton: {
    flex: 1,
    paddingVertical: 15,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: "#27ae60",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: { fontSize: 16, color: "#fff", fontWeight: "600" },
  disabledButton: { backgroundColor: "#ccc" },
});

export default TripDetailScreen;
