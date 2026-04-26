// app/WorkersList.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAdminTheme } from "../context/AdminThemeContext";
import { supabase } from "../utils/supabase";

const { width } = Dimensions.get("window");

interface WorkerProfile {
  id: string;
  user_id: string;
  category_id: string;
  experience_years: number;
  pricing_type: string;
  price: number | null;
  currency: string;
  availability_status: string;
  service_description: string | null;
  average_rating: number;
  total_ratings: number;
  profiles: {
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
    address: string | null;
  };
}

export default function WorkersListScreen() {
  const { categoryId, categoryName } = useLocalSearchParams<{
    categoryId: string;
    categoryName: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, mode } = useAdminTheme();
  const styles = useMemo(() => getStyles(colors, mode), [colors, mode]);
  const statusBarHeight = StatusBar.currentHeight || 0;

  useEffect(() => {
    navigation.setOptions({
      headerTitle: categoryName,
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
  }, [categoryName, mode, colors]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (categoryId && currentUserId) {
      fetchWorkers();
    }
  }, [categoryId, currentUserId]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('worker_profiles')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url,
            phone,
            address
          )
        `)
        .eq('category_id', categoryId)
        .neq('user_id', currentUserId)
        .neq('availability_status', 'unavailable')
        .order('average_rating', { ascending: false });

      if (error) {
        console.error('Error fetching workers:', error);
        return;
      }

      setWorkers(data || []);

      if (currentUserId) {
        const { data: pendingOrdersData } = await supabase
          .from('orders')
          .select('worker_id')
          .eq('user_id', currentUserId)
          .eq('category_id', categoryId)
          .in('status', ['pending', 'accepted']);

        if (pendingOrdersData) {
          setPendingOrders(new Set(pendingOrdersData.map(o => o.worker_id)));
        }
      }
    } catch (error) {
      console.error('Error in fetchWorkers:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkers();
    setRefreshing(false);
  };

  const handleStartChat = (worker: WorkerProfile) => {
    router.push({
      pathname: "/ChatScreen",
      params: {
        user: worker.profiles.full_name,
        workerId: worker.user_id
      },
    });
  };

  const handleCreateOrder = (worker: WorkerProfile) => {
    router.push({
      pathname: "/NewOrder",
      params: {
        workerId: worker.user_id,
        categoryId: categoryId,
      },
    });
  };

  const getAvatarUrl = (avatarPath: string | null) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarPath);

    return data.publicUrl;
  };

  const renderWorker = ({ item }: { item: WorkerProfile }) => {
    const avatarUrl = getAvatarUrl(item.profiles.avatar_url);
    const hasPendingOrder = pendingOrders.has(item.user_id);

    return (
      <View style={styles.workerCard}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.push(`/userProfile?userId=${item.user_id}`)}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <MaterialCommunityIcons name="account" size={28} color={mode === 'dark' ? colors.textSecondary : "#999999"} />
                </View>
              )}
            </View>
          </Pressable>

          <View style={styles.nameAndDetailsContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.workerName} numberOfLines={1}>
                {item.profiles.full_name}
              </Text>
              {item.price && (
                <Text style={styles.hourlyRate}>
                  {item.currency === 'USD' ? '$' : '₹'}{item.price.toFixed(0)}{item.pricing_type === 'hourly' ? '/hr' : ''}
                </Text>
              )}
            </View>

            <Text style={styles.workerDescription} numberOfLines={2}>
              {item.service_description || "Professional service provider"}
            </Text>

            <View style={styles.bottomRow}>
              <View style={[
                styles.statusBadge,
                item.availability_status === 'available' ? styles.available :
                  item.availability_status === 'busy' ? styles.busy : styles.unavailable
              ]}>
                <View style={[
                  styles.statusDot,
                  item.availability_status === 'available' && styles.availableDot
                ]} />
                <Text style={styles.statusText}>
                  {item.availability_status === 'available' ? 'Available' :
                    item.availability_status === 'busy' ? 'Busy' : 'Unavailable'}
                </Text>
              </View>

              {item.experience_years > 0 && (
                <Text style={styles.workerExperience}>
                  {item.experience_years} yrs
                </Text>
              )}

              {item.average_rating > 0 ? (
                <View style={styles.ratingContainer}>
                  <MaterialCommunityIcons name="star" size={14} color="#FFB800" />
                  <Text style={styles.ratingText}>
                    {item.average_rating.toFixed(1)}
                  </Text>
                  <Text style={styles.reviewCount}>({item.total_ratings})</Text>
                </View>
              ) : (
                <Text style={styles.noRating}>New</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {hasPendingOrder ? (
            <View style={styles.pendingButton}>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#666666" />
              <Text style={styles.pendingButtonText}>Order Pending</Text>
            </View>
          ) : (
            <Pressable
              style={styles.orderButton}
              onPress={() => handleCreateOrder(item)}
            >
              <MaterialCommunityIcons name="clipboard-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.orderButtonText}>Create Order</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.chatButton}
            onPress={() => handleStartChat(item)}
          >
            <MaterialCommunityIcons name="chat-outline" size={18} color={mode === 'dark' ? colors.text : "#000000"} />
            <Text style={styles.chatButtonText}>Chat</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={mode === 'dark' ? colors.text : "#000000"} />
          <Text style={styles.loadingText}>Loading workers...</Text>
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-search-outline" size={80} color={mode === 'dark' ? colors.textSecondary : "#CCCCCC"} />
          <Text style={styles.emptyText}>No workers available</Text>
          <Text style={styles.emptySubtext}>
            Check back later or try another category
          </Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          renderItem={renderWorker}
          contentContainerStyle={styles.workerList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[mode === 'dark' ? colors.text : "#000000"]}
              tintColor={mode === 'dark' ? colors.text : "#000000"}
            />
          }
        />
      )}
    </View>
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
  },
  loadingText: {
    color: mode === 'dark' ? colors.text : '#000000',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: mode === 'dark' ? colors.text : '#000000',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtext: {
    color: mode === 'dark' ? colors.textSecondary : '#666666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  workerList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  workerCard: {
    backgroundColor: mode === 'dark' ? colors.card : "#F5F5F5",
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    width: width - 40,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: mode === 'dark' ? colors.border : "#000000",
  },
  avatarPlaceholder: {
    backgroundColor: mode === 'dark' ? colors.iconBg : "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  nameAndDetailsContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  workerName: {
    fontSize: 17,
    fontWeight: "700",
    color: mode === 'dark' ? colors.text : "#000000",
    flex: 1,
    letterSpacing: -0.3,
  },
  hourlyRate: {
    fontSize: 15,
    fontWeight: '700',
    color: mode === 'dark' ? colors.primary : "#000000",
    marginLeft: 12,
  },
  workerDescription: {
    fontSize: 13,
    color: mode === 'dark' ? colors.textSecondary : "#666666",
    lineHeight: 18,
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: mode === 'dark' ? colors.background : '#FFFFFF',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCCCCC',
  },
  availableDot: {
    backgroundColor: '#34C759',
  },
  available: {
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
  },
  busy: {
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
  },
  unavailable: {
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : '#000000',
  },
  workerExperience: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : "#666666",
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : "#000000",
  },
  reviewCount: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : "#666666",
  },
  noRating: {
    fontSize: 12,
    color: mode === 'dark' ? colors.textSecondary : "#999999",
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  orderButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: mode === 'dark' ? colors.primary : "#000000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  orderButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: mode === 'dark' ? colors.text : "#000000",
  },
  chatButtonText: {
    color: mode === 'dark' ? colors.text : "#000000",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  pendingButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: mode === 'dark' ? colors.background : '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
  },
  pendingButtonText: {
    color: mode === 'dark' ? colors.textSecondary : '#666666',
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});