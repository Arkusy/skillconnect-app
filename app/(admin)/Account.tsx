// app/(admin)/Account.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "../../components/Avatar";
import { useCustomAlert } from "../../components/CustomAlert";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { clearProfileCache, useProfile } from "../../utils/useProfile";

export default function AdminAccountScreen() {
    const { profile, loading: profileLoading, updateProfile, fetchProfile } = useProfile();
    const { colors, mode, toggleTheme } = useAdminTheme();
    const insets = useSafeAreaInsets();
    const { showAlert, AlertComponent } = useCustomAlert();

    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "");
            setPhone(profile.phone || "");
            setAddress(profile.address || "");
            setBio(profile.bio || "");
            setAvatarUrl(profile.avatar_url || null);
        }
    }, [profile]);

    useEffect(() => {
        if (profile) {
            const isDirty =
                fullName !== (profile.full_name || "") ||
                phone !== (profile.phone || "") ||
                address !== (profile.address || "") ||
                bio !== (profile.bio || "");
            setHasChanges(isDirty);
        }
    }, [fullName, phone, address, bio, profile]);

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) return showAlert("Error", "Full Name is required", "error");

        setLoading(true);
        try {
            const res = await updateProfile({
                full_name: fullName,
                phone,
                address,
                bio,
            });
            if (res.success) {
                showAlert("Success", "Profile updated successfully", "success");
                setHasChanges(false);
            } else {
                showAlert("Error", res.error || "Failed to update profile", "error");
            }
        } catch (e: any) {
            showAlert("Error", e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async (path: string) => {
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ avatar_url: path })
                .eq("id", profile?.id);

            if (error) throw error;
            setAvatarUrl(path);
            clearProfileCache();
            fetchProfile(true);
        } catch (error: any) {
            showAlert("Error", error.message, "error");
        }
    };

    const handleSignOut = async () => {
        showAlert(
            "Sign Out",
            "Are you sure you want to sign out?",
            "warning",
            {
                showCancel: true,
                buttonText: "Sign Out",
                onConfirm: async () => {
                    await AsyncStorage.removeItem("biometrics_enabled");
                    await supabase.auth.signOut();
                },
            }
        );
    };

    if (profileLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={mode === "dark" ? "light-content" : "dark-content"}
                backgroundColor={colors.headerBg}
            />

            {/* HEADER */}
            <View style={[styles.header, {
                backgroundColor: colors.headerBg,
                borderBottomColor: colors.border,
                paddingTop: Math.max(insets.top, 10) + 10
            }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Account</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* PROFILE CARD */}
                <View style={[styles.card, { backgroundColor: colors.card, shadowColor: mode === 'dark' ? '#000' : '#ccc' }]}>
                    <View style={styles.profileRow}>
                        <View style={styles.avatarContainer}>
                            <Avatar
                                size={70}
                                url={avatarUrl}
                                onUpload={handleAvatarUpload}
                            />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.text }]}>
                                {fullName || "Admin User"}
                            </Text>
                            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                                {profile?.email}
                            </Text>
                            <View style={[styles.roleBadge, { backgroundColor: colors.iconBg }]}>
                                <Text style={[styles.roleText, { color: colors.primary }]}>ADMINISTRATOR</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* SETTINGS LINK */}
                <Pressable
                    style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push("/settings")}
                    accessibilityRole="button"
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[styles.iconBox, { backgroundColor: colors.iconBg }]}>
                            <Ionicons name="settings-outline" size={22} color={colors.primary} />
                        </View>
                        <Text style={[styles.settingsText, { color: colors.text }]}>Settings</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#ccc" />
                </Pressable>

                {/* EDIT PROFILE FORM */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>EDIT DETAILS</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Full Name"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Phone</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Phone Number"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Details</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, height: 80 }]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Bio / Notes"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <Pressable
                        style={[
                            styles.saveBtn,
                            { backgroundColor: hasChanges ? colors.primary : colors.border },
                        ]}
                        onPress={handleUpdateProfile}
                        disabled={!hasChanges || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        )}
                    </Pressable>
                </View>

                {/* LOGOUT */}
                <Pressable
                    style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.danger }]}
                    onPress={handleSignOut}
                >
                    <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
                </Pressable>

                <View style={{ height: 40 }} />
            </ScrollView>
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
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "700",
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 25,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    profileRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
    },
    avatarContainer: {
        bottom: 22,
    },
    profileInfo: {
        marginLeft: 15,
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        marginBottom: 8,
    },
    roleBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    roleText: {
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 10,
        marginLeft: 5,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    settingLabelContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: "500",
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
    },
    saveBtn: {
        marginTop: 10,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    saveBtnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    logoutBtn: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: "center",
        marginBottom: 20,
    },
    logoutText: {
        fontWeight: "600",
        fontSize: 16,
    },
    settingsCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    settingsText: { fontWeight: "800", fontSize: 16 },
});
