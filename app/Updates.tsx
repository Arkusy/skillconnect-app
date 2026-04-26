// app/Updates.tsx
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAdminTheme } from "../context/AdminThemeContext";
import { supabase } from "../utils/supabase";

const { width } = Dimensions.get("window");

// --- TYPES ---

type NotificationType = 'important' | 'order' | 'offer';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  actionText?: string;
  navigateTo?: string;
}

// --- SKELETON COMPONENT ---
const SkeletonItem = ({ colors, mode }: { colors: any, mode: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const styles = getStyles(colors, mode);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity, borderColor: 'transparent', backgroundColor: mode === 'dark' ? colors.card : '#FFFFFF' }]}>
      <View style={[styles.iconContainer, { backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0' }]} />
      <View style={styles.cardContent}>
        <View style={{ height: 16, width: '60%', backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0', borderRadius: 4, marginBottom: 8 }} />
        <View style={{ height: 12, width: '90%', backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0', borderRadius: 4, marginBottom: 4 }} />
        <View style={{ height: 12, width: '40%', backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0', borderRadius: 4 }} />
      </View>
    </Animated.View>
  );
};

// Helper to get icon/color based on notification type and data
const getNotificationStyle = (type: string, data?: any) => {
  // Check for specific actions first
  const action = data?.action;

  // Worker role changes
  if (action === 'worker_demotion') {
    return {
      icon: 'warning' as keyof typeof Ionicons.glyphMap,
      iconColor: '#D32F2F',
      bgColor: '#FFEBEE',
      actionText: 'Apply Again',
      navigateTo: '/WorkerUpgrade'
    };
  }
  if (action === 'worker_promotion') {
    return {
      icon: 'ribbon' as keyof typeof Ionicons.glyphMap,
      iconColor: '#4CAF50',
      bgColor: '#E8F5E9',
      actionText: 'Go to Dashboard',
      navigateTo: '/(tabs)/Home'
    };
  }

  // Verification actions
  if (action === 'verification_approved') {
    return {
      icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
      iconColor: '#4CAF50',
      bgColor: '#E8F5E9',
      actionText: 'Start Working',
      navigateTo: '/(tabs)/Home'
    };
  }
  if (action === 'verification_rejected') {
    return {
      icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
      iconColor: '#D32F2F',
      bgColor: '#FFEBEE',
      actionText: 'Try Again',
      navigateTo: '/WorkerUpgrade'
    };
  }
  if (action === 'payment_pending') {
    return {
      icon: 'card' as keyof typeof Ionicons.glyphMap,
      iconColor: '#FF9800',
      bgColor: '#FFF3E0',
      actionText: 'Complete Payment',
      navigateTo: '/PaymentScreen?amount=499'
    };
  }

  // Order actions
  if (action === 'new_order') {
    return {
      icon: 'briefcase' as keyof typeof Ionicons.glyphMap,
      iconColor: '#2196F3',
      bgColor: '#E3F2FD',
      actionText: 'View Orders',
      navigateTo: '/(tabs)/MyOrders'
    };
  }
  if (action === 'order_accepted') {
    return {
      icon: 'checkmark' as keyof typeof Ionicons.glyphMap,
      iconColor: '#4CAF50',
      bgColor: '#E8F5E9',
      actionText: 'View Order',
      navigateTo: data?.order_id ? `/DisplayOrder?orderId=${data.order_id}` : undefined
    };
  }
  if (action === 'order_completed') {
    return {
      icon: 'checkmark-done' as keyof typeof Ionicons.glyphMap,
      iconColor: '#2E7D32',
      bgColor: '#E8F5E9',
      actionText: 'Rate & Review',
      navigateTo: data?.order_id ? `/DisplayOrder?orderId=${data.order_id}` : undefined
    };
  }
  if (action === 'order_cancelled') {
    return {
      icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
      iconColor: '#757575',
      bgColor: '#F5F5F5',
      actionText: 'View Details',
      navigateTo: data?.order_id ? `/DisplayOrder?orderId=${data.order_id}` : undefined
    };
  }

  switch (type) {
    case 'important':
      return {
        icon: 'alert-circle' as keyof typeof Ionicons.glyphMap,
        iconColor: '#D32F2F',
        bgColor: '#FFEBEE',
        actionText: data?.navigate_to ? 'View Details' : undefined,
        navigateTo: data?.navigate_to
      };
    case 'order':
      const status = data?.status;
      if (status === 'completed') {
        return {
          icon: 'checkmark-done' as keyof typeof Ionicons.glyphMap,
          iconColor: '#2E7D32',
          bgColor: '#E8F5E9',
          actionText: 'View Order',
          navigateTo: data?.order_id ? `/DisplayOrder?orderId=${data.order_id}` : undefined
        };
      } else if (status === 'cancelled') {
        return {
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: '#757575',
          bgColor: '#F5F5F5',
          actionText: 'View Order',
          navigateTo: data?.order_id ? `/DisplayOrder?orderId=${data.order_id}` : undefined
        };
      } else if (status === 'accepted') {
        return {
          icon: 'checkmark' as keyof typeof Ionicons.glyphMap,
          iconColor: '#4CAF50',
          bgColor: '#E8F5E9',
          actionText: 'View Order',
          navigateTo: data?.order_id ? `/DisplayOrder?orderId=${data.order_id}` : undefined
        };
      }
      // New order request (for workers)
      return {
        icon: 'cart' as keyof typeof Ionicons.glyphMap,
        iconColor: '#2196F3',
        bgColor: '#E3F2FD',
        actionText: 'View Orders',
        navigateTo: '/(tabs)/MyOrders'
      };
    case 'offer':
      return {
        icon: 'gift' as keyof typeof Ionicons.glyphMap,
        iconColor: '#7B1FA2',
        bgColor: '#F3E5F5'
      };
    default:
      return {
        icon: 'notifications' as keyof typeof Ionicons.glyphMap,
        iconColor: '#757575',
        bgColor: '#F5F5F5'
      };
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default function UpdatesScreen() {
  const router = useRouter();
  const { colors, mode } = useAdminTheme();
  const styles = useMemo(() => getStyles(colors, mode), [colors, mode]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<NotificationType | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedNotifications: NotificationItem[] = (data || []).map(n => {
        const style = getNotificationStyle(n.type, n.data);
        return {
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          message: n.message,
          timestamp: formatTimeAgo(n.created_at),
          read: n.is_read,
          data: n.data,
          ...style
        };
      });

      setNotifications(formattedNotifications);
    } catch (error) {
      console.log('Error fetching notifications:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    };
    loadData();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const n = payload.new as any;
          const style = getNotificationStyle(n.type, n.data);
          const newNotification: NotificationItem = {
            id: n.id,
            type: n.type as NotificationType,
            title: n.title,
            message: n.message,
            timestamp: formatTimeAgo(n.created_at),
            read: n.is_read,
            data: n.data,
            ...style
          };
          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  // Hardware Back Button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeSection) {
        handleBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [activeSection]);

  const handleBack = () => {
    if (activeSection) {
      setActiveSection(null);
    } else {
      router.back();
    }
  };

  const handleSeeAll = (type: NotificationType) => {
    setActiveSection(type);
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    // Mark as read
    if (!item.read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.id);

      setNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, read: true } : n)
      );
    }

    // Navigate using the navigateTo property
    if (item.navigateTo) {
      router.push(item.navigateTo as any);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const NotificationCard = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity onPress={() => handleNotificationPress(item)}>
      <View style={[styles.card, !item.read && styles.unreadCard, { backgroundColor: mode === 'dark' ? colors.card : '#FFFFFF' }]}>
        <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
          <Ionicons name={item.icon} size={24} color={item.iconColor} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>

          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.message}
          </Text>

          {item.actionText && item.navigateTo && (
            <View style={[styles.actionButton, { backgroundColor: item.iconColor + '15' }]}>
              <Text style={[styles.actionButtonText, { color: item.iconColor }]}>
                {item.actionText}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={item.iconColor} />
            </View>
          )}
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title, count, type }: { title: string; count?: number, type: NotificationType }) => {
    const isExpanded = activeSection === type;

    return (
      <View style={styles.sectionHeader}>
        <View style={styles.titleContainer}>
          {isExpanded && (
            <TouchableOpacity onPress={handleBack} style={{ marginRight: 8 }}>
              <Ionicons name="arrow-back" size={24} color={mode === 'dark' ? colors.text : "#000"} />
            </TouchableOpacity>
          )}
          <Text style={[styles.sectionTitle, isExpanded && { fontSize: 24 }]}>{title}</Text>

          {count && count > 0 && !isExpanded ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          ) : null}
        </View>

        {!isExpanded && (
          <TouchableOpacity onPress={() => handleSeeAll(type)}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Group notifications by type
  const importantNotifications = notifications.filter(n => n.type === 'important');
  const orderNotifications = notifications.filter(n => n.type === 'order');
  const offerNotifications = notifications.filter(n => n.type === 'offer');

  const getUnreadCount = (list: NotificationItem[]) => list.filter(n => !n.read).length;

  const renderSection = (
    type: NotificationType,
    title: string,
    data: NotificationItem[]
  ) => {
    if (activeSection && activeSection !== type) {
      return null;
    }

    const isExpanded = activeSection === type;
    const displayData = isExpanded ? data : data.slice(0, 2);

    if (data.length === 0 && !isExpanded) return null;

    return (
      <View style={styles.sectionContainer}>
        <SectionHeader title={title} count={getUnreadCount(data)} type={type} />
        <View style={styles.listContainer}>
          {displayData.length === 0 ? (
            <Text style={styles.emptyText}>No {title.toLowerCase()} notifications</Text>
          ) : (
            displayData.map((item) => (
              <NotificationCard key={item.id} item={item} />
            ))
          )}

          {isExpanded && data.length > 0 && (
            <Text style={styles.endOfListText}>No more notifications</Text>
          )}
        </View>

        {!isExpanded && <View style={styles.divider} />}
      </View>
    );
  };

  const renderSkeletons = () => {
    if (activeSection) {
      return (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ height: 30, width: 150, backgroundColor: mode === 'dark' ? colors.border : '#f0f0f0', borderRadius: 4, marginVertical: 16 }} />
          {[1, 2, 3, 4].map(i => <SkeletonItem key={i} colors={colors} mode={mode} />)}
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 20 }}>
        {[1, 2, 3].map((section) => (
          <View key={section} style={{ marginBottom: 20, marginTop: 10 }}>
            <View style={{ width: 100, height: 20, backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0', borderRadius: 4, marginBottom: 15 }} />
            <SkeletonItem colors={colors} mode={mode} />
            <SkeletonItem colors={colors} mode={mode} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={mode === 'dark' ? colors.headerBg : "#FFFFFF"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name={activeSection ? "close" : "chevron-back"} size={24} color={mode === 'dark' ? colors.text : "#000"} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Updates</Text>
        <TouchableOpacity style={styles.headerAction} onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done-outline" size={24} color={mode === 'dark' ? colors.text : "#000"} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          renderSkeletons()
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No notifications yet</Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              You'll see order updates and important alerts here
            </Text>
          </View>
        ) : (
          <View>
            {renderSection('important', 'Important', importantNotifications)}
            {renderSection('order', 'Orders', orderNotifications)}
            {renderSection('offer', 'Offers', offerNotifications)}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, mode: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mode === 'dark' ? colors.background : '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: mode === 'dark' ? colors.border : '#F5F5F5',
    backgroundColor: mode === 'dark' ? colors.headerBg : '#FFFFFF',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mode === 'dark' ? colors.border : '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: mode === 'dark' ? colors.text : '#000',
  },
  scrollContent: {
    paddingVertical: 10,
  },
  sectionContainer: {},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: mode === 'dark' ? colors.text : '#000',
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: mode === 'dark' ? colors.textSecondary : '#666',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  divider: {
    height: 1,
    backgroundColor: mode === 'dark' ? colors.border : '#F0F0F0',
    marginVertical: 24,
    marginHorizontal: 20,
  },
  endOfListText: {
    textAlign: 'center',
    color: mode === 'dark' ? colors.textSecondary : '#999',
    marginTop: 20,
    marginBottom: 40,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: mode === 'dark' ? colors.textSecondary : '#999',
    paddingVertical: 20,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: mode === 'dark' ? colors.card : '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: mode === 'dark' ? colors.border : '#F0F0F0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: mode === 'dark' ? colors.card : '#FAFAFA',
    borderColor: mode === 'dark' ? colors.border : '#E0E0E0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: mode === 'dark' ? colors.text : '#000',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 11,
    color: mode === 'dark' ? colors.textSecondary : '#999',
    fontWeight: '500',
  },
  cardMessage: {
    fontSize: 13,
    color: mode === 'dark' ? colors.textSecondary : '#666',
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    position: 'absolute',
    top: 16,
    right: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});