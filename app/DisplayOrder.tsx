// app/DisplayOrder.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useCustomAlert } from "../components/CustomAlert";
import RatingModal from "../components/Ratingmodal";
import { useAdminTheme } from "../context/AdminThemeContext";
import { supabase } from "../utils/supabase";
import { useProfile } from "../utils/useProfile";

const { width } = Dimensions.get("window");

interface OrderDetails {
  id: number;
  user_id: string;
  worker_id: string;
  category_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  problem_description: string | null;
  problem_image_url: string | null;
  initiate_otp: string | null;
  complete_otp: string | null;
  pricing_type: string | null;
  price_amount: number | null;
  currency: string | null;
  hours_worked: number | null;
  extra_parts_cost: number | null;
  total_price: number | null;
  status: 'pending' | 'accepted' | 'initiated' | 'completed' | 'cancelled' | 'rejected';
  is_rated: boolean;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null; // Added this to interface
  categories: {
    name: string;
    icon: string;
  };
  worker_profile: {
    full_name: string;
    avatar_url: string | null;
    average_rating: number;
    total_ratings: number;
  };
  customer_profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function DisplayOrderScreen() {
  const { colors, mode } = useAdminTheme();
  const styles = useMemo(() => getStyles(colors, mode), [colors, mode]);
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useProfile();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpInput, setOtpInput] = useState("");
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [workerProfileId, setWorkerProfileId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userRating, setUserRating] = useState<{ rating: number; review: string | null; created_at: string } | null>(null);

  // Pricing calculation states
  const [hoursWorked, setHoursWorked] = useState("");
  const [extraPartsCost, setExtraPartsCost] = useState("0");
  const [calculatedTotal, setCalculatedTotal] = useState(0);

  const isWorker = profile?.role === 1;
  const isCustomer = order && profile?.id === order.user_id;

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  useEffect(() => {
    if (order?.hours_worked) setHoursWorked(order.hours_worked.toString());
    if (order?.extra_parts_cost) setExtraPartsCost(order.extra_parts_cost.toString());
    if (order?.total_price) setCalculatedTotal(order.total_price);
  }, [order]);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
      const channel = supabase
        .channel(`order-${orderId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          (payload: any) => {
            fetchOrderDetails();
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [orderId]);

  useEffect(() => {
    if (order?.status === 'completed') fetchUserRating();
  }, [order?.status]);

  const fetchUserRating = async () => {
    if (!orderId) return;
    try {
      const { data: ratingData, error } = await supabase
        .from('ratings')
        .select('rating, review, created_at')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!error && ratingData) setUserRating(ratingData);
      else setUserRating(null);
    } catch (error) {
      setUserRating(null);
    }
  };

  const calculateTotal = (hours: string, extra: string) => {
    const hoursNum = parseFloat(hours) || 0;
    const extraNum = parseFloat(extra) || 0;
    const rate = order?.price_amount || 0;
    if (order?.pricing_type === 'hourly') return (hoursNum * rate) + extraNum;
    return (order?.price_amount || 0) + extraNum;
  };

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`*, categories (name, icon)`)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      const { data: workerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', data.worker_id)
        .single();

      const { data: workerStats } = await supabase
        .from('worker_profiles')
        .select('id, average_rating, total_ratings')
        .eq('user_id', data.worker_id)
        .single();

      if (workerStats) setWorkerProfileId(workerStats.id);

      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', data.user_id)
        .single();

      if (data.status === 'completed') {
        const { data: ratingData } = await supabase
          .from('ratings')
          .select('rating, review, created_at')
          .eq('order_id', orderId)
          .maybeSingle();
        if (ratingData) setUserRating(ratingData);
      }

      setOrder({
        ...data,
        worker_profile: {
          full_name: workerProfile?.full_name || 'Unknown',
          avatar_url: workerProfile?.avatar_url || null,
          average_rating: workerStats?.average_rating || 0,
          total_ratings: workerStats?.total_ratings || 0,
        },
        customer_profile: {
          full_name: customerProfile?.full_name || 'Unknown',
          avatar_url: customerProfile?.avatar_url || null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching order:', error);
      showAlert("Error", "Failed to load order details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRatingModal = async () => setShowRatingModal(true);

  const handleCancelOrder = async () => {
    showAlert("Cancel Order", "Are you sure you want to cancel this order?", "warning", {
      showCancel: true,
      buttonText: "Yes, Cancel",
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .eq('user_id', profile?.id);
          if (error) throw error;
          showAlert("Success", "Order cancelled", "success", { buttonText: "OK", onConfirm: () => router.back() });
        } catch (error: any) {
          showAlert("Error", error.message, "error");
        }
      }
    });
  };

  const handleSubmitOTP = async () => {
    if (!order || !otpInput.trim()) {
      showAlert("Error", "Please enter OTP", "error");
      return;
    }
    setSubmitting(true);
    try {
      const otp = otpInput.trim();
      let newStatus: string | null = null;
      let additionalUpdates: any = {};

      if (order.status === 'accepted' && otp === order.initiate_otp) {
        newStatus = 'initiated';
        additionalUpdates = { initiated_at: new Date().toISOString() };
      } else if (order.status === 'initiated' && otp === order.complete_otp) {
        newStatus = 'completed';
        additionalUpdates = { completed_at: new Date().toISOString() };
        if (hoursWorked || extraPartsCost) {
          additionalUpdates = {
            ...additionalUpdates,
            hours_worked: parseFloat(hoursWorked) || null,
            extra_parts_cost: parseFloat(extraPartsCost) || 0,
            total_price: calculatedTotal
          };
        }
      } else {
        showAlert("Error", "Invalid OTP", "error");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('orders').update({ status: newStatus, ...additionalUpdates }).eq('id', orderId).eq('worker_id', profile?.id);
      if (error) throw error;

      setOtpInput("");
      showAlert("Success", `Order status updated to ${newStatus}`, "success");
      fetchOrderDetails();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('order-images').getPublicUrl(path);
    return data.publicUrl;
  };

  // Memoized dependencies for internal functions if needed, but simple functions are fine.
  // We need to ensure sub-components like StatusCard that depend on styles render correctly.


  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#FFA000";
      case "accepted": return "#2196F3";
      case "initiated": return "#9C27B0";
      case "completed": return "#4CAF50";
      case "cancelled": return "#F44336";
      case "rejected": return "#D32F2F";
      default: return "#757575";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return "clock-outline";
      case "accepted": return "check-circle-outline";
      case "initiated": return "progress-wrench";
      case "completed": return "check-decagram";
      case "cancelled": return "close-circle-outline";
      case "rejected": return "cancel";
      default: return "help-circle-outline";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // --- DYNAMIC TIMELINE GENERATOR ---
  const getTimelineEvents = () => {
    if (!order) return [];

    // Fix: Explicitly define the type so 'date' can be string or null
    const events: { label: string; date: string | null; active: boolean; color: string }[] = [
      { label: 'Created', date: order.created_at, active: true, color: '#059ef1' }
    ];

    // If cancelled/rejected, we show that path
    if (order.status === 'cancelled') {
      // We might want to show Accepted before Cancelled if it happened
      if (order.accepted_at) {
        events.push({ label: 'Accepted', date: order.accepted_at, active: true, color: '#2196F3' });
      }
      // Use cancelled_at or fallback to updated_at
      events.push({
        label: 'Cancelled',
        date: order.cancelled_at || order.updated_at,
        active: true,
        color: '#F44336' // Red for cancel
      });
      return events;
    }

    if (order.status === 'rejected') {
      // Rejection usually happens from Pending
      events.push({
        label: 'Rejected',
        date: order.updated_at,
        active: true,
        color: '#D32F2F' // Dark Red
      });
      return events;
    }

    // Normal Flow
    if (order.accepted_at) {
      events.push({ label: 'Accepted', date: order.accepted_at, active: true, color: '#059ef1' });
    } else {
      events.push({ label: 'Accepted', date: null, active: false, color: '#E0E0E0' });
    }

    if (order.initiated_at) {
      events.push({ label: 'Started', date: order.initiated_at, active: true, color: '#059ef1' });
    } else {
      events.push({ label: 'Started', date: null, active: false, color: '#E0E0E0' });
    }

    if (order.completed_at) {
      events.push({ label: 'Completed', date: order.completed_at, active: true, color: '#4CAF50' });
    } else {
      events.push({ label: 'Completed', date: null, active: false, color: '#E0E0E0' });
    }

    return events;
  };

  const getCurrencySymbol = (curr: string | null) => (curr === 'INR' ? '₹' : '$');

  useEffect(() => {
    navigation.setOptions({
      headerTitle: `Order #${orderId}`,
      headerTitleStyle: { fontWeight: '800', fontSize: 18, color: mode === 'dark' ? colors.text : '#1A1A1A' },
      headerStyle: { backgroundColor: mode === 'dark' ? colors.headerBg : '#FFFFFF' },
      headerShadowVisible: false,
      headerTintColor: mode === 'dark' ? colors.primary : '#059ef1',
    });
  }, [navigation, orderId, mode, colors]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059ef1" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(order.status);
  const statusIcon = getStatusIcon(order.status);
  const statusLabel = getStatusLabel(order.status);
  const imageUrl = getImageUrl(order.problem_image_url);
  const canCancel = isCustomer && (order.status === 'pending' || order.status === 'accepted');
  const currencySymbol = getCurrencySymbol(order.currency);
  const timelineEvents = getTimelineEvents();

  return (
    <View style={styles.container}>
      <Stack.Screen />
      <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={mode === 'dark' ? colors.headerBg : "#fff"} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* FIX 1: CENTERED BOLD STATUS HEADER */}
        <View style={[styles.statusCard, { borderColor: statusColor, borderTopColor: statusColor }]}>
          <MaterialCommunityIcons name={statusIcon as any} size={32} color={statusColor} style={{ marginBottom: 8 }} />
          <Text style={[styles.statusLabelBig, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={styles.statusSubtext}>
            {new Date(order.updated_at).toLocaleDateString()} • {new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Category & Profiles */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: mode === 'dark' ? colors.iconBg : "#E3F2FD" }]}>
              <MaterialCommunityIcons name={order.categories.icon as any} size={24} color={mode === 'dark' ? colors.primary : "#059ef1"} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.categoryTitle}>{order.categories.name}</Text>
              <Text style={styles.sectionHeader}>
                {isWorker ? 'Customer Details' : 'Worker Details'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.profileRow}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(isWorker ? order.customer_profile.full_name : order.worker_profile.full_name).charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.personName}>
                {isWorker ? order.customer_profile.full_name : order.worker_profile.full_name}
              </Text>
              {!isWorker && order.worker_profile.average_rating > 0 && (
                <View style={styles.ratingRow}>
                  <MaterialCommunityIcons name="star" size={14} color="#FFB300" />
                  <Text style={styles.ratingText}>
                    {order.worker_profile.average_rating.toFixed(1)} ({order.worker_profile.total_ratings})
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Pricing Info */}
        {order.price_amount && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="cash" size={20} color="#059ef1" />
              <Text style={styles.cardTitle}>Pricing</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Agreed Rate</Text>
              <Text style={styles.priceValue}>
                {currencySymbol}{order.price_amount.toFixed(0)}
                {order.pricing_type === 'hourly' ? '/hr' : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#059ef1" />
            <Text style={styles.cardTitle}>Details</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <View style={styles.detailValueContainer}>
              <Text style={styles.detailValue}>{order.customer_name}</Text>
            </View>
          </View>

          {/* FIX 2: PHONE ALIGNMENT */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Pressable style={styles.detailValueContainer} onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}>
              <Text style={[styles.detailValue, styles.linkText]}>{order.customer_phone}</Text>
            </Pressable>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <View style={styles.detailValueContainer}>
              <Text style={styles.detailValue}>{order.customer_address}</Text>
            </View>
          </View>

          {order.problem_description && (
            <View style={styles.problemBox}>
              <Text style={styles.problemLabel}>Description</Text>
              <Text style={styles.problemText}>{order.problem_description}</Text>
            </View>
          )}

          {imageUrl && (
            <View style={styles.imageContainer}>
              <Text style={styles.problemLabel}>Image</Text>
              <Image source={{ uri: imageUrl }} style={styles.problemImage} />
            </View>
          )}
        </View>

        {/* CALCULATE TOTAL (Customer + Initiated) */}
        {isCustomer && order.status === 'initiated' && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="calculator" size={20} color="#059ef1" />
              <Text style={styles.cardTitle}>Payment Calculator</Text>
            </View>

            {order.pricing_type === 'hourly' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hours Worked</Text>
                <TextInput
                  style={styles.input}
                  value={hoursWorked}
                  onChangeText={(val) => {
                    setHoursWorked(val);
                    setCalculatedTotal(calculateTotal(val, extraPartsCost));
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#999"}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Extra Parts Cost</Text>
              <TextInput
                style={styles.input}
                value={extraPartsCost}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9.]/g, '');
                  setExtraPartsCost(cleaned);
                  setCalculatedTotal(calculateTotal(hoursWorked, cleaned));
                }}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#999"}
              />
            </View>

            <View style={styles.totalDisplay}>
              <Text style={styles.totalLabel}>Total Payable</Text>
              <Text style={styles.totalAmount}>{currencySymbol}{calculatedTotal.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* WORKER ACTIONS (OTP INPUT) */}
        {isWorker && (order.status === 'accepted' || order.status === 'initiated') && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="key-variant" size={20} color="#059ef1" />
              <Text style={styles.cardTitle}>
                {order.status === 'accepted' ? 'Start Job' : 'Complete Job'}
              </Text>
            </View>

            <Text style={styles.instructionText}>
              Enter the OTP provided by the customer to {order.status === 'accepted' ? 'start' : 'complete'} the service.
            </Text>

            <TextInput
              style={styles.otpInput}
              value={otpInput}
              onChangeText={setOtpInput}
              placeholder="● ● ● ● ● ●"
              placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#ccc"}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Pressable
              style={[styles.primaryBtn, submitting && styles.disabledBtn]}
              onPress={handleSubmitOTP}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit OTP</Text>}
            </Pressable>
          </View>
        )}

        {/* CUSTOMER OTP DISPLAY */}
        {isCustomer && (order.status === 'accepted' || order.status === 'initiated') && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="lock-open-outline" size={20} color="#059ef1" />
              <Text style={styles.cardTitle}>Secret OTP</Text>
            </View>

            {order.status === 'accepted' && order.initiate_otp && (
              <View style={styles.otpContainer}>
                <Text style={styles.otpLabel}>Start OTP</Text>
                <Text style={styles.otpValue}>{order.initiate_otp}</Text>
                <Text style={styles.otpInstruction}>Share this with worker upon arrival</Text>
              </View>
            )}

            {order.status === 'initiated' && order.complete_otp && (
              <View style={styles.otpContainer}>
                <Text style={styles.otpLabel}>Completion OTP</Text>
                <Text style={styles.otpValue}>{order.complete_otp}</Text>
                <Text style={styles.otpInstruction}>Share this when work is done satisfactorily</Text>
              </View>
            )}
          </View>
        )}

        {/* PAYMENT SUMMARY (Completed) */}
        {order.status === 'completed' && order.total_price && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="receipt" size={20} color="#059ef1" />
              <Text style={styles.cardTitle}>Receipt</Text>
            </View>

            {/* Dynamic Summary Rows */}
            {order.pricing_type === 'hourly' && order.hours_worked && (
              <>
                <View style={styles.summaryRow}><Text style={styles.summaryText}>Hours ({order.hours_worked})</Text><Text style={styles.summaryValue}>{currencySymbol}{((order.hours_worked || 0) * (order.price_amount || 0)).toFixed(2)}</Text></View>
              </>
            )}
            {order.pricing_type === 'fix' && (
              <View style={styles.summaryRow}><Text style={styles.summaryText}>Fixed Price</Text><Text style={styles.summaryValue}>{currencySymbol}{order.price_amount?.toFixed(2)}</Text></View>
            )}
            {(order.extra_parts_cost || 0) > 0 && (
              <View style={styles.summaryRow}><Text style={styles.summaryText}>Extra Parts</Text><Text style={styles.summaryValue}>{currencySymbol}{order.extra_parts_cost?.toFixed(2)}</Text></View>
            )}

            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelSmall}>Total Paid</Text>
              <Text style={styles.totalValueSmall}>{currencySymbol}{order.total_price.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* CANCEL BUTTON */}
        {canCancel && (
          <Pressable style={styles.cancelBtn} onPress={handleCancelOrder}>
            <MaterialCommunityIcons name="close-circle-outline" size={20} color="#F44336" />
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          </Pressable>
        )}

        {/* RATING SECTION */}
        {order.status === 'completed' && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="star-outline" size={20} color="#FFB300" />
              <Text style={styles.cardTitle}>Review</Text>
            </View>

            {!userRating && isCustomer && (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={styles.instructionText}>How was your experience?</Text>
                <Pressable style={styles.ratingBtn} onPress={handleOpenRatingModal}>
                  <Text style={styles.ratingBtnText}>Write a Review</Text>
                </Pressable>
              </View>
            )}

            {userRating && (
              <View>
                <View style={styles.ratingHeader}>
                  <View style={{ flexDirection: 'row' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <MaterialCommunityIcons key={star} name="star" size={20} color={star <= userRating.rating ? "#FFB300" : (mode === 'dark' ? colors.border : "#eee")} />
                    ))}
                  </View>
                  <Text style={styles.ratingDate}>{new Date(userRating.created_at).toLocaleDateString()}</Text>
                </View>
                {userRating.review && <Text style={styles.reviewBody}>"{userRating.review}"</Text>}
              </View>
            )}

            {!userRating && isWorker && (
              <Text style={[styles.instructionText, { textAlign: 'center' }]}>Waiting for customer review.</Text>
            )}
          </View>
        )}

        {/* FIX 3: DYNAMIC TIMELINE */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Timeline</Text>
          {timelineEvents.map((item, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={[styles.timelineDot, item.active && { backgroundColor: item.color }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, item.active && { color: item.color, fontWeight: '700' }]}>{item.label}</Text>
                {item.date && <Text style={styles.timelineDate}>{new Date(item.date).toLocaleString()}</Text>}
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Rating Modal */}
      {workerProfileId && showRatingModal && (
        <RatingModal
          visible={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          orderId={parseInt(orderId)}
          workerProfileId={workerProfileId}
          userId={profile?.id || ''}
          onRatingSubmitted={() => {
            setShowRatingModal(false);
            fetchOrderDetails();
          }}
        />
      )}
      <AlertComponent />
    </View>
  );
}

const getStyles = (colors: any, mode: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mode === 'dark' ? colors.background : "#F5F7FA", // Professional Grey
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: mode === 'dark' ? colors.background : "#F5F7FA",
  },
  errorText: {
    color: mode === 'dark' ? colors.textSecondary : '#666',
    fontSize: 16,
  },

  // --- CARDS ---
  card: {
    backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#f0f0f0',
  },
  divider: {
    height: 1,
    backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0',
    marginVertical: 12,
  },

  // --- HEADERS & TITLES ---
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: mode === 'dark' ? colors.text : '#1A1A1A',
  },

  // --- STATUS HEADER (Centered) ---
  statusCard: {
    backgroundColor: mode === 'dark' ? colors.card : '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderTopWidth: 5, // Top border colored by status
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  statusLabelBig: {
    fontSize: 22,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : '#999',
  },

  // --- CATEGORY & PROFILE ---
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mode === 'dark' ? colors.text : "#1A1A1A",
  },
  sectionHeader: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : '#666',
    marginTop: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mode === 'dark' ? colors.iconBg : '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059ef1',
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : '#333',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : '#666',
  },

  // --- PRICING & DETAILS ---
  priceBox: {
    backgroundColor: mode === 'dark' ? colors.background : '#F5F7FA',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : '#666',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: mode === 'dark' ? colors.text : '#059ef1',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Important for multiline text
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  detailLabel: {
    color: mode === 'dark' ? colors.textSecondary : '#666',
    fontSize: 14,
    width: '30%', // Fixed width for label
  },
  detailValueContainer: {
    flex: 1, // Takes remaining space
    alignItems: 'flex-end', // Aligns text to right
  },
  detailValue: {
    color: mode === 'dark' ? colors.text : '#333',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right', // Ensures text aligns right
  },
  linkText: {
    color: '#059ef1',
  },
  problemBox: {
    marginTop: 12,
    backgroundColor: mode === 'dark' ? colors.background : '#FFF9C4',
    padding: 12,
    borderRadius: 8,
  },
  problemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: mode === 'dark' ? colors.warning : '#FBC02D',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  problemText: {
    fontSize: 14,
    color: mode === 'dark' ? colors.text : '#333',
    lineHeight: 20,
  },
  imageContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: mode === 'dark' ? colors.background : '#f9f9f9',
    padding: 8,
  },
  problemImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: '#f0f0f0',
  },

  // --- INPUTS & FORMS ---
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: mode === 'dark' ? colors.textSecondary : '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: mode === 'dark' ? colors.background : '#F5F7FA',
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: mode === 'dark' ? colors.text : '#333',
  },
  totalDisplay: {
    marginTop: 8,
    backgroundColor: mode === 'dark' ? colors.card : '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : 'transparent',
  },
  totalLabel: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : '#059ef1',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: mode === 'dark' ? colors.primary : '#0047AB',
  },
  instructionText: {
    fontSize: 14,
    color: mode === 'dark' ? colors.text : '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  otpInput: {
    backgroundColor: mode === 'dark' ? colors.background : '#F5F7FA',
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#059ef1',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
    color: mode === 'dark' ? colors.text : '#333',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#059ef1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: "#059ef1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  disabledBtn: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // --- OTP DISPLAY ---
  otpContainer: {
    alignItems: 'center',
    backgroundColor: '#E8F5E9', // Light Green
    padding: 20,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
  },
  otpValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 4,
    marginVertical: 4,
  },
  otpInstruction: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : '#666',
  },

  // --- SUMMARY ---
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryText: {
    color: mode === 'dark' ? colors.textSecondary : '#666',
    fontSize: 14,
  },
  summaryValue: {
    color: mode === 'dark' ? colors.text : '#333',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  totalLabelSmall: {
    fontSize: 16,
    fontWeight: '700',
    color: mode === 'dark' ? colors.text : '#333',
  },
  totalValueSmall: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4CAF50',
  },

  // --- BUTTONS ---
  cancelBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    marginBottom: 20,
  },
  cancelBtnText: {
    color: '#D32F2F',
    fontWeight: '700',
  },
  ratingBtn: {
    backgroundColor: '#FFB300',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  ratingBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratingDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewBody: {
    fontSize: 14,
    color: mode === 'dark' ? colors.text : '#444',
    fontStyle: 'italic',
    backgroundColor: mode === 'dark' ? colors.background : '#F9F9F9',
    padding: 10,
    borderRadius: 8,
  },

  // --- TIMELINE ---
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  timelineDate: {
    fontSize: 12,
    color: '#666',
  }
});