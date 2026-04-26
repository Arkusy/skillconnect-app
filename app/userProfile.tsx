import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../context/AdminThemeContext";
import { supabase } from "../utils/supabase";

const { width } = Dimensions.get("window");

interface UserProfile {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: number;
    email: string;
    phone: string | null;
    address: string | null;
    created_at: string;
}

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
    categories: {
        name: string;
        icon: string;
    };
    portfolio_images: string[] | null;
}

interface Rating {
    id: number;
    rating: number;
    review: string | null;
    created_at: string;
}

interface Order {
    id: number;
    user_id: string;
    worker_id: string;
    status: string;
    total_price: number | null;
    created_at: string;
    problem_description: string | null;
    categories: {
        name: string;
        icon: string;
    };
}

export default function UserProfileScreen() {
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, mode } = useAdminTheme();
    const styles = useMemo(() => getStyles(colors, mode), [colors, mode]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [workerDetails, setWorkerDetails] = useState<WorkerProfile | null>(null);
    const [reviews, setReviews] = useState<Rating[]>([]);
    const [showAllReviews, setShowAllReviews] = useState(false);

    // Shared Orders
    const [sharedOrders, setSharedOrders] = useState<Order[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [showAllOrders, setShowAllOrders] = useState(false);

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [userId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                fetchUserProfile(),
                fetchWorkerData(),
                fetchSharedOrders(),
            ]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserProfile = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return;
        }
        setUserProfile(data);
    };

    const fetchWorkerData = async () => {
        // Check if user is a worker
        const { data: workerData, error } = await supabase
            .from('worker_profiles')
            .select(`
        *,
        categories (
          name,
          icon
        )
      `)
            .eq('user_id', userId)
            .maybeSingle();

        if (workerData) {
            setWorkerDetails(workerData);

            // Fetch reviews if worker
            // Assuming ratings are linked via orders for this worker
            // Query ratings where order has worker_id = userId
            const { data: reviewsData } = await supabase
                .from('ratings')
                .select(`
          id,
          rating,
          review,
          created_at,
          orders!inner (
            worker_id
          )
        `)
                .eq('orders.worker_id', userId)
                .order('created_at', { ascending: false });

            if (reviewsData) {
                setReviews(reviewsData.map((r: any) => ({
                    id: r.id,
                    rating: r.rating,
                    review: r.review,
                    created_at: r.created_at,
                })));
            }
        }
    };

    const fetchSharedOrders = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const { data } = await supabase
            .from('orders')
            .select('*, categories(name, icon)')
            // Fetch where (worker is current AND user is profile) OR (user is current AND worker is profile)
            .or(`and(worker_id.eq.${user.id},user_id.eq.${userId}),and(user_id.eq.${user.id},worker_id.eq.${userId})`)
            .order('created_at', { ascending: false });

        if (data) setSharedOrders(data);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const getAvatarUrl = (avatarPath: string | null) => {
        if (!avatarPath) return null;
        if (avatarPath.startsWith('http')) return avatarPath;
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
        return data.publicUrl;
    };

    const getPortfolioImageUrl = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from('portfolio').getPublicUrl(path);
        return data.publicUrl;
    };

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

    const getRoleName = (role: number) => {
        switch (role) {
            case 0: return "Admin";
            case 1: return "Worker";
            default: return "User";
        }
    };

    const renderRoleBadge = (role: number) => {
        const roleName = getRoleName(role);
        let badgeColor = colors.primary;
        let icon = "account";

        if (role === 0) {
            badgeColor = "#F44336"; // Red for Admin
            icon = "shield-account";
        } else if (role === 1) {
            badgeColor = "#2196F3"; // Blue for Worker
            icon = "briefcase";
        } else {
            badgeColor = "#4CAF50"; // Green for User
            icon = "account-circle";
        }

        return (
            <View style={[styles.roleBadge, { backgroundColor: badgeColor }]}>
                <MaterialCommunityIcons name={icon as any} size={14} color="#FFF" />
                <Text style={styles.roleText}>{roleName}</Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!userProfile) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>User not found</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const avatarUrl = getAvatarUrl(userProfile.avatar_url);
    const isWorker = userProfile.role === 1 || !!workerDetails;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={mode === 'dark' ? colors.headerBg : "#FFFFFF"} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={mode === 'dark' ? colors.text : "#000"} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={50} color="#999" />
                            </View>
                        )}
                    </View>

                    <Text style={styles.profileName}>{userProfile.full_name}</Text>
                    {renderRoleBadge(userProfile.role)}
                    <Text style={styles.joinedDate}>Joined {new Date(userProfile.created_at).toLocaleDateString()}</Text>
                </View>

                {/* Worker Specific Details */}
                {/* Portfolio Section */}
                {isWorker && workerDetails?.portfolio_images && workerDetails.portfolio_images.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Portfolio</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                            {workerDetails.portfolio_images.map((img: string, index: number) => {
                                const url = getPortfolioImageUrl(img);
                                return (
                                    <View key={index} style={[styles.demoImagePlaceholder, { backgroundColor: mode === 'dark' ? colors.card : '#E0E0E0', overflow: 'hidden' }]}>
                                        {url ? (
                                            <Image source={{ uri: url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                                        ) : (
                                            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {isWorker && workerDetails && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Details</Text>
                        <View style={styles.card}>
                            <View style={styles.detailRow}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.detailLabel}>Service Category</Text>
                                    <Text style={styles.detailValue}>{workerDetails.categories?.name || "Unknown"}</Text>
                                </View>
                            </View>

                            <View style={[styles.divider, { marginVertical: 12 }]} />

                            <View style={styles.detailRow}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.detailLabel}>Pricing</Text>
                                    <Text style={styles.detailValue}>
                                        {workerDetails.currency === 'USD' ? '$' : '₹'}{workerDetails.price?.toFixed(0)}
                                        {workerDetails.pricing_type === 'hourly' ? '/hr' : ''}
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.divider, { marginVertical: 12 }]} />

                            <View style={styles.detailRow}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="star-outline" size={20} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.detailLabel}>Rating</Text>
                                    <Text style={styles.detailValue}>
                                        {workerDetails.average_rating.toFixed(1)} ({workerDetails.total_ratings} Reviews)
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={[styles.detailLabel, { marginBottom: 8 }]}>About</Text>
                            {workerDetails.service_description ? (
                                <Text style={styles.bioText}>{workerDetails.service_description}</Text>
                            ) : (
                                <Text style={[styles.bioText, { fontStyle: 'italic', opacity: 0.7 }]}>No description provided.</Text>
                            )}
                        </View>
                    </View>
                )}

                {/* Reviews Section for Worker */}
                {/* Reviews Section for Worker */}
                {isWorker && (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.sectionTitle}>Reviews</Text>
                            <Text style={styles.reviewCountBadge}>{reviews.length}</Text>
                        </View>

                        {reviews.length > 0 ? (
                            <>
                                {(showAllReviews ? reviews : reviews.slice(0, 3)).map((review) => (
                                    <View key={review.id} style={styles.reviewCard}>
                                        <View style={styles.reviewHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={styles.reviewerName}>Anonymous</Text>
                                                <View style={{ flexDirection: 'row' }}>
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <Ionicons
                                                            key={star}
                                                            name={star <= review.rating ? "star" : "star-outline"}
                                                            size={14}
                                                            color="#FFB800"
                                                        />
                                                    ))}
                                                </View>
                                            </View>
                                            <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                                        </View>
                                        {review.review ? (
                                            <Text style={styles.reviewText}>{review.review}</Text>
                                        ) : (
                                            <Text style={[styles.reviewText, { fontStyle: 'italic', opacity: 0.7 }]}>No description.</Text>
                                        )}
                                    </View>
                                ))}

                                {reviews.length > 3 && (
                                    <TouchableOpacity
                                        style={styles.showMoreButton}
                                        onPress={() => setShowAllReviews(!showAllReviews)}
                                    >
                                        <Text style={styles.showMoreText}>
                                            {showAllReviews ? "Show Less" : "Show More"}
                                        </Text>
                                        <Ionicons name={showAllReviews ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textSecondary} />
                                <Text style={styles.emptyText}>No reviews yet</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Shared Orders Section */}
                {sharedOrders.length > 0 && (
                    <View style={[styles.section, { marginTop: 24 }]}>
                        <Text style={styles.sectionTitle}>Order History</Text>

                        {(showAllOrders ? sharedOrders : sharedOrders.slice(0, 3)).map((order) => {
                            const statusColor = getStatusColor(order.status);
                            const statusIcon = getStatusIcon(order.status);

                            return (
                                <Pressable
                                    key={order.id}
                                    style={styles.orderCard}
                                    onPress={() => router.push({ pathname: '/DisplayOrder', params: { orderId: order.id.toString() } })}
                                >
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.orderId}>Order #{order.id}</Text>
                                        <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
                                            <MaterialCommunityIcons name={statusIcon as any} size={14} color={statusColor} />
                                            <Text style={[styles.statusText, { color: statusColor }]}>
                                                {order.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.cardBody}>
                                        <View style={styles.infoRow}>
                                            <View style={styles.iconBox}>
                                                <MaterialCommunityIcons name={order.categories.icon as any} size={20} color={colors.primary} />
                                            </View>
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={styles.categoryTitle}>{order.categories.name}</Text>
                                                {order.problem_description && (
                                                    <Text style={[styles.detailLabel, { marginTop: 4 }]} numberOfLines={1}>{order.problem_description}</Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.cardFooter}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.textSecondary} />
                                            <Text style={styles.reviewDate}>
                                                {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={mode === 'dark' ? colors.border : "#ccc"} />
                                    </View>
                                </Pressable>
                            );
                        })}

                        {sharedOrders.length > 3 && (
                            <TouchableOpacity style={styles.showMoreButton} onPress={() => setShowAllOrders(!showAllOrders)}>
                                <Text style={styles.showMoreText}>{showAllOrders ? "Show Less" : `Show More (${sharedOrders.length - 3} more)`}</Text>
                                <Ionicons name={showAllOrders ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Demo Things Section */}


                {/* Report User Button */}
                {/* Report User Button */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.reportButton}
                        onPress={() => router.push({
                            pathname: "/ReportUser",
                            params: { userId, userName: userProfile.full_name }
                        })}
                    >
                        <Ionicons name="flag-outline" size={18} color="#ef4444" />
                        <Text style={styles.reportButtonText}>Report User</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any, mode: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: mode === 'dark' ? colors.background : "#F5F7FA",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: mode === 'dark' ? colors.background : "#F5F7FA",
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: mode === 'dark' ? colors.background : "#F5F7FA",
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: colors.textSecondary,
        marginBottom: 20,
    },
    backButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: mode === 'dark' ? colors.headerBg : "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: mode === 'dark' ? colors.border : "#F0F0F0",
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: mode === 'dark' ? colors.text : "#000",
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    avatarContainer: {
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: mode === 'dark' ? colors.background : "#FFFFFF",
    },
    avatarPlaceholder: {
        backgroundColor: mode === 'dark' ? colors.background : "#F0F0F0",
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileName: {
        fontSize: 24,
        fontWeight: '800',
        color: mode === 'dark' ? colors.text : "#1A1A1A",
        marginBottom: 8,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 8,
        gap: 6,
    },
    roleText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    joinedDate: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: mode === 'dark' ? colors.text : "#1A1A1A",
        marginBottom: 12,
    },
    card: {
        backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: mode === 'dark' ? colors.border : "transparent",
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: mode === 'dark' ? colors.iconBg : "#F5F9FF",
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '600',
        color: mode === 'dark' ? colors.text : "#1A1A1A",
    },
    divider: {
        height: 1,
        backgroundColor: mode === 'dark' ? colors.border : "#F0F0F0",
    },
    bioText: {
        fontSize: 14,
        lineHeight: 22,
        color: mode === 'dark' ? colors.textSecondary : "#444",
    },
    reviewCard: {
        backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: mode === 'dark' ? colors.border : "#F0F0F0",
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewDate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    reviewText: {
        fontSize: 14,
        color: mode === 'dark' ? colors.text : "#333",
        lineHeight: 20,
    },
    reviewCountBadge: {
        backgroundColor: mode === 'dark' ? colors.border : "#E0E0E0",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        fontSize: 12,
        color: mode === 'dark' ? colors.text : "#444",
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: mode === 'dark' ? colors.card : "#FAFAFA",
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: mode === 'dark' ? colors.border : "#E0E0E0",
    },
    emptyText: {
        marginTop: 8,
        color: colors.textSecondary,
        fontSize: 14,
    },
    demoImagePlaceholder: {
        width: 180,
        height: 120,
        borderRadius: 12,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reviewerName: {
        fontSize: 14,
        fontWeight: '600',
        color: mode === 'dark' ? colors.text : "#000",
    },
    showMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
        marginTop: 4,
    },
    showMoreText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    reportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
    },
    reportButtonText: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: '600',
    },
    // Shared Orders Styles
    orderCard: {
        backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
        borderRadius: 16,
        paddingVertical: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: mode === 'dark' ? colors.border : "transparent",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    orderId: {
        fontSize: 16,
        fontWeight: "bold",
        color: mode === 'dark' ? colors.text : "#333",
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4,
    },
    statusText: { fontSize: 11, fontWeight: "700" },
    cardBody: { paddingHorizontal: 16, paddingTop: 12 },
    infoRow: { flexDirection: "row", alignItems: "center" },
    categoryTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: mode === 'dark' ? colors.text : "#222",
    },
    cardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 12,
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: mode === 'dark' ? colors.border : "#f0f0f0",
    },
});


