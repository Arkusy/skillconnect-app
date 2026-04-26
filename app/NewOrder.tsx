// app/NewOrder.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useCustomAlert } from "../components/CustomAlert";
import { useAdminTheme } from "../context/AdminThemeContext";
import { supabase } from "../utils/supabase";

interface WorkerProfile {
  id: string;
  user_id: string;
  category_id: string;
  average_rating: number;
  total_ratings: number;
  pricing_type: string;
  price: number | null;
  currency: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function NewOrderScreen() {
  const { workerId, categoryId } = useLocalSearchParams<{
    workerId: string;
    categoryId: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, mode } = useAdminTheme();
  const styles = useMemo(() => getStyles(colors, mode), [colors, mode]);
  const statusBarHeight = StatusBar.currentHeight || 0;
  const { showAlert, AlertComponent } = useCustomAlert();

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasPendingOrder, setHasPendingOrder] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [problemImage, setProblemImage] = useState<string | null>(null);

  // Broadcast State
  const isBroadcast = !workerId;
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryId || "");
  const [userPrice, setUserPrice] = useState("");
  const [userPricingType, setUserPricingType] = useState("fixed"); // Default fixed
  const [userCurrency, setUserCurrency] = useState("USD");
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showPricingTypeModal, setShowPricingTypeModal] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false); // Toggle for categories

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "New Order", // Always New Order
      headerTitleAlign: "center",
      headerTitleStyle: {
        fontSize: 20,
        fontWeight: "700",
        color: mode === 'dark' ? colors.text : "#000",
        letterSpacing: -0.3,
      },
      headerStyle: {
        backgroundColor: mode === 'dark' ? colors.headerBg : "#FFFFFF",
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: mode === 'dark' ? colors.border : "#F0F0F0",
        height: 60 + statusBarHeight,
      },
      headerStatusBarHeight: statusBarHeight,
      headerTintColor: mode === 'dark' ? colors.text : "#000000",
    });
  }, [mode, colors]);

  useEffect(() => {
    loadUserData();
    if (!isBroadcast) {
      fetchWorkerDetails();
      checkPendingOrders();
    } else {
      fetchCategories();
      setLoading(false);
    }
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (data) setCategories(data);
  };

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCustomerName(profile.full_name || "");
        setCustomerPhone(profile.phone || "");
        setCustomerAddress(profile.address || "");
      }
    }
  };

  const fetchWorkerDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('worker_profiles')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', workerId)
        .single();

      if (error) throw error;
      setWorker(data);
    } catch (error) {
      console.error('Error fetching worker:', error);
      showAlert("Error", "Failed to load worker details", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkPendingOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: pendingOrdersData } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('worker_id', workerId)
        .in('status', ['pending', 'accepted']);

      if (pendingOrdersData && pendingOrdersData.length > 0) {
        setHasPendingOrder(true);
      }
    } catch (error) {
      console.error('Error checking pending orders:', error);
    }
  };

  const pickImage = async () => {
    if (hasPendingOrder) {
      showAlert("Order Pending", "You already have a pending order with this worker", "warning");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProblemImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());

      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
      const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      const { data, error } = await supabase.storage
        .from('order-images')
        .upload(fileName, arrayBuffer, {
          contentType: mimeType
        });

      if (error) throw error;

      console.log('Image uploaded successfully:', data.path);
      return data.path;
    } catch (error) {
      console.error('Error uploading image:', error);
      showAlert('Upload Failed', 'Could not upload image. Please try again.', 'error');
      return null;
    }
  };

  const handleCreateOrder = async () => {
    if (hasPendingOrder) {
      showAlert("Order Pending", "You already have a pending order with this worker. Please wait for it to be completed.", "warning");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      showAlert("Error", "Please fill all required fields", "error");
      return;
    }

    if (!currentUserId) {
      showAlert("Error", "User not authenticated", "error");
      return;
    }

    setSubmitting(true);

    try {
      let finalWorkerId = workerId;
      let finalPrice = worker?.price;
      let finalPricingType = worker?.pricing_type;

      // Broadcast Logic: Find nearest worker
      if (isBroadcast) {
        if (!selectedCategory) {
          showAlert("Error", "Please select a service category", "error");
          setSubmitting(false);
          return;
        }
        if (!userPrice) {
          showAlert("Error", "Please enter a price", "error");
          setSubmitting(false);
          return;
        }

        // 1. Get User Location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert("Permission denied", "Location permission is required for broadcast orders.", "warning");
          setSubmitting(false);
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        const userLat = location.coords.latitude;
        const userLong = location.coords.longitude;

        // 2. Fetch Workers in Category with Coords
        const { data: candidates, error: workerError } = await supabase
          .from('worker_profiles')
          .select(`
            id,
            user_id,
            availability_status,
            profiles!worker_profiles_user_id_fkey (
              latitude,
              longitude,
              full_name
            )
          `)
          .eq('category_id', selectedCategory)
          .eq('availability_status', 'available')
          .not('profiles.latitude', 'is', null)
          .not('profiles.longitude', 'is', null);

        if (workerError || !candidates || candidates.length === 0) {
          showAlert("Unavailable", "No available workers found in this category nearby.", "warning");
          setSubmitting(false);
          return;
        }

        // 3. Calculate Distances and Sort
        // Haversine formula
        const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371; // Radius of the earth in km
          const dLat = (lat2 - lat1) * (Math.PI / 180);
          const dLon = (lon2 - lon1) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const workersWithDist = candidates
          .map(w => {
            const p = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
            if (!p || p.latitude == null || p.longitude == null) return null;

            const dist = getDistanceFromLatLonInKm(userLat, userLong, p.latitude, p.longitude);
            return { ...w, dist, name: p.full_name };
          })
          .filter((w): w is NonNullable<typeof w> => w !== null) // Type guard to remove nulls
          .sort((a, b) => a.dist - b.dist);

        if (workersWithDist.length === 0) {
          showAlert("Unavailable", "No workers with location data found nearby.", "warning");
          setSubmitting(false);
          return;
        }

        const nearestWorker = workersWithDist[0];
        console.log("Nearest Worker found:", nearestWorker.name, nearestWorker.dist, "km");

        finalWorkerId = nearestWorker.user_id;
        finalPrice = parseFloat(userPrice);
        finalPricingType = userPricingType;
      }


      let imageUrl = null;
      if (problemImage) {
        imageUrl = await uploadImage(problemImage);
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: currentUserId,
          worker_id: finalWorkerId,
          category_id: selectedCategory, // Use selected category
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_address: customerAddress.trim(),
          problem_description: problemDescription.trim() || null,
          problem_image_url: imageUrl,
          pricing_type: finalPricingType || null,
          price_amount: finalPrice || null,
          currency: isBroadcast ? userCurrency : (worker?.currency || 'USD'),
        })
        .select()
        .single();

      if (error) throw error;

      showAlert(
        "Success",
        isBroadcast
          ? `Broadcast sent!\n\nAssigned to nearest worker.`
          : `Order #${data.id} created successfully!\n\nThe worker will be notified.`,
        "success",
        { buttonText: "OK", onConfirm: () => router.push("/(tabs)/MyOrders") }
      );
    } catch (error: any) {
      console.error('Error creating order:', error);

      // Friendly message for duplicate pending order constraint
      if (error.message?.includes('idx_orders_unique_pending')) {
        // Try to find the existing pending order
        try {
          const { data: pendingOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', currentUserId)
            .in('status', ['pending', 'accepted'])
            .limit(1)
            .single();

          if (pendingOrder) {
            showAlert(
              "Order Already Pending",
              "You already have a pending order with this worker. Please wait for it to be completed or cancelled before creating a new one.",
              "warning",
              {
                buttonText: "View Order",
                onConfirm: () => router.push({ pathname: "/DisplayOrder", params: { orderId: pendingOrder.id.toString() } }),
              }
            );
          } else {
            showAlert(
              "Order Already Pending",
              "You already have a pending order with this worker. Please wait for it to be completed or cancelled.",
              "warning"
            );
          }
        } catch {
          showAlert(
            "Order Already Pending",
            "You already have a pending order with this worker. Please wait for it to be completed or cancelled.",
            "warning"
          );
        }
      } else {
        showAlert("Error", error.message || "Failed to create order", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getAvatarUrl = (avatarPath: string | null) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={mode === 'dark' ? colors.text : "#000000"} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!worker && !isBroadcast) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#CCCCCC" />
        <Text style={styles.errorText}>Worker not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarUrl = worker ? getAvatarUrl(worker.profiles.avatar_url) : null;
  const currencySymbol = isBroadcast ? '$' : (worker?.currency === 'USD' ? '$' : '₹');
  const priceDisplay = worker && worker.price
    ? `${currencySymbol}${worker.price.toFixed(0)}${worker.pricing_type === 'hourly' ? '/hr' : ''}`
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hasPendingOrder && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={20} color={mode === 'dark' ? colors.text : "#000000"} />
            <Text style={styles.pendingText}>
              You have a pending order with this worker
            </Text>
          </View>
        )}

        {isBroadcast ? (
          <View style={styles.workerCard}>
            <Text style={styles.sectionTitle}>Create New Order</Text>
            <Text style={[styles.label, { marginBottom: 16, color: mode === 'dark' ? colors.textSecondary : '#666' }]}>
              Your order will be broadcast to the nearest available worker in the selected category.
            </Text>

            {/* Category Selection - Home Style */}
            <View style={styles.inputGroup}>
              <View style={styles.headerRow}>
                <Text style={styles.label}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowAllCategories(!showAllCategories)}>
                  <Text style={styles.seeAllText}>{showAllCategories ? "Show Less" : "See All"}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {(showAllCategories ? categories : categories.slice(0, 2)).map(cat => {
                  const getIconForCategory = (name: string): keyof typeof Ionicons.glyphMap => {
                    const lower = name.toLowerCase();
                    if (lower.includes('plumb')) return 'water';
                    if (lower.includes('electr')) return 'flash';
                    if (lower.includes('clean')) return 'sparkles';
                    if (lower.includes('paint')) return 'color-palette';
                    if (lower.includes('carpent')) return 'hammer';
                    if (lower.includes('repair')) return 'construct';
                    if (lower.includes('garden')) return 'leaf';
                    return 'construct';
                  };
                  const iconName = getIconForCategory(cat.name);

                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[
                        styles.categoryCard,
                        selectedCategory === cat.id && styles.categoryCardActive,
                        { width: '48%', marginBottom: 12 }
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.categoryIconBubble}>
                        <Ionicons name={iconName} size={24} color={mode === 'dark' ? "#99aaff" : "#000000"} />
                      </View>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {categories.length > 2 && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => setShowAllCategories(!showAllCategories)}
                >
                  <Ionicons
                    name={showAllCategories ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={mode === 'dark' ? colors.textSecondary : "#666"}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Price Input - Account Style */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Budget / Price</Text>
              <View style={styles.pricingContainer}>
                {/* Fixed / Hourly Selector (Modal) */}
                <Pressable
                  style={[styles.pricingTypeBtn, { borderRightWidth: 1, borderRightColor: mode === 'dark' ? colors.border : '#E0E0E0' }]}
                  onPress={() => setShowPricingTypeModal(true)}
                >
                  <Text style={{ fontWeight: "600", color: mode === 'dark' ? colors.text : colors.text }}>
                    {userPricingType === 'hourly' ? "Hourly" : "Fixed"}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={mode === 'dark' ? colors.textSecondary : colors.textSecondary} />
                </Pressable>

                <View style={styles.priceInputWrapper}>
                  <TextInput
                    style={styles.pricingInput}
                    value={userPrice}
                    onChangeText={setUserPrice}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#AAAAAA"}
                  />
                </View>

                <Pressable
                  style={[styles.currencyBtn, { borderLeftWidth: 1, borderLeftColor: mode === 'dark' ? colors.border : '#E0E0E0', borderRightWidth: 0 }]}
                  onPress={() => setShowCurrencyModal(true)}
                >
                  <Text style={{ fontWeight: "700", color: "#fff" }}>
                    {userCurrency}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.workerCard}>
            <View style={styles.workerHeader}>
              <View style={styles.avatarContainer}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={32} color={mode === 'dark' ? colors.textSecondary : "#999999"} />
                  </View>
                )}
              </View>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{worker!.profiles.full_name}</Text>
                <View style={styles.workerMetaRow}>
                  {worker!.average_rating > 0 ? (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FFB800" />
                      <Text style={styles.ratingText}>
                        {worker!.average_rating.toFixed(1)}
                      </Text>
                      <Text style={styles.reviewCount}>({worker!.total_ratings})</Text>
                    </View>
                  ) : (
                    <Text style={styles.noRating}>New Worker</Text>
                  )}
                </View>
                {priceDisplay && (
                  <Text style={styles.workerPrice}>{priceDisplay}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Order Details</Text>

          <View style={styles.inputGroup}>
            <View style={styles.headerRow}>
              <Text style={styles.label}>
                Full Name <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/Account')} style={styles.editBtn}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={customerName}
              placeholder="Enter your full name"
              placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#AAAAAA"}
              editable={false} // READ ONLY
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.headerRow}>
              <Text style={styles.label}>
                Phone Number <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/Account')} style={styles.editBtn}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={customerPhone}
              placeholder="Enter your phone number"
              placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#AAAAAA"}
              editable={false} // READ ONLY
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Enter your complete address"
              placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#AAAAAA"}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!hasPendingOrder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Problem Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={problemDescription}
              onChangeText={setProblemDescription}
              placeholder="Describe the issue (optional)"
              placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#AAAAAA"}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!hasPendingOrder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Problem Image (Optional)</Text>
            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                hasPendingOrder && styles.imagePickerDisabled
              ]}
              onPress={pickImage}
              activeOpacity={0.7}
              disabled={hasPendingOrder}
            >
              <Ionicons
                name={problemImage ? "checkmark-circle" : "camera-outline"}
                size={24}
                color={hasPendingOrder ? "#CCCCCC" : problemImage ? "#000000" : "#666666"}
              />
              <Text style={[
                styles.imagePickerText,
                problemImage && styles.imagePickerTextActive,
                hasPendingOrder && styles.imagePickerTextDisabled
              ]}>
                {problemImage ? "Image Selected" : "Upload Image"}
              </Text>
            </TouchableOpacity>

            {problemImage && !hasPendingOrder && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: problemImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setProblemImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color={mode === 'dark' ? colors.text : "#000000"} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (submitting || hasPendingOrder) && styles.createButtonDisabled
          ]}
          onPress={handleCreateOrder}
          disabled={submitting || hasPendingOrder}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : hasPendingOrder ? (
            <>
              <Ionicons name="time-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Order Pending</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            {['USD', 'INR'].map((curr) => (
              <TouchableOpacity
                key={curr}
                style={styles.modalItem}
                onPress={() => {
                  setUserCurrency(curr);
                  setShowCurrencyModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{curr}</Text>
                {userCurrency === curr && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pricing Type Modal */}
      <Modal
        visible={showPricingTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPricingTypeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPricingTypeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Pricing Type</Text>
            {[
              { label: 'Fixed Price', value: 'fixed' },
              { label: 'Hourly Rate', value: 'hourly' }
            ].map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.modalItem}
                onPress={() => {
                  setUserPricingType(type.value);
                  setShowPricingTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{type.label}</Text>
                {userPricingType === type.value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <AlertComponent />
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, mode: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mode === 'dark' ? colors.background : "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: mode === 'dark' ? colors.background : "#FFFFFF",
  },
  loadingText: {
    color: mode === 'dark' ? colors.text : '#000000',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: mode === 'dark' ? colors.background : "#FFFFFF",
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : '#000000',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: mode === 'dark' ? colors.primary : '#000000',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mode === 'dark' ? colors.card : '#F5F5F5',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.warning : '#E0E0E0',
  },
  pendingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : '#000000',
  },
  workerCard: {
    backgroundColor: mode === 'dark' ? colors.card : "#F5F5F5",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: mode === 'dark' ? colors.border : "#000000",
  },
  avatarPlaceholder: {
    backgroundColor: mode === 'dark' ? colors.iconBg : "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 18,
    fontWeight: "700",
    color: mode === 'dark' ? colors.text : "#000000",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  workerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : "#000000",
  },
  reviewCount: {
    fontSize: 13,
    color: mode === 'dark' ? colors.textSecondary : "#666666",
  },
  noRating: {
    fontSize: 13,
    color: mode === 'dark' ? colors.textSecondary : "#999999",
    fontStyle: 'italic',
  },
  workerPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: mode === 'dark' ? colors.primary : '#000000',
  },
  formSection: {
    backgroundColor: mode === 'dark' ? colors.background : "#FFFFFF",
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: mode === 'dark' ? colors.text : "#000000",
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: mode === 'dark' ? colors.text : "#000000",
    marginBottom: 8,
  },
  required: {
    color: colors.danger,
  },
  input: {
    backgroundColor: mode === 'dark' ? colors.card : "#F5F5F5",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: mode === 'dark' ? colors.text : "#000000",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "#E0E0E0",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mode === 'dark' ? colors.card : "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: mode === 'dark' ? colors.textSecondary : "#000000",
    borderStyle: 'dashed',
    gap: 10,
  },
  imagePickerDisabled: {
    backgroundColor: mode === 'dark' ? colors.border : '#FAFAFA',
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
  },
  imagePickerText: {
    fontSize: 15,
    color: mode === 'dark' ? colors.textSecondary : "#666666",
    fontWeight: "600",
  },
  imagePickerTextActive: {
    color: mode === 'dark' ? colors.text : "#000000",
  },
  imagePickerTextDisabled: {
    color: mode === 'dark' ? colors.textSecondary : "#CCCCCC",
  },
  imagePreviewContainer: {
    marginTop: 12,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: mode === 'dark' ? colors.card : '#FFFFFF',
    borderRadius: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomPadding: {
    height: 20,
  },
  bottomBar: {
    backgroundColor: mode === 'dark' ? colors.headerBg : '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: mode === 'dark' ? colors.border : "#F0F0F0",
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: mode === 'dark' ? colors.primary : "#000000",
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
  },
  createButtonDisabled: {
    backgroundColor: mode === 'dark' ? colors.border : "#CCCCCC",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  // --- New Styling from Home/Account replication ---
  categoryCard: {
    backgroundColor: mode === 'dark' ? colors.card : "#F7F7F7",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "rgba(0,0,0,0.06)",
  },
  categoryCardActive: {
    borderColor: colors.primary,
    backgroundColor: mode === 'dark' ? 'rgba(5, 158, 241, 0.1)' : '#E3F2FD',
  },
  categoryIconBubble: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: mode === 'dark' ? colors.iconBg : "#FFFFFF",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "700",
    color: mode === 'dark' ? colors.text : "#000",
    textAlign: 'center'
  },
  pricingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mode === 'dark' ? colors.card : "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "#E0E0E0",
    marginTop: 6,
    overflow: "hidden",
  },
  pricingTypeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: mode === 'dark' ? colors.card : "#EEF2F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
  },
  priceInputWrapper: { flex: 1 },
  pricingInput: {
    padding: 14,
    fontSize: 16,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : "#000",
    textAlign: 'left'
  },
  currencyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: mode === 'dark' ? colors.card : "#FFF",
    borderRadius: 16,
    padding: 20,
    elevation: 5
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
    color: mode === 'dark' ? colors.text : "#000",
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: mode === 'dark' ? colors.border : "#E0E0E0",
  },
  modalItemText: { fontSize: 16, color: mode === 'dark' ? colors.text : "#000" },

  // --- See All / Edit Buttons ---
  seeAllBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  seeAllText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4
  },
  editText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  inputReadOnly: {
    backgroundColor: mode === 'dark' ? colors.background : "#F0F0F0",
    color: mode === 'dark' ? colors.textSecondary : "#666"
  }
});