import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCustomAlert } from "../components/CustomAlert";
import { supabase } from "../utils/supabase";

type ReportType = "fraud" | "harassment" | "spam" | "fake_profile" | "other";

interface ReportOption {
    type: ReportType;
    label: string;
    description: string;
    icon: string;
}

const REPORT_OPTIONS: ReportOption[] = [
    {
        type: "fraud",
        label: "Fraud / Scam",
        description: "Worker tried to scam or cheat you",
        icon: "warning",
    },
    {
        type: "harassment",
        label: "Harassment",
        description: "Abusive or threatening behavior",
        icon: "hand-left",
    },
    {
        type: "spam",
        label: "Spam / Fake Service",
        description: "Not providing actual service",
        icon: "mail-unread",
    },
    {
        type: "fake_profile",
        label: "Fake Profile",
        description: "Profile information is false",
        icon: "person-remove",
    },
    {
        type: "other",
        label: "Other Issue",
        description: "Something else not listed above",
        icon: "ellipsis-horizontal-circle",
    },
];

export default function ReportUser() {
    const router = useRouter();
    const { userId, userName } = useLocalSearchParams<{ userId: string; userName: string }>();
    const { showAlert, AlertComponent } = useCustomAlert();

    const [selectedType, setSelectedType] = useState<ReportType | null>(null);
    const [details, setDetails] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedType) {
            showAlert("Error", "Please select a report type", "error");
            return;
        }

        if (details.length < 20) {
            showAlert("Error", "Please provide more details (at least 20 characters)", "error");
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Insert into issues table for admin Issue Center
            const { error } = await supabase.from("issues").insert({
                reporter_id: user.id,
                reported_user_id: userId, // The worker being reported
                type: REPORT_OPTIONS.find(o => o.type === selectedType)?.label || selectedType,
                priority: selectedType === "fraud" || selectedType === "harassment" ? "urgent" : "normal",
                status: "open",
                description: `Reported User: ${userName} (${userId})\nReport Type: ${selectedType}\n\nDetails:\n${details}`,
            });

            if (error) throw error;

            showAlert(
                "Report Submitted",
                "Thank you for your report. Our team will review it and take appropriate action.",
                "success",
                { buttonText: "OK", onConfirm: () => router.back() }
            );
        } catch (error: any) {
            showAlert("Error", error.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </Pressable>
                <Text style={styles.headerTitle}>Report User</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#3b82f6" />
                    <Text style={styles.infoText}>
                        Reporting <Text style={styles.userName}>{userName}</Text>. Please select the issue type and provide details.
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>What's the issue?</Text>

                {REPORT_OPTIONS.map((option) => (
                    <Pressable
                        key={option.type}
                        style={[
                            styles.optionCard,
                            selectedType === option.type && styles.optionCardSelected,
                        ]}
                        onPress={() => setSelectedType(option.type)}
                    >
                        <View style={[
                            styles.optionIcon,
                            selectedType === option.type && styles.optionIconSelected,
                        ]}>
                            <Ionicons
                                name={option.icon as any}
                                size={22}
                                color={selectedType === option.type ? "#fff" : "#64748b"}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[
                                styles.optionLabel,
                                selectedType === option.type && styles.optionLabelSelected,
                            ]}>
                                {option.label}
                            </Text>
                            <Text style={styles.optionDescription}>{option.description}</Text>
                        </View>
                        {selectedType === option.type && (
                            <Ionicons name="checkmark-circle" size={24} color="#4f46e5" />
                        )}
                    </Pressable>
                ))}

                <Text style={styles.sectionTitle}>Provide Details</Text>
                <Text style={styles.requirement}>
                    Minimum 20 characters required
                </Text>
                <TextInput
                    style={[
                        styles.textArea,
                        details.length > 0 && details.length < 20 && styles.textAreaError,
                        details.length >= 20 && styles.textAreaValid,
                    ]}
                    placeholder="Please describe what happened in detail. Include dates, times, and any evidence if available..."
                    placeholderTextColor="#94a3b8"
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                />
                <Text style={[
                    styles.charCount,
                    details.length > 0 && details.length < 20 && styles.charCountError,
                    details.length >= 20 && styles.charCountValid,
                ]}>
                    {details.length}/500 {details.length > 0 && details.length < 20 ? `(${20 - details.length} more needed)` : details.length >= 20 ? "✓" : ""}
                </Text>

                <Pressable
                    style={[
                        styles.submitButton,
                        (!selectedType || details.length < 20 || submitting) && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!selectedType || details.length < 20 || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="flag" size={20} color="#fff" />
                            <Text style={styles.submitButtonText}>Submit Report</Text>
                        </>
                    )}
                </Pressable>

                <View style={styles.disclaimer}>
                    <Text style={styles.disclaimerText}>
                        False reports may result in action against your account. All reports are reviewed by our team.
                    </Text>
                </View>
            </ScrollView>
            <AlertComponent />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8fafc" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        backgroundColor: "#fff",
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
    content: { flex: 1, padding: 20 },
    infoBox: {
        flexDirection: "row",
        backgroundColor: "#eff6ff",
        padding: 14,
        borderRadius: 12,
        gap: 10,
        marginBottom: 24,
    },
    infoText: { flex: 1, fontSize: 14, color: "#3b82f6", lineHeight: 20 },
    userName: { fontWeight: "700" },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: 12,
    },
    optionCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 2,
        borderColor: "#e2e8f0",
        gap: 12,
    },
    optionCardSelected: {
        borderColor: "#4f46e5",
        backgroundColor: "#f5f3ff",
    },
    optionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "#f1f5f9",
        justifyContent: "center",
        alignItems: "center",
    },
    optionIconSelected: {
        backgroundColor: "#4f46e5",
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1e293b",
    },
    optionLabelSelected: {
        color: "#4f46e5",
    },
    optionDescription: {
        fontSize: 13,
        color: "#64748b",
        marginTop: 2,
    },
    textArea: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: "#1e293b",
        minHeight: 120,
        marginTop: 8,
    },
    charCount: {
        textAlign: "right",
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 4,
        marginBottom: 20,
    },
    submitButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ef4444",
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    disclaimer: {
        marginTop: 20,
        marginBottom: 40,
    },
    disclaimerText: {
        fontSize: 12,
        color: "#94a3b8",
        textAlign: "center",
        lineHeight: 18,
    },
    requirement: {
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 4,
        marginBottom: 4,
    },
    textAreaError: {
        borderColor: "#ef4444",
        borderWidth: 2,
    },
    textAreaValid: {
        borderColor: "#22c55e",
        borderWidth: 2,
    },
    charCountError: {
        color: "#ef4444",
        fontWeight: "600",
    },
    charCountValid: {
        color: "#22c55e",
        fontWeight: "600",
    },
});
