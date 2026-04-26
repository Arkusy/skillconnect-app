import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, { useAnimatedRef, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCustomAlert } from "../components/CustomAlert";
import { supabase } from "../utils/supabase";

const UPI_ID = "jha0@yesg";
const PAYEE_NAME = "Santosh Yoganand Jha";

export default function PaymentScreen() {
    const router = useRouter();
    const { amount, type, subscriptionId } = useLocalSearchParams<{
        amount: string;
        type: "trial_end" | "reupgrade";
        subscriptionId?: string;
    }>();

    const [utrNumber, setUtrNumber] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const { showAlert, AlertComponent } = useCustomAlert();

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollToEnd({ animated: true });
        }
    };

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => {
                scrollToBottom();
            }
        );
        return () => showSubscription.remove();
    }, []);

    // Keyboard Handler
    const keyboardHeight = useSharedValue(0);
    useKeyboardHandler(
        {
            onMove: (e) => {
                "worklet";
                keyboardHeight.value = Math.max(e.height, 0);
            },
        },
        [keyboardHeight]
    );

    const keyboardSpacerStyle = useAnimatedStyle(() => ({
        height: keyboardHeight.value + 40,
    }));

    const paymentAmount = parseFloat(amount || "99");
    const isReupgrade = type === "reupgrade";

    const handleCopyUPI = async () => {
        await Clipboard.setStringAsync(UPI_ID);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenUPIApp = async () => {
        // UPI deep link format
        const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${paymentAmount}&cu=INR&tn=${encodeURIComponent("SkillConnect Worker Subscription")}`;

        try {
            await Linking.openURL(upiUrl);
        } catch (error) {
            console.error("Error opening UPI app:", error);
            showAlert("Error", "Could not open UPI app. Please scan the QR code manually.", "error");
        }
    };

    const handleSubmitUTR = async () => {
        if (utrNumber.length < 12) {
            showAlert("Invalid UTR", "Please enter a valid 12-digit UTR number", "error");
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Create or update subscription with UTR
            const subscriptionData = {
                user_id: user.id,
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                base_fee: isReupgrade ? 499 : 99,
                percentage_fee: isReupgrade ? 0 : 5,
                total_fee: paymentAmount,
                is_trial: false,
                is_reupgrade: isReupgrade,
                payment_status: "pending",
            };

            if (subscriptionId) {
                // Update existing subscription
                await supabase
                    .from("worker_subscriptions")
                    .update({
                        payment_status: "pending",
                        total_fee: paymentAmount,
                    })
                    .eq("id", subscriptionId);
            } else {
                // Create new subscription
                await supabase.from("worker_subscriptions").insert(subscriptionData);
            }

            // Update worker_verification with payment details
            const { error: verifyError } = await supabase
                .from("worker_verification")
                .update({
                    status: "payment_pending",
                    utr_number: utrNumber,
                    payment_amount: paymentAmount,
                    payment_submitted_at: new Date().toISOString(),
                })
                .eq("user_id", user.id)
                .in("status", ["docs_approved", "rejected", "payment_pending"]); // Allow retry if rejected or pending

            if (verifyError) {
                console.error("Verification update error:", verifyError);
                // Fallback to help ticket if no verification record found (e.g. legacy or renewal)
                await supabase.from("help").insert({
                    user_id: user.id,
                    category: "payment_verification",
                    status: "open",
                    subject: `Payment Verification (Fallback) - UTR: ${utrNumber}`,
                    message: `Payment Amount: ₹${paymentAmount}\nUTR: ${utrNumber}\nType: ${isReupgrade ? "Re-upgrade" : "Subscription"}`,
                });
            } else {
                // Log to history
                await supabase.from("worker_status_history").insert({
                    user_id: user.id,
                    action: "payment_submitted",
                    from_role: 2,
                    to_role: 2,
                    reason: `Payment submitted - UTR: ${utrNumber}`,
                });
            }

            showAlert(
                "Payment Submitted",
                "Your payment details have been submitted for verification. You'll receive a notification once verified.",
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
                <Text style={styles.headerTitle}>Complete Payment</Text>
                <View style={{ width: 32 }} />
            </View>

            <Animated.ScrollView
                ref={scrollRef}
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Amount Card */}
                <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>Amount to Pay</Text>
                    <Text style={styles.amountValue}>₹{paymentAmount.toFixed(0)}</Text>
                    <Text style={styles.amountDesc}>
                        {isReupgrade ? "Re-upgrade Fee (One-time)" : "Monthly Subscription"}
                    </Text>
                </View>

                {/* QR Code Section */}
                <View style={styles.qrSection}>
                    <Text style={styles.sectionTitle}>Scan to Pay</Text>
                    <View style={styles.qrContainer}>
                        <Image
                            source={require("../assets/images/upi.jpeg")}
                            style={styles.qrImage}
                            contentFit="contain"
                        />
                    </View>
                    <Text style={styles.payeeName}>{PAYEE_NAME}</Text>
                </View>

                {/* UPI ID Section */}
                <View style={styles.upiSection}>
                    <Text style={styles.sectionTitle}>Or Pay via UPI</Text>
                    <View style={styles.upiIdBox}>
                        <Text style={styles.upiIdLabel}>UPI ID</Text>
                        <View style={styles.upiIdRow}>
                            <Text style={styles.upiIdValue}>{UPI_ID}</Text>
                            <Pressable style={styles.copyButton} onPress={handleCopyUPI}>
                                <Ionicons
                                    name={copied ? "checkmark" : "copy-outline"}
                                    size={18}
                                    color={copied ? "#22c55e" : "#4f46e5"}
                                />
                                <Text style={[styles.copyText, copied && { color: "#22c55e" }]}>
                                    {copied ? "Copied!" : "Copy"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    <Pressable style={styles.openAppButton} onPress={handleOpenUPIApp}>
                        <Ionicons name="open-outline" size={20} color="#fff" />
                        <Text style={styles.openAppText}>Open UPI App</Text>
                    </Pressable>
                </View>

                {/* UTR Input Section */}
                <View style={styles.utrSection}>
                    <Text style={styles.sectionTitle}>Enter UTR Number</Text>
                    <Text style={styles.utrHint}>
                        After payment, enter the 12-digit UTR/Reference number from your UPI app
                    </Text>
                    <TextInput
                        style={styles.utrInput}
                        placeholder="e.g., 123456789012"
                        placeholderTextColor="#94a3b8"
                        value={utrNumber}
                        onChangeText={setUtrNumber}
                        keyboardType="numeric"
                        maxLength={22}
                    />

                    <Pressable
                        style={[
                            styles.submitButton,
                            (utrNumber.length < 12 || submitting) && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSubmitUTR}
                        disabled={utrNumber.length < 12 || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="shield-checkmark" size={20} color="#fff" />
                                <Text style={styles.submitButtonText}>Submit for Verification</Text>
                            </>
                        )}
                    </Pressable>
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#3b82f6" />
                    <Text style={styles.infoText}>
                        Your payment will be verified by our admin team within 24 hours.
                        Once verified, your worker subscription will be activated.
                    </Text>
                </View>
                {/* Spacer to push content above keyboard */}
                <Animated.View style={keyboardSpacerStyle} />
            </Animated.ScrollView>
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
    amountCard: {
        backgroundColor: "#4f46e5",
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        marginBottom: 24,
    },
    amountLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
    amountValue: { fontSize: 42, fontWeight: "bold", color: "#fff", marginVertical: 4 },
    amountDesc: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: 12,
        textAlign: "center",
    },
    qrSection: { marginBottom: 24 },
    qrContainer: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    qrImage: { width: 220, height: 220 },
    payeeName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1e293b",
        textAlign: "center",
        marginTop: 12,
    },
    upiSection: { marginBottom: 24 },
    upiIdBox: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        marginBottom: 12,
    },
    upiIdLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
    upiIdRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    upiIdValue: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
    copyButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "#eef2ff",
    },
    copyText: { fontSize: 13, fontWeight: "600", color: "#4f46e5" },
    openAppButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#22c55e",
        paddingVertical: 14,
        borderRadius: 12,
    },
    openAppText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    utrSection: { marginBottom: 24 },
    utrHint: {
        fontSize: 13,
        color: "#64748b",
        marginBottom: 12,
        textAlign: "center",
    },
    utrInput: {
        backgroundColor: "#fff",
        borderWidth: 2,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        padding: 14,
        fontSize: 18,
        color: "#1e293b",
        textAlign: "center",
        letterSpacing: 2,
        marginBottom: 16,
    },
    submitButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#4f46e5",
        paddingVertical: 16,
        borderRadius: 12,
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    infoBox: {
        flexDirection: "row",
        backgroundColor: "#eff6ff",
        padding: 14,
        borderRadius: 12,
        gap: 10,
        marginBottom: 40,
    },
    infoText: { flex: 1, fontSize: 13, color: "#3b82f6", lineHeight: 18 },
});
