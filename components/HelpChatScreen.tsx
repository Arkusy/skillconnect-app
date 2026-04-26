
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import ImageViewing from "../components/ImageViewingWeb";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../context/AdminThemeContext";
import { HelpMessage, HelpTicket } from "../utils/helpTypes";
import {
    getTicketDetails,
    getTicketMessages,
    markTicketAsRead,
    sendHelpMessage,
    subscribeToTicketMessages
} from "../utils/helpUtils";
import { supabase } from "../utils/supabase";

interface HelpChatScreenProps {
    ticketId: string;
    currentUserId: string;
    isAdmin?: boolean;
}

export default function HelpChatScreen({ ticketId, currentUserId, isAdmin = false }: HelpChatScreenProps) {
    const { colors, mode } = useAdminTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);

    const [ticket, setTicket] = useState<HelpTicket | null>(null);
    const [messages, setMessages] = useState<HelpMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState("");

    // Image Viewer
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const COLORS = {
        bg: mode === 'dark' ? colors.background : "#F4F6F9",
        card: mode === 'dark' ? colors.card : "#FFFFFF",
        text: mode === 'dark' ? colors.text : "#1A1A1A",
        subtext: mode === 'dark' ? colors.textSecondary : "#6B7280",
        primary: colors.primary,
        myBubble: mode === 'dark' ? colors.primary : "#059ef1",
        myText: "#FFFFFF",
        theirBubble: mode === 'dark' ? colors.card : "#FFFFFF",
        theirText: mode === 'dark' ? colors.text : "#1A1A1A",
        border: mode === 'dark' ? colors.border : "#E0E0E0",
    };

    useEffect(() => {
        loadData();
    }, [ticketId]);

    useEffect(() => {
        const unsubscribe = subscribeToTicketMessages(ticketId, (newMessage) => {
            setMessages((prev) => {
                if (prev.find(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            // Mark read if it's from the other person
            if (newMessage.sender_id !== currentUserId) {
                markTicketAsRead(ticketId, currentUserId);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [ticketId, currentUserId]);

    const loadData = async () => {
        setLoading(true);
        const { data: ticketData } = await getTicketDetails(ticketId);
        if (ticketData) setTicket(ticketData);

        const { data: msgs } = await getTicketMessages(ticketId);
        if (msgs) setMessages(msgs);

        await markTicketAsRead(ticketId, currentUserId);
        setLoading(false);
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;
        const textToSave = inputText.trim();
        setInputText("");
        setSending(true);

        // Optimistic update could go here, but for now wait for DB
        await sendHelpMessage(ticketId, currentUserId, textToSave);
        setSending(false);
    };

    const handleImagePick = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0].uri) {
            uploadAndSendImage(result.assets[0].uri);
        }
    };

    const uploadAndSendImage = async (uri: string) => {
        setSending(true);
        try {
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${ticketId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const response = await fetch(uri);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
                .from('help-center-images')
                .upload(fileName, blob, { contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}` });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('help-center-images')
                .getPublicUrl(fileName);

            await sendHelpMessage(ticketId, currentUserId, null, publicUrl);

        } catch (e) {
            console.error(e);
            alert("Failed to upload image");
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: HelpMessage }) => {
        const isMe = item.sender_id === currentUserId;
        const showAvatar = !isMe;

        return (
            <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
                {showAvatar && (
                    <Image
                        source={{ uri: item.sender_avatar || "https://ui-avatars.com/api/?name=User" }}
                        style={styles.avatar}
                    />
                )}
                <View style={[
                    styles.bubble,
                    isMe ? { backgroundColor: COLORS.myBubble } : { backgroundColor: COLORS.theirBubble }
                ]}>
                    {item.message_type === 'text' && (
                        <Text style={[
                            styles.msgText,
                            isMe ? { color: COLORS.myText } : { color: COLORS.theirText }
                        ]}>
                            {item.message_text}
                        </Text>
                    )}
                    {item.message_type === 'image' && item.media_url && (
                        <Pressable onPress={() => {
                            const index = messages.filter(m => m.message_type === 'image').findIndex(m => m.id === item.id);
                            setCurrentImageIndex(index);
                            setIsViewerVisible(true);
                        }}>
                            <Image
                                source={{ uri: item.media_url }}
                                style={styles.msgImage}
                                resizeMode="cover"
                            />
                        </Pressable>
                    )}
                    <View style={styles.footer}>
                        <Text style={[
                            styles.time,
                            isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: COLORS.subtext }
                        ]}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMe && (
                            <Ionicons
                                name={item.is_read ? "checkmark-done" : "checkmark"}
                                size={14}
                                color={item.is_read ? "#FFF" : "rgba(255,255,255,0.7)"}
                                style={{ marginLeft: 4 }}
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
            {/* Header if not provided by wrapper page, but typically wrapper page has header */}
            {/* We assume wrapper handles header or we can add a light header info bar about the ticket */}
            <View style={[styles.ticketInfo, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}>
                <Text style={[styles.ticketSubject, { color: COLORS.text }]} numberOfLines={1}>
                    {ticket?.subject || "Loading..."}
                </Text>
                <Text style={[styles.ticketStatus, { color: ticket?.status === 'open' ? 'green' : 'gray' }]}>
                    {ticket?.status?.toUpperCase()}
                </Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View style={[styles.inputContainer, { backgroundColor: COLORS.card, paddingBottom: insets.bottom + 10 }]}>
                    <Pressable onPress={handleImagePick} style={styles.iconBtn}>
                        <Ionicons name="image-outline" size={24} color={COLORS.subtext} />
                    </Pressable>
                    <TextInput
                        style={[styles.input, { color: COLORS.text, backgroundColor: COLORS.bg }]}
                        placeholder="Type a message..."
                        placeholderTextColor={COLORS.subtext}
                        value={inputText}
                        onChangeText={setInputText}
                        editable={!sending && ticket?.status !== 'closed'}
                    />
                    <Pressable onPress={handleSend} disabled={sending || !inputText.trim()} style={styles.sendBtn}>
                        {sending ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Ionicons name="send" size={20} color="#FFF" />
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>

            <ImageViewing
                images={messages.filter(m => m.message_type === 'image' && m.media_url).map(m => ({ uri: m.media_url! }))}
                imageIndex={currentImageIndex}
                visible={isViewerVisible}
                onRequestClose={() => setIsViewerVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    ticketInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        elevation: 1
    },
    ticketSubject: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
    ticketStatus: { fontSize: 12, fontWeight: '700' },
    msgRow: { flexDirection: 'row', marginBottom: 12, maxWidth: '80%' },
    msgRowLeft: { alignSelf: 'flex-start' },
    msgRowRight: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
    avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, marginTop: 4 },
    bubble: { padding: 12, borderRadius: 16, maxWidth: '100%' },
    msgText: { fontSize: 16, lineHeight: 22 },
    msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
    time: { fontSize: 10 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)'
    },
    input: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        paddingHorizontal: 16,
        marginHorizontal: 10,
    },
    iconBtn: { padding: 8 },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#059ef1',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
