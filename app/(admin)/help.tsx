// app/(admin)/help.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";

interface HelpConversation {
    id: string;
    participant_id: string;
    participant_name: string;
    participant_avatar: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
}



export default function AdminHelpList() {
    const { colors, mode } = useAdminTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<HelpConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(14)).current;

    const COLORS = {
        bg: mode === 'dark' ? colors.background : "#F5F7FA",
        card: mode === 'dark' ? colors.card : "#FFFFFF",
        text: mode === 'dark' ? colors.text : "#111827",
        muted: mode === 'dark' ? colors.textSecondary : "#6B7280",
        border: mode === 'dark' ? colors.border : "#E5E7EB",
        soft: mode === 'dark' ? 'rgba(255,255,255,0.05)' : "#F3F4F6",
        primary: colors.primary,
    };

    const styles = useMemo(() => getStyles(COLORS), [COLORS]);

    const safeHaptic = () => {
        Haptics.selectionAsync().catch(() => { });
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentAdminId(user.id);
        });
    }, []);

    const fetchHelpConversations = async (background = false) => {
        if (!currentAdminId) return;
        if (!background) setLoading(true);

        try {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    participant1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url),
                    participant2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url)
                `)
                .eq('is_help_channel', true)
                .order('last_message_at', { ascending: false, nullsFirst: false });

            if (error) {
                console.error("Error fetching help conversations:", error);
                return;
            }

            if (data) {
                const mappedPromises = data.map(async (conv: any) => {
                    // Find the OTHER participant (the user requesting help)
                    const otherParticipant =
                        conv.participant1.id === currentAdminId ? conv.participant2 : conv.participant1;

                    // Fetch unread count for the admin
                    const { count } = await supabase
                        .from('messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id)
                        .eq('receiver_id', currentAdminId)
                        .eq('is_read', false);

                    return {
                        id: conv.id,
                        participant_id: otherParticipant.id,
                        participant_name: otherParticipant.full_name || "Unknown User",
                        participant_avatar: otherParticipant.avatar_url,
                        last_message_at: conv.last_message_at,
                        last_message_preview: conv.last_message_preview || null,
                        unread_count: count || 0,
                    };
                });

                const mapped = await Promise.all(mappedPromises);
                setConversations(mapped);
            }
        } catch (error) {
            console.error("Error in fetchHelpConversations:", error);
        } finally {
            if (!background) setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (currentAdminId) fetchHelpConversations();
    }, [currentAdminId]);

    useFocusEffect(
        useCallback(() => {
            if (currentAdminId) {
                fetchHelpConversations(true);
            }
        }, [currentAdminId])
    );

    useEffect(() => {
        if (!loading) {
            fadeAnim.setValue(0);
            slideAnim.setValue(14);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
            ]).start();
        }
    }, [loading, fadeAnim, slideAnim]);

    useEffect(() => {
        if (!currentAdminId) return;

        const subscription = supabase
            .channel('admin_help_list_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations',
                    filter: 'is_help_channel=eq.true'
                },
                () => {
                    fetchHelpConversations(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [currentAdminId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchHelpConversations(true);
    };

    const handleOpenChat = (item: HelpConversation) => {
        safeHaptic();
        router.push({
            pathname: "/ChatScreen",
            params: {
                user: item.participant_name,
                workerId: item.participant_id,
                isHelpChat: "true"
            },
        });
    };

    const getAvatarUrl = (avatarPath: string | null) => {
        if (!avatarPath) return null;
        if (avatarPath.startsWith("http")) return avatarPath;
        const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
        return data.publicUrl;
    };

    const formatLastMessageTime = (timestamp: string | null) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;

        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const headerSubtitleText = useMemo(() => {
        const n = conversations.length;
        return `${n} ${n === 1 ? "request" : "requests"}`;
    }, [conversations.length]);

    const ConversationCard = ({ item, index }: { item: HelpConversation; index: number }) => {
        const avatarUrl = getAvatarUrl(item.participant_avatar);
        const enter = useRef(new Animated.Value(0)).current;
        const scaleValue = useRef(new Animated.Value(1)).current;

        useEffect(() => {
            Animated.timing(enter, {
                toValue: 1,
                duration: 260,
                delay: Math.min(index * 30, 220),
                useNativeDriver: true,
            }).start();
        }, [enter, index]);

        const rowTranslateY = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

        return (
            <Animated.View style={{ opacity: enter, transform: [{ translateY: rowTranslateY }, { scale: scaleValue }] }}>
                <Pressable
                    style={styles.conversationCard}
                    onPress={() => handleOpenChat(item)}
                    onPressIn={() => Animated.spring(scaleValue, { toValue: 0.98, useNativeDriver: true }).start()}
                    onPressOut={() => Animated.spring(scaleValue, { toValue: 1, friction: 6, useNativeDriver: true }).start()}
                    android_ripple={{ color: "#00000010" }}
                >
                    <View style={styles.avatarContainer}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={26} color={COLORS.muted} />
                            </View>
                        )}
                        {item.unread_count > 0 && (
                            <View style={styles.unreadBadgeAbsolute}>
                                <Text style={styles.unreadText}>{item.unread_count}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.cardContent}>
                        <View style={styles.nameRow}>
                            <Text style={styles.participantName} numberOfLines={1}>
                                {item.participant_name}
                            </Text>
                            <Text style={styles.timeText}>
                                {formatLastMessageTime(item.last_message_at)}
                            </Text>
                        </View>
                        <Text style={styles.previewText} numberOfLines={1}>
                            {item.last_message_preview || "No messages yet"}
                        </Text>
                    </View>
                </Pressable>
            </Animated.View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header - same style as Home.tsx */}
            <View style={[styles.headerContainer, { backgroundColor: colors.headerBg, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.primary }]}>Support Center</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {conversations.filter(c => c.unread_count > 0).length} chats with new messages
                    </Text>
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    <FlatList
                        data={conversations}
                        keyExtractor={item => item.id}
                        renderItem={({ item, index }) => <ConversationCard item={item} index={index} />}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                        }
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Ionicons name="chatbubbles-outline" size={64} color={COLORS.muted} />
                                <Text style={styles.emptyTitle}>No Help Requests</Text>
                                <Text style={styles.emptySubtitle}>When users need help, their chats will appear here.</Text>
                            </View>
                        }
                    />
                </Animated.View>
            )}
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
        paddingTop: 10,
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
    countBadge: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
    },
    countText: {
        fontSize: 18,
        fontWeight: '800',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 32,
    },
    conversationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    avatarPlaceholder: {
        backgroundColor: COLORS.soft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadgeAbsolute: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
        borderWidth: 2,
        borderColor: COLORS.card,
    },
    unreadText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    cardContent: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    participantName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        flex: 1,
        marginRight: 8,
    },
    timeText: {
        fontSize: 12,
        color: COLORS.muted,
    },
    previewText: {
        fontSize: 14,
        color: COLORS.muted,
    },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.muted,
        textAlign: 'center',
        marginTop: 6,
        paddingHorizontal: 40,
    },
});
