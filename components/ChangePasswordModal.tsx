import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useAdminTheme } from "../context/AdminThemeContext";
import { supabase } from "../utils/supabase";

interface ChangePasswordModalProps {
    visible: boolean;
    onClose: () => void;
    userEmail: string | undefined;
}

export default function ChangePasswordModal({
    visible,
    onClose,
    userEmail,
}: ChangePasswordModalProps) {
    const [step, setStep] = useState<"initial" | "verify">("initial");
    const [loading, setLoading] = useState(false);
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const { colors } = useAdminTheme();

    const resetState = () => {
        setStep("initial");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
        setErrorMessage("");
        setSuccessMessage("");
        setLoading(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSendOtp = async () => {
        if (!userEmail) {
            setErrorMessage("User email not found.");
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(userEmail);

            if (error) {
                setErrorMessage(error.message);
            } else {
                setStep("verify");
                setSuccessMessage("OTP sent to your email.");
            }
        } catch (err) {
            setErrorMessage("An unexpected error occurred.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!otp || otp.length !== 6) {
            setErrorMessage("Please enter a valid 6-digit OTP.");
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setErrorMessage("Password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setErrorMessage("Passwords do not match.");
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            // 1. Verify OTP
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email: userEmail!,
                token: otp,
                type: "recovery",
            });

            if (verifyError) {
                setErrorMessage(verifyError.message);
                setLoading(false);
                return;
            }

            if (data.session) {
                // 2. Update Password
                const { error: updateError } = await supabase.auth.updateUser({
                    password: newPassword,
                });

                if (updateError) {
                    setErrorMessage(updateError.message);
                } else {
                    setSuccessMessage("Password verified! Logging out...");

                    // 3. Logout after delay
                    setTimeout(async () => {
                        await supabase.auth.signOut();
                        handleClose();
                    }, 1500);
                }
            }
        } catch (err) {
            setErrorMessage("Failed to reset password.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.card }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Change Password</Text>

                    {errorMessage ? (
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}
                    {successMessage ? (
                        <Text style={styles.successText}>{successMessage}</Text>
                    ) : null}

                    {step === "initial" ? (
                        <>
                            <Text style={[styles.description, { color: colors.text }]}>
                                To change your password, we need to verify it's you. Click below to receive a One-Time Password (OTP) at{" "}
                                <Text style={{ fontWeight: "700", color: colors.text }}>{userEmail}</Text>.
                            </Text>

                            <View style={styles.buttonContainer}>
                                <Pressable
                                    style={[styles.button, styles.cancelButton, { backgroundColor: colors.background }]}
                                    onPress={handleClose}
                                    disabled={loading}
                                >
                                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.button, styles.primaryButton]}
                                    onPress={handleSendOtp}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Send OTP</Text>
                                    )}
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>OTP Code</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    placeholder="000000"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                    maxLength={6}
                                    value={otp}
                                    onChangeText={setOtp}
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>New Password</Text>
                                <View style={[styles.passwordContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <TextInput
                                        style={[styles.passwordInput, { color: colors.text }]}
                                        placeholder="New Password"
                                        placeholderTextColor="#999"
                                        secureTextEntry={!showPassword}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        editable={!loading}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-off" : "eye"}
                                            size={20}
                                            color={colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
                                <View style={[styles.passwordContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <TextInput
                                        style={[styles.passwordInput, { color: colors.text }]}
                                        placeholder="Confirm Password"
                                        placeholderTextColor="#999"
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        editable={!loading}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? "eye-off" : "eye"}
                                            size={20}
                                            color={colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.buttonContainer}>
                                <Pressable
                                    style={[styles.button, styles.cancelButton, { backgroundColor: colors.background }]}
                                    onPress={handleClose}
                                    disabled={loading}
                                >
                                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.button, styles.primaryButton]}
                                    onPress={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Reset Password</Text>
                                    )}
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        padding: 20,
    },
    container: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        color: "#1A1A1A",
        marginBottom: 16,
        textAlign: "center",
    },
    description: {
        fontSize: 14,
        color: "#555",
        marginBottom: 24,
        textAlign: "center",
        lineHeight: 20,
    },
    errorText: {
        color: "#ef4444",
        fontSize: 14,
        marginBottom: 16,
        textAlign: "center",
        fontWeight: "500",
    },
    successText: {
        color: "#22c55e",
        fontSize: 14,
        marginBottom: 16,
        textAlign: "center",
        fontWeight: "500",
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        marginBottom: 6,
        textTransform: "uppercase",
    },
    input: {
        backgroundColor: "#f9fafb",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: "#1f2937",
    },
    passwordContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f9fafb",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
    },
    passwordInput: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        color: "#1f2937",
    },
    eyeButton: {
        padding: 12,
    },
    buttonContainer: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    cancelButton: {
        backgroundColor: "#f3f4f6",
    },
    cancelButtonText: {
        color: "#4b5563",
        fontWeight: "600",
        fontSize: 16,
    },
    primaryButton: {
        backgroundColor: "#0ea5e9", // Sky blueish
    },
    primaryButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
});
