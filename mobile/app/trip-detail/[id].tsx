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
  gaji: number | null; // 🎯 FIX: Allow null to handle edge cases
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  load_location: string;
  unload_location: string;
  load_latitude: string;
  load_longitude: string;
  unload_latitude: string;
  unload_longitude: string;
  surat_jalan_photo_url?: string;
  expenses_total: number;
  remaining_allowance: number;
  expenses: Expense[];
  status: string;
  created_at: string;
  additional_allowance: number[]; // Array of additional allowances
  payment_notes: string; // Payment notes
  financial_summary: {
    trip_allowance: number;
    gaji: number | null; // 🎯 FIX: Allow null to handle edge cases
    total_for_driver: number;
    expenses_total: number;
    remaining_allowance: number;
    additional_allowance: number[]; // Included in financial_summary
    unit: 'kilogram' | 'ton' | 'kubik';
  };
  unit: 'kilogram' | 'ton' | 'kubik';
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
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);
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

  // Helper to get unit display
  const getUnitDisplay = (unit: DeliveryOrderDetails['unit']) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit] || unit;
  };

  // 🎯 FIX: Simplified parsing of payment_notes for allowance descriptions
  const parseAllowanceDescriptions = (paymentNotes: string): string[] => {
    if (!paymentNotes) return [];
    try {
      // Split by newlines and filter for lines starting with "Additional Allowance"
      const lines = paymentNotes.split("\n").filter(line => line.trim().startsWith("Additional Allowance"));
      return lines.map(line => {
        const parts = line.split(" - ");
        return parts.length > 1 ? parts[1].trim() : `Tambahan ${parts[0].replace("Additional Allowance ", "")}`;
      });
    } catch (error) {
      console.error("Error parsing payment_notes:", error);
      return [];
    }
  };

  const fetchTripDetails = useCallback(async () => {
    if (!id || isLoadingRef.current) {
      console.log("Skipping fetch - already loading or no ID");
      return;
    }

    isLoadingRef.current = true;

    try {
      console.log(`Fetching trip details for ID: ${id}`);
      const response = await getDeliveryOrderDetails(id);

      // Ensure additional_allowance, payment_notes, and gaji are valid
      const data = response.data;
      console.log("Raw trip data:", data); // 🎯 FIX: Log raw data for debugging
      if (!data.additional_allowance || !Array.isArray(data.additional_allowance)) {
        console.warn('Trip data missing additional_allowance, defaulting to []');
        data.additional_allowance = [];
      }
      if (!data.payment_notes) {
        console.warn('Trip data missing payment_notes, defaulting to ""');
        data.payment_notes = "";
      }
      if (!data.unit) {
        console.warn('Trip data missing unit, defaulting to "ton"');
        data.unit = "ton";
      }
      if (data.financial_summary.gaji === null || data.financial_summary.gaji === undefined) {
        console.warn('Trip data missing gaji, defaulting to 0');
        data.financial_summary.gaji = 0;
        data.gaji = 0;
      }

      if (mountedRef.current) {
        setTrip(data);
        console.log(`Trip loaded - Status: ${data.status}, Gaji: ${data.financial_summary.gaji}, Additional Allowance: ${JSON.stringify(data.additional_allowance)}`);
      }
    } catch (error: any) {
      if (mountedRef.current) {
        console.error("Error fetching trip:", error);
        if (error.response?.status === 401) {
          Alert.alert("Session Expired", "Please login again.", [
            { text: "OK", onPress: () => router.replace("/(auth)/login") },
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
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, starting fetch...");
      setLoading(true);
      fetchTripDetails();
      return () => {
        console.log("Screen unfocused, cleaning up...");
        isLoadingRef.current = false;
      };
    }, [fetchTripDetails])
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isLoadingRef.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    if (isLoadingRef.current) {
      console.log("Refresh skipped - already loading");
      return;
    }
    setRefreshing(true);
    fetchTripDetails();
  }, [fetchTripDetails]);

  const pickImage = async () => {
    try {
      console.log("Starting image picker...");
      if (Platform.OS !== "web") {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log("Permission result:", permissionResult);
        if (!permissionResult.granted) {
          Alert.alert(
            "Permission Diperlukan",
            "Aplikasi memerlukan izin untuk mengakses galeri foto. Silakan berikan izin di pengaturan aplikasi.",
            [{ text: "OK" }]
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      console.log("Image picker result:", result);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        console.log("Selected image:", selectedImage);
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
      console.log("Starting camera...");
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log("Camera permission result:", permissionResult);
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Diperlukan",
          "Aplikasi memerlukan izin untuk mengakses kamera. Silakan berikan izin di pengaturan aplikasi.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      console.log("Camera result:", result);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const takenImage = result.assets[0];
        console.log("Taken image:", takenImage);
        setReceiptImage(takenImage);
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
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.log("Back navigation failed, using fallback Error: ", error);
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
        url = `geo:${target.latitude},${target.longitude}?q=${target.latitude},${target.longitude}(${target.type === "load" ? "Loading" : "Unloading"} Location)`;
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
    return target?.type === "load" ? "arrow-up" : "arrow-down";
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

  const isTripCompleted = trip?.status === "completed";

  const handleSubmitExpense = async () => {
    if (isTripCompleted) {
      Alert.alert(
        "Tidak Dapat Menambah Pengeluaran",
        "Perjalanan ini sudah selesai. Pengeluaran tidak dapat ditambahkan lagi.",
        [{ text: "OK" }]
      );
      return;
    }

    if (!validateExpenseForm() || !trip) return;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Apakah Anda yakin ingin menyimpan pengeluaran ini?"
      );
      if (confirmed) {
        await submitExpenseToServer();
      }
    } else {
      Alert.alert(
        "Konfirmasi Penyimpanan",
        "Apakah Anda yakin ingin menyimpan pengeluaran ini?",
        [
          { text: "Batal", style: "cancel" },
          { text: "Oke", style: "default", onPress: submitExpenseToServer },
        ]
      );
    }
  };

  const submitExpenseToServer = async () => {
    if (!trip) return;

    setSubmittingExpense(true);
    console.log("Starting expense submission process...");

    try {
      let imageData = null;
      if (receiptImage) {
        console.log("Receipt image:", receiptImage);
        imageData =
          Platform.OS === "web"
            ? receiptImage
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
      console.log("Submitting expense data:", expenseData);

      const response = await createDriverExpense(expenseData);
      console.log("Expense submission response:", response.data);

      setShowExpenseModal(false);
      resetExpenseForm();
      await fetchTripDetails();

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
        }, 300);
      }
    } catch (error: any) {
      console.error("Error submitting expense:", error);
      if (error.response) {
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
      }

      if (Platform.OS === "web") {
        window.alert(
          "❌ Gagal Menyimpan: " +
            (error.response?.data?.message ||
              error.message ||
              "Terjadi kesalahan")
        );
      } else {
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
      console.log("Calling confirmLoad with:", { doId: trip.id, loadData });
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

  const allowanceDescriptions = parseAllowanceDescriptions(trip.payment_notes);
  const unitDisplay = getUnitDisplay(trip.unit);

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
        {/* Header Card */}
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
              <Text style={styles.itemName}>
                {trip.item_name} - {trip.minimal_load_quantity} {unitDisplay}
                {trip.actual_load_quantity &&
                  ` → ${trip.actual_load_quantity} ${unitDisplay}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Saldo Card */}
        <View
          style={[styles.saldoCard, isTripCompleted && styles.completedCard]}
        >
          {isTripCompleted && (
            <View style={styles.completedBadge}>
              <FontAwesome5 name="check-circle" size={24} color="#fff" />
              <Text style={styles.completedText}>PERJALANAN SELESAI</Text>
            </View>
          )}
          <Text style={styles.saldoTitle}>Keuangan</Text>
          <Text style={styles.saldoAmount}>
            Rp {Number(trip.remaining_allowance).toLocaleString("id-ID")}
          </Text>
          <Text style={styles.saldoSubtitle}>Sisa Uang Jalan</Text>

          {/* Revenue Subsection */}
          <View style={styles.saldoSection}>
            <Text style={styles.sectionTitle}>Pendapatan</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Uang Jalan</Text>
              <Text style={styles.breakdownValue}>
                Rp {Number(trip.financial_summary.trip_allowance).toLocaleString("id-ID")}
              </Text>
            </View>
            {trip.additional_allowance.length > 0 ? (
              trip.additional_allowance.map((amount, index) => (
                <View key={index} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Tambahan {index + 1}
                    {allowanceDescriptions[index] ? ` (${allowanceDescriptions[index]})` : ""}
                  </Text>
                  <Text style={styles.breakdownValue}>
                    Rp {Number(amount).toLocaleString("id-ID")}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tambahan</Text>
                <Text style={styles.breakdownValue}>Tidak ada</Text>
              </View>
            )}
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Gaji</Text>
              <Text style={styles.breakdownValue}>
                Rp {Number(trip.financial_summary.gaji || 0).toLocaleString("id-ID")}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={[styles.breakdownLabel, styles.totalLabel]}>Total untuk Driver</Text>
              <Text style={[styles.breakdownValue, styles.totalValue]}>
                Rp {Number(trip.financial_summary.total_for_driver).toLocaleString("id-ID")}
              </Text>
            </View>
          </View>

          {/* Expenses Subsection */}
          <View style={styles.saldoSection}>
            <Text style={styles.sectionTitle}>Pengeluaran</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Total Pengeluaran</Text>
              <Text style={[styles.breakdownValue, styles.expenseValue]}>
                Rp {Number(trip.expenses_total).toLocaleString("id-ID")}
              </Text>
            </View>
          </View>

          {/* Payment Notes */}
          {trip.payment_notes && (
            <View style={styles.saldoSection}>
              <Text style={styles.sectionTitle}>Catatan Pembayaran</Text>
              <Text style={styles.paymentNotes}>{trip.payment_notes}</Text>
            </View>
          )}

          {/* Unit Information */}
          <View style={styles.saldoSection}>
            <Text style={styles.sectionTitle}>Satuan</Text>
            <Text style={styles.breakdownValue}>{unitDisplay}</Text>
          </View>
        </View>

        {/* Detail Trip Card */}
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

        {/* Location, Navigation & Details Card */}
        <View style={styles.detailCard}>
          <Text style={styles.cardTitle}>📍 Lokasi & Navigasi</Text>
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
          <View style={{ height: 1, backgroundColor: "#eee", marginVertical: 16 }} />
          <TouchableOpacity style={styles.mapPreviewButton} onPress={handleOpenMap}>
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
          {getNavigationTarget() && (
            <View style={styles.navigationTarget}>
              <View style={styles.navigationHeader}>
                <FontAwesome5
                  name={getNavigationIcon()}
                  size={20}
                  color={
                    getNavigationTarget()?.type === "load" ? "#3498db" : "#e74c3c"
                  }
                />
                <Text style={styles.navigationTitle}>
                  Tujuan Berikutnya:{" "}
                  {getNavigationTarget()?.type === "load" ? "Loading" : "Unloading"}
                </Text>
              </View>
              <Text style={styles.navigationAddress}>
                {getNavigationTarget()?.address}
              </Text>
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

        {/* Riwayat Pengeluaran */}
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

      {!isTripCompleted && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowExpenseModal(true)}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}

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
    otw_to_base: "#fd7e14",
    completed: "#28a745",
    cancelled: "#dc3545",
  };
  return colorMap[status] || "#6c757d";
};

const getStatusText = (status: string) => {
  const statusMap = {
    assigned: "Ditugaskan",
    otw_to_load_location: "Menuju Muat",
    at_load_location: "Di Lokasi Muat",
    otw_to_unload_location: "Menuju Bongkar",
    at_unload_location: "Di Lokasi Bongkar",
    otw_to_base: "Perjalanan Pulang",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };
  return statusMap[status as keyof typeof statusMap] || status;
};

const getStatusStyle = (status: string) => {
  const styleMap = {
    assigned: { backgroundColor: "#6c757d" },
    otw_to_load_location: { backgroundColor: "#f59e42" },
    at_load_location: { backgroundColor: "#3498db" },
    otw_to_unload_location: { backgroundColor: "#e67e22" },
    at_unload_location: { backgroundColor: "#e74c3c" },
    otw_to_base: { backgroundColor: "#fd7e14" },
    completed: { backgroundColor: "#28a745" },
    cancelled: { backgroundColor: "#dc3545" },
  };
  return styleMap[status as keyof typeof styleMap] || { backgroundColor: "#6c757d" };
};

const styles = StyleSheet.create({
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  locationText: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  placeholder: { width: 36 },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  doNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    letterSpacing: 1,
    marginRight: 8,
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
  headerInfo: { gap: 4 },
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
    marginVertical: 8,
  },
  saldoSubtitle: {
    fontSize: 14,
    color: "#e2e8f0",
    textAlign: "center",
    marginBottom: 16,
  },
  saldoSection: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 14,
    color: "#4b5563",
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  expenseValue: {
    color: "#e74c3c",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontWeight: "bold",
  },
  totalValue: {
    fontWeight: "bold",
    color: "#2563eb",
  },
  paymentNotes: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1f2937",
  },
  detailText: { fontSize: 14, color: "#555", marginBottom: 4 },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
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
  historyCard: {
    backgroundColor: "white",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 8,
  },
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
  completedCard: { backgroundColor: "#10b981" },
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
  googleButton: { backgroundColor: "#4285f4" },
  wazeButton: { backgroundColor: "#33ccff" },
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
  imagePickerText: {
    fontSize: 16,
    color: "#3b82f6",
    marginLeft: 10,
    fontWeight: "500",
  },
  imageContainer: { alignItems: "center", marginBottom: 30 },
  changeImageText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  incompleteButton: { backgroundColor: "#bdc3c7" },
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