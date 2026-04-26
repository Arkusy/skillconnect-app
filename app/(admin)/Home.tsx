import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { useProfile } from "../../utils/useProfile";

const { width } = Dimensions.get("window");

interface Activity {
    id: string;
    text: string;
    time: string;
    icon: string;
    color: string;
    type: 'order' | 'user' | 'verification';
    targetId?: string | number;
}

const QUICK_ACTIONS = [
    { id: "verify", label: "Verify Workers", icon: "shield-checkmark", color: "#54a0ff", route: "/(admin)/VerifyWorkers" },
    { id: "users", label: "Manage Users", icon: "people", color: "#00d2d3", route: "/(admin)/users" },
    { id: "help", label: "Help Center", icon: "help-buoy", color: "#ff9f43", route: "/(admin)/help" },
    { id: "settings", label: "System Settings", icon: "settings", color: "#576574", route: "/(admin)/Account" },
];

export default function AdminHomeScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { profile } = useProfile();
    const { colors, mode } = useAdminTheme();

    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [helpRequestCount, setHelpRequestCount] = useState(0);
    const [userCount, setUserCount] = useState(0);
    const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
    const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(true);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        if (profile?.avatar_url) {
            downloadImage(profile.avatar_url);
        }
    }, [profile]);

    async function downloadImage(path: string) {
        try {
            if (path.startsWith('http')) {
                setAvatarUrl(path);
                return;
            }
            const { data, error } = await supabase.storage
                .from("avatars")
                .download(path);
            if (error) throw error;
            const fr = new FileReader();
            fr.readAsDataURL(data);
            fr.onload = () => {
                setAvatarUrl(fr.result as string);
            };
        } catch (error) {
            console.log("Error downloading image: ", error);
        }
    }

    // Fetch help requests with unread messages and total users
    useFocusEffect(
        useCallback(() => {
            const fetchCounts = async () => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    // Get help conversations with unread messages for this admin
                    const { data: helpConvs } = await supabase
                        .from('conversations')
                        .select('id')
                        .eq('is_help_channel', true);

                    if (helpConvs) {
                        let unreadChatCount = 0;
                        for (const conv of helpConvs) {
                            const { count } = await supabase
                                .from('messages')
                                .select('id', { count: 'exact', head: true })
                                .eq('conversation_id', conv.id)
                                .eq('receiver_id', user.id)
                                .eq('is_read', false);
                            if (count && count > 0) unreadChatCount++;
                        }
                        setHelpRequestCount(unreadChatCount);
                    }

                    // Get total non-admin users (role != 0)
                    const { count: usersCount } = await supabase
                        .from('profiles')
                        .select('id', { count: 'exact', head: true })
                        .neq('role', 0);

                    setUserCount(usersCount || 0);

                    // Get pending verification count
                    const { count: pendingCount } = await supabase
                        .from('worker_verification')
                        .select('id', { count: 'exact', head: true })
                        .in('status', ['pending', 'payment_pending']);

                    setPendingVerificationCount(pendingCount || 0);

                    // Fetch recent activities
                    await fetchRecentActivities();
                } catch (error) {
                    console.log('Error fetching counts:', error);
                }
            };

            fetchCounts();
        }, [])
    );

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

    const fetchRecentActivities = async () => {
        setActivitiesLoading(true);
        try {
            const activities: Activity[] = [];
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 2);

            // Fetch recent orders
            const { data: orders } = await supabase
                .from('orders')
                .select('id, status, created_at, customer_name')
                .gte('created_at', oneDayAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(5);

            orders?.forEach(order => {
                const icons: Record<string, { icon: string; color: string; text: string }> = {
                    pending: { icon: 'cart', color: '#2196F3', text: `New Order #${order.id}` },
                    accepted: { icon: 'checkmark', color: '#4CAF50', text: `Order #${order.id} accepted` },
                    completed: { icon: 'checkmark-done', color: '#4CAF50', text: `Order #${order.id} completed` },
                    cancelled: { icon: 'close-circle', color: '#F44336', text: `Order #${order.id} cancelled` },
                };
                const info = icons[order.status] || icons.pending;
                activities.push({
                    id: `order-${order.id}`,
                    text: info.text,
                    time: formatTimeAgo(order.created_at),
                    icon: info.icon,
                    color: info.color,
                    type: 'order',
                    targetId: order.id,
                });
            });

            // Fetch recent registrations
            const { data: newUsers } = await supabase
                .from('profiles')
                .select('id, full_name, created_at')
                .neq('role', 0)
                .gte('created_at', oneDayAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(3);

            newUsers?.forEach(user => {
                activities.push({
                    id: `user-${user.id}`,
                    text: `User '${user.full_name || 'New User'}' registered`,
                    time: formatTimeAgo(user.created_at),
                    icon: 'person-add',
                    color: '#4CAF50',
                    type: 'user',
                    targetId: user.id,
                });
            });

            // Fetch recent verifications
            const { data: verifications } = await supabase
                .from('worker_verification')
                .select('id, status, updated_at, user_id, profiles:user_id(full_name)')
                .gte('updated_at', oneDayAgo.toISOString())
                .order('updated_at', { ascending: false })
                .limit(3);

            verifications?.forEach((v: any) => {
                const name = v.profiles?.full_name || 'Worker';
                const statusInfo: Record<string, { icon: string; color: string; text: string }> = {
                    pending: { icon: 'time', color: '#FF9800', text: `${name} submitted for verification` },
                    approved: { icon: 'checkmark-circle', color: '#4CAF50', text: `${name} verified` },
                    rejected: { icon: 'close-circle', color: '#F44336', text: `${name} verification rejected` },
                };
                const info = statusInfo[v.status] || statusInfo.pending;
                activities.push({
                    id: `verify-${v.id}`,
                    text: info.text,
                    time: formatTimeAgo(v.updated_at),
                    icon: info.icon,
                    color: info.color,
                    type: 'verification',
                });
            });

            // Sort by most recent and limit
            activities.sort((a, b) => {
                const timeA = a.time.includes('Just') ? 0 : parseInt(a.time);
                const timeB = b.time.includes('Just') ? 0 : parseInt(b.time);
                return timeA - timeB;
            });

            setRecentActivities(activities.slice(0, 6));
        } catch (error) {
            console.log('Error fetching activities:', error);
        } finally {
            setActivitiesLoading(false);
        }
    };

    const handleActivityPress = (activity: Activity) => {
        if (activity.type === 'order' && activity.targetId) {
            router.push(`/DisplayOrder?orderId=${activity.targetId}`);
        } else if (activity.type === 'user') {
            router.push('/(admin)/users');
        } else if (activity.type === 'verification') {
            router.push('/(admin)/VerifyWorkers');
        }
    };

    const FixedHeader = () => (
        <View style={[styles.headerContainer, {
            paddingTop: insets.top + 10,
            backgroundColor: colors.headerBg,
            shadowColor: mode === 'dark' ? '#000' : '#ccc'
        }]}>
            <View style={styles.headerTopRow}>
                <View>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Welcome back,</Text>
                    <Text style={[styles.headerTitle, { color: colors.primary }]}>{profile?.full_name || "Admin"}</Text>
                </View>
                <Pressable
                    style={[styles.profileBtn, { shadowColor: mode === 'dark' ? '#000' : '#888' }]}
                    onPress={() => router.push("/(admin)/Account")}
                >
                    <Image
                        source={
                            avatarUrl
                                ? { uri: avatarUrl }
                                : { uri: "https://ui-avatars.com/api/?name=Admin&background=2e86de&color=fff" }
                        }
                        style={[styles.profileImage, { borderColor: mode === 'dark' ? colors.card : '#FFF' }]}
                    />
                </Pressable>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.headerBg}
            />
            <FixedHeader />

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Animated Hero Card */}
                <Animated.View style={[styles.heroCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.heroOverlay}>
                        <View style={styles.heroContent}>
                            <View style={styles.heroIconCircle}>
                                <Ionicons name="flash" size={24} color="#00d2d3" />
                            </View>
                            <View>
                                <Text style={styles.heroTitle}>System Status</Text>
                                <Text style={styles.heroStatus}>All Systems Operational</Text>
                            </View>
                        </View>
                        <BlurView intensity={20} tint="light" style={styles.blurBadge}>
                            <Text style={styles.onlineText}>● Online</Text>
                        </BlurView>
                    </View>
                </Animated.View>

                {/* Quick Actions Grid */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                <View style={styles.gridContainer}>
                    {QUICK_ACTIONS.map((action, index) => {
                        // Determine badge info
                        let badgeCount: number | null = null;
                        let badgeColor = '#4CAF50'; // green by default

                        if (action.id === 'help') {
                            badgeCount = helpRequestCount;
                            badgeColor = helpRequestCount > 0 ? '#EF4444' : '#4CAF50';
                        } else if (action.id === 'users') {
                            badgeCount = userCount;
                            badgeColor = '#4CAF50'; // always green
                        } else if (action.id === 'verify') {
                            badgeCount = pendingVerificationCount;
                            badgeColor = pendingVerificationCount > 0 ? '#EF4444' : '#4CAF50';
                        }

                        return (
                            <Pressable
                                key={action.id}
                                style={({ pressed }) => [
                                    styles.actionCard,
                                    { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' },
                                    pressed && styles.pressedCard
                                ]}
                                onPress={() => router.push(action.route as any)}
                            >
                                {badgeCount !== null && (
                                    <View style={[styles.countBadge, { backgroundColor: badgeColor }]}>
                                        <Text style={styles.countBadgeText}>{badgeCount}</Text>
                                    </View>
                                )}
                                <View style={[styles.actionIconBox, { backgroundColor: action.color + '20' }]}>
                                    <Ionicons name={action.icon as any} size={28} color={action.color} />
                                </View>
                                <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Recent Activity Feed */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
                <View style={[styles.activityList, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                    {activitiesLoading ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary }}>Loading...</Text>
                        </View>
                    ) : recentActivities.length === 0 ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary }}>No recent activity</Text>
                        </View>
                    ) : (
                        recentActivities.map((item, index) => (
                            <Pressable
                                key={item.id}
                                onPress={() => handleActivityPress(item)}
                            >
                                <Animated.View
                                    style={[
                                        styles.activityItem,
                                        {
                                            borderBottomColor: colors.border,
                                            opacity: fadeAnim,
                                            transform: [{
                                                translateX: slideAnim.interpolate({
                                                    inputRange: [0, 50],
                                                    outputRange: [0, 50 * (index + 1) * 0.2]
                                                })
                                            }]
                                        }
                                    ]}
                                >
                                    <View style={[styles.activityIcon, { backgroundColor: item.color + '20' }]}>
                                        <Ionicons name={item.icon as any} size={18} color={item.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.activityText, { color: colors.text }]}>{item.text}</Text>
                                        <Text style={[styles.activityTime, { color: colors.textSecondary }]}>{item.time}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                </Animated.View>
                            </Pressable>
                        ))
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        paddingBottom: 15,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        zIndex: 10,
        paddingHorizontal: 20,
    },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: "800",
    },
    headerSubtitle: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: -4,
    },
    profileBtn: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    profileImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
    },
    content: {
        padding: 20,
    },
    heroCard: {
        backgroundColor: "#2f3542",
        borderRadius: 20,
        height: 120,
        marginBottom: 30,
        shadowColor: "#2f3542",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden'
    },
    heroOverlay: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        position: 'relative',
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15
    },
    heroIconCircle: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    heroTitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    heroStatus: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    blurBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'absolute',
        top: 20,
        right: 20,
    },
    onlineText: {
        color: '#00d2d3',
        fontWeight: 'bold',
        fontSize: 12
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 15,
        marginLeft: 4
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 15,
        marginBottom: 30
    },
    actionCard: {
        width: (width - 55) / 2,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    pressedCard: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }]
    },
    actionIconBox: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabel: {
        fontWeight: "600",
        fontSize: 14
    },
    countBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
        zIndex: 10,
    },
    countBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    activityList: {
        borderRadius: 20,
        padding: 10,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        gap: 15
    },
    activityIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    activityText: {
        fontWeight: "600",
        fontSize: 14
    },
    activityTime: {
        fontSize: 12,
        marginTop: 2
    }
});
