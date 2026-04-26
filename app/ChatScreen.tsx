import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import ImageViewing from "../components/ImageViewingWeb";
import {
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTheme } from "../context/AdminThemeContext";
import type { MessageWithSender } from "../utils/chatTypes";
import {
  getConversationCreatedAt,
  getConversationMessages,
  getOrCreateConversation,
  markConversationAsRead,
  sendMessage as sendMessageDB
} from "../utils/chatUtils";
import { supabase } from "../utils/supabase";

const HEADER_AVATAR_SIZE = 40;

interface WorkerProfile {
  avatar_url: string | null;
  full_name: string;
  phone: string | null;
}

// Extended type for local optimistic updates
interface LocalMessage extends MessageWithSender {
  status?: 'sending' | 'sent' | 'error';
  localUri?: string;
}

type RenderItem =
  | { type: "message"; data: LocalMessage }
  | { type: "date"; data: string }
  | { type: "system"; data: string };

// Custom hook to get keyboard height
const useKeyboardHeight = () => {
  const height = useSharedValue(0);

  useKeyboardHandler(
    {
      onMove: (event) => {
        "worklet";
        height.value = Math.max(event.height, 0);
      },
      onStart: (event) => {
        "worklet";
      },
      onEnd: (event) => {
        "worklet";
      },
      onInteractive: (event) => {
        "worklet";
      },
    },
    [height]
  );

  return height;
};

export default function ChatScreen() {
  const { colors, mode } = useAdminTheme();

  // Map theme to local usage to preserve EXACT light mode output
  const COLORS = {
    screenBg: mode === 'dark' ? colors.background : "#F6F7F9",
    surface: mode === 'dark' ? colors.card : "#FFFFFF",
    surface2: mode === 'dark' ? 'rgba(255,255,255,0.05)' : "#F1F3F5",
    text: mode === 'dark' ? colors.text : "#0B0B0F",
    subtext: mode === 'dark' ? colors.textSecondary : "#6B7280",
    muted: mode === 'dark' ? colors.textSecondary : "#9CA3AF",
    border: mode === 'dark' ? colors.border : "rgba(17, 24, 39, 0.10)",

    accent: mode === 'dark' ? colors.primary : "#4def96ff",
    accentDark: mode === 'dark' ? colors.primary : "#01843cff",

    myBubble: mode === 'dark' ? colors.card : "#FFFFFF",
    myText: mode === 'dark' ? colors.text : "#111827",
    theirBubble: mode === 'dark' ? colors.card : "#FFFFFF",
    theirText: mode === 'dark' ? colors.text : "#111827",
  };

  const SHADOW = Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: mode === 'dark' ? 0.2 : 0.08,
      shadowRadius: 16,
    },
    android: { elevation: mode === 'dark' ? 4 : 2 },
    default: {},
  });

  const styles = useMemo(() => getStyles(COLORS, SHADOW), [COLORS, SHADOW]);

  const { user, workerId, isHelpChat } = useLocalSearchParams<{
    user: string;
    workerId: string;
    isHelpChat?: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardHeight = useKeyboardHeight();

  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [conversationStartDate, setConversationStartDate] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Image Viewer State
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const [showChevron, setShowChevron] = useState(false);

  const displayName = useMemo(() => {
    if (workerProfile?.full_name) return workerProfile.full_name;
    if (typeof user === "string" && user.trim()) return user.trim();
    return "Chat";
  }, [workerProfile?.full_name, user]);

  const canSend = useMemo(() => newMessage.trim().length > 0, [newMessage]);

  const uploadImage = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${conversationId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        });

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error in uploadImage:", error);
      return null;
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert("Permission to access media library is required!");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Enable cropping
        // aspect: [1, 1], // REMOVED to allow freeform
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;

        // 1. Optimistic Update: Add fake message immediately
        const tempId = `temp-${Date.now()}`;
        const tempMessage: LocalMessage = {
          id: tempId,
          conversation_id: conversationId || '',
          sender_id: currentUserId || '',
          receiver_id: workerId,
          message_text: null,
          message_type: 'image',
          media_url: uri, // Use local URI for display
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          read_at: null,
          sender_name: "Me",
          sender_avatar: null,
          status: 'sending' // Mark as sending
        };

        setMessages(prev => [...prev, tempMessage]);

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        // 2. Upload in background (NO Global Loading)
        const publicUrl = await uploadImage(uri);

        if (publicUrl && conversationId && currentUserId && workerId) {
          // 3. Send to DB
          const { data: sentMessage, error } = await sendMessageDB(
            conversationId,
            currentUserId,
            workerId,
            null,
            publicUrl
          );

          if (sentMessage) {
            // 4. Handle "Temp vs Real" Race Condition
            setMessages(prev => {
              // Check if the real message (from DB subscription) already made it into the list
              const realMessageExists = prev.some(m => m.id === sentMessage.id);

              if (realMessageExists) {
                // If it's already there via subscription, just REMOVE the temporary one.
                // We don't need to replace it because the real one is already present.
                console.log("Real message arrived first. Removing temp.");
                return prev.filter(m => m.id !== tempId);
              } else {
                // If not there yet, upgrade the temp message to the real one.
                // This keeps the scroll position stable.
                return prev.map(m => m.id === tempId ? {
                  ...sentMessage,
                  sender_name: m.sender_name, // Keep local info
                  sender_avatar: m.sender_avatar,
                  status: 'sent'
                } : m);
              }
            });
          } else {
            // Handle error (maybe mark as error)
            console.error("Failed to send message DB");
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
          }
        } else {
          alert("Failed to upload image.");
          setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove if upload fails
        }
      }
    } catch (e) {
      console.error("Picker Error:", e);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    const fetchWorkerProfile = async () => {
      if (!workerId) {
        setLoadingProfile(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("avatar_url, full_name, phone")
          .eq("id", workerId)
          .single();

        if (error) {
          console.error("Error fetching worker profile:", error);
          setLoadingProfile(false);
          return;
        }

        if (data) {
          setWorkerProfile(data);

          if (data.avatar_url) {
            const avatarPath = data.avatar_url;
            if (avatarPath.startsWith("http")) {
              setAvatarUrl(avatarPath);
            } else {
              const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(avatarPath);
              setAvatarUrl(urlData.publicUrl);
            }
          } else {
            setAvatarUrl(null);
          }
        }
      } catch (error) {
        console.error("Error in fetchWorkerProfile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchWorkerProfile();
  }, [workerId]);

  useEffect(() => {
    const initChat = async () => {
      if (!currentUserId || !workerId) return;

      setLoading(true);

      try {
        const { data: convId, error } = await getOrCreateConversation(
          currentUserId,
          workerId,
          isHelpChat === "true"
        );

        if (error) {
          console.error("Error creating conversation:", error);
          setLoading(false);
          return;
        }

        if (convId) {
          setConversationId(convId);

          const { data: createdAt } = await getConversationCreatedAt(convId);
          if (createdAt) {
            setConversationStartDate(createdAt);
          }

          const { data: msgs, error: msgError } = await getConversationMessages(
            convId
          );

          if (msgError) {
            console.error("Error loading messages:", msgError);
          } else if (msgs) {
            setMessages(msgs);
          }

          // Mark messages as read when chat is opened
          await markConversationAsRead(convId, currentUserId);
        }
      } catch (error) {
        console.error("Error in initChat:", error);
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [currentUserId, workerId, isHelpChat]);

  // ... (useEffect for subscribeToMessages and markConversationAsRead)

  const handleCall = useCallback(() => {
    if (workerProfile?.phone) {
      Linking.openURL(`tel:${workerProfile.phone}`);
    } else {
      console.warn("No phone number available for this worker");
    }
  }, [workerProfile?.phone]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Pressable style={styles.navAvatarWrap} onPress={() => router.push(`/userProfile?userId=${workerId}`)}>
            {loadingProfile ? (
              <View style={[styles.navAvatar, styles.avatarPlaceholder]}>
                <ActivityIndicator size="small" color={COLORS.subtext} />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.navAvatar} />
            ) : (
              <View style={[styles.navAvatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={18} color={COLORS.muted} />
              </View>
            )}
            <View style={styles.onlineDot} />
          </Pressable>

          <View style={{ justifyContent: 'center' }}>
            <Text numberOfLines={1} style={styles.navTitleText}>
              {displayName}
            </Text>
          </View>
        </View>
      ),
      headerLeft: () => null,
      headerTitleAlign: "left",
      headerBackVisible: false,
      headerRight: () => isHelpChat === "true" ? null : (
        <View style={styles.navRightRow}>
          <Pressable hitSlop={10} style={styles.navIconBtn} onPress={handleCall}>
            <Ionicons name="call-outline" size={20} color={COLORS.text} />
          </Pressable>
          <Pressable hitSlop={10} style={styles.navIconBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </Pressable>
        </View>
      ),
      headerStyle: {
        backgroundColor: COLORS.surface,
        height: 120, // Increased height as requested
      },
      headerShadowVisible: false,
      headerTintColor: COLORS.text,
    });
  }, [displayName, avatarUrl, loadingProfile, navigation, handleCall, COLORS, styles]);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !currentUserId || !workerId) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    // Optimistic Update (Optional)
    const tempId = `temp-${Date.now()}`;
    // We could add a temp message here, but simpler to just wait for DB response 
    // since it's usually fast. If we want instant feedback, we can add it.

    // For now, let's just append the successfully sent message immediately
    const { data: sentMessage, error } = await sendMessageDB(
      conversationId,
      currentUserId,
      workerId,
      messageText
    );

    if (error) {
      console.error("⚠️ Error sending message:", error);
      setNewMessage(messageText); // Restore text on error
    } else if (sentMessage) {
      // Manually add to list if not already there (race condition with subscription)
      setMessages(prev => {
        const exists = prev.some(m => m.id === sentMessage.id);
        if (exists) return prev;

        // We need to shape it as LocalMessage/MessageWithSender
        // Since we sent it, we know the sender is us.
        const newMsg: LocalMessage = {
          ...sentMessage,
          sender_name: "Me", // or fetch from profile if we had it stored locally
          sender_avatar: null, // or fetch
          status: 'sent'
        };
        return [...prev, newMsg];
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDateKey = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  };

  const renderItems: RenderItem[] = [];

  if (conversationStartDate) {
    renderItems.push({ type: "system", data: conversationStartDate });
  }

  let lastDate: string | null = null;
  messages.forEach((message) => {
    const messageDate = getDateKey(message.created_at);

    if (messageDate !== lastDate) {
      renderItems.push({ type: "date", data: message.created_at });
      lastDate = messageDate;
    }

    renderItems.push({ type: "message", data: message });
  });

  // Fake spacer to push content with keyboard
  const fakeViewAnimatedStyle = useAnimatedStyle(() => ({
    height: keyboardHeight.value,
  }), []);

  // IMPORTANT: keep your nav-overlay padding fix exactly
  const inputContainerAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeight.value > 0 ? 10 : Math.max(insets.bottom, 10),
  }), [insets.bottom]);

  const bottomSpacingStyle = useAnimatedStyle(() => ({
    height: keyboardHeight.value > 0 ? 20 : 80,
  }), []);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          data={renderItems}
          keyExtractor={(item, index) => {
            if (item.type === "message") return item.data.id;
            return `${item.type}-${index}`;
          }}
          renderItem={({ item }) => {
            if (item.type === "system") {
              const startDate = new Date(item.data);
              const formattedDate = startDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });

              return (
                <View style={styles.systemMessageContainer}>
                  <View style={styles.systemMessageBubble}>
                    <Ionicons name="chatbubbles" size={16} color={COLORS.muted} />
                    <Text style={styles.systemMessageText}>
                      Conversation started on {formattedDate}
                    </Text>
                  </View>
                </View>
              );
            }

            if (item.type === "date") {
              return (
                <View style={styles.dateSeparatorContainer}>
                  <View style={styles.dateSeparatorLine} />
                  <Text style={styles.dateSeparatorText}>
                    {formatDate(item.data)}
                  </Text>
                  <View style={styles.dateSeparatorLine} />
                </View>
              );
            }

            const message = item.data;
            const isMyMessage = message.sender_id === currentUserId;

            return (
              <View style={[styles.messageRow, isMyMessage ? styles.rowRight : styles.rowLeft]}>
                {!isMyMessage ? (
                  <View style={styles.miniAvatarWrap}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.miniAvatar} />
                    ) : (
                      <View style={[styles.miniAvatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={14} color={COLORS.muted} />
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage,
                message.message_type === 'image' && { padding: 4, backgroundColor: 'transparent', borderWidth: 0 }
                ]}>
                  {!isMyMessage && message.message_type !== 'image' && (
                    <Text style={styles.senderName} numberOfLines={1}>
                      {message.sender_name}
                    </Text>
                  )}

                  {message.message_type === 'image' && message.media_url ? (
                    <Pressable onPress={() => {
                      // Open Viewer
                      const imgIndex = messages.filter(m => m.message_type === 'image' && m.media_url).findIndex(m => m.id === message.id);
                      if (imgIndex !== -1) {
                        setCurrentImageIndex(imgIndex);
                        setIsViewerVisible(true);
                      }
                    }}>
                      <View>
                        <Image
                          source={{ uri: message.media_url }}
                          style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: '#f0f0f0', opacity: message.status === 'sending' ? 0.7 : 1 }}
                          resizeMode="cover"
                        />
                        {message.status === 'sending' && (
                          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                            <ActivityIndicator size="small" color={COLORS.accent} />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        isMyMessage ? styles.myMessageText : styles.theirMessageText,
                      ]}
                      selectable
                    >
                      {message.message_text}
                    </Text>
                  )}

                  <View style={[styles.messageFooter, message.message_type === 'image' && { marginTop: 4, marginRight: 4 }]}>
                    <Text style={[styles.timestamp, isMyMessage ? styles.myTimestamp : styles.theirTimestamp]}>
                      {formatTime(message.created_at)}
                    </Text>

                    {isMyMessage && (
                      <Ionicons
                        name={message.status === 'sending' ? "time-outline" : (message.is_read ? "checkmark-done" : "checkmark")}
                        size={16}
                        color={message.is_read ? COLORS.accent : COLORS.muted}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={34} color={COLORS.subtext} />
              </View>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
          ListFooterComponent={<Animated.View style={bottomSpacingStyle} />}
        />
      )}

      <Animated.View style={[styles.inputContainer, inputContainerAnimatedStyle]}>
        <View style={styles.inputCard}>
          <Pressable
            onPress={async () => {
              if (showChevron) {
                // User wants to switch back to Image icon manually
                // DO NOT dismiss keyboard, just toggle icon
                setShowChevron(false);
              } else {
                // Icon is Image: Launch Picker
                await handleImagePick();
              }
            }}
            hitSlop={10}
            style={styles.leftInputIcon}
          >
            <Ionicons
              name={showChevron ? "chevron-forward" : "image-outline"}
              size={24}
              color={COLORS.muted}
            />
          </Pressable>

          <TextInput
            style={[styles.input, { maxHeight: 100 }]} // Limit height growth
            placeholder="Type a message..."
            placeholderTextColor={COLORS.muted}
            value={newMessage}
            onChangeText={setNewMessage}
            // Removed onSubmitEditing to allow new lines
            // onSubmitEditing={handleSendMessage}
            // returnKeyType="default" // Default allows newline
            blurOnSubmit={false}
            multiline={true}
            editable={!loading}
            onFocus={() => setShowChevron(true)}
            onBlur={() => setShowChevron(false)}
          />

          <Pressable
            onPress={handleSendMessage}
            disabled={!canSend || loading}
            hitSlop={10}
            style={({ pressed }) => [
              styles.sendButton,
              (!canSend || loading) && styles.sendButtonDisabled,
              pressed && canSend && !loading ? { transform: [{ scale: 0.98 }] } : null,
            ]}
          >
            <Ionicons name="send" size={18} color={mode === 'dark' ? "#000" : COLORS.myText} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Fake view to push content up with keyboard */}
      <Animated.View style={fakeViewAnimatedStyle} />

      <ImageViewing
        images={messages
          .filter(m => m.message_type === 'image' && m.media_url)
          .map(m => ({ uri: m.media_url! }))
        }
        imageIndex={currentImageIndex}
        visible={isViewerVisible}
        onRequestClose={() => setIsViewerVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />
    </View>
  );
}

const getStyles = (COLORS: any, SHADOW: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scrollContent: { flexGrow: 1, paddingTop: 10 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: COLORS.text,
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
  },

  // Header UI (navigation)
  navTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "95%",
  },
  navAvatarWrap: { width: HEADER_AVATAR_SIZE, height: HEADER_AVATAR_SIZE },
  navAvatar: {
    width: HEADER_AVATAR_SIZE,
    height: HEADER_AVATAR_SIZE,
    borderRadius: HEADER_AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface2,
  },
  onlineDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  avatarPlaceholder: { justifyContent: "center", alignItems: "center" },
  navTitleText: { fontSize: 16.5, fontWeight: "900", color: COLORS.text },
  navSubtitleText: { marginTop: 1, fontSize: 12, fontWeight: "700", color: COLORS.subtext },
  navRightRow: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 0 },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.surface2,
    justifyContent: "center",
    alignItems: "center",
  },

  // System message
  systemMessageContainer: { alignItems: "center", marginVertical: 14, paddingHorizontal: 16 },
  systemMessageBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
  },
  systemMessageText: {
    color: COLORS.subtext,
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "600",
    flexShrink: 1,
  },

  // Date separator
  dateSeparatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 18,
  },
  dateSeparatorLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dateSeparatorText: {
    color: COLORS.subtext,
    fontSize: 11.5,
    fontWeight: "800",
    marginHorizontal: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // Messages
  messageRow: { flexDirection: "row", paddingHorizontal: 10, marginVertical: 6, alignItems: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },

  miniAvatarWrap: { width: 28, height: 28, marginRight: 8 },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  messageBubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 16,
    ...SHADOW,
  },
  myMessage: {
    backgroundColor: COLORS.myBubble,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomRightRadius: 6
  },
  theirMessage: {
    backgroundColor: COLORS.theirBubble,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 6,
  },

  senderName: { fontSize: 12, color: COLORS.subtext, marginBottom: 4, fontWeight: "800" },
  messageText: { fontSize: 15.5, lineHeight: 21 },
  myMessageText: { color: COLORS.myText },
  theirMessageText: { color: COLORS.theirText },

  messageFooter: { flexDirection: "row", alignItems: "center", marginTop: 6, justifyContent: "flex-end" },
  timestamp: { fontSize: 10.5, fontWeight: "800" },
  myTimestamp: { color: COLORS.subtext },
  theirTimestamp: { color: COLORS.subtext },

  // Empty
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 110, paddingHorizontal: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    ...SHADOW,
  },
  emptyText: { color: COLORS.text, fontSize: 18, marginTop: 2, fontWeight: "900" },
  emptySubtext: { color: COLORS.subtext, fontSize: 14, marginTop: 6, fontWeight: "600" },

  // Input
  inputContainer: {
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...SHADOW,
  },
  input: { flex: 1, color: COLORS.text, fontSize: 16, paddingVertical: 0 },
  leftInputIcon: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  sendButtonDisabled: { opacity: 0.5 },

  // Header
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 0, // Reset margin since back button is gone
    flex: 1,
    paddingRight: 10,
  },
});