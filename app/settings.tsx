import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { useCustomAlert } from "../components/CustomAlert";
import { useAdminTheme } from "../context/AdminThemeContext";
import {
    registerForPushNotificationsAsync,
    removePushTokenFromDatabase,
    savePushTokenToDatabase
} from "../utils/notifications";
import { supabase } from "../utils/supabase";



export default function Settings() {
    const { mode, toggleTheme, colors } = useAdminTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => getStyles(colors, mode, insets), [colors, mode, insets]);
    const router = useRouter();


    // Local settings (in a real app, these might also be persisted or part of a UserContext)
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);
    // const [darkMode, setDarkMode] = useState(false); // Replaced by Context
    const [biometrics, setBiometrics] = useState(false);
    const { showAlert, AlertComponent } = useCustomAlert();
    const [loading, setLoading] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);

    React.useEffect(() => {
        (async () => {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            setIsBiometricSupported(compatible && enrolled);

            const savedBiometrics = await AsyncStorage.getItem("biometrics_enabled");
            if (savedBiometrics === "true") {
                setBiometrics(true);
            }

            // Load push notification preference  
            const savedPush = await AsyncStorage.getItem("push_notifications_enabled");
            // Default to true if not set
            setPushEnabled(savedPush !== "false");
        })();

        supabase.auth.getUser().then(({ data }) => {
            setUserEmail(data.user?.email);
        });
    }, []);

    const handleBiometricToggle = async () => {
        await Haptics.selectionAsync();

        if (!isBiometricSupported) {
            showAlert("Not Supported", "Biometric authentication is not available on this device.");
            return;
        }

        if (!biometrics) {
            // Turning ON
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: "Authenticate to enable biometrics",
            });

            if (result.success) {
                setBiometrics(true);
                AsyncStorage.setItem("biometrics_enabled", "true");
                showAlert("Success", "Biometric login enabled!", "success");
            } else {
                showAlert("Error", "Authentication failed. Please try again.");
            }
        } else {
            // Turning OFF - Require auth
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: "Authenticate to disable biometrics",
            });

            if (result.success) {
                setBiometrics(false);
                AsyncStorage.removeItem("biometrics_enabled");
            } else {
                showAlert("Error", "Authentication failed. Changes not saved.");
            }
        }
    };

    // Playful Button Animation
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const rotateAnim = React.useRef(new Animated.Value(0)).current;

    const handlePlayfulPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        Animated.sequence([
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true, friction: 3 }),
                Animated.timing(rotateAnim, { toValue: 1, duration: 200, useNativeDriver: true })
            ]),
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
                Animated.timing(rotateAnim, { toValue: 0, duration: 200, useNativeDriver: true })
            ])
        ]).start();
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const handleDeleteAccount = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showAlert(
            "Delete Account",
            "Are you sure you want to delete your account? Your data will be retained for 30 days before permanent deletion. During this period, your account will be disabled.",
            "warning",
            {
                showCancel: true,
                buttonText: "Delete",
                onConfirm: async () => {
                    try {
                        setLoading(true);
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        await supabase.auth.signOut();
                        showAlert("Account Deleted", "Your account has been scheduled for deletion.", "success");
                        router.replace("/(auth)/login" as any);
                    } catch (error) {
                        showAlert("Error", "Failed to delete account.", "error");
                    } finally {
                        setLoading(false);
                    }
                }
            }
        );
    };

    const handlePushNotificationToggle = async () => {
        await Haptics.selectionAsync();
        const newValue = !pushEnabled;
        setPushEnabled(newValue);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (newValue) {
            // Turning ON - re-register push notifications
            await AsyncStorage.setItem("push_notifications_enabled", "true");
            try {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    await savePushTokenToDatabase(user.id, token);
                    showAlert("Success", "Push notifications enabled!", "success");
                }
            } catch (error) {
                console.error("Error enabling push notifications:", error);
            }
        } else {
            // Turning OFF - remove push token from database
            await AsyncStorage.setItem("push_notifications_enabled", "false");
            try {
                await removePushTokenFromDatabase(user.id);
                showAlert("Disabled", "Push notifications disabled.", "info");
            } catch (error) {
                console.error("Error disabling push notifications:", error);
            }
        }
    };

    const toggleSwitch = (
        value: boolean,
        setter: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
        Haptics.selectionAsync();
        setter(!value);
    };

    const SettingItem = ({
        icon,
        color,
        label,
        value,
        onValueChange,
        type = "switch",
        textColor = "#1A1A1A"
    }: {
        icon: any;
        color: string;
        label: string;
        value?: boolean;
        onValueChange?: () => void;
        type?: "switch" | "link";
        textColor?: string;
    }) => (
        <Pressable
            style={styles.settingRow}
            onPress={type === "link" ? onValueChange : undefined}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.iconBox, { backgroundColor: color + "20" }]}>
                    <Ionicons name={icon} size={20} color={color} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
            </View>
            {type === "switch" ? (
                <Switch
                    value={value}
                    onValueChange={() => onValueChange && onValueChange()}
                    trackColor={{ false: "#E0E0E0", true: "#059ef1" }}
                    thumbColor={"#fff"}
                />
            ) : (
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
            )}
        </Pressable>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* StatusBar handled by Provider, or we can override if needed, but context does it well */}

            {/* Header */}
            <View style={[styles.headerContainer, { backgroundColor: colors.headerBg }]}>
                <View style={styles.headerTopRow}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                    <Pressable onPress={handlePlayfulPress} hitSlop={10}>
                        <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: spin }] }}>
                            {mode === 'dark' ? (
                                <Ionicons name="flash" size={28} color="#ffa602c9" />
                            ) : (
                                <Ionicons name="flash" size={28} color="#2002ffc9" />
                            )}
                        </Animated.View>
                    </Pressable>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Preferences</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingItem
                            icon="moon-outline"
                            color="#607D8B"
                            label="Dark Mode"
                            value={mode === 'dark'}
                            onValueChange={() => {
                                toggleTheme();
                            }}
                            textColor={colors.text}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem
                            icon="notifications-outline"
                            color="#FF9800"
                            label="Push Notifications"
                            value={pushEnabled}
                            onValueChange={handlePushNotificationToggle}
                            textColor={colors.text}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem
                            icon="mail-outline"
                            color="#E91E63"
                            label="Email Updates"
                            value={emailEnabled}
                            onValueChange={() => toggleSwitch(emailEnabled, setEmailEnabled)}
                            textColor={colors.text}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Security</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingItem
                            icon="finger-print-outline"
                            color="#4CAF50"
                            label="Biometric Login"
                            value={biometrics}
                            onValueChange={handleBiometricToggle}
                            textColor={colors.text}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem
                            icon="lock-closed-outline"
                            color="#2196F3"
                            label="Change Password"
                            type="link"
                            onValueChange={() => setShowChangePassword(true)}
                            textColor={colors.text}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Support</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingItem
                            icon="help-circle-outline"
                            color="#9C27B0"
                            label="Help Center"
                            type="link"
                            onValueChange={() => router.push("/help-center" as any)}
                            textColor={colors.text}

                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem
                            icon="document-text-outline"
                            color="#795548"
                            label="Terms of Service"
                            type="link"
                            onValueChange={() => router.push({ pathname: "/legal", params: { type: "terms" } })}
                            textColor={colors.text}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem
                            icon="shield-checkmark-outline"
                            color="#607D8B"
                            label="Privacy Policy"
                            type="link"
                            onValueChange={() => router.push({ pathname: "/legal", params: { type: "privacy" } })}
                            textColor={colors.text}
                        />
                    </View>
                </View>

                {/* Delete Account */}
                <Pressable
                    style={({ pressed }) => [
                        styles.deleteBtn,
                        { opacity: pressed ? 0.7 : 1, backgroundColor: pressed ? (mode === 'dark' ? "#FFEBEE" : "#FFF5F5") : "transparent" }
                    ]}
                    onPress={handleDeleteAccount}
                    disabled={loading}
                >
                    <Text style={styles.deleteText}>{loading ? "Processing..." : "Delete Account"}</Text>
                </Pressable>

                <Text style={[styles.versionText, { color: colors.textSecondary }]}>Version 1.0.0</Text>
            </ScrollView>
            <ChangePasswordModal
                visible={showChangePassword}
                onClose={() => setShowChangePassword(false)}
                userEmail={userEmail}
            />
            <AlertComponent />
        </View>
    );
}

// ---------- Styles ----------
const getStyles = (colors: any, mode: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 20, paddingBottom: 40 },
    headerContainer: {
        backgroundColor: colors.card,
        paddingTop: Math.max(insets.top, 10) + 10,
        paddingBottom: 10,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        zIndex: 10,
    },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "800",
        color: colors.text,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.textSecondary,
        marginBottom: 10,
        marginLeft: 4,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: 16,
        paddingVertical: 4,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 60,
    },
    versionText: {
        textAlign: "center",
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 10,
        marginBottom: 30,
    },
    deleteBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        marginBottom: 20,
    },
    deleteText: {
        color: "#F44336",
        fontWeight: "600",
        fontSize: 15,
    },
    emailCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    }
});
