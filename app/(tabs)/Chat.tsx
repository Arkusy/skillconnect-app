// app/(tabs)/Chat.tsx
import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAdminTheme } from "../../context/AdminThemeContext";
import { getUserConversations } from "../../utils/chatUtils";
import { supabase } from "../../utils/supabase";

interface ConversationItem {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_avatar: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

interface SearchResult {
  id: string;
  message_text: string;
  created_at: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  participant_name: string;
  participant_id: string;
}



export default function ChatPage() {
  const { colors, mode } = useAdminTheme();

  // Map theme to local usage to preserve EXACT light mode output while enabling dark mode
  const COLORS = {
    bg: mode === 'dark' ? colors.background : "#F5F7FA",
    card: mode === 'dark' ? colors.card : "#FFFFFF",
    text: mode === 'dark' ? colors.text : "#111827",
    muted: mode === 'dark' ? colors.textSecondary : "#6B7280",
    border: mode === 'dark' ? colors.border : "#E5E7EB",
    soft: mode === 'dark' ? 'rgba(255,255,255,0.05)' : "#F3F4F6",
    primary: colors.primary, // "#059ef1" matches both
    textInverse: mode === 'dark' ? '#000' : '#FFF',
  };

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(COLORS, insets), [COLORS, insets]);

  const router = useRouter();

  // Haptics should never block UI
  const safeHaptic = () => {
    Haptics.selectionAsync().catch(() => { });
  };

  const [session, setSession] = useState<Session | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search (inline, header)
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);

  // Screen entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null as any);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setCurrentUserId(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (currentUserId) fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

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

  const fetchConversations = async (background = false) => {
    if (!currentUserId) return;

    try {
      if (!background) setLoading(true);

      const { data, error } = await getUserConversations(currentUserId);

      if (error) {
        console.error("Error fetching conversations:", error);
        return;
      }

      if (data) {
        // Optimization: Use Promise.all only for unread counts if needed, 
        // or effectively we can assume unread_count is fetched/calculated efficiently.
        // For now, removing the N+1 message fetch.

        const mappedPromises = data.map(async (conv) => {
          const otherParticipant =
            conv.participant1.id === currentUserId ? conv.participant2 : conv.participant1;

          // Fetch unread count (still requires individual fetch unless we optimize SQL further)
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('receiver_id', currentUserId)
            .eq('is_read', false);

          return {
            id: conv.id,
            participant_id: otherParticipant.id,
            participant_name: otherParticipant.full_name,
            participant_avatar: otherParticipant.avatar_url,
            last_message_at: conv.last_message_at,
            last_message_preview: (conv as any).last_message_preview || null, // Read from conv directly
            unread_count: count || 0,
          };
        });

        const mapped = await Promise.all(mappedPromises);
        setConversations(mapped);
      }
    } catch (error) {
      console.error("Error in fetchConversations:", error);
    } finally {
      if (!background) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Refresh list when screen is focused to update unread counts
      if (currentUserId) {
        fetchConversations(true);
      }
    }, [currentUserId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations(true);
    setRefreshing(false);
  };

  const handleOpenChat = async (conversation: ConversationItem) => {
    safeHaptic();
    router.push({
      pathname: "/ChatScreen",
      params: {
        user: conversation.participant_name,
        workerId: conversation.participant_id,
      },
    });
  };

  const openInlineSearch = () => {
    safeHaptic();

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchExpanded(true);

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeInlineSearch = () => {
    safeHaptic();

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setSearchExpanded(false);
    setSearchQuery("");
    setSearchResults([]);
    setShowAllResults(false);
  };

  const performSearch = async (query: string) => {
    if (!query.trim() || !currentUserId) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          message_text,
          created_at,
          conversation_id,
          sender_id,
          sender:profiles!messages_sender_id_fkey(full_name, avatar_url),
          conversation:conversations!messages_conversation_id_fkey(
            participant_1,
            participant_2,
            participant1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url),
            participant2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url)
          )
        `
        )
        .ilike("message_text", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Search error:", error);
        return;
      }

      if (data) {
        const filteredResults: SearchResult[] = data
          .filter((msg) => {
            const conv = msg.conversation as any;
            if (!conv) return false;
            return conv.participant_1 === currentUserId || conv.participant_2 === currentUserId;
          })
          .map((msg) => {
            const conv = msg.conversation as any;
            const sender = msg.sender as any;

            const isParticipant1CurrentUser = conv.participant_1 === currentUserId;
            const conversationPartner = isParticipant1CurrentUser ? conv.participant2 : conv.participant1;

            return {
              id: msg.id,
              message_text: msg.message_text,
              created_at: msg.created_at,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              sender_name: sender?.full_name || "Unknown",
              sender_avatar: sender?.avatar_url || null,
              participant_name: conversationPartner?.full_name || "Unknown",
              participant_id: conversationPartner?.id || "",
            };
          });

        setSearchResults(filteredResults);
      }
    } catch (error) {
      console.error("Error in performSearch:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowAllResults(false);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 450);
  };

  const handleSearchResultPress = (result: SearchResult) => {
    safeHaptic();
    router.push({
      pathname: "/ChatScreen",
      params: {
        user: result.participant_name,
        workerId: result.participant_id,
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

  const formatSearchResultTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const highlightSearchText = (text: string, query: string): string[] => {
    if (!query.trim()) return [text];
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.split(new RegExp(`(${safe})`, "gi"));
  };

  const displayedResults = showAllResults ? searchResults : searchResults.slice(0, 100);
  const hasMoreResults = searchResults.length > 100;

  const headerSubtitleText = useMemo(() => {
    if (searchExpanded) return "Search inside your conversations";
    const n = conversations.length;
    return `${n} ${n === 1 ? "conversation" : "conversations"}`;
  }, [conversations.length, searchExpanded]);

  const showingSearchList = searchExpanded;

  const ConversationCard = ({ item, index }: { item: ConversationItem; index: number }) => {
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
          accessibilityRole="button"
          accessibilityLabel={`Open chat with ${item.participant_name}`}
        >
          <Pressable onPress={() => router.push(`/userProfile?userId=${item.participant_id}`)}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={26} color={COLORS.muted} />
                </View>
              )}
              {item.unread_count > 0 && (
                <View style={styles.unreadBadgeAboslute}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </Pressable>

          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text style={styles.participantName} numberOfLines={1}>
                {item.participant_name}
              </Text>

              {!!item.last_message_at && (
                <Text style={styles.lastMessageTime}>{formatLastMessageTime(item.last_message_at)}</Text>
              )}
            </View>

            <View style={styles.conversationFooter}>
              <Text
                style={[
                  styles.lastMessagePreview,
                  item.unread_count > 0 && styles.lastMessageUnread
                ]}
                numberOfLines={1}
              >
                {item.last_message_preview || "Tap to view conversation"}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>
      </Animated.View>
    );
  };

  const SearchResultCard = ({ item, index }: { item: SearchResult; index: number }) => {
    const avatarUrl = getAvatarUrl(item.sender_avatar);
    const isMyMessage = item.sender_id === currentUserId;
    const highlightedParts = highlightSearchText(item.message_text, searchQuery);

    const fromName = isMyMessage ? "You" : item.sender_name;
    const toName = isMyMessage ? item.participant_name : "You";

    const enter = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(enter, {
        toValue: 1,
        duration: 220,
        delay: Math.min(index * 18, 220),
        useNativeDriver: true,
      }).start();
    }, [enter, index]);

    const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

    return (
      <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
        <Pressable
          style={styles.searchResultCard}
          onPress={() => handleSearchResultPress(item)}
          android_ripple={{ color: "#00000010" }}
          accessibilityRole="button"
          accessibilityLabel={`Open search result from ${fromName} to ${toName}`}
        >
          <View style={styles.searchResultHeader}>
            <View style={styles.searchResultAvatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.searchResultAvatar} />
              ) : (
                <View style={[styles.searchResultAvatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={18} color={COLORS.muted} />
                </View>
              )}
            </View>

            <View style={styles.searchResultInfo}>
              <View style={styles.searchResultTopRow}>
                <Text style={styles.searchResultName} numberOfLines={1}>
                  {fromName}
                </Text>
                <Ionicons name="arrow-forward" size={12} color="#9AA3AF" style={{ marginHorizontal: 6 }} />
                <Text style={styles.searchResultParticipant} numberOfLines={1}>
                  {toName}
                </Text>
              </View>

              <Text style={styles.searchResultMessage} numberOfLines={2}>
                {highlightedParts.map((part: string, i: number) => (
                  <Text
                    key={i}
                    style={part.toLowerCase() === searchQuery.toLowerCase() ? styles.highlightedText : styles.normalText}
                  >
                    {part}
                  </Text>
                ))}
              </Text>

              <Text style={styles.searchResultTime}>{formatSearchResultTime(item.created_at)}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading conversations…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={COLORS.bg} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {!searchExpanded ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} accessibilityRole="header">
                Messages
              </Text>
              <Text style={styles.headerSubtitle}>{headerSubtitleText}</Text>
            </View>

            <Pressable
              style={styles.searchButton}
              onPress={openInlineSearch}
              android_ripple={{ color: "#00000010", borderless: true }}
              accessibilityRole="button"
              accessibilityLabel="Open search"
            >
              <Ionicons name="search" size={22} color={COLORS.text} />
            </Pressable>
          </>
        ) : (
          <View style={styles.headerSearchRow}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={18} color="#9AA3AF" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search messages…"
                placeholderTextColor="#9AA3AF"
                value={searchQuery}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search messages"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    safeHaptic();
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowAllResults(false);
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={20} color="#9AA3AF" />
                </Pressable>
              )}
            </View>

            <Pressable
              style={styles.headerCloseBtn}
              onPress={closeInlineSearch}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close search"
            >
              <Ionicons name="close" size={22} color={COLORS.text} />
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Body */}
      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        {!showingSearchList ? (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <ConversationCard item={item} index={index} />}
            contentContainerStyle={[
              styles.listContent,
              conversations.length === 0 && { flexGrow: 1 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={() => (
              <Animated.View
                style={[
                  styles.emptyContainer,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="chatbubbles-outline" size={64} color={COLORS.muted} />
                </View>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>Start chatting with workers from the Home tab.</Text>
              </Animated.View>
            )}
          />
        ) : (
          <View style={styles.searchBody}>
            {searchLoading ? (
              <View style={styles.searchState}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.searchStateText}>Searching…</Text>
              </View>
            ) : searchQuery.trim() === "" ? (
              <View style={styles.searchState}>
                <Ionicons name="search-outline" size={56} color={COLORS.muted} />
                <Text style={styles.searchStateTitle}>Search your messages</Text>
                <Text style={styles.searchStateText}>Type to search across all conversations.</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.searchState}>
                <Ionicons name="sad-outline" size={56} color={COLORS.muted} />
                <Text style={styles.searchStateTitle}>No results</Text>
                <Text style={styles.searchStateText}>Try different keywords.</Text>
              </View>
            ) : (
              <>
                <View style={styles.searchResultsHeader}>
                  <Text style={styles.searchResultsCount}>
                    {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                    {!showAllResults && hasMoreResults ? " (showing first 100)" : ""}
                  </Text>

                  {hasMoreResults && !showAllResults && (
                    <Pressable
                      onPress={() => {
                        safeHaptic();
                        setShowAllResults(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Show all results"
                    >
                      <Text style={styles.showAllText}>Show all</Text>
                    </Pressable>
                  )}
                </View>

                <FlatList
                  data={displayedResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => <SearchResultCard item={item} index={index} />}
                  contentContainerStyle={styles.searchResultsList}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  ListFooterComponent={
                    hasMoreResults && !showAllResults ? (
                      <Pressable
                        style={styles.seeMoreButton}
                        onPress={() => {
                          safeHaptic();
                          setShowAllResults(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`See all ${searchResults.length} results`}
                      >
                        <Text style={styles.seeMoreText}>See all {searchResults.length} results</Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.text} />
                      </Pressable>
                    ) : (
                      <View style={{ height: 10 }} />
                    )
                  }
                />
              </>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const getStyles = (COLORS: any, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
  },
  loadingText: { marginTop: 12, color: COLORS.muted, fontWeight: "600" },

  header: {
    paddingTop: Math.max(insets.top, 10) + 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
    fontWeight: "600",
  },

  // header search toggle button
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  // when expanded, header becomes: [search-input..............][X]
  headerSearchRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.soft,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border, // relaxed from #E9EEF5 for dark mode consistency
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 0,
  },

  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 20 },

  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
  },
  avatarContainer: { marginRight: 14, position: "relative" },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarPlaceholder: { backgroundColor: COLORS.soft, justifyContent: "center", alignItems: "center" },

  unreadDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.card,
  },

  conversationInfo: { flex: 1 },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 10,
  },
  participantName: { fontSize: 16, fontWeight: "800", color: COLORS.text, flex: 1 },
  lastMessageTime: { fontSize: 12, color: "#9AA3AF", fontWeight: "700" },
  conversationFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  lastMessagePreview: { fontSize: 13, color: COLORS.muted, flex: 1 },
  lastMessageUnread: { color: COLORS.text, fontWeight: "600" },

  unreadBadgeAboslute: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  unreadText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 34,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: { color: COLORS.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Search body (same page)
  searchBody: { flex: 1 },

  searchState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 30,
  },
  searchStateTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  searchStateText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
  },

  searchResultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.soft, // Adjusted to soft for dynamic bg
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchResultsCount: { fontSize: 13, fontWeight: "800", color: COLORS.muted },
  showAllText: { color: COLORS.primary, fontWeight: "900", fontSize: 13 },
  searchResultsList: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 18 },

  searchResultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchResultHeader: { flexDirection: "row" },
  searchResultAvatarContainer: { marginRight: 12 },
  searchResultAvatar: { width: 44, height: 44, borderRadius: 22 },
  searchResultInfo: { flex: 1 },

  searchResultTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  searchResultName: { fontSize: 15, fontWeight: "900", color: COLORS.text, maxWidth: "42%" },
  searchResultParticipant: { fontSize: 15, fontWeight: "700", color: COLORS.muted, flex: 1 },

  searchResultMessage: { fontSize: 14, lineHeight: 20, color: COLORS.text, marginBottom: 6 },
  highlightedText: { backgroundColor: "#FFF59D", fontWeight: "900", color: "#111827" }, // Keep text dark on yellow
  normalText: { color: COLORS.text },
  searchResultTime: { fontSize: 12, color: "#9AA3AF", fontWeight: "700" },

  seeMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.soft,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  seeMoreText: { fontSize: 14, fontWeight: "900", color: COLORS.text },
});