import BanDurationModal from "@/components/BanDurationModal";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomAlert } from "../../components/CustomAlert";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { banUser, demoteWorker, promoteToWorker, unbanUser } from "../../utils/workerUtils";

const { width, height } = Dimensions.get("window");

type UserRole = 'all' | 'worker' | 'user' | 'payment-due';

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: number;
    avatar_url: string | null;
    created_at: string;
    is_banned?: boolean;
    ban_expires_at?: string | null;
    ban_reason?: string | null;
    availability_status?: string; // For workers
    subscription_expires_at?: string | null; // For subscription check
    subscription_is_active?: boolean;
}

// Helper component to load avatar
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

        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(url);

        if (data) {
            setAvatarUri(data.publicUrl);
        }
    }, [url]);

    const uiAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random&color=fff&size=200`;
    const finalSource = (avatarUri && !imageError) ? { uri: avatarUri } : { uri: uiAvatarUrl };

    return (
        <Image
            source={finalSource}
            style={styles.avatar}
            onError={() => setImageError(true)}
        />
    );
});

export default function ManageUsersScreen() {
    const { colors, mode } = useAdminTheme();
    const insets = useSafeAreaInsets();
    const { showAlert, AlertComponent } = useCustomAlert();
    const [activeTab, setActiveTab] = useState<UserRole>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [banModalVisible, setBanModalVisible] = useState(false);
    const [promoteModalVisible, setPromoteModalVisible] = useState(false);
    const [promoteDuration, setPromoteDuration] = useState("");
    const [promoting, setPromoting] = useState(false);
    const [demoting, setDemoting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch profiles with ban info
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, avatar_url, created_at, is_banned, ban_expires_at, ban_reason')
                .neq('role', 0)
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // Fetch worker availability status for workers
            const { data: workerData } = await supabase
                .from('worker_profiles')
                .select('user_id, availability_status');

            // Fetch active subscriptions for workers
            const { data: subscriptionData } = await supabase
                .from('worker_subscriptions')
                .select('user_id, expires_at, is_active')
                .eq('is_active', true);

            // Merge availability status and subscription data into profiles
            const usersWithStatus = (profilesData || []).map(profile => {
                const workerProfile = workerData?.find(w => w.user_id === profile.id);
                const subscription = subscriptionData?.find(s => s.user_id === profile.id);
                return {
                    ...profile,
                    availability_status: workerProfile?.availability_status || null,
                    subscription_expires_at: subscription?.expires_at || null,
                    subscription_is_active: subscription?.is_active || false
                };
            });

            setUsers(usersWithStatus);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to check if subscription is expired
    const isSubscriptionExpired = (user: UserProfile) => {
        if (!user.subscription_expires_at) return true; // No subscription = expired
        return new Date(user.subscription_expires_at) < new Date();
    };

    const getFilteredUsers = () => {
        let filtered = users;

        if (activeTab === 'worker') {
            // Active workers with valid subscription
            filtered = filtered.filter(u => u.role === 1 && !isSubscriptionExpired(u));
        } else if (activeTab === 'user') {
            filtered = filtered.filter(u => u.role === 2);
        } else if (activeTab === 'payment-due') {
            // Workers with expired subscription
            filtered = filtered.filter(u => u.role === 1 && isSubscriptionExpired(u));
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(u =>
                u.full_name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q)
            );
        }

        return filtered;
    };

    const handleAction = async (action: string) => {
        setModalVisible(false);

        if (action === "Ban User" && selectedUser) {
            // Open ban duration modal
            setBanModalVisible(true);
            return;
        }

        if (action === "Unban User" && selectedUser) {
            showAlert(
                "Unban User",
                `Are you sure you want to unban ${selectedUser.full_name}?`,
                "warning",
                {
                    showCancel: true,
                    buttonText: "Unban",
                    onConfirm: async () => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            const result = await unbanUser(selectedUser.id, user?.id || '');
                            if (result.success) {
                                showAlert("Success", `${selectedUser.full_name} has been unbanned.`, "success");
                                fetchUsers();
                            } else {
                                showAlert("Error", result.error || "Failed to unban user", "error");
                            }
                        } catch (error: any) {
                            showAlert("Error", error.message, "error");
                        }
                    },
                }
            );
            return;
        }

        if (action === "Remove Worker Rights" && selectedUser) {
            showAlert(
                "Demote Worker",
                `Are you sure you want to remove worker rights from ${selectedUser.full_name}?\n\nThis will:\n• Delete their worker profile\n• Delete their KYC documents\n• Require re-verification to upgrade again`,
                "warning",
                {
                    showCancel: true,
                    buttonText: "Demote",
                    onConfirm: async () => {
                        try {
                            setDemoting(true);
                            const { data: { user } } = await supabase.auth.getUser();
                            const result = await demoteWorker(
                                selectedUser.id,
                                user?.id || null,
                                "Admin manually removed worker rights"
                            );
                            setDemoting(false);
                            if (result.success) {
                                showAlert("Success", `${selectedUser.full_name} has been demoted to regular user.`, "success");
                                fetchUsers();
                            } else {
                                showAlert("Error", result.error || "Failed to demote worker", "error");
                            }
                        } catch (error: any) {
                            setDemoting(false);
                            showAlert("Error", error.message, "error");
                        }
                    },
                }
            );
            return;
        }

        if (action === "Promote to Worker" && selectedUser) {
            // Open promote modal
            setPromoteDuration("");
            setPromoteModalVisible(true);
            return;
        }
    };

    const handlePromoteConfirm = async () => {
        setPromoteModalVisible(false);
        if (!selectedUser || !promoteDuration) return;

        const months = parseInt(promoteDuration);
        if (isNaN(months) || months < 1 || months > 24) {
            showAlert("Invalid Duration", "Please enter a valid number of months (1-24)", "error");
            return;
        }

        showAlert(
            "Promote to Worker",
            `Promote ${selectedUser.full_name} to Worker for ${months} month(s)?\n\nThis will bypass KYC verification.`,
            "warning",
            {
                showCancel: true,
                buttonText: "Promote",
                onConfirm: async () => {
                    try {
                        setPromoting(true);
                        const { data: { user } } = await supabase.auth.getUser();
                        const result = await promoteToWorker(
                            selectedUser.id,
                            user?.id || '',
                            months
                        );
                        setPromoting(false);
                        if (result.success) {
                            const trialMsg = result.isFirstPromotion ? "\n(Free trial has been used)" : "";
                            showAlert(
                                "Success",
                                `${selectedUser.full_name} is now a Worker for ${months} month(s)!${trialMsg}`,
                                "success"
                            );
                            fetchUsers();
                        } else {
                            showAlert("Error", result.error || "Failed to promote user", "error");
                        }
                    } catch (error: any) {
                        setPromoting(false);
                        showAlert("Error", error.message, "error");
                    }
                },
            }
        );
    };

    const handleBanDuration = async (duration: 1 | 2 | 3 | 6 | 12 | 'permanent') => {
        setBanModalVisible(false);
        if (!selectedUser) return;

        showAlert(
            duration === 'permanent' ? "Permanent Ban" : `${duration} Month Ban`,
            `Are you sure you want to ban ${selectedUser.full_name}${duration === 'permanent' ? ' permanently' : ` for ${duration} month(s)`}?`,
            "warning",
            {
                showCancel: true,
                buttonText: "Ban",
                onConfirm: async () => {
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        const result = await banUser(
                            selectedUser.id,
                            user?.id || '',
                            duration,
                            "Admin ban"
                        );
                        if (result.success) {
                            showAlert(
                                "Success",
                                `${selectedUser.full_name} has been banned${duration === 'permanent' ? ' permanently' : ` for ${duration} month(s)`}.`,
                                "success"
                            );
                            fetchUsers();
                        } else {
                            showAlert("Error", result.error || "Failed to ban user", "error");
                        }
                    } catch (error: any) {
                        showAlert("Error", error.message, "error");
                    }
                },
            }
        );
    };

    const openActions = (user: UserProfile) => {
        setSelectedUser(user);
        setModalVisible(true);
    };

    const renderUserItem = ({ item, index }: { item: UserProfile; index: number }) => {
        const isWorker = item.role === 1;
        const badgeColor = isWorker ? colors.warning : colors.success;
        const badgeText = isWorker ? "Worker" : "User";
        const isBanned = item.is_banned;
        const isPaymentDue = isWorker && isSubscriptionExpired(item);

        return (
            <View style={[styles.userCard, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                <View style={styles.userInfo}>
                    <AvatarItem url={item.avatar_url} name={item.full_name || "Unknown"} />
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.userName, { color: colors.text }]}>{item.full_name || "Unknown"}</Text>
                            {isBanned && (
                                <View style={[styles.roleBadge, { backgroundColor: '#F4433620' }]}>
                                    <Text style={[styles.roleText, { color: '#F44336' }]}>Banned</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <View style={[styles.roleBadge, { backgroundColor: badgeColor + '20' }]}>
                                <Text style={[styles.roleText, { color: badgeColor }]}>{badgeText}</Text>
                            </View>
                            {isPaymentDue && (
                                <View style={[styles.roleBadge, { backgroundColor: '#FF980020' }]}>
                                    <Text style={[styles.roleText, { color: '#FF9800' }]}>Payment Due</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
                <TouchableOpacity onPress={() => openActions(item)} style={styles.actionBtn}>
                    <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />

            {/* Header Container */}
            <View style={[styles.headerContainer, {
                backgroundColor: colors.card, // Using card color for header bg in this case or could use headerBg
                shadowColor: mode === 'dark' ? '#000' : '#ccc'
            }]}>
                <Text style={[styles.headerTitle, { color: colors.text, paddingHorizontal: 20, marginBottom: 15 }]}>Manage Users</Text>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search users..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Filter Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                >
                    {(['all', 'worker', 'user', 'payment-due'] as UserRole[]).map((tab) => {
                        const tabLabels: Record<UserRole, string> = {
                            'all': 'All',
                            'worker': 'Workers',
                            'user': 'Users',
                            'payment-due': 'Payment Due'
                        };
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[
                                    styles.tab,
                                    { backgroundColor: activeTab === tab ? colors.text : colors.background },
                                    activeTab !== tab && { borderWidth: 1, borderColor: colors.border }
                                ]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[
                                    styles.tabText,
                                    { color: activeTab === tab ? colors.background : colors.textSecondary }
                                ]}>
                                    {tabLabels[tab]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={getFilteredUsers()}
                    keyExtractor={item => item.id}
                    renderItem={renderUserItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={{ color: colors.textSecondary, marginTop: 50 }}>No users found</Text>
                        </View>
                    }
                />
            )}

            {/* Action Modal */}
            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Manage {selectedUser?.full_name}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Ban / Unban option */}
                        {selectedUser?.is_banned ? (
                            <TouchableOpacity style={[styles.modalOption, { borderBottomColor: colors.border }]} onPress={() => handleAction("Unban User")}>
                                <View style={[styles.iconBox, { backgroundColor: '#4CAF5020' }]}>
                                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                </View>
                                <View>
                                    <Text style={[styles.optionTitle, { color: colors.text }]}>Unban User</Text>
                                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Restore account access</Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.modalOption, { borderBottomColor: colors.border }]} onPress={() => handleAction("Ban User")}>
                                <View style={[styles.iconBox, { backgroundColor: '#ffcccc' }]}>
                                    <Ionicons name="ban" size={20} color="#ff4757" />
                                </View>
                                <View>
                                    <Text style={[styles.optionTitle, { color: colors.text }]}>Ban User</Text>
                                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Restrict account access</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {(selectedUser?.role === 1) && (
                            <TouchableOpacity style={[styles.modalOption, { borderBottomColor: colors.border }]} onPress={() => handleAction("Remove Worker Rights")}>
                                <View style={[styles.iconBox, { backgroundColor: '#dff9fb' }]}>
                                    <Ionicons name="briefcase" size={20} color="#22a6b3" />
                                </View>
                                <View>
                                    <Text style={[styles.optionTitle, { color: colors.text }]}>Remove Worker Rights</Text>
                                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Downgrade to normal user</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Promote to Worker option (for users only) */}
                        {(selectedUser?.role === 2) && (
                            <TouchableOpacity style={[styles.modalOption, { borderBottomColor: colors.border }]} onPress={() => handleAction("Promote to Worker")}>
                                <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                                    <Ionicons name="arrow-up-circle" size={20} color="#4CAF50" />
                                </View>
                                <View>
                                    <Text style={[styles.optionTitle, { color: colors.text }]}>Promote to Worker</Text>
                                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Grant worker rights (skip KYC)</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </Pressable>
            </Modal>

            {/* Ban Duration Modal */}
            <BanDurationModal
                visible={banModalVisible}
                onClose={() => setBanModalVisible(false)}
                onSelectDuration={handleBanDuration}
                userName={selectedUser?.full_name || ''}
                colors={colors}
                mode={mode}
            />

            {/* Promote Duration Modal */}
            <Modal
                transparent={true}
                visible={promoteModalVisible}
                animationType="fade"
                onRequestClose={() => setPromoteModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setPromoteModalVisible(false)}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Promote {selectedUser?.full_name}</Text>
                                <TouchableOpacity onPress={() => setPromoteModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <Text style={{ color: colors.textSecondary, marginBottom: 16, paddingHorizontal: 16 }}>
                                Enter the number of months for worker subscription:
                            </Text>

                            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderRadius: 12,
                                        padding: 14,
                                        fontSize: 18,
                                        color: colors.text,
                                        backgroundColor: mode === 'dark' ? colors.background : '#F5F5F5',
                                        textAlign: 'center',
                                    }}
                                    placeholder="e.g., 6"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                    value={promoteDuration}
                                    onChangeText={setPromoteDuration}
                                    maxLength={2}
                                />
                                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                                    Valid range: 1-24 months
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#4CAF50',
                                    marginHorizontal: 16,
                                    marginBottom: 16,
                                    padding: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                }}
                                onPress={handlePromoteConfirm}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Promote to Worker</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* Loading Overlay for Promote/Demote */}
            {(promoting || demoting) && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 999,
                }}>
                    <View style={{
                        backgroundColor: colors.card,
                        padding: 24,
                        borderRadius: 16,
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ color: colors.text, fontWeight: '600' }}>
                            {promoting ? "Promoting user..." : "Demoting worker..."}
                        </Text>
                    </View>
                </View>
            )}

            {/* Custom Alert Component */}
            <AlertComponent />
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
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        zIndex: 10,
        paddingTop: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: "800",
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 15,
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    tabsContainer: {
        paddingHorizontal: 20,
        gap: 10,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    tabText: {
        fontWeight: "600",
        fontSize: 13,
    },
    listContent: {
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 40
    },
    userCard: {
        borderRadius: 16,
        padding: 15,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        flex: 1
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#eee'
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
    },
    userEmail: {
        fontSize: 13,
        marginBottom: 4
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    roleText: {
        fontSize: 11,
        fontWeight: '700'
    },
    actionBtn: {
        padding: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        gap: 16
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    optionSub: {
        fontSize: 13,
    }
});
