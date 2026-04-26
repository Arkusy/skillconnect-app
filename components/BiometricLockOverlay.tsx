import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAdminTheme } from "../context/AdminThemeContext";

interface BiometricLockOverlayProps {
    isLocked: boolean;
    onUnlock: () => void;
    onSignOut: () => void;
}

export default function BiometricLockOverlay({ isLocked, onUnlock, onSignOut }: BiometricLockOverlayProps) {
    const { colors, mode } = useAdminTheme();

    if (!isLocked) return null;

    const isDark = mode === "dark";

    // Custom colors to match the user's preferred "good" dark mode look
    const overlayBg = isDark ? "#1a1a1a" : "#ffffff";
    const iconContainerBg = isDark ? "#333333" : "#f5f5f5";
    const iconColor = isDark ? "#ffffff" : "#000000";
    const textColor = isDark ? "#ffffff" : "#000000";
    const subTextColor = isDark ? "#cccccc" : "#666666";
    const unlockBtnBg = isDark ? "#2196F3" : "#000000"; // Blue in dark, black in light (or keep blue)
    const unlockBtnText = "#ffffff";

    return (
        <View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: overlayBg }]}>
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={overlayBg}
            />
            <View style={[styles.iconContainer, { backgroundColor: iconContainerBg }]}>
                <Ionicons name="lock-closed" size={64} color={iconColor} />
            </View>
            <Text style={[styles.title, { color: textColor }]}>SkillConnect Locked</Text>
            <Text style={[styles.subtitle, { color: subTextColor }]}>Please authenticate to continue</Text>

            <TouchableOpacity
                style={[styles.unlockButton, { backgroundColor: unlockBtnBg }]}
                onPress={onUnlock}
            >
                <Ionicons name="finger-print" size={24} color={unlockBtnText} style={{ marginRight: 8 }} />
                <Text style={[styles.unlockButtonText, { color: unlockBtnText }]}>Unlock</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutLink} onPress={onSignOut}>
                <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 9999,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 40,
        textAlign: "center",
    },
    unlockButton: {
        flexDirection: "row",
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 30,
        alignItems: "center",
        marginBottom: 20,
    },
    unlockButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
    },
    signOutLink: {
        padding: 10,
    },
    signOutText: {
        fontSize: 14,
    },
});
