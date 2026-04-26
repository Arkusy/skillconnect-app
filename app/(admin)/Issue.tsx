import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    UIManager,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS = ["All", "Urgent", "Pending", "Resolved"];

interface Issue {
    id: string;
    reporter_id: string;
    reported_user_id: string | null;
    order_id: number | null;
    type: string;
    priority: string;
    status: string;
    description: string;
    created_at: string;
    profiles?: {
        full_name: string;
    };
    reported_user?: {
        full_name: string;
    };
}

export default function IssueScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, mode } = useAdminTheme();
    const [activeFilter, setActiveFilter] = useState("All");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchIssues = async () => {
        try {
            let query = supabase
                .from('issues')
                .select(`
                    *,
                    profiles:reporter_id (full_name),
                    reported_user:reported_user_id (full_name)
                `)
                .order('created_at', { ascending: false });

            // Apply filters based on UI selection
            if (activeFilter === 'Urgent') {
                query = query.eq('priority', 'urgent');
            } else if (activeFilter === 'Pending') {
                query = query.in('status', ['open', 'investigating']);
            } else if (activeFilter === 'Resolved') {
                query = query.eq('status', 'resolved');
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching issues:', error);
            } else {
                setIssues(data || []);
            }
        } catch (err) {
            console.error('Unexpected error fetching issues:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchIssues();
    }, [activeFilter]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchIssues();
    };

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const resolveIssue = async (id: string) => {
        try {
            const { error } = await supabase
                .from('issues')
                .update({ status: 'resolved', resolved_at: new Date().toISOString() })
                .eq('id', id);

            if (!error) {
                // Optimistic update
                setIssues(prev => prev.map(issue =>
                    issue.id === id ? { ...issue, status: 'resolved' } : issue
                ));
            }
        } catch (err) {
            console.error('Error resolving issue:', err);
        }
    };

    const getStatusColor = (status: string, priority: string) => {
        if (status === 'resolved') return colors.success;
        if (priority === 'urgent') return colors.danger;
        if (status === 'investigating') return colors.secondary;
        return colors.warning; // Pending/Open
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const FixedHeader = () => (
        <View style={[styles.headerContainer, {
            paddingTop: insets.top + 10,
            backgroundColor: colors.headerBg,
            shadowColor: mode === 'dark' ? '#000' : '#ccc'
        }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Issue Center</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
            >
                {FILTERS.map((filter) => (
                    <Pressable
                        key={filter}
                        style={[
                            styles.filterChip,
                            { backgroundColor: activeFilter === filter ? colors.text : colors.border },
                            activeFilter === filter && styles.activeChip // Override if needed
                        ]}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setActiveFilter(filter);
                        }}
                    >
                        <Text style={[
                            styles.filterText,
                            { color: activeFilter === filter ? colors.background : colors.textSecondary }
                        ]}>
                            {filter}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.headerBg}
            />
            <FixedHeader />

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                >
                    {issues.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="shield-checkmark-outline" size={64} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No issues found</Text>
                        </View>
                    ) : (
                        issues.map((issue) => (
                            <Pressable
                                key={issue.id}
                                style={[styles.issueCard, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}
                                onPress={() => toggleExpand(issue.id)}
                            >
                                {/* Header Line */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.row}>
                                        <View style={[styles.typeBadge, { backgroundColor: getStatusColor(issue.status, issue.priority) + '20' }]}>
                                            <Text style={[styles.typeText, { color: getStatusColor(issue.status, issue.priority) }]}>{issue.type}</Text>
                                        </View>
                                        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTimeAgo(issue.created_at)}</Text>
                                    </View>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(issue.status, issue.priority) }]} />
                                </View>

                                {/* Main Content */}
                                <View style={styles.mainContent}>
                                    <Text style={[styles.userText, { color: colors.text }]}>{issue.profiles?.full_name || "Unknown User"}</Text>
                                    {issue.order_id && <Text style={[styles.orderText, { color: colors.textSecondary }]}>Order #{issue.order_id}</Text>}
                                </View>

                                {/* Status Label */}
                                <Text style={[styles.statusLabel, { color: getStatusColor(issue.status, issue.priority) }]}>
                                    {issue.status}
                                </Text>

                                {/* Expandable Details */}
                                {expandedId === issue.id && (
                                    <View style={styles.detailsContainer}>
                                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                                        {/* Show reported user if available */}
                                        {issue.reported_user_id && issue.reported_user && (
                                            <View style={styles.reportedUserInfo}>
                                                <Text style={[styles.descLabel, { color: colors.textSecondary }]}>REPORTED USER</Text>
                                                <Text style={[styles.reportedUserName, { color: colors.text }]}>{issue.reported_user.full_name}</Text>
                                            </View>
                                        )}

                                        <Text style={[styles.descLabel, { color: colors.textSecondary }]}>REPORT DETAILS</Text>
                                        <Text style={[styles.descText, { color: colors.text }]}>{issue.description}</Text>

                                        {/* Action Buttons */}
                                        <View style={styles.actionRow}>
                                            {issue.status !== 'resolved' && (
                                                <Pressable
                                                    style={[styles.actionBtn, styles.resolveBtn, { backgroundColor: colors.success }]}
                                                    onPress={() => resolveIssue(issue.id)}
                                                >
                                                    <Ionicons name="checkmark" size={16} color="#FFF" />
                                                    <Text style={styles.btnText}>Resolve</Text>
                                                </Pressable>
                                            )}
                                        </View>

                                        {/* Chat Buttons - Full Width */}
                                        <View style={styles.chatButtonsContainer}>
                                            <Pressable
                                                style={[styles.chatFullBtn, { backgroundColor: colors.primary }]}
                                                onPress={() => router.push({
                                                    pathname: "/ChatScreen",
                                                    params: {
                                                        workerId: issue.reporter_id,
                                                        user: issue.profiles?.full_name || "Reporter"
                                                    }
                                                })}
                                            >
                                                <Ionicons name="chatbubble" size={16} color="#FFF" />
                                                <Text style={styles.chatBtnText}>
                                                    Chat with Reporter ({issue.profiles?.full_name || "Unknown"})
                                                </Text>
                                            </Pressable>

                                            {issue.reported_user_id && (
                                                <Pressable
                                                    style={[styles.chatFullBtn, { backgroundColor: colors.warning }]}
                                                    onPress={() => router.push({
                                                        pathname: "/ChatScreen",
                                                        params: {
                                                            workerId: issue.reported_user_id!,
                                                            user: issue.reported_user?.full_name || "Reported User"
                                                        }
                                                    })}
                                                >
                                                    <Ionicons name="chatbubble" size={16} color="#FFF" />
                                                    <Text style={styles.chatBtnText}>
                                                        Chat with Reported ({issue.reported_user?.full_name || "Unknown"})
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </Pressable>
                        ))
                    )}
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
    emptyState: {
        alignItems: 'center',
        marginTop: 50,
        gap: 10
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500'
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
    headerTitle: {
        fontSize: 28,
        fontWeight: "800",
        marginBottom: 15
    },
    filterRow: {
        gap: 10,
        paddingRight: 20
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    activeChip: {
        // Handled dynamically
    },
    filterText: {
        fontWeight: "600"
    },
    content: {
        padding: 20,
        paddingBottom: 100,
        gap: 15
    },
    issueCard: {
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    typeText: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase"
    },
    timeText: {
        fontSize: 12
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    mainContent: {
        marginBottom: 4
    },
    userText: {
        fontSize: 16,
        fontWeight: "700",
    },
    orderText: {
        fontSize: 13,
        marginTop: 2
    },
    statusLabel: {
        fontSize: 13,
        fontWeight: "600",
        marginTop: 8,
        alignSelf: 'flex-start',
        textTransform: 'capitalize'
    },
    detailsContainer: {
        marginTop: 12
    },
    divider: {
        height: 1,
        marginBottom: 12
    },
    descLabel: {
        fontSize: 11,
        fontWeight: "700",
        marginBottom: 4
    },
    descText: {
        lineHeight: 20,
        marginBottom: 16
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6
    },
    resolveBtn: {
        // Dynamically colored
    },
    chatBtn: {
        // Dynamically colored
    },
    btnText: {
        fontWeight: "600",
        fontSize: 14,
        color: "#FFF"
    },
    reportedUserInfo: {
        marginBottom: 12
    },
    reportedUserName: {
        fontSize: 15,
        fontWeight: "700",
        marginTop: 4
    },
    chatButtonsContainer: {
        marginTop: 12,
        gap: 10
    },
    chatFullBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8
    },
    chatBtnText: {
        fontWeight: "600",
        fontSize: 14,
        color: "#FFF"
    }
});
