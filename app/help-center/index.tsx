
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { getHelpConversation } from "../../utils/chatUtils";
import { supabase } from "../../utils/supabase";

export default function HelpCenter() {
    const { colors, mode } = useAdminTheme();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const COLORS = {
        bg: mode === 'dark' ? colors.background : "#F5F7FA",
        card: mode === 'dark' ? colors.card : "#FFFFFF",
        text: mode === 'dark' ? colors.text : "#1A1A1A",
        subtext: mode === 'dark' ? colors.textSecondary : "#6B7280",
        primary: colors.primary,
        border: mode === 'dark' ? colors.border : "#E0E0E0",
    };

    const [unreadCount, setUnreadCount] = useState(0);

    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;

            const fetchUnreadCount = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: conversationId } = await getHelpConversation(user.id);

                if (conversationId && isActive) {
                    const { count, error } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('conversation_id', conversationId)
                        .eq('receiver_id', user.id)
                        .eq('is_read', false);

                    if (!error && count !== null) {
                        setUnreadCount(count);
                    }
                }
            };

            fetchUnreadCount();

            return () => {
                isActive = false;
            };
        }, [])
    );

    const handleChatSupport = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: conversationId, error } = await getHelpConversation(user.id);

            if (error) {
                console.error("Error creating help chat:", error);
                alert("Could not connect to support. Please try again.");
                return;
            }

            if (conversationId) {
                // Find the other participant (the Admin)
                const { data: conv } = await supabase.from('conversations').select('participant_1, participant_2').eq('id', conversationId).single();

                if (conv) {
                    const adminId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

                    router.push({
                        pathname: "/ChatScreen",
                        params: {
                            user: "Support Team", // Display name
                            workerId: adminId, // Admin ID
                            isHelpChat: "true"
                        }
                    });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSupport = () => {
        Linking.openURL("mailto:example@gmail.com");
    };

    return (
        <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
            <Stack.Screen options={{
                headerTitle: "Help Center",
                headerStyle: { backgroundColor: COLORS.card },
                headerTintColor: COLORS.text,
                headerShadowVisible: false
            }} />

            <View style={styles.content}>
                <View style={styles.headerSection}>
                    <Ionicons name="headset" size={64} color={COLORS.primary} />
                    <Text style={[styles.title, { color: COLORS.text }]}>How can we help you?</Text>
                    <Text style={[styles.subtitle, { color: COLORS.subtext }]}>
                        Choose an option below to get in touch with our support team.
                    </Text>
                </View>

                <View style={styles.optionsContainer}>
                    {/* Chat Option */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.optionCard,
                            { backgroundColor: COLORS.card },
                            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                        ]}
                        onPress={handleChatSupport}
                        disabled={loading}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                            {loading ? (
                                <ActivityIndicator color="#2196F3" />
                            ) : (
                                <View>
                                    <Ionicons name="chatbubbles" size={28} color="#2196F3" />
                                    {unreadCount > 0 && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                        <View style={styles.optionText}>
                            <Text style={[styles.optionTitle, { color: COLORS.text }]}>Chat with Support</Text>
                            <Text style={[styles.optionDesc, { color: COLORS.subtext }]}>Start a conversation with an agent</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={COLORS.subtext} />
                    </Pressable>

                    {/* Email Option */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.optionCard,
                            { backgroundColor: COLORS.card, marginTop: 16 },
                            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                        ]}
                        onPress={handleEmailSupport}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: '#FFEBEE' }]}>
                            <Ionicons name="mail" size={28} color="#F44336" />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={[styles.optionTitle, { color: COLORS.text }]}>Email Us</Text>
                            <Text style={[styles.optionDesc, { color: COLORS.subtext }]}>Send us an email at example@gmail.com</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={COLORS.subtext} />
                    </Pressable>
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerSection: { alignItems: 'center', marginBottom: 40 },
    title: { fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' },
    subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 22 },
    optionsContainer: { width: '100%' },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    optionText: { flex: 1 },
    optionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    optionDesc: { fontSize: 13 },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#E3F2FD'
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
