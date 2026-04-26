// app/(tabs)/Home.tsx
import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { useProfile } from "../../utils/useProfile";

const { width } = Dimensions.get("window");

// ---------- Types ----------
interface Category {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string | null;
  workerCount?: number;
}

interface FeaturedWorker {
  id: string;
  user_id: string;
  name: string;
  service: string;
  rating: number;
  price: number | null;
  pricing_type: string | null;
  currency: string | null;
  categoryName: string;
  categoryId: string;
  avatarUrl: string | null;
}

interface PlatformStats {
  activeWorkers: number;
  completedJobs: number;
  avgRating: number;
}

// Worker Dashboard Types
interface DashboardStats {
  totalOrders: number;
  totalEarnings: number;
  averageRating: number;
  monthlyJobs: number;
}

interface OrderStatusCount {
  status: string;
  count: number;
}

interface RatingCount {
  rating: number;
  count: number;
}

interface MonthlyEarning {
  month: string;
  amount: number;
}

interface Review {
  id: string;
  rating: number;
  review: string;
  created_at: string;
  user_id: string;
  user: {
    full_name: string;
    avatar_url: string | null;
  };
}

// ---------- Shadow ----------
const SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  android: { elevation: 2 },
  default: {},
});

// ---------- Worker Dashboard Charts ----------
const BarChart = ({ data, colors, maxValue }: { data: MonthlyEarning[]; colors: any; maxValue: number }) => {
  const chartHeight = 120;
  const barWidth = (width - 80) / data.length - 8;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartHeight, gap: 8 }}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.amount / maxValue) * (chartHeight - 20) : 4;
          return (
            <View key={index} style={{ alignItems: "center", flex: 1 }}>
              <View
                style={{
                  width: barWidth,
                  height: Math.max(barHeight, 4),
                  backgroundColor: "#4CAF50",
                  borderRadius: 4,
                }}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
                {item.month}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const OrderStatusChart = ({ data, colors }: { data: OrderStatusCount[]; colors: any }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <Text style={{ color: colors.textSecondary }}>No orders yet</Text>;

  const statusColors: Record<string, string> = {
    pending: "#FFA726",
    accepted: "#42A5F5",
    initiated: "#AB47BC",
    completed: "#66BB6A",
    cancelled: "#EF5350",
    rejected: "#78909C",
  };

  return (
    <View>
      <View style={{ flexDirection: "row", height: 24, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {data.map((item, i) => (
          <View
            key={i}
            style={{
              flex: item.count,
              backgroundColor: statusColors[item.status] || "#999",
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {data.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: statusColors[item.status] || "#999", marginRight: 4 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, textTransform: "capitalize" }}>
              {item.status}: {item.count}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 12, textAlign: "center" }}>
        Total: {total} orders
      </Text>
    </View>
  );
};

const RatingDistributionChart = ({ data, colors }: { data: RatingCount[]; colors: any }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <View>
      {[5, 4, 3, 2, 1].map((star) => {
        const item = data.find((d) => d.rating === star) || { rating: star, count: 0 };
        const barWidthPct = (item.count / maxCount) * 100;
        return (
          <View key={star} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: colors.text, width: 20, fontSize: 12 }}>{star}</Text>
            <Ionicons name="star" size={14} color="#FFC107" style={{ marginRight: 8 }} />
            <View style={{ flex: 1, height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: "hidden" }}>
              <View style={{ width: `${barWidthPct}%`, height: "100%", backgroundColor: "#FFC107", borderRadius: 6 }} />
            </View>
            <Text style={{ color: colors.textSecondary, width: 30, textAlign: "right", fontSize: 12 }}>{item.count}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useAdminTheme();
  const { profile, loading: profileLoading } = useProfile();
  const styles = useMemo(() => getStyles(colors, mode, insets), [colors, mode, insets]);

  const [session, setSession] = useState<Session | null>(null);

  // `loading` only for first load (refresh won't show skeleton / empty UI)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.98)).current;

  // User Home Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredWorkers, setFeaturedWorkers] = useState<{
    [key: string]: FeaturedWorker[];
  }>({});
  const [stats, setStats] = useState<PlatformStats>({
    activeWorkers: 0,
    completedJobs: 0,
    avgRating: 0,
  });

  // Worker Dashboard Data
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ totalOrders: 0, totalEarnings: 0, averageRating: 0, monthlyJobs: 0 });
  const [orderStatus, setOrderStatus] = useState<OrderStatusCount[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingCount[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Dynamic Notification Count
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

      if (!error) {
        setUnreadNotificationCount(count || 0);
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
    }
  }, [session?.user?.id]);

  // Fetch on focus and session change
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // ---- Sizing (keeps exactly 3 per row) ----
  const CAT_MARGIN = 6;
  const CAT_HPAD = 14;
  const catCardWidth = useMemo(() => {
    return (width - 64) / 3;
  }, []);

  // Determine if user is a worker
  const isWorker = profile?.role === 1;

  // ---------- Auth ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
      }
    });
  }, []);

  // ---------- Fetch data based on role ----------
  useEffect(() => {
    if (profile && session) {
      if (isWorker) {
        fetchWorkerDashboardData();
      } else {
        fetchAllData({ showLoader: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, session, isWorker]);

  // ---------- Entrance animation (only after initial loading) ----------
  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      scaleAnim.setValue(0.98);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 10,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, fadeAnim, slideAnim, scaleAnim]);

  // ---------- User Home Data Fetching ----------
  const fetchAllData = async (opts?: { showLoader?: boolean }) => {
    const showLoader = opts?.showLoader ?? true;

    if (showLoader) setLoading(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchPlatformStats(),
        fetchFeaturedWorkersByCategory(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name")
        .limit(6);

      if (error) throw error;

      if (data) {
        const categoriesWithIcons = data.map((cat) => ({
          ...cat,
          icon: getIconForCategory(cat.name) as keyof typeof Ionicons.glyphMap,
        }));

        const categoriesWithCounts = await Promise.all(
          categoriesWithIcons.map(async (cat) => {
            const { count } = await supabase
              .from("worker_profiles")
              .select("id", { count: "exact", head: true })
              .eq("category_id", cat.id)
              .eq("availability_status", "available");

            return { ...cat, workerCount: count || 0 };
          })
        );

        setCategories(categoriesWithCounts);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const getIconForCategory = (name: string): string => {
    const iconMap: { [key: string]: string } = {
      Plumbing: "water",
      Electrical: "flash",
      Carpentry: "hammer",
      Painter: "brush",
      Cleaner: "sparkles",
      "AC Repair": "snow",
    };
    return iconMap[name] || "construct";
  };

  const fetchPlatformStats = async () => {
    try {
      const { count: activeCount } = await supabase
        .from("worker_profiles")
        .select("id", { count: "exact", head: true })
        .eq("availability_status", "available");

      const { count: completedCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed");

      const { data: ratingsData, error: ratingsError } = await supabase
        .from("ratings")
        .select("rating");

      let avgRating = 0;
      if (!ratingsError && ratingsData && ratingsData.length > 0) {
        const totalRating = ratingsData.reduce((sum, r) => sum + r.rating, 0);
        avgRating = totalRating / ratingsData.length;
      }

      setStats({
        activeWorkers: activeCount || 0,
        completedJobs: completedCount || 0,
        avgRating,
      });
    } catch (error) {
      console.error("Error fetching platform stats:", error);
    }
  };

  const fetchFeaturedWorkersByCategory = async () => {
    try {
      const { data: allCategories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (!allCategories) return;

      const selectedWorkers: FeaturedWorker[] = [];
      const usedCategoryIds = new Set<string>();

      // Step 1: top 1 worker per category until 3 workers
      for (const category of allCategories) {
        if (selectedWorkers.length >= 3) break;

        const { data: workers } = await supabase
          .from("worker_profiles")
          .select(
            `
            id,
            user_id,
            average_rating,
            price,
            pricing_type,
            currency,
            category_id,
            categories!worker_profiles_category_id_fkey (
              name
            ),
            profiles!worker_profiles_user_id_fkey (
              full_name,
              avatar_url
            )
          `
          )
          .eq("category_id", category.id)
          .eq("availability_status", "available")
          .order("average_rating", { ascending: false })
          .limit(1);

        if (workers && workers.length > 0) {
          const worker = workers[0];
          const profileData = Array.isArray(worker.profiles)
            ? worker.profiles[0]
            : worker.profiles;
          const categoryData = Array.isArray(worker.categories)
            ? worker.categories[0]
            : worker.categories;

          selectedWorkers.push({
            id: worker.id,
            user_id: worker.user_id,
            name: profileData?.full_name || "Unknown",
            service: categoryData?.name || category.name,
            rating: worker.average_rating || 0,
            price: worker.price,
            pricing_type: worker.pricing_type,
            currency: worker.currency,
            categoryName: categoryData?.name || category.name,
            categoryId: worker.category_id,
            avatarUrl: profileData?.avatar_url || null,
          });
          usedCategoryIds.add(category.id);
        }
      }

      // Step 2: fill remaining slots from used categories
      if (selectedWorkers.length < 3) {
        const usedWorkerIds = new Set(selectedWorkers.map((w) => w.id));

        for (const categoryId of usedCategoryIds) {
          if (selectedWorkers.length >= 3) break;

          const { data: moreWorkers } = await supabase
            .from("worker_profiles")
            .select(
              `
              id,
              user_id,
              average_rating,
              price,
              pricing_type,
              currency,
              category_id,
              categories!worker_profiles_category_id_fkey (
                name
              ),
              profiles!worker_profiles_user_id_fkey (
                full_name,
                avatar_url
              )
            `
            )
            .eq("category_id", categoryId)
            .eq("availability_status", "available")
            .order("average_rating", { ascending: false });

          if (moreWorkers) {
            for (const worker of moreWorkers) {
              if (selectedWorkers.length >= 3) break;
              if (usedWorkerIds.has(worker.id)) continue;

              const profileData = Array.isArray(worker.profiles)
                ? worker.profiles[0]
                : worker.profiles;
              const categoryData = Array.isArray(worker.categories)
                ? worker.categories[0]
                : worker.categories;

              selectedWorkers.push({
                id: worker.id,
                user_id: worker.user_id,
                name: profileData?.full_name || "Unknown",
                service: categoryData?.name || "Service",
                rating: worker.average_rating || 0,
                price: worker.price,
                pricing_type: worker.pricing_type,
                currency: worker.currency,
                categoryName: categoryData?.name || "Service",
                categoryId: worker.category_id,
                avatarUrl: profileData?.avatar_url || null,
              });
              usedWorkerIds.add(worker.id);
            }
          }
        }
      }

      setFeaturedWorkers({ all: selectedWorkers });
    } catch (error) {
      console.error("Error fetching featured workers:", error);
      setFeaturedWorkers({ all: [] });
    }
  };

  // ---------- Worker Dashboard Data Fetching ----------
  const fetchWorkerDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get worker profile
      const { data: workerProfile } = await supabase
        .from("worker_profiles")
        .select("id, average_rating, total_jobs_completed")
        .eq("user_id", user.id)
        .single();

      if (!workerProfile) {
        setLoading(false);
        return;
      }

      // Fetch all orders for this worker
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, total_price, completed_at, created_at")
        .eq("worker_id", user.id);

      // Calculate stats
      const completedOrders = orders?.filter((o) => o.status === "completed") || [];
      const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

      // Monthly jobs (current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyJobs = completedOrders.filter((o) => new Date(o.completed_at) >= startOfMonth).length;

      setDashboardStats({
        totalOrders: completedOrders.length,
        totalEarnings,
        averageRating: workerProfile.average_rating || 0,
        monthlyJobs,
      });

      // Order status breakdown
      const statusCounts: Record<string, number> = {};
      orders?.forEach((o) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });
      setOrderStatus(Object.entries(statusCounts).map(([status, count]) => ({ status, count })));

      // Monthly earnings (last 6 months)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyData: MonthlyEarning[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const monthOrders = completedOrders.filter((o) => {
          const date = new Date(o.completed_at);
          return date >= monthStart && date <= monthEnd;
        });
        const amount = monthOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        monthlyData.push({ month: monthNames[d.getMonth()], amount });
      }
      setMonthlyEarnings(monthlyData);

      // Rating distribution
      const { data: ratings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("worker_profile_id", workerProfile.id);

      const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratings?.forEach((r) => {
        ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
      });
      setRatingDistribution(Object.entries(ratingCounts).map(([rating, count]) => ({ rating: parseInt(rating), count })));

      // All reviews (including star-only ratings)
      const { data: allReviews } = await supabase
        .from("ratings")
        .select("id, rating, review, created_at, user_id")
        .eq("worker_profile_id", workerProfile.id)
        .order("created_at", { ascending: false });

      if (allReviews && allReviews.length > 0) {
        const userIds = allReviews.map((r) => r.user_id);
        const { data: users } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        const reviewsWithUsers = allReviews.map((r) => {
          const u = users?.find((u) => u.id === r.user_id);
          let avatarUrl = u?.avatar_url || null;

          if (avatarUrl && !avatarUrl.startsWith('http')) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
            avatarUrl = data.publicUrl;
          }

          return {
            ...r,
            user: { full_name: u?.full_name || "User", avatar_url: avatarUrl },
          };
        });
        setReviews(reviewsWithUsers);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isWorker) {
      await fetchWorkerDashboardData();
    } else {
      await fetchAllData({ showLoader: false });
    }
    setRefreshing(false);
  };

  const handleCategoryPress = (category: Category) => {
    setActiveCategory(category.id);

    router.push({
      pathname: "/WorkerList",
      params: {
        categoryId: category.id,
        categoryName: category.name,
      },
    });
  };

  const handleSeeAllCategories = () => {
    alert("See All Categories Pressed");
  };

  const handleFilterPress = () => {

  };

  // --- Filtering Logic ---
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const lowerQ = searchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(lowerQ));
  }, [categories, searchQuery]);

  const filteredWorkers = useMemo(() => {
    const all = featuredWorkers.all || [];
    if (!searchQuery) return all;
    const lowerQ = searchQuery.toLowerCase();
    return all.filter(
      (w) =>
        w.name.toLowerCase().includes(lowerQ) ||
        w.service.toLowerCase().includes(lowerQ)
    );
  }, [featuredWorkers.all, searchQuery]);

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  // ---------- UI components ----------
  const CategoryCard = ({ category }: { category: Category }) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const isActive = activeCategory === category.id;

    const handlePressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.96,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => handleCategoryPress(category)}
          style={[
            styles.categoryCard,
            { width: catCardWidth, margin: CAT_MARGIN },
            isActive && styles.categoryCardActiveSoft,
          ]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Category ${category.name}`}
        >
          <View style={styles.categoryIconBubble}>
            <Ionicons name={category.icon} size={22} color={mode === 'dark' ? "#99aaffff" : "#000000"} />
          </View>

          <Text style={styles.categoryName} numberOfLines={1}>
            {category.name}
          </Text>

          <Text style={styles.categoryCount} numberOfLines={1}>
            {category.workerCount || 0} workers
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const WorkerCard = ({ worker }: { worker: FeaturedWorker }) => {
    const scaleValue = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.985,
        friction: 7,
        tension: 160,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 7,
        tension: 160,
        useNativeDriver: true,
      }).start();
    };

    const handleWorkerPress = () => {
      router.push({
        pathname: "/NewOrder",
        params: {
          workerId: worker.user_id,
          categoryId: worker.categoryId,
        },
      });
    };

    const getAvatarUrl = (avatarPath: string | null) => {
      if (!avatarPath) return null;
      if (avatarPath.startsWith("http")) return avatarPath;
      const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
      return data.publicUrl;
    };

    const avatarUrl = getAvatarUrl(worker.avatarUrl);

    const getPriceDisplay = () => {
      if (!worker.price) return null;
      const currencySymbol = worker.currency === "USD" ? "$" : "₹";
      const priceValue = worker.price.toFixed(0);
      return worker.pricing_type === "hourly"
        ? `${currencySymbol}${priceValue}/hr`
        : `${currencySymbol}${priceValue}`;
    };

    const priceText = getPriceDisplay();

    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <TouchableOpacity
          style={styles.workerCard}
          activeOpacity={0.92}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleWorkerPress}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Worker ${worker.name}`}
        >
          <View style={styles.workerAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.workerAvatarImage} />
            ) : (
              <Ionicons name="person" size={28} color={mode === 'dark' ? colors.textSecondary : "#666666ff"} />
            )}
          </View>

          <View style={styles.workerInfo}>
            <Text style={styles.workerName} numberOfLines={1}>
              {worker.name}
            </Text>

            <Text style={styles.workerService} numberOfLines={1}>
              {worker.service}
            </Text>

            <View style={styles.workerMeta}>
              <View style={styles.pill}>
                <Ionicons name="star" size={14} color={mode === 'dark' ? colors.warning : "#FFB800"} />
                <Text style={styles.pillText}>
                  {worker.rating > 0 ? worker.rating.toFixed(1) : "New"}
                </Text>
              </View>

              <View style={styles.pill}>
                <Ionicons name="cash-outline" size={14} color={mode === 'dark' ? colors.textSecondary : "#666666"} />
                <Text style={styles.pillText}>
                  {priceText ? priceText : "Price on request"}
                </Text>
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={mode === 'dark' ? colors.border : "#CFCFCF"} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ---------- Header Component (Notch Style like Account) ----------
  const FixedHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          {isWorker ? (
            <Text style={styles.headerTitle}>Dashboard</Text>
          ) : (
            <>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {profile?.full_name || session?.user?.user_metadata?.name || "User"}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push("/Updates")}
          activeOpacity={0.85}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Updates"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />

          {unreadNotificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------- Loading (UI improvement vs plain spinner; 3-per-row skeleton) ----------
  if (loading || profileLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={colors.card} />

        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <View style={[styles.skelLine, { width: 110 }]} />
              <View style={[styles.skelLine, { width: 180, height: 24, marginTop: 10 }]} />
            </View>
            <View style={[styles.notificationButton, { backgroundColor: colors.border }]} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={[styles.skelRow, { marginBottom: 12 }]} />
          ))}
        </View>

        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.loadingFooterText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ---------- Render Worker Dashboard ----------
  if (isWorker) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={colors.card} />

        <FixedHeader />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.dashboardScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: "#E3F2FD" }]}>
                <Ionicons name="briefcase" size={20} color="#2196F3" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboardStats.totalOrders}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Jobs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="cash" size={20} color="#4CAF50" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(dashboardStats.totalEarnings)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Earnings</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: "#FFF8E1" }]}>
                <Ionicons name="star" size={20} color="#FFC107" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboardStats.averageRating.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Rating</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: "#F3E5F5" }]}>
                <Ionicons name="calendar" size={20} color="#9C27B0" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboardStats.monthlyJobs}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
            </View>
          </View>

          {/* Monthly Earnings Chart */}
          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Monthly Earnings</Text>
            <BarChart data={monthlyEarnings} colors={colors} maxValue={Math.max(...monthlyEarnings.map((m) => m.amount), 1)} />
          </View>

          {/* Order Status Breakdown */}
          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Order Status</Text>
            <OrderStatusChart data={orderStatus} colors={colors} />
          </View>

          {/* Ratings Distribution */}
          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Rating Distribution</Text>
            <RatingDistributionChart data={ratingDistribution} colors={colors} />
          </View>

          {/* Recent Reviews */}
          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[styles.chartTitle, { color: colors.text, marginBottom: 0 }]}>Reviews</Text>
              <View style={styles.reviewCountBadge}>
                <Text style={styles.reviewCountText}>{reviews.length}</Text>
              </View>
            </View>
            {reviews.length === 0 ? (
              <View style={styles.emptyReviewsState}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No reviews yet</Text>
              </View>
            ) : (
              <>
                {(showAllReviews ? reviews : reviews.slice(0, 3)).map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/userProfile', params: { userId: review.user_id } })}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Image
                        source={{ uri: review.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.user.full_name)}&background=random` }}
                        style={styles.reviewAvatar}
                      />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                        <Pressable onPress={() => router.push({ pathname: '/userProfile', params: { userId: review.user_id } })}>
                          <Text style={[styles.reviewName, { color: colors.text }]}>{review.user.full_name}</Text>
                        </Pressable>
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={12} color="#FFC107" />
                          <Text style={styles.ratingText}>{review.rating}</Text>
                        </View>
                      </View>
                      {review.review ? (
                        <Text style={[styles.reviewText, { color: colors.textSecondary }]} numberOfLines={showAllReviews ? undefined : 2}>
                          {review.review}
                        </Text>
                      ) : (
                        <Text style={[styles.reviewText, { color: colors.textSecondary, fontStyle: "italic", opacity: 0.7 }]}>
                          No description provided
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

                {reviews.length > 3 && (
                  <TouchableOpacity
                    style={styles.showMoreButton}
                    onPress={() => setShowAllReviews(!showAllReviews)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                      {showAllReviews ? "Show Less" : `Show More (${reviews.length - 3} more)`}
                    </Text>
                    <Ionicons name={showAllReviews ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>
      </View>
    );
  }

  // ---------- Render User Home ----------
  return (
    <View style={styles.container}>
      <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={colors.card} />

      <FixedHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[mode === 'dark' ? colors.text : '#000000']}
            tintColor={mode === 'dark' ? colors.text : '#000000'}
          />
        }
      >
        {/* Search */}
        <Animated.View
          style={[
            styles.searchContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons name="search" size={20} color={mode === 'dark' ? colors.textSecondary : "#999999"} style={styles.searchIcon} />

          <TextInput
            style={styles.searchInput}
            placeholder="Search services or workers..."
            placeholderTextColor={mode === 'dark' ? colors.textSecondary : "#999999"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearchBtn}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={mode === 'dark' ? colors.textSecondary : "#999999"} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={handleFilterPress}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Filter"
            >
              <Ionicons name="options-outline" size={20} color={mode === 'dark' ? colors.text : "#000000"} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Categories */}
        <Animated.View
          style={[
            styles.section,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse Categories</Text>

            <TouchableOpacity onPress={handleSeeAllCategories} hitSlop={10} activeOpacity={0.8}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.categoriesGrid, { paddingHorizontal: CAT_HPAD }]}>
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))
            ) : (
              <View style={styles.emptyStateBox}>
                <Ionicons name="search" size={18} color={mode === 'dark' ? colors.textSecondary : "#999999"} />
                <Text style={styles.emptyStateText}>No categories found</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Featured Workers */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Workers</Text>
          </View>

          <View style={styles.workersContainer}>
            {filteredWorkers.length > 0 ? (
              filteredWorkers.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))
            ) : (
              <View style={styles.emptyStateBoxWide}>
                <Ionicons name="person-outline" size={18} color={mode === 'dark' ? colors.textSecondary : "#999999"} />
                <Text style={styles.emptyStateText}>No workers found</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Platform Stats */}
        <Animated.View style={[styles.statsSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Platform Stats</Text>

          <View style={styles.platformStatsRow}>
            <View style={styles.platformStatCard}>
              <View style={styles.statIconBubble}>
                <Ionicons name="people" size={18} color={mode === 'dark' ? colors.text : "#000000"} />
              </View>
              <Text style={styles.platformStatValue}>{stats.activeWorkers}+</Text>
              <Text style={styles.platformStatLabel}>Active Workers</Text>
            </View>
            <View style={styles.platformStatCard}>
              <View style={styles.statIconBubble}>
                <Ionicons name="checkmark-circle" size={18} color={mode === 'dark' ? colors.text : "#000000"} />
              </View>
              <Text style={styles.platformStatValue}>{stats.completedJobs}+</Text>
              <Text style={styles.platformStatLabel}>Jobs Completed</Text>
            </View>
            <View style={styles.platformStatCard}>
              <View style={styles.statIconBubble}>
                <Ionicons name="star" size={18} color={mode === 'dark' ? colors.warning : "#FFB800"} />
              </View>
              <Text style={styles.platformStatValue}>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "0.0"}</Text>
              <Text style={styles.platformStatLabel}>Avg Rating</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB Button */}
      <Animated.View
        style={[
          styles.floatingButton,
          { opacity: fadeAnim, transform: [{ scale: fadeAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/NewOrder")}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="New order"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ---------- Styles ----------
const getStyles = (colors: any, mode: any, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Notch-style header (matching Account.tsx)
  headerContainer: {
    backgroundColor: colors.card,
    paddingTop: Math.max(insets.top, 10) + 10,
    paddingBottom: 14,
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
  greeting: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },

  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mode === 'dark' ? colors.background : "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: mode === 'dark' ? colors.background : "#F5F5F5",
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  scrollContent: { paddingBottom: 110 },
  dashboardScrollContent: { padding: 16, paddingBottom: 20 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: mode === 'dark' ? colors.card : "#efefefff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  clearSearchBtn: { padding: 4 },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: mode === 'dark' ? colors.background : "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  section: { marginTop: 16 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  seeAllText: { fontSize: 14, color: colors.primary, fontWeight: "600" },

  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  categoryCard: {
    backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
    ...SHADOW,
  },
  categoryCardActiveSoft: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  categoryIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mode === 'dark' ? colors.background : "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: "center",
  },

  workersContainer: { paddingHorizontal: 20, gap: 12 },
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    gap: 14,
    ...SHADOW,
  },
  workerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: mode === 'dark' ? colors.background : "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  workerAvatarImage: { width: 52, height: 52, borderRadius: 26 },
  workerInfo: { flex: 1 },
  workerName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  workerService: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  workerMeta: { flexDirection: "row", gap: 10 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mode === 'dark' ? colors.background : "#F9F9F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  pillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  emptyStateBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mode === 'dark' ? colors.card : "#F9F9F9",
    padding: 20,
    borderRadius: 12,
    gap: 8,
    width: "100%",
  },
  emptyStateBoxWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mode === 'dark' ? colors.card : "#F9F9F9",
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  bottomSpacer: { height: 40 },

  // Skeleton
  skelLine: {
    height: 14,
    backgroundColor: colors.border,
    borderRadius: 7,
    marginBottom: 6,
  },
  skelRow: {
    height: 60,
    backgroundColor: colors.border,
    borderRadius: 12,
  },
  loadingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 40,
  },
  loadingFooterText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Worker Dashboard Styles
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 4 },
  chartCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  chartTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  reviewItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16, gap: 12 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewName: { fontWeight: "600", fontSize: 14 },
  reviewText: { fontSize: 13, lineHeight: 18 },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  ratingText: { fontSize: 12, fontWeight: "600", color: "#FF8F00", marginLeft: 2 },
  reviewCountBadge: {
    backgroundColor: mode === 'dark' ? colors.border : "#E0E0E0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reviewCountText: {
    fontSize: 12,
    color: mode === 'dark' ? colors.text : "#444",
    fontWeight: "600",
  },
  emptyReviewsState: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: mode === 'dark' ? colors.background : "#FAFAFA",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "#E0E0E0",
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Platform Stats Section (User Home)
  statsSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  platformStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  platformStatCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    backgroundColor: mode === 'dark' ? colors.card : "#F7F7F7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "rgba(0,0,0,0.06)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  statIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: mode === 'dark' ? colors.iconBg : "#FFFFFF",
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  platformStatValue: {
    fontSize: 18,
    fontWeight: "900",
    color: mode === 'dark' ? colors.text : "#000000",
    marginBottom: 4,
  },
  platformStatLabel: {
    fontSize: 11,
    color: mode === 'dark' ? colors.textSecondary : "#666666",
    textAlign: "center",
  },

  // FAB Button (User Home)
  floatingButton: {
    position: "absolute",
    bottom: 24,
    right: 20,
    zIndex: 100,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: mode === 'dark' ? colors.primary : "#000000",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
});