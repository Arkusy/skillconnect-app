// app/(tabs)/MyOrders.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { useProfile } from "../../utils/useProfile";

const { width } = Dimensions.get("window");

const PAGE_SIZE = 20;

interface Order {
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
  status:
  | "pending"
  | "accepted"
  | "initiated"
  | "completed"
  | "cancelled"
  | "rejected";
  created_at: string;
  updated_at: string;
  categories: {
    name: string;
    icon: string;
  };
  worker_profile: {
    full_name: string;
    avatar_url: string | null;
  };
  customer_profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

const STATUS_OPTIONS = [
  { label: "Pending", value: "pending", icon: "clock-outline", color: "#FFA000" },
  { label: "Accepted", value: "accepted", icon: "check-circle-outline", color: "#2196F3" },
  { label: "Initiated", value: "initiated", icon: "progress-wrench", color: "#9C27B0" },
  { label: "Completed", value: "completed", icon: "check-decagram", color: "#4CAF50" },
  { label: "Cancelled", value: "cancelled", icon: "close-circle-outline", color: "#F44336" },
  { label: "Rejected", value: "rejected", icon: "cancel", color: "#D32F2F" },
];

// --- 1. EXTRACTED FILTER POPUP (Refined Animation) ---
const FilterPopup = ({
  visible,
  onClose,
  currentFilter,
  onSelect,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  currentFilter: string | null;
  onSelect: (val: string) => void;
  onClear: () => void;
}) => {
  const { colors, mode } = useAdminTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, mode, insets), [colors, mode, insets]);
  const [showModal, setShowModal] = useState(visible);

  // Animation Values
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current; // Start 20px lower

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      // Reset values before animating in
      scaleValue.setValue(0.8);
      translateY.setValue(20);
      opacityValue.setValue(0);

      Animated.parallel([
        // Springy Scale with Bounce
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,    // Less damping = more bounce
          mass: 0.8,      // Lighter mass = faster initial movement
          stiffness: 150, // Balanced stiffness
        }),
        // Slight Slide Up
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 100,
        }),
        // Fade In
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    } else {
      // Snappy Exit Animation
      Animated.parallel([
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
        Animated.timing(scaleValue, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
        onClose();
      });
    }
  }, [visible]);

  if (!showModal) return null;

  return (
    <View style={styles.overlayContainer}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.backdropFill, { opacity: opacityValue }]} />
      </Pressable>

      {/* Popup Card */}
      <Animated.View
        style={[
          styles.popupCard,
          {
            opacity: opacityValue,
            transform: [
              { scale: scaleValue },
              { translateY: translateY }
            ]
          },
        ]}
      >
        <View style={styles.popupHeader}>
          <Text style={styles.popupTitle}>Filter by Status</Text>
          <Pressable onPress={onClose} hitSlop={20}>
            <MaterialCommunityIcons name="close" size={24} color="#666" />
          </Pressable>
        </View>

        <View style={styles.popupList}>
          {STATUS_OPTIONS.map((option) => {
            const isSelected = currentFilter === option.value;
            return (
              <Pressable
                key={option.value}
                style={styles.popupOption}
                onPress={() => onSelect(option.value)}
                android_ripple={{ color: option.color + "20" }}
              >
                <View style={[styles.popupIconCircle, { backgroundColor: option.color + "15" }]}>
                  <MaterialCommunityIcons name={option.icon as any} size={20} color={option.color} />
                </View>
                <Text style={styles.popupOptionText}>{option.label}</Text>

                <View
                  style={[
                    styles.radioButton,
                    isSelected && { borderColor: "#059ef1" },
                  ]}
                >
                  {isSelected && <View style={styles.radioButtonSelected} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.popupFooter}>
          <Pressable
            style={styles.popupClearButton}
            onPress={onClear}
            android_ripple={{ color: "#FFEBEE" }}
          >
            <MaterialCommunityIcons name="filter-off" size={18} color="#F44336" style={{ marginRight: 8 }} />
            <Text style={styles.popupClearText}>Clear Filter</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default function MyOrdersScreen() {
  const { colors, mode } = useAdminTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, mode, insets), [colors, mode, insets]);
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useProfile();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalDbCount, setTotalDbCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterExpanded, setFilterExpanded] = useState(false);

  const isWorker = profile?.role === 1;

  // --- FETCH LOGIC ---
  const fetchOrders = useCallback(async (pageNumber: number, reset = false) => {
    if (!profile?.id) return;

    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setOrders([]); // Clear immediately to show SKELETONS instantly
      } else {
        setLoadingMore(true);
      }

      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Start Query
      let queryBuilder = supabase
        .from("orders")
        .select(`*, categories (name, icon)`, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (isWorker) {
        queryBuilder = queryBuilder.eq("worker_id", profile.id);
      } else {
        queryBuilder = queryBuilder.eq("user_id", profile.id);
      }

      // Apply Status Filter (SERVER SIDE)
      if (filterStatus) {
        queryBuilder = queryBuilder.eq("status", filterStatus);
      }

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      // Fetch profiles manually for the loaded orders
      const workerIds = (data || []).map((o: any) => o.worker_id).filter(Boolean);
      const userIds = (data || []).map((o: any) => o.user_id).filter(Boolean);

      let workerMap = new Map();
      let userMap = new Map();

      if (workerIds.length > 0) {
        const { data: workerProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", workerIds);
        workerMap = new Map(workerProfiles?.map((p: any) => [p.id, p]) || []);
      }

      if (userIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        userMap = new Map(userProfiles?.map((p: any) => [p.id, p]) || []);
      }

      const transformedData = (data || []).map((order: any) => {
        const workerProfile = workerMap.get(order.worker_id);
        const userProfile = userMap.get(order.user_id);

        return {
          ...order,
          worker_profile: {
            full_name: workerProfile?.full_name || "Unknown Worker",
            avatar_url: workerProfile?.avatar_url || null,
          },
          customer_profile: {
            full_name: userProfile?.full_name || "Unknown Customer",
            avatar_url: userProfile?.avatar_url || null,
          },
        };
      });

      if (reset) {
        setOrders(transformedData);
        setTotalDbCount(count || 0);
      } else {
        setOrders((prev) => [...prev, ...transformedData]);
      }

      setHasMore((data || []).length === PAGE_SIZE);
      setPage(pageNumber);
    } catch (err: any) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. Check your internet connection.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [profile?.id, isWorker, filterStatus]);

  useEffect(() => {
    if (profile?.id) {
      fetchOrders(0, true);
      const cleanup = subscribeToOrders();
      return cleanup;
    }
  }, [profile?.id, profile?.role, filterStatus, fetchOrders]);

  const subscribeToOrders = () => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: isWorker ? `worker_id=eq.${profile.id}` : `user_id=eq.${profile.id}`,
        },
        () => {
          fetchOrders(0, true);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders(0, true);
  }, [fetchOrders]);

  const loadMore = useCallback(() => {
    if (!loadingMore && !loading && hasMore) {
      fetchOrders(page + 1);
    }
  }, [loadingMore, loading, hasMore, page, fetchOrders]);

  const handleOrderPress = useCallback((order: Order) => {
    router.push({
      pathname: "/DisplayOrder" as any,
      params: { orderId: order.id.toString() },
    });
  }, [router]);

  const handleAcceptOrder = useCallback(
    async (orderId: number) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("worker_id", profile?.id);
        if (error) throw error;
        fetchOrders(0, true);
      } catch (error: any) {
        alert("Failed to accept order");
      }
    },
    [profile?.id, fetchOrders]
  );

  const handleRejectOrder = useCallback(
    async (orderId: number) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "rejected" })
          .eq("id", orderId)
          .eq("worker_id", profile?.id);
        if (error) throw error;
        fetchOrders(0, true);
      } catch (error: any) {
        alert("Failed to reject order");
      }
    },
    [profile?.id, fetchOrders]
  );

  // --- CLIENT SIDE FILTERING ---
  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!q) return true;
      const person = isWorker ? o.customer_profile.full_name : o.worker_profile.full_name;
      return (
        o.categories?.name?.toLowerCase().includes(q) ||
        person?.toLowerCase().includes(q) ||
        (o.problem_description || "").toLowerCase().includes(q) ||
        o.id.toString().includes(q)
      );
    });
  }, [orders, query, isWorker]);

  // --- AUTO-PAGINATION FOR SEARCH ---
  // This is the new logic: if we are searching (client-side) and we haven't found many results,
  // but there are more pages on the server, automatically fetch them.
  useEffect(() => {
    // Only trigger if searching. (Status filters are handled server-side now, so they don't need this).
    if (!query) return;

    // If results are sparse (< 10) AND we have more data on server AND not currently fetching...
    if (!loading && !loadingMore && hasMore && filteredOrders.length < 10) {
      const timer = setTimeout(() => {
        // Double check state inside timeout to prevent race conditions
        if (!loading && !loadingMore && hasMore) {
          fetchOrders(page + 1);
        }
      }, 300); // 300ms delay to throttle requests
      return () => clearTimeout(timer);
    }
  }, [query, filteredOrders.length, hasMore, loading, loadingMore, page, fetchOrders]);


  const headerStats = useMemo(() => {
    if (query) {
      return { label: "Results", count: filteredOrders.length };
    }
    if (filterStatus) {
      return {
        label: filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1),
        count: totalDbCount,
      };
    }
    return { label: "Total", count: totalDbCount };
  }, [query, filterStatus, filteredOrders.length, totalDbCount]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "pending": return "#FFA000";
      case "accepted": return "#2196F3";
      case "initiated": return "#9C27B0";
      case "completed": return "#4CAF50";
      case "cancelled": return "#F44336";
      case "rejected": return "#D32F2F";
      default: return "#757575";
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case "pending": return "clock-outline";
      case "accepted": return "check-circle-outline";
      case "initiated": return "progress-wrench";
      case "completed": return "check-decagram";
      case "cancelled": return "close-circle-outline";
      case "rejected": return "cancel";
      default: return "help-circle-outline";
    }
  }, []);

  const SkeletonCard = () => {
    const opacity = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }, []);

    return (
      <Animated.View style={[styles.orderCard, { opacity }]}>
        <View style={styles.cardHeader}>
          <View style={{ height: 20, width: 80, backgroundColor: mode === 'dark' ? colors.border : "#eee", borderRadius: 4 }} />
          <View style={{ height: 24, width: 90, backgroundColor: mode === 'dark' ? colors.border : "#eee", borderRadius: 12 }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={{ width: 40, height: 40, backgroundColor: mode === 'dark' ? colors.border : "#eee", borderRadius: 10, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <View style={{ height: 16, width: "60%", backgroundColor: mode === 'dark' ? colors.border : "#eee", marginBottom: 6, borderRadius: 4 }} />
              <View style={{ height: 14, width: "40%", backgroundColor: mode === 'dark' ? colors.border : "#eee", borderRadius: 4 }} />
            </View>
          </View>
          <View style={{ marginTop: 10, height: 40, backgroundColor: mode === 'dark' ? colors.border : "#eee", borderRadius: 8 }} />
        </View>
      </Animated.View>
    );
  };

  // --- UPDATED FIXED HEADER (LOADING STATE) ---
  const FixedHeader = useMemo(() => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTopRow}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.statBadge}>
          {loading && page === 0 ? (
            <ActivityIndicator size="small" color={mode === 'dark' ? colors.textSecondary : "#666"} />
          ) : (
            <>
              <Text style={styles.statNumber}>{headerStats.count}</Text>
              <Text style={styles.statLabel}>{headerStats.label}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  ), [headerStats, loading, page, styles, mode, colors]);

  const SearchAndFilterHeader = useMemo(() => (
    <View style={styles.searchContainer}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={mode === 'dark' ? colors.textSecondary : "#666"} />
          <TextInput
            style={styles.searchInput}
            placeholder={filterStatus ? `Search ${filterStatus} orders...` : "Search all orders..."}
            placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#999"}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={18} color={mode === 'dark' ? colors.textSecondary : "#999"} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[styles.filterButton, filterStatus !== null && styles.filterButtonActive]}
          onPress={() => setFilterExpanded(true)}
        >
          <MaterialCommunityIcons
            name={filterStatus ? "filter" : "filter-variant"}
            size={22}
            color="#fff"
          />
        </Pressable>
      </View>
    </View>
  ), [query, filterStatus, styles, colors, mode]);

  const renderOrder = useCallback(
    ({ item }: { item: Order }) => {
      const statusColor = getStatusColor(item.status);
      const statusIcon = getStatusIcon(item.status);
      const otherPerson = isWorker ? item.customer_profile : item.worker_profile;

      return (
        <Pressable
          style={styles.orderCard}
          onPress={() => handleOrderPress(item)}
          android_ripple={{ color: "#eee" }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.orderId}>Order #{item.id}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
              <MaterialCommunityIcons name={statusIcon as any} size={14} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <View style={[styles.iconBox, { backgroundColor: mode === 'dark' ? colors.iconBg : "#E3F2FD" }]}>
                <MaterialCommunityIcons name={item.categories.icon as any} size={20} color={mode === 'dark' ? colors.primary : "#059ef1"} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.categoryTitle}>{item.categories.name}</Text>
                <Text style={styles.personText}>
                  {isWorker ? "Customer" : "Technician"}: <Text style={styles.personName}>{otherPerson.full_name}</Text>
                </Text>
              </View>
            </View>

            {item.problem_description && (
              <View style={styles.problemContainer}>
                <Text style={styles.problemLabel}>Description:</Text>
                <Text style={styles.problemText} numberOfLines={2}>
                  {item.problem_description}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.dateContainer}>
              <MaterialCommunityIcons name="calendar-month-outline" size={14} color={mode === 'dark' ? colors.textSecondary : "#999"} />
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                • {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={mode === 'dark' ? colors.border : "#ccc"} />
          </View>

          {isWorker && item.status === "pending" && item.worker_id === profile?.id && (
            <View style={styles.actionContainer}>
              <Pressable
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRejectOrder(item.id);
                }}
              >
                <Text style={styles.rejectBtnText}>Reject</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAcceptOrder(item.id);
                }}
              >
                <Text style={styles.acceptBtnText}>Accept Order</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      );
    },
    [
      getStatusColor,
      getStatusIcon,
      isWorker,
      profile?.id,
      handleOrderPress,
      handleAcceptOrder,
      handleRejectOrder,
      styles,
      mode,
      colors,
    ]
  );

  const keyExtractor = useCallback((item: Order) => item.id.toString(), []);

  const ListEmptyComponent = useMemo(() => {
    if (loading)
      return (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      );

    if (error)
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="wifi-off" size={50} color="#F44336" />
          <Text style={styles.emptyTitle}>Connection Error</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBg}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={50} color="#999" />
        </View>
        <Text style={styles.emptyTitle}>No Orders Found</Text>
        <Text style={styles.emptySubtitle}>
          {filterStatus ? `No ${filterStatus} orders found.` : "Try adjusting your search."}
        </Text>
      </View>
    );
  }, [loading, error, filterStatus, onRefresh, styles, mode, colors]);

  const ListFooterComponent = useMemo(() => {
    if (loadingMore) return <ActivityIndicator style={{ marginVertical: 20 }} color="#059ef1" />;
    if (filteredOrders.length > 0 && hasMore && !loading) {
      return (
        <Pressable style={styles.loadMoreButton} onPress={loadMore}>
          <Text style={styles.loadMoreText}>Load More Orders</Text>
        </Pressable>
      );
    }
    return <View style={{ height: 20 }} />;
  }, [loadingMore, hasMore, loading, filteredOrders.length, loadMore, styles]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={mode === 'dark' ? colors.headerBg : "#fff"} />

      {FixedHeader}

      <FlatList
        data={filteredOrders}
        keyExtractor={keyExtractor}
        renderItem={renderOrder}
        ListHeaderComponent={SearchAndFilterHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[mode === 'dark' ? colors.primary : "#059ef1"]} tintColor={mode === 'dark' ? colors.primary : "#059ef1"} />
        }
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      <FilterPopup
        visible={filterExpanded}
        onClose={() => setFilterExpanded(false)}
        currentFilter={filterStatus}
        onSelect={(val) => {
          setFilterStatus(val);
          setFilterExpanded(false);
        }}
        onClear={() => {
          setFilterStatus(null);
          setFilterExpanded(false);
        }}
      />
    </View>
  );
}

const getStyles = (colors: any, mode: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mode === 'dark' ? colors.background : "#F5F7FA",
  },
  // --- HEADER ---
  headerContainer: {
    backgroundColor: mode === 'dark' ? colors.headerBg : "#FFFFFF",
    paddingTop: Math.max(insets.top, 10) + 10,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: "#000",
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
    color: mode === 'dark' ? colors.text : "#1A1A1A",
  },
  statBadge: {
    alignItems: "center",
    backgroundColor: mode === 'dark' ? colors.card : "#F5F5F5",
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "#EEEEEE",
    minWidth: 80,
  },
  statNumber: {
    color: mode === 'dark' ? colors.text : "#333",
    fontSize: 14,
    fontWeight: "bold",
  },
  statLabel: {
    color: mode === 'dark' ? colors.textSecondary : "#999",
    fontSize: 10,
    textTransform: "uppercase",
  },
  // --- SEARCH CONTAINER ---
  searchContainer: {
    backgroundColor: "transparent",
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 0,
    marginTop: 0,
    paddingHorizontal: 0,
  },
  searchBox: {
    flex: 1,
    backgroundColor: mode === 'dark' ? colors.card : "#F5F7FA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "android" ? 8 : 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "#E0E0E0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: mode === 'dark' ? colors.text : "#222",
  },
  filterButton: {
    backgroundColor: mode === 'dark' ? colors.primary : "#059ef1",
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: mode === 'dark' ? colors.primary : "#059ef1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  filterButtonActive: {
    borderWidth: 2,
    borderColor: mode === 'dark' ? colors.headerBg : "#0047AB",
  },
  // --- POPUP STYLES ---
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  backdropFill: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  popupCard: {
    width: width * 0.85,
    backgroundColor: mode === 'dark' ? colors.card : "white",
    borderRadius: 24,
    padding: 24,
    zIndex: 2,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  popupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: mode === 'dark' ? colors.text : "#1A1A1A",
  },
  popupList: {
    gap: 16,
  },
  popupOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  popupIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  popupOptionText: {
    flex: 1,
    fontSize: 16,
    color: mode === 'dark' ? colors.text : "#444",
    fontWeight: "500",
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: mode === 'dark' ? colors.border : "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: mode === 'dark' ? colors.primary : "#059ef1",
  },
  popupFooter: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: mode === 'dark' ? colors.border : "#f0f0f0",
  },
  popupClearButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.danger + '30' : "#FFCDD2",
    backgroundColor: mode === 'dark' ? colors.danger + '10' : "#FFEBEE",
  },
  popupClearText: {
    color: mode === 'dark' ? colors.danger : "#D32F2F",
    fontWeight: "700",
    fontSize: 15,
  },
  // --- LIST CONTENT ---
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    color: mode === 'dark' ? colors.textSecondary : "#666",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: mode === 'dark' ? colors.card : "#E1E8ED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: mode === 'dark' ? colors.text : "#333",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: mode === 'dark' ? colors.textSecondary : "#777",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: mode === 'dark' ? colors.primary : "#059ef1",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  loadMoreButton: {
    backgroundColor: mode === 'dark' ? colors.card : "#F0F9FF",
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.primary : "#059ef1",
  },
  loadMoreText: {
    color: mode === 'dark' ? colors.primary : "#059ef1",
    fontWeight: "600",
  },
  // --- CARD STYLES ---
  orderCard: {
    backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: mode === 'dark' ? colors.border : "#F0F0F0",
    marginHorizontal: 16,
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: mode === 'dark' ? colors.text : "#333",
  },
  personText: {
    fontSize: 13,
    color: mode === 'dark' ? colors.textSecondary : "#777",
    marginTop: 2,
  },
  personName: {
    color: mode === 'dark' ? colors.text : "#333",
    fontWeight: "500",
  },
  problemContainer: {
    marginTop: 8,
    backgroundColor: mode === 'dark' ? colors.background : "#FAFAFA",
    padding: 10,
    borderRadius: 8,
  },
  problemLabel: {
    fontSize: 11,
    color: mode === 'dark' ? colors.textSecondary : "#999",
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  problemText: {
    fontSize: 13,
    color: mode === 'dark' ? colors.text : "#555",
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : "#999",
    fontWeight: "500",
  },
  actionContainer: {
    flexDirection: "row",
    padding: 12,
    paddingTop: 0,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    backgroundColor: mode === 'dark' ? colors.danger + '20' : "#FFEBEE",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.danger + '40' : "#FFCDD2",
  },
  rejectBtnText: {
    color: mode === 'dark' ? colors.danger : "#D32F2F",
    fontWeight: "600",
    fontSize: 14,
  },
  acceptBtn: {
    backgroundColor: mode === 'dark' ? colors.primary : "#059ef1",
    shadowColor: mode === 'dark' ? colors.primary : "#059ef1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  acceptBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
});