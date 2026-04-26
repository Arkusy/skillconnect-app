// app/(tabs)/Account.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from "@supabase/supabase-js";
import * as Haptics from "expo-haptics";
import * as ImagePicker from 'expo-image-picker';
import * as Location from "expo-location";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "../../components/Avatar";
import CaptchaModal from "../../components/CaptchaModal";
import { useCustomAlert } from "../../components/CustomAlert";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { clearProfileCache, useProfile } from "../../utils/useProfile";



const BANNER_CONFIG = {
  showBanner: true,
  displayDuration: 3000,
  animationSpeed: 300,
};

interface Category {
  id: string;
  name: string;
}

interface WorkerProfile {
  id: string;
  category_id: string;
  experience_years: number;
  pricing_type?: string;
  price?: number | null;
  currency?: string;
  availability_status: string;
  service_description: string | null;
  portfolio_images: string[] | null;
}

export default function Account({ session }: { session: Session }) {
  const { profile, loading: profileLoading, updateProfile, fetchProfile } =
    useProfile();
  const insets = useSafeAreaInsets();
  const { showAlert, AlertComponent } = useCustomAlert();
  const { colors, mode } = useAdminTheme();
  const styles = useMemo(() => getStyles(colors, mode, insets), [colors, mode, insets]);

  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Profile State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Initial State for Dirty Check (Profile)
  const [initialProfile, setInitialProfile] = useState({
    fullName: "",
    phone: "",
    address: "",
    bio: "",
    avatarUrl: "" as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // WORKER Profile State
  const [workerProfileExpanded, setWorkerProfileExpanded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(
    null
  );
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] =
    useState("Select Category");
  const [experienceYears, setExperienceYears] = useState("");
  const [pricingType, setPricingType] = useState("hourly");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [serviceDescription, setServiceDescription] = useState("");
  const [portfolioImages, setPortfolioImages] = useState<(string | null)[]>([null, null, null]);

  // Initial State for Dirty Check (Worker)
  const [initialWorker, setInitialWorker] = useState({
    categoryId: "",
    experienceYears: "",
    pricingType: "hourly",
    price: "",
    currency: "USD",
    availabilityStatus: "available",
    serviceDescription: "",
    portfolioImages: [null, null, null] as (string | null)[],
  });

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showPricingTypeModal, setShowPricingTypeModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaAction, setCaptchaAction] = useState<
    "update" | "role" | "worker"
  >("update");
  const [loadingMessage, setLoadingMessage] = useState("");

  // Banner animations (slide + fade)
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showBanner, setShowBanner] = useState(false);

  // Enable LayoutAnimation on Android (UI-only)
  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (profile?.role === 2) {
        fetchVerificationStatus();
      } else if (profile?.role === 1) {
        fetchSubscription();
        fetchWorkerProfile();
      }
    }, [profile])
  );

  useEffect(() => {
    if (profile) {
      const pData = {
        fullName: profile.full_name || "",
        phone: profile.phone || "",
        address: profile.address || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatar_url || null, // Just the path, not full URL
      };

      setFullName(pData.fullName);
      setPhone(pData.phone);
      setAddress(pData.address);
      setBio(pData.bio);
      setAvatarUrl(pData.avatarUrl);
      setLatitude(profile.latitude || null);
      setLongitude(profile.longitude || null);
      setInitialProfile({
        ...pData,
        latitude: profile.latitude || null,
        longitude: profile.longitude || null,
      });

      if (profile.role === 1) {
        fetchWorkerProfile();
        fetchSubscription();
        fetchCategories();
      }
      fetchVerificationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (BANNER_CONFIG.showBanner && profile) {
      setShowBanner(true);

      // reset
      slideAnim.setValue(-100);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: BANNER_CONFIG.animationSpeed,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: BANNER_CONFIG.animationSpeed,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        dismissBanner();
      }, BANNER_CONFIG.displayDuration);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const dismissBanner = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: BANNER_CONFIG.animationSpeed,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: BANNER_CONFIG.animationSpeed,
        useNativeDriver: true,
      }),
    ]).start(() => setShowBanner(false));
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) setCategories(data);
  };

  const fetchWorkerProfile = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!error && data) {
        setWorkerProfile(data);

        let catName = "Select Category";
        const cat = categories.find((c) => c.id === data.category_id);
        if (cat) {
          catName = cat.name;
        } else {
          const { data: catData } = await supabase
            .from("categories")
            .select("name")
            .eq("id", data.category_id)
            .single();
          if (catData) catName = catData.name;
        }

        const wData = {
          categoryId: data.category_id,
          experienceYears: data.experience_years?.toString() || "",
          pricingType: data.pricing_type || "hourly",
          price: data.price?.toString() || "",
          currency: data.currency || "USD",
          availabilityStatus: data.availability_status || "available",
          serviceDescription: data.service_description || "",
        };

        setSelectedCategoryId(wData.categoryId);
        setSelectedCategoryName(catName);
        setExperienceYears(wData.experienceYears);
        setPricingType(wData.pricingType);
        setPrice(wData.price);
        setCurrency(wData.currency);
        setAvailabilityStatus(wData.availabilityStatus);
        setServiceDescription(wData.serviceDescription);

        // Portfolio Images
        const pImages = data.portfolio_images || [];
        const newImages = [null, null, null];
        for (let i = 0; i < 3; i++) {
          if (pImages[i]) newImages[i] = pImages[i];
        }
        setPortfolioImages(newImages);

        setInitialWorker({
          ...wData,
          portfolioImages: newImages,
        });
      }
    } catch (err) {
      console.error("fetchWorkerProfile error:", err);
    }
  };

  const fetchVerificationStatus = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("worker_verification")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setVerificationStatus(data);
  };

  const fetchSubscription = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("worker_subscriptions")
      .select("expires_at")
      .eq("user_id", profile.id)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.expires_at) {
      console.log("Found subscription expiring at:", data.expires_at);
      setSubscriptionExpiresAt(data.expires_at);
    } else {
      console.log("No active subscription found or error:", error, data);
      setSubscriptionExpiresAt(null);
    }
  };

  const getProfileCompletion = () => {
    let completed = 0;
    let total = 3;
    if (fullName && fullName.trim()) completed++;
    if (phone && phone.trim()) completed++;
    if (address && address.trim()) completed++;
    return Math.round((completed / total) * 100);
  };

  // --- DIRTY CHECK ---
  const isProfileDirty = () => {
    return (
      fullName !== initialProfile.fullName ||
      phone !== initialProfile.phone ||
      address !== initialProfile.address ||
      bio !== initialProfile.bio ||
      latitude !== initialProfile.latitude ||
      longitude !== initialProfile.longitude
    );
  };

  const isWorkerDirty = () => {
    return (
      selectedCategoryId !== initialWorker.categoryId ||
      experienceYears !== initialWorker.experienceYears ||
      pricingType !== initialWorker.pricingType ||
      price !== initialWorker.price ||
      currency !== initialWorker.currency ||
      availabilityStatus !== initialWorker.availabilityStatus ||
      serviceDescription !== initialWorker.serviceDescription ||
      JSON.stringify(portfolioImages) !== JSON.stringify(initialWorker.portfolioImages)
    );
  };

  // --- AVATAR UPLOAD HANDLER ---
  const handleAvatarUpload = async (filePath: string) => {
    try {
      setLoading(true);
      setLoadingMessage("Updating profile picture...");

      // DELETE OLD AVATAR FIRST (before updating DB)
      if (profile?.avatar_url && !profile.avatar_url.startsWith("http")) {
        try {
          const { error: deleteError } = await supabase.storage
            .from("avatars")
            .remove([profile.avatar_url]);

          if (deleteError) {
            console.log("⚠️ Old avatar delete failed:", deleteError);
          } else {
            console.log("🗑️ Old avatar deleted successfully");
          }
        } catch (err) {
          console.log("⚠️ Old avatar delete error:", err);
        }
      }

      // Update database with new path
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("id", profile!.id);

      if (dbError) throw dbError;

      console.log("✅ Database updated with new avatar path:", filePath);

      // Update local state
      setAvatarUrl(filePath);
      setInitialProfile((prev) => ({ ...prev, avatarUrl: filePath }));

      // Clear cache and force refresh profile
      clearProfileCache();
      await fetchProfile(true);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      showAlert("Success", "Profile picture updated!", "success");
    } catch (error: any) {
      console.error("❌ Avatar upload error:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Error", error.message || "Failed to update profile picture");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleFetchLocation = async () => {
    try {
      setFetchingLocation(true);
      await Haptics.selectionAsync();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert("Permission Denied", "Allow location access to fetch your address.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      // Use coordinates to populate address? Or reverse geocode?
      // User said "fill the address textbox with that... coordinate or address... whatever we get"
      // Better to reverse geocode for a readable address.

      const reverseGeocoded = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocoded.length > 0) {
        const addressObj = reverseGeocoded[0];
        // Construct standard address string
        const parts = [
          addressObj.street || addressObj.name,
          addressObj.city || addressObj.subregion,
          addressObj.region,
          addressObj.postalCode,
          addressObj.country
        ].filter(Boolean);

        const fullAddress = parts.join(", ");
        setAddress(fullAddress);

        showAlert("Success", "Address updated from current location!", "success");
      } else {
        // Fallback to coordinates if address not found
        const coords = `Lat: ${location.coords.latitude}, Long: ${location.coords.longitude}`;
        setAddress(coords);
      }

      console.log("Fetched location:", location.coords);
      // Save coordinates to state so they are pushed to DB on "Save Changes"
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

    } catch (error: any) {
      console.error("Location error:", error);
      showAlert("Error", "Failed to fetch location.");
    } finally {
      setFetchingLocation(false);
    }

  };

  const handlePortfolioImagePick = async (index: number) => {
    try {
      if (loading) return;
      await Haptics.selectionAsync();

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        setLoadingMessage("Uploading image...");
        const uri = result.assets[0].uri;

        // Upload logic similar to avatar
        const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${profile!.id}/${Date.now()}_${index}.${fileExt}`;
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: fileName,
          type: result.assets[0].mimeType || 'image/jpeg',
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(fileName, formData, {
            contentType: result.assets[0].mimeType || 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Determine public URL? Or just store path. 
        // User requested: "data of this img will get stored in worker profile table"
        // We'll store the path in the bucket: fileName
        // But for display we might need public URL.
        // Actually, bucket is public, so we can construct URL or use path.
        // Stick to storing path for consistency.

        const newImages = [...portfolioImages];
        newImages[index] = fileName;
        setPortfolioImages(newImages);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert("Success", "Image uploaded!", "success");
      }
    } catch (error: any) {
      console.error("Portfolio upload error:", error);
      showAlert("Error", error.message || "Failed to upload image");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleRemovePortfolioImage = async (index: number) => {
    // Optional: Delete from storage? Maybe later. For now just remove ref.
    await Haptics.selectionAsync();
    const newImages = [...portfolioImages];
    newImages[index] = null;
    setPortfolioImages(newImages);
  };

  // Resolve helper for portfolio images
  const getPortfolioImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('portfolio').getPublicUrl(path);
    return data.publicUrl;
  };

  const validateProfileFields = () => {
    if (!fullName.trim()) {
      showAlert("Error", "Full name is required");
      return false;
    }
    if (!phone.trim()) {
      showAlert("Error", "Phone number is required");
      return false;
    }
    if (!address.trim()) {
      showAlert("Error", "Address is required");
      return false;
    }
    return true;
  };

  const validateWorkerProfile = () => {
    if (!selectedCategoryId) {
      showAlert("Error", "Please select a category");
      return false;
    }
    if (!experienceYears || parseInt(experienceYears) < 0) {
      showAlert("Error", "Invalid experience");
      return false;
    }
    return true;
  };

  const handleUpdateProfileClick = async () => {
    if (!validateProfileFields()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    await Haptics.selectionAsync();
    setCaptchaAction("update");
    setShowCaptcha(true);
  };

  const handleUpdateProfile = async () => {
    try {
      setShowCaptcha(false);
      setLoading(true);
      setLoadingMessage("Updating profile...");

      const updates = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        bio: bio.trim() || null,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      };

      console.log("Updating profile with:", updates);

      const result = await updateProfile(updates);

      if (result.success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        showAlert("Success", "Profile updated successfully!", "success");
        setInitialProfile((prev) => ({ ...prev, fullName, phone, address, bio }));
        await fetchProfile(true);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Error", result.error || "Failed to update profile");
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerProfileClick = async () => {
    if (!validateWorkerProfile()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    await Haptics.selectionAsync();
    setCaptchaAction("worker");
    setShowCaptcha(true);
  };

  const handleSaveWorkerProfile = async () => {
    try {
      setShowCaptcha(false);
      setLoading(true);
      setLoadingMessage("Saving worker profile...");

      const workerData = {
        user_id: profile!.id,
        category_id: selectedCategoryId,
        experience_years: parseInt(experienceYears),
        pricing_type: pricingType,
        price: price ? parseFloat(price) : null,
        currency: currency,
        availability_status: availabilityStatus,
        service_description: serviceDescription.trim() || null,
        portfolio_images: portfolioImages.filter(img => img !== null) as string[],
      };

      if (workerProfile) {
        await supabase
          .from("worker_profiles")
          .update(workerData)
          .eq("id", workerProfile.id);
      } else {
        await supabase.from("worker_profiles").insert(workerData);
      }

      setInitialWorker({
        categoryId: selectedCategoryId,
        experienceYears: experienceYears,
        pricingType: pricingType,
        price: price,
        currency: currency,
        availabilityStatus: availabilityStatus,
        serviceDescription: serviceDescription,
        portfolioImages: portfolioImages,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert("Success", "Worker profile saved!", "success");
      await fetchWorkerProfile();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Error", "Failed to save worker profile");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitchClick = async () => {
    // If worker (role 1) switching to user
    if (profile?.role === 1) {
      await Haptics.selectionAsync();
      setCaptchaAction("role");
      setShowCaptcha(true);
      return;
    }

    // If user (role 2) trying to become worker
    if (profile?.role === 2) {
      // 1. Check if user was previously a worker (has worker profile)
      // If not, they need to go through upgrade flow
      if (!verificationStatus && !workerProfile) {
        router.push("/WorkerUpgrade");
        return;
      }

      // 2. Check verification status
      if (verificationStatus) {
        if (verificationStatus.status === 'pending') {
          showAlert("Verification Pending", "Your documents are under review by admin.", "info");
          return;
        }
        if (verificationStatus.status === 'docs_approved') {
          // Needs to pay
          router.push({ pathname: "/PaymentScreen", params: { amount: "499", type: "reupgrade" } });
          return;
        }
        if (verificationStatus.status === 'payment_pending') {
          showAlert("Payment Pending", "Your payment is being verified by admin.", "info");
          return;
        }
        if (verificationStatus.status === 'rejected') {
          // Allow them to try again? Or show rejection reason
          showAlert(
            "Verification Rejected",
            `Reason: ${verificationStatus.rejection_reason || 'Documents rejected'}. Please submit again.`,
            "error",
            {
              buttonText: "Re-Submit",
              onConfirm: () => router.push("/WorkerUpgrade")
            }
          );
          return;
        }
      }

      // If no verification status but has worker profile (legacy case or re-upgrade without verification?)
      // Treat as re-upgrade needed
      router.push("/WorkerUpgrade");
    }
  };

  const handleRoleSwitch = async () => {
    try {
      setShowCaptcha(false);
      setLoading(true);
      const currentRole = profile?.role ?? 2;
      const newRole = currentRole === 2 ? 1 : 2;
      const roleName = newRole === 1 ? "Worker" : "User";
      setLoadingMessage(`Switching to ${roleName}...`);

      await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", session.user.id);
      await fetchProfile(true);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert("Success", `Switched to ${roleName}!`, "success");
      if (newRole === 1) fetchCategories();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Error", "Failed to switch role");
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaSuccess = () => {
    if (captchaAction === "update") handleUpdateProfile();
    else if (captchaAction === "role") handleRoleSwitch();
    else if (captchaAction === "worker") handleSaveWorkerProfile();
  };

  const handleSignOut = async () => {
    showAlert(
      "Sign Out",
      "Are you sure you want to sign out?",
      "warning",
      {
        showCancel: true,
        buttonText: "Sign Out",
        onConfirm: async () => {
          try {
            await Haptics.selectionAsync();
            clearProfileCache();
            await AsyncStorage.removeItem("biometrics_enabled");
            await supabase.auth.signOut();
          } catch (error) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            // If sign out fails, we might want to show another alert or just log it
            console.error("Sign out failed", error);
          }
        }
      }
    );
  };

  const handleSelectCategory = async (category: Category) => {
    await Haptics.selectionAsync();
    setSelectedCategoryId(category.id);
    setSelectedCategoryName(category.name);
    setShowCategoryModal(false);
  };

  const handleSelectAvailability = async (status: string) => {
    await Haptics.selectionAsync();
    setAvailabilityStatus(status);
    setShowAvailabilityModal(false);
  };

  const toggleWorkerProfile = async () => {
    await Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkerProfileExpanded((prev) => !prev);
  };

  const completionPercentage = getProfileCompletion();
  const isProfileComplete = profile?.is_profile_complete ?? false;
  const currentRole = profile?.role ?? 2;

  // Calculate remaining days for worker subscription
  const getRemainingDays = (): number | null => {
    if (currentRole !== 1 || !subscriptionExpiresAt) return null;
    const now = new Date();
    const expiresAt = new Date(subscriptionExpiresAt);
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const remainingDays = getRemainingDays();
  const roleDisplayName =
    currentRole === 0
      ? "Admin"
      : currentRole === 1
        ? (remainingDays !== null ? `Worker ${remainingDays}D` : "Worker")
        : "User";
  const availabilityLabel =
    availabilityStatus === "available"
      ? "Available"
      : availabilityStatus === "busy"
        ? "Busy"
        : "Unavailable";

  const FixedHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTopRow}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Account
        </Text>
        <View
          style={[
            styles.roleBadge,
            currentRole === 1 && remainingDays !== null && remainingDays <= 7 && styles.roleBadgeWarning
          ]}
          accessibilityLabel={`Current role: ${roleDisplayName}`}
        >
          <Text style={styles.roleText}>{roleDisplayName}</Text>
        </View>
      </View>
    </View>
  );

  if (profileLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#059ef1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={colors.background} />

        <FixedHeader />

        {/* Animated Banner (slide + fade + dismiss) */}
        {BANNER_CONFIG.showBanner && showBanner && (
          <Animated.View
            style={[
              styles.bannerContainer,
              { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={dismissBanner}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                isProfileComplete
                  ? "All set. Your profile is ready."
                  : `Profile incomplete. Only ${completionPercentage} percent complete.`
              }
            >
              <View
                style={[
                  styles.banner,
                  isProfileComplete
                    ? styles.bannerComplete
                    : styles.bannerIncomplete,
                ]}
              >
                <Ionicons
                  name={isProfileComplete ? "checkmark-circle" : "alert-circle"}
                  size={24}
                  color="#FFF"
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.bannerTitle}>
                    {isProfileComplete ? "All Set!" : "Profile Incomplete"}
                  </Text>
                  <Text style={styles.bannerText}>
                    {isProfileComplete
                      ? "Your profile is ready."
                      : `Only ${completionPercentage}% complete.`}
                  </Text>
                </View>
                <Ionicons name="close" size={18} color="#FFF" />
              </View>
            </Pressable>
          </Animated.View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Card */}
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.avatarContainer}>
                <Avatar size={80} url={avatarUrl} onUpload={handleAvatarUpload} editable={!profile?.avatar_locked} />
              </View>

              <View style={styles.headerInfo}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {fullName || "Your Name"}
                </Text>
                <Text style={styles.headerEmail} numberOfLines={1}>
                  {profile?.email}
                </Text>
                <Text style={styles.headerPhone} numberOfLines={1}>
                  {phone || "No phone added"}
                </Text>
              </View>
            </View>

            {!isProfileComplete && (
              <View
                style={styles.progressContainer}
                accessibilityLabel={`Profile completion: ${completionPercentage} percent`}
              >
                <View
                  style={[styles.progressBar, { width: `${completionPercentage}%` }]}
                />
              </View>
            )}
          </View>

          {/* Personal Info Form */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Details</Text>

            <View style={styles.inputGroup}>
              <Text nativeID="fullNameLabel" style={styles.label}>
                Full Name
              </Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabelledBy="fullNameLabel"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text nativeID="phoneLabel" style={styles.label}>
                Phone
              </Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+1 234 567 890"
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                returnKeyType="next"
                accessibilityLabelledBy="phoneLabel"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text nativeID="addressLabel" style={styles.label}>
                  Address
                </Text>
                <Pressable
                  onPress={handleFetchLocation}
                  disabled={fetchingLocation}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 })}
                >
                  {fetchingLocation ? (
                    <ActivityIndicator size="small" color="#059ef1" />
                  ) : (
                    <Ionicons name="location-outline" size={16} color="#059ef1" />
                  )}
                  <Text style={{ color: "#059ef1", fontSize: 13, fontWeight: "600" }}>
                    {fetchingLocation ? "Fetching..." : "Use Current Location"}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={address}
                onChangeText={setAddress}
                multiline
                textAlignVertical="top"
                placeholder="Your address..."
                placeholderTextColor={colors.textSecondary}
                accessibilityLabelledBy="addressLabel"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text nativeID="bioLabel" style={styles.label}>
                Bio
              </Text>
              <TextInput
                style={[styles.input, { height: 100 }]}
                value={bio}
                onChangeText={setBio}
                multiline
                textAlignVertical="top"
                maxLength={500}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textSecondary}
                accessibilityLabelledBy="bioLabel"
              />
              {bio.length > 0 && (
                <Text style={styles.charCount}>{bio.length}/500</Text>
              )}
            </View>

            <Pressable
              style={[styles.primaryBtn, !isProfileDirty() && styles.disabledBtn]}
              onPress={handleUpdateProfileClick}
              disabled={!isProfileDirty() || loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isProfileDirty() || loading }}
              accessibilityLabel="Save profile changes"
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  !isProfileDirty() && { color: colors.textSecondary },
                ]}
              >
                Save Changes
              </Text>
            </Pressable>
          </View>

          {/* Upgrade to Worker Promo (for Users only) - Hide if already waiting for verification */}
          {currentRole === 2 && !verificationStatus && (
            <Pressable
              style={styles.upgradeCard}
              onPress={() => router.push("/WorkerUpgrade")}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Worker"
            >
              <View style={styles.upgradeContent}>
                <View style={styles.upgradeIconBox}>
                  <MaterialCommunityIcons
                    name="briefcase-check"
                    size={28}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upgradeTitle}>Become a Worker</Text>
                  <Text style={styles.upgradeSubtitle}>
                    Start earning by offering your services
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>
            </Pressable>
          )}

          {/* Worker Profile (Accordion Style) */}
          {currentRole === 1 && (
            <View style={styles.card}>
              <Pressable
                style={styles.accordionHeader}
                onPress={toggleWorkerProfile}
                accessibilityRole="button"
                accessibilityState={{ expanded: workerProfileExpanded }}
                accessibilityLabel="Worker Profile"
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons
                      name="briefcase-outline"
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.sectionTitleNoMargin}>Worker Profile</Text>
                </View>

                <Ionicons
                  name={workerProfileExpanded ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={colors.textSecondary}
                />
              </Pressable>

              {workerProfileExpanded && (
                <View style={{ marginTop: 16 }}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Specialty Category</Text>
                    <Pressable
                      style={styles.selectInput}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setShowCategoryModal(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Select category"
                    >
                      <Text style={{ color: selectedCategoryId ? colors.text : colors.textSecondary }}>
                        {selectedCategoryName}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  <View style={styles.rowInputs}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Experience (Yrs)</Text>
                      <TextInput
                        style={styles.input}
                        value={experienceYears}
                        onChangeText={setExperienceYears}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Status</Text>
                      <Pressable
                        style={styles.selectInput}
                        onPress={async () => {
                          await Haptics.selectionAsync();
                          setShowAvailabilityModal(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Select availability status"
                      >
                        <Text style={{ color: colors.text, fontSize: 14 }}>
                          {availabilityLabel}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>

                  <Text style={[styles.label, { marginTop: 4 }]}>Pricing</Text>
                  <View style={styles.pricingContainer}>
                    <Pressable
                      style={styles.pricingTypeBtn}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setShowPricingTypeModal(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Select pricing type"
                    >
                      <Text style={{ fontWeight: "600", color: colors.text }}>
                        {pricingType === "hourly" ? "Hourly" : "Fixed"}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                    </Pressable>

                    <View style={styles.priceInputWrapper}>
                      <TextInput
                        style={styles.pricingInput}
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.textSecondary}
                        accessibilityLabel="Enter price"
                      />
                    </View>

                    <Pressable
                      style={styles.currencyBtn}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setShowCurrencyModal(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Select currency"
                    >
                      <Text style={{ fontWeight: "700", color: "#fff" }}>
                        {currency}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Service Description</Text>
                    <TextInput
                      style={[styles.input, { height: 80 }]}
                      value={serviceDescription}
                      onChangeText={setServiceDescription}
                      multiline
                      placeholder="What do you offer?"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>



                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Portfolio (Max 3)</Text>
                    <View style={styles.portfolioRow}>
                      {portfolioImages.map((img, index) => {
                        const url = getPortfolioImageUrl(img);
                        return (
                          <View key={index} style={[styles.portfolioBox, { backgroundColor: mode === 'dark' ? colors.border : '#F5F5F5' }]}>
                            {url ? (
                              <>
                                <Animated.Image source={{ uri: url }} style={styles.portfolioImage} />
                                <Pressable
                                  style={styles.removeImageBtn}
                                  onPress={() => handleRemovePortfolioImage(index)}
                                >
                                  <Ionicons name="close-circle" size={24} color="#FF5252" />
                                </Pressable>
                              </>
                            ) : (
                              <Pressable
                                style={styles.uploadPlaceholder}
                                onPress={() => handlePortfolioImagePick(index)}
                              >
                                <Ionicons name="add" size={30} color={colors.textSecondary} />
                                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Upload</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      !isWorkerDirty() && styles.disabledBtnSecondary,
                    ]}
                    onPress={handleWorkerProfileClick}
                    disabled={!isWorkerDirty() || loading}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !isWorkerDirty() || loading }}
                    accessibilityLabel="Update worker profile"
                  >
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        !isWorkerDirty() && { color: colors.textSecondary },
                      ]}
                    >
                      Update Worker Profile
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Role Switcher */}
          {currentRole !== 0 && (
            <Pressable
              style={styles.roleSwitchCard}
              onPress={handleRoleSwitchClick}
              accessibilityRole="button"
              accessibilityLabel="Switch mode"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.iconBox, { backgroundColor: mode === 'dark' ? 'rgba(255, 152, 0, 0.15)' : "#FFF3E0" }]}>
                  <MaterialCommunityIcons
                    name="swap-horizontal"
                    size={22}
                    color={colors.warning}
                  />
                </View>
                <View>
                  <Text style={styles.roleSwitchTitle}>
                    {verificationStatus?.status === 'docs_approved' && profile?.role === 2 ? "Complete Payment" :
                      verificationStatus?.status === 'payment_pending' && profile?.role === 2 ? "Verification Pending" :
                        "Switch Mode"}
                  </Text>
                  <Text style={styles.roleSwitchSubtitle}>
                    {verificationStatus?.status === 'docs_approved' && profile?.role === 2 ? "Action Required" :
                      verificationStatus?.status === 'payment_pending' && profile?.role === 2 ? "Admin is verifying" :
                        `Currently: ${roleDisplayName}`}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={"#FFF3E0"} />
            </Pressable>
          )}

          {/* Settings Button */}
          <Pressable
            style={[styles.settingsCard, { borderColor: "#787777ff" }]}
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: mode === 'dark' ? colors.border : "#ECEFF1" }]}>
                <Ionicons name="settings-outline" size={22} color={mode === 'dark' ? "#aaa" : "#555"} />
              </View>
              <Text style={styles.settingsText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={mode === 'dark' ? "#aaa" : "#555"} />
          </Pressable>

          {/* Sign Out */}
          <Pressable
            style={styles.signOutCard}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={mode === 'dark' ? colors.danger + '80' : "#f2b3b0"} />
          </Pressable>
        </ScrollView>
      </View >

      {/* Reusable Selection Modal */}
      {
        [
          {
            visible: showCategoryModal,
            close: () => setShowCategoryModal(false),
            title: "Select Category",
            items: categories,
            onSelect: handleSelectCategory,
            key: "id",
            label: "name",
          },
          {
            visible: showAvailabilityModal,
            close: () => setShowAvailabilityModal(false),
            title: "Status",
            items: [
              { id: "available", name: "Available" },
              { id: "busy", name: "Busy" },
              { id: "unavailable", name: "Unavailable" },
            ],
            onSelect: (i: any) => handleSelectAvailability(i.id),
            key: "id",
            label: "name",
          },
          {
            visible: showPricingTypeModal,
            close: () => setShowPricingTypeModal(false),
            title: "Pricing Type",
            items: [
              { id: "hourly", name: "Hourly Rate" },
              { id: "fix", name: "Fixed Price" },
            ],
            onSelect: async (i: any) => {
              await Haptics.selectionAsync();
              setPricingType(i.id);
              setShowPricingTypeModal(false);
            },
            key: "id",
            label: "name",
          },
          {
            visible: showCurrencyModal,
            close: () => setShowCurrencyModal(false),
            title: "Currency",
            items: [
              { id: "USD", name: "USD ($)" },
              { id: "INR", name: "INR (₹)" },
            ],
            onSelect: async (i: any) => {
              await Haptics.selectionAsync();
              setCurrency(i.id);
              setShowCurrencyModal(false);
            },
            key: "id",
            label: "name",
          },
        ].map((modal, index) => (
          <Modal
            key={index}
            visible={modal.visible}
            transparent
            animationType="fade"
            onRequestClose={modal.close}
          >
            <Pressable style={styles.modalOverlay} onPress={modal.close}>
              <Pressable
                style={styles.modalContent}
                onPress={() => { }}
                accessibilityRole="menu"
              >
                <Text style={styles.modalTitle}>{modal.title}</Text>
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {modal.items.map((item: any) => (
                    <Pressable
                      key={item[modal.key]}
                      style={styles.modalItem}
                      onPress={() => modal.onSelect(item)}
                      accessibilityRole="menuitem"
                    >
                      <Text style={styles.modalItemText}>{item[modal.label]}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#ccc" />
                    </Pressable>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        ))
      }

      <CaptchaModal
        visible={showCaptcha}
        onSuccess={handleCaptchaSuccess}
        onCancel={() => setShowCaptcha(false)}
        isSubmitting={loading}
      />
      <LoadingOverlay visible={loading && !showCaptcha} message={loadingMessage} />
      <AlertComponent />
    </KeyboardAvoidingView >
  );
}

const getStyles = (colors: any, mode: string, insets: any) => StyleSheet.create({
  // --- LAYOUT ---
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 44 },

  // --- HEADER CONTAINER ---
  headerContainer: {
    backgroundColor: colors.card,
    paddingTop: Math.max(insets.top, 10) + 10,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: "#111",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  roleBadge: {
    backgroundColor: mode === 'dark' ? 'rgba(5, 158, 241, 0.15)' : "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  roleBadgeWarning: {
    backgroundColor: mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : "#FFF3E0",
    borderColor: colors.warning,
  },

  // --- BANNER ---
  bannerContainer: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  bannerComplete: { backgroundColor: colors.success || "#4CAF50" },
  bannerIncomplete: { backgroundColor: colors.warning || "#FF9800" },
  bannerTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  bannerText: { color: "#fff", fontSize: 12, marginTop: 2 },

  // --- CARDS ---
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: mode === 'dark' ? 1 : 0,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 16,
  },
  sectionTitleNoMargin: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },

  // --- HEADER SECTION ---
  headerRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  avatarContainer: { bottom: 22 },
  headerInfo: { flex: 1, justifyContent: "center" },
  headerName: { fontSize: 20, fontWeight: "800", color: colors.text },
  headerEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  headerPhone: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  progressContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 20,
    overflow: "hidden",
  },
  progressBar: { height: "100%", backgroundColor: colors.primary },

  // --- FORMS ---
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: mode === 'dark' ? colors.background : "#F9FAFB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  selectInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: mode === 'dark' ? colors.background : "#F9FAFB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  charCount: { textAlign: "right", fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  rowInputs: { flexDirection: "row", gap: 12 },

  // --- BUTTONS ---
  primaryBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "800" },
  disabledBtn: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  disabledBtnSecondary: { borderColor: colors.border, backgroundColor: mode === 'dark' ? colors.background : "#F4F6F8" },

  // --- WORKER PROFILE ---
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: mode === 'dark' ? 'rgba(5, 158, 241, 0.15)' : "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },

  // --- PRICING UI ---
  pricingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mode === 'dark' ? colors.background : "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    marginTop: 6,
    overflow: "hidden",
  },
  pricingTypeBtn: {
    padding: 13,
    backgroundColor: mode === 'dark' ? colors.background : "#EEF2F6",
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  priceInputWrapper: { flex: 1 },
  pricingInput: { padding: 12, fontSize: 16, color: colors.text },
  currencyBtn: {
    padding: 13,
    backgroundColor: colors.primary,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },

  // --- ROLE SWITCH ---
  roleSwitchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.warning + '40' : "#FFECB3",
  },
  roleSwitchTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  roleSwitchSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // --- SIGNOUT (safer + clearer) ---
  signOutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.danger + '40' : "#FAD4D1",
    marginBottom: 10,
  },
  signOutText: { color: colors.danger, fontWeight: "800" },

  // --- MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: { backgroundColor: colors.card, borderRadius: 16, padding: 20, maxHeight: 420 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
    color: colors.text,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemText: { fontSize: 16, color: colors.text },
  // --- SETTINGS BUTTON ---
  settingsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsText: { fontWeight: "800", color: colors.text, fontSize: 16 },

  // --- UPGRADE TO WORKER PROMO ---
  upgradeCard: {
    backgroundColor: "#6366f1",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  upgradeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },

  portfolioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  portfolioBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
