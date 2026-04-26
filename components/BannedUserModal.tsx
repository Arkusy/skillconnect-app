// components/BannedUserModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface BannedUserModalProps {
    visible: boolean;
    isPermanent: boolean;
    daysRemaining: number | null;
    reason: string | null;
    onSignOut: () => void;
}

export default function BannedUserModal({
    visible,
    isPermanent,
    daysRemaining,
    reason,
    onSignOut,
}: BannedUserModalProps) {
    const getDurationText = () => {
        if (isPermanent) return "permanently";
        if (daysRemaining === null) return "";
        if (daysRemaining <= 0) return "until further notice";
        if (daysRemaining === 1) return "for 1 more day";
        if (daysRemaining < 30) return `for ${daysRemaining} more days`;
        const months = Math.ceil(daysRemaining / 30);
        return `for approximately ${months} ${months === 1 ? 'month' : 'months'}`;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="ban" size={60} color="#F44336" />
                    </View>

                    <Text style={styles.title}>Account Suspended</Text>

                    <Text style={styles.message}>
                        Your account has been suspended {getDurationText()}.
                    </Text>

                    {reason && (
                        <View style={styles.reasonBox}>
                            <Text style={styles.reasonLabel}>Reason:</Text>
                            <Text style={styles.reasonText}>{reason}</Text>
                        </View>
                    )}

                    <Text style={styles.contactText}>
                        If you believe this is a mistake, please contact support.
                    </Text>

                    <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
                        <Ionicons name="log-out-outline" size={20} color="#FFF" />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(244, 67, 54, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#AAA',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16,
    },
    reasonBox: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        marginBottom: 16,
    },
    reasonLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    reasonText: {
        fontSize: 14,
        color: '#DDD',
        lineHeight: 20,
    },
    contactText: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F44336',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        gap: 8,
    },
    signOutText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
