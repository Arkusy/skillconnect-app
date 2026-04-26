// components/BanDurationModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface BanDurationModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectDuration: (duration: 1 | 2 | 3 | 6 | 12 | 'permanent') => void;
    userName: string;
    colors: any;
    mode: 'light' | 'dark';
}

const DURATIONS: { label: string; value: 1 | 2 | 3 | 6 | 12 | 'permanent'; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { label: "1 Month", value: 1, icon: "time-outline", color: "#FFC107" },
    { label: "2 Months", value: 2, icon: "time-outline", color: "#FF9800" },
    { label: "3 Months", value: 3, icon: "timer-outline", color: "#FF5722" },
    { label: "6 Months", value: 6, icon: "timer-outline", color: "#E91E63" },
    { label: "12 Months", value: 12, icon: "calendar-outline", color: "#9C27B0" },
    { label: "Permanent", value: 'permanent', icon: "ban", color: "#F44336" },
];

export default function BanDurationModal({
    visible,
    onClose,
    onSelectDuration,
    userName,
    colors,
    mode
}: BanDurationModalProps) {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={[styles.content, { backgroundColor: colors.card }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Ban {userName}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Select ban duration
                    </Text>

                    <View style={styles.optionsContainer}>
                        {DURATIONS.map((duration) => (
                            <TouchableOpacity
                                key={duration.value.toString()}
                                style={[
                                    styles.option,
                                    {
                                        backgroundColor: mode === 'dark' ? colors.background : '#F5F5F5',
                                        borderColor: duration.color
                                    }
                                ]}
                                onPress={() => onSelectDuration(duration.value)}
                            >
                                <View style={[styles.iconBox, { backgroundColor: duration.color + '20' }]}>
                                    <Ionicons name={duration.icon} size={20} color={duration.color} />
                                </View>
                                <Text style={[styles.optionText, { color: colors.text }]}>
                                    {duration.label}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 20,
    },
    optionsContainer: {
        gap: 10,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 3,
        gap: 12,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 16,
        marginTop: 16,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
