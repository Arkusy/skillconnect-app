import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image, // Added Image
    Modal,
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
import { useAdminTheme } from '../../context/AdminThemeContext';
import { supabase } from "../../utils/supabase";

const { width } = Dimensions.get("window");

type ChartPeriod = 'daily' | 'weekly' | 'monthly';

interface DashboardStats {
    revenue: string;
    activeOrders: string;
    disputes: string;
}

interface OrderPreview {
    id: number;
    total_price: number;
    status: string;
    created_at: string;
    items_count: number;
    currency: string;
}

interface ChartDataPoint {
    label: string;
    value: number; // percentage
    amount: number; // raw total
}

export default function AdminDashboardScreen() {
    const insets = useSafeAreaInsets();
    const { colors, mode } = useAdminTheme(); // Use Theme

    // Chart State
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('daily');
    const [showFilter, setShowFilter] = useState(false);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

    const MAX_BARS = 12;
    const barAnims = useRef(new Array(MAX_BARS).fill(0).map(() => new Animated.Value(0))).current;

    const [stats, setStats] = useState<DashboardStats>({
        revenue: "$0.00",
        activeOrders: "0",
        disputes: "0"
    });
    const [recentOrders, setRecentOrders] = useState<OrderPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [completedOrders, setCompletedOrders] = useState<any[]>([]);

    // Top Workers State
    const [topWorkersMode, setTopWorkersMode] = useState<'rating' | 'earnings'>('rating');
    const [topWorkers, setTopWorkers] = useState<any[]>([]);

    // Format: 19 Dec 25
    const getFormattedDate = () => {
        const d = new Date();
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    const calculateOrderTotal = (order: any) => {
        let total = 0;
        // Logic: specific price logic based on schema
        // If total_price is already set in DB (preferred), use it.
        // Else calculate on fly.
        if (order.total_price) {
            total = Number(order.total_price);
        } else {
            const price = Number(order.price_amount || 0);
            const extra = Number(order.extra_parts_cost || 0);

            if (order.pricing_type === 'hourly') {
                const hours = Number(order.hours_worked || 0);
                total = (price * hours) + extra;
            } else {
                // 'fix' type
                total = price + extra;
            }
        }
        return { total, currency: order.currency || 'INR' }; // Default INR if null
    };

    const fetchDashboardData = async () => {
        try {
            // 1. Fetch completed orders with all cost columns
            const { data: revenueData } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1000);

            let revenueMap: Record<string, number> = {};

            if (revenueData) {
                setCompletedOrders(revenueData);

                // Aggregate Revenue by Currency
                revenueData.forEach(order => {
                    const { total, currency } = calculateOrderTotal(order);
                    if (!revenueMap[currency]) revenueMap[currency] = 0;
                    revenueMap[currency] += total;
                });
            }

            // Format Revenue String (e.g. "₹50,000 + $200")
            const revenueString = Object.entries(revenueMap)
                .map(([curr, amt]) => {
                    const symbol = curr === 'USD' ? '$' : '₹';
                    return `${symbol}${amt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                })
                .join(' + ') || "₹0.00";

            // 2. Count Active Orders
            const { count: activeCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .in('status', ['pending', 'accepted', 'initiated']);

            // 3. Count Pending Disputes
            const { count: disputeCount } = await supabase
                .from('issues')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'resolved');

            setStats({
                revenue: revenueString,
                activeOrders: (activeCount || 0).toString(),
                disputes: (disputeCount || 0).toString()
            });

            // 4. Fetch Recent Orders
            const { data: ordersData } = await supabase
                .from('orders')
                .select('id, total_price, status, created_at, currency, price_amount, pricing_type, hours_worked, worker_id') // Added worker_id
                .order('created_at', { ascending: false })
                .limit(5);

            if (ordersData) {
                const mappedOrders = ordersData.map(o => {
                    const { total, currency } = calculateOrderTotal(o);
                    return {
                        ...o,
                        total_price: total,
                        currency: currency,
                        items_count: 1
                    };
                });
                setRecentOrders(mappedOrders);
            }

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const processTopWorkers = async () => {
        if (topWorkersMode === 'rating') {
            // Fetch top rated from worker_profiles join profiles
            try {
                // Note: supabase-js auto detection for foreign keys can be tricky. 
                // We rely on 'user_id' FK in worker_profiles -> profiles(id)
                const { data, error } = await supabase
                    .from('worker_profiles')
                    .select('*, profiles:user_id(full_name, avatar_url)')
                    .order('average_rating', { ascending: false })
                    .limit(5);

                if (data) {
                    const mapped = data.map(w => ({
                        id: w.user_id,
                        name: w.profiles?.full_name || 'Unknown',
                        avatar: w.profiles?.avatar_url,
                        secondary: `⭐ ${w.average_rating?.toFixed(1) || '0.0'} (${w.total_ratings || 0})`,
                        valueMetric: w.average_rating
                    }));
                    setTopWorkers(mapped);
                }
            } catch (e) {
                console.log("Error fetching top rated", e);
            }
        } else {
            // Calculate Top Earners from completedOrders
            const earningsMap: Record<string, number> = {};

            completedOrders.forEach(o => {
                if (o.worker_id) {
                    const { total } = calculateOrderTotal(o);
                    // Simplify: Convert everything to main unit or just sum raw (assuming single currency dominant for now)
                    // IDEAL: proper currency conversion. MVP: Sum it up.
                    if (!earningsMap[o.worker_id]) earningsMap[o.worker_id] = 0;
                    earningsMap[o.worker_id] += total;
                }
            });

            const sortedIds = Object.entries(earningsMap)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);

            if (sortedIds.length > 0) {
                // Fetch profiles for these IDs
                const ids = sortedIds.map(([id]) => id);
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', ids);

                if (data) {
                    const mapped = sortedIds.map(([id, amount]) => {
                        const profile = data.find(p => p.id === id);
                        return {
                            id,
                            name: profile?.full_name || 'Unknown',
                            avatar: profile?.avatar_url,
                            secondary: `Earned: ${amount.toFixed(0)}`, // Add currency symbol if known
                            valueMetric: amount
                        };
                    });
                    setTopWorkers(mapped);
                }
            } else {
                setTopWorkers([]);
            }
        }
    };

    const processChartData = () => {
        if (!completedOrders.length) {
            setChartData([]);
            return;
        }

        const now = new Date();
        let points: ChartDataPoint[] = [];

        // Note: For chart visualization mixing currencies is tricky.
        // We will sum pure numbers for now, or assume primary currency (INR) dominant.
        // Ideally we'd convert, but without exchange rates, we sum 'total' regardless of currency
        // just to show *volume* trend.

        if (chartPeriod === 'daily') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
                const dateKey = d.toISOString().split('T')[0];

                const total = completedOrders
                    .filter(o => o.created_at.startsWith(dateKey))
                    .reduce((sum, o) => sum + calculateOrderTotal(o).total, 0);

                points.push({ label: dayLabel, value: 0, amount: total });
            }
        }
        else if (chartPeriod === 'weekly') {
            for (let i = 3; i >= 0; i--) {
                const start = new Date();
                start.setDate(now.getDate() - (i * 7) - 6);
                const end = new Date();
                end.setDate(now.getDate() - (i * 7));
                const label = `W${4 - i}`;

                const total = completedOrders
                    .filter(o => {
                        const oDate = new Date(o.created_at);
                        return oDate >= start && oDate <= end;
                    })
                    .reduce((sum, o) => sum + calculateOrderTotal(o).total, 0);

                points.push({ label, value: 0, amount: total });
            }
        }
        else if (chartPeriod === 'monthly') {
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(now.getMonth() - i);
                const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                const total = completedOrders
                    .filter(o => o.created_at.startsWith(monthKey))
                    .reduce((sum, o) => sum + calculateOrderTotal(o).total, 0);

                points.push({ label: monthLabel, value: 0, amount: total });
            }
        }

        const maxAmount = Math.max(...points.map(p => p.amount), 1);
        points = points.map(p => ({
            ...p,
            value: (p.amount / maxAmount) * 100
        }));

        setChartData(points);
        animateChart(points.length);
    };

    const animateChart = (count: number) => {
        barAnims.forEach(anim => anim.setValue(0));
        const validAnims = barAnims.slice(0, count);
        const animations = validAnims.map((anim, index) =>
            Animated.spring(anim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                delay: index * 50,
                useNativeDriver: false,
            })
        );
        Animated.stagger(50, animations).start();
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    useEffect(() => {
        processChartData();
        processTopWorkers();
    }, [chartPeriod, completedOrders, topWorkersMode]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData();
    };

    const FixedHeader = () => (
        <View style={[styles.headerContainer, { paddingTop: insets.top + 10, backgroundColor: colors.headerBg }]}>
            <View style={styles.headerTopRow}>
                <Text style={[styles.headerTitle, { color: colors.primary }]}>Dashboard</Text>
                <View style={[styles.dateBadge, { backgroundColor: colors.border }]}>
                    <Text style={[styles.dateText, { color: colors.primary }]}>{getFormattedDate()}</Text>
                </View>
            </View>
        </View>
    );

    const getChartTitle = () => {
        switch (chartPeriod) {
            case 'daily': return 'Last 7 Days';
            case 'weekly': return 'Last 4 Weeks';
            case 'monthly': return 'Last 6 Months';
        }
    };

    // Helper component to load avatar (Same as in users.tsx)
    const AvatarItem = React.memo(({ url, name }: { url: string | null, name: string }) => {
        const [avatarUri, setAvatarUri] = useState<string | null>(null);
        const [imageError, setImageError] = useState(false);

        useEffect(() => {
            setImageError(false);
            if (!url) {
                setAvatarUri(null);
                return;
            }
            if (url.startsWith('http')) {
                setAvatarUri(url);
                return;
            }
            const { data } = supabase.storage.from("avatars").getPublicUrl(url);
            if (data) setAvatarUri(data.publicUrl);
        }, [url]);

        const uiAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random&color=fff&size=200`;
        const finalSource = (avatarUri && !imageError) ? { uri: avatarUri } : { uri: uiAvatarUrl };

        return (
            <Image
                source={finalSource}
                style={styles.workerAvatar}
                onError={() => setImageError(true)}
            />
        );
    });

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={mode === 'dark' ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />
            <FixedHeader />

            <Modal
                visible={showFilter}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFilter(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowFilter(false)}>
                    <View style={[styles.filterMenu, { backgroundColor: colors.card }]}>
                        <Text style={[styles.filterMenuHeader, { color: colors.text }]}>Select Period</Text>
                        {(['daily', 'weekly', 'monthly'] as ChartPeriod[]).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.filterOption, chartPeriod === p && { backgroundColor: colors.border }, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                    setChartPeriod(p);
                                    setShowFilter(false);
                                }}
                            >
                                <Text style={[styles.filterOptionText, chartPeriod === p && { color: colors.primary }]}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </Text>
                                {chartPeriod === p && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            {loading && !refreshing ? (
                <View style={[styles.centered, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
                    }
                >

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                        {/* Revenue - Full Width */}
                        <View style={[styles.statCard, styles.statCardFull, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                            <View style={styles.statHeader}>
                                <View style={[styles.statIconBox, { backgroundColor: colors.iconBg }]}>
                                    <Ionicons name="cash" size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.statTitle}>Total Revenue</Text>
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{stats.revenue}</Text>
                        </View>

                        <View style={styles.statsRow}>
                            {/* Active Orders - Half Width */}
                            <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                                <View style={styles.statHeader}>
                                    <View style={[styles.statIconBox, { backgroundColor: colors.iconBg }]}>
                                        <Ionicons name="cart" size={20} color={colors.primary} />
                                    </View>
                                </View>
                                <Text style={[styles.statValue, { color: colors.text }]}>{stats.activeOrders}</Text>
                                <Text style={styles.statTitle}>Active Orders</Text>
                            </View>

                            {/* Disputes - Half Width */}
                            <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                                <View style={styles.statHeader}>
                                    <View style={[styles.statIconBox, { backgroundColor: mode === 'light' ? '#FFEBEE' : '#422', }]}>
                                        <Ionicons name="alert-circle" size={20} color={colors.danger} />
                                    </View>
                                </View>
                                <Text style={[styles.statValue, { color: colors.text }]}>{stats.disputes}</Text>
                                <Text style={styles.statTitle}>Pending Disputes</Text>
                            </View>
                        </View>
                    </View>

                    {/* Chart Section */}
                    <View style={[styles.chartCard, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                        <View style={styles.chartHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{getChartTitle()}</Text>
                            <TouchableOpacity onPress={() => setShowFilter(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="ellipsis-horizontal" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.chartArea}>
                            {chartData.length === 0 ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: colors.textSecondary }}>No data available</Text>
                                </View>
                            ) : (
                                chartData.map((dataPoint, index) => (
                                    <View key={index} style={styles.barContainer}>
                                        <Animated.View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: barAnims[index].interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: ['0%', `${Math.max(dataPoint.value, 2)}%`]
                                                    }),
                                                    backgroundColor: dataPoint.value > 0 ? (dataPoint.value > 80 ? colors.primary : colors.info) : colors.border
                                                }
                                            ]}
                                        />
                                        <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{dataPoint.label}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>

                    {/* Top Workers Section */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Workers</Text>
                        <View style={[styles.toggleContainer, { backgroundColor: colors.border }]}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, topWorkersMode === 'rating' && styles.toggleBtnActive, topWorkersMode === 'rating' && { backgroundColor: colors.card }]}
                                onPress={() => setTopWorkersMode('rating')}
                            >
                                <Text style={[styles.toggleText, topWorkersMode === 'rating' && { color: colors.primary }]}>{mode === 'dark' ? 'Rating' : 'Rating'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, topWorkersMode === 'earnings' && styles.toggleBtnActive, topWorkersMode === 'earnings' && { backgroundColor: colors.card }]}
                                onPress={() => setTopWorkersMode('earnings')}
                            >
                                <Text style={[styles.toggleText, topWorkersMode === 'earnings' && { color: colors.primary }]}>Earned</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.listContainer, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                        {topWorkers.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No data available</Text>
                        ) : (
                            topWorkers.map((worker, i) => (
                                <View key={worker.id} style={[styles.workerItem, { borderBottomColor: colors.border }]}>
                                    <View style={styles.workerLeft}>
                                        <Text style={styles.rankText}>#{i + 1}</Text>
                                        <AvatarItem url={worker.avatar} name={worker.name || "Unknown"} />
                                        <Text style={[styles.workerName, { color: colors.text }]}>{worker.name}</Text>
                                    </View>
                                    <Text style={[styles.workerValue, { color: colors.success }]}>{worker.secondary}</Text>
                                </View>
                            ))
                        )}
                    </View>


                    {/* Recent Transactions */}
                    <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 16, marginTop: 24, color: colors.text }]}>Recent Orders</Text>
                    <View style={[styles.listContainer, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                        {recentOrders.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No recent orders</Text>
                        ) : (
                            recentOrders.map((order) => (
                                <View key={order.id} style={[styles.listItem, { borderBottomColor: colors.border }]}>
                                    <View style={styles.listLeft}>
                                        <View style={[styles.listIcon, { backgroundColor: colors.iconBg }]}>
                                            <Ionicons name="bag-check" size={20} color={colors.primary} />
                                        </View>
                                        <View>
                                            <Text style={[styles.orderId, { color: colors.text }]}>Order #{order.id}</Text>
                                            <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                                                {order.currency === 'USD' ? '$' : '₹'}{order.total_price.toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[
                                        styles.statusBadge,
                                        { backgroundColor: order.status === 'completed' ? (mode === 'light' ? '#E8F5E9' : '#143') : (mode === 'light' ? '#FFF3E0' : '#431') }
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            { color: order.status === 'completed' ? colors.success : colors.warning }
                                        ]}>
                                            {order.status}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerContainer: {
        paddingBottom: 15,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4,
        shadowColor: "#000",
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
    dateBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20
    },
    dateText: {
        fontWeight: "600",
        fontSize: 12
    },
    content: {
        padding: 20,
        paddingBottom: 100
    },
    statsGrid: {
        marginBottom: 24,
        gap: 12
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    statCardFull: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    statHeader: {
        // Removed flexDirection, justifyContent, alignItems, marginBottom from original statCard
        // Now specific to the full card or the inner cards
        marginBottom: 10
    },
    statIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8
    },
    statValue: {
        fontSize: 22,
        fontWeight: "800",
    },
    statTitle: {
        fontSize: 12,
        color: "#a4b0be",
        fontWeight: "500"
    },
    chartCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 30,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
    },
    chartArea: {
        height: 180,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 10
    },
    barContainer: {
        alignItems: 'center',
        gap: 8,
        flex: 1
    },
    bar: {
        width: 12,
        borderRadius: 6,
        minHeight: 10,
    },
    dayLabel: {
        fontSize: 11,
        fontWeight: "600"
    },

    // Top Workers Styles
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 6
    },
    toggleContainer: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 2,
    },
    toggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 18,
    },
    toggleBtnActive: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    toggleText: {
        fontSize: 12,
        color: '#777',
        fontWeight: '600'
    },
    workerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    workerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    rankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#b2bec3',
        width: 20
    },
    workerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f2f6'
    },
    workerName: {
        fontSize: 14,
        fontWeight: '600',
    },
    workerValue: {
        fontSize: 13,
        fontWeight: '700',
    },

    listContainer: {
        borderRadius: 24,
        padding: 16,
        marginTop: 0, // Adjusted to fit new layout
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16, // Adjusted from 16 to 12 for consistency with workerItem
        borderBottomWidth: 1,
    },
    listLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14
    },
    listIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center'
    },
    orderId: {
        fontWeight: "700",
        fontSize: 15
    },
    orderMeta: {
        fontSize: 13,
        marginTop: 2
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    statusText: {
        fontWeight: "700",
        fontSize: 12
    },
    emptyText: {
        padding: 20,
        textAlign: 'center'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    filterMenu: {
        width: width * 0.8,
        borderRadius: 16,
        padding: 20,
        elevation: 10
    },
    filterMenuHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    filterOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    filterOptionText: {
        fontSize: 16,
        color: '#57606F',
        fontWeight: '500'
    }
});
