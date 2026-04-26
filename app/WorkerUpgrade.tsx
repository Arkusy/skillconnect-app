import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
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
import { calculateReupgradeFee, wasPreviouslyDemoted } from "../utils/workerUtils";

const { width } = Dimensions.get("window");

type Step = "info" | "aadhar" | "selfie" | "review" | "status";

interface FormData {
    alternatePhone: string;
    serviceAreas: string;
    certifications: string;
    aadharPhoto: string | null;
    selfiePhoto: string | null;
}

export default function WorkerUpgrade() {
    const router = useRouter();
    const cameraRef = useRef<any>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const { showAlert, AlertComponent } = useCustomAlert();

    const [currentStep, setCurrentStep] = useState<Step>("info");
    const [formData, setFormData] = useState<FormData>({
        alternatePhone: "",
        serviceAreas: "",
        certifications: "",
        aadharPhoto: null,
        selfiePhoto: null,
    });
    const [submitting, setSubmitting] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
    const [isReupgrade, setIsReupgrade] = useState(false);
    const [reupgradeFee, setReupgradeFee] = useState(0);

    // Check if user was previously demoted
    React.useEffect(() => {
        const checkDemotionStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const wasDemoted = await wasPreviouslyDemoted(user.id);
                setIsReupgrade(wasDemoted);
                if (wasDemoted) {
                    const fee = calculateReupgradeFee();
                    setReupgradeFee(fee.totalFee);
                }

                // Check if there's already a pending verification
                const { data: existingVerification } = await supabase
                    .from("worker_verification")
                    .select("status")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                if (existingVerification) {
                    setVerificationStatus(existingVerification.status as any);
                    if (existingVerification.status === "pending") {
                        setCurrentStep("status");
                    }
                }
            }
        };
        checkDemotionStatus();
    }, []);

    const handleTakePhoto = async () => {
        if (!cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
            });

            if (currentStep === "aadhar") {
                setFormData({ ...formData, aadharPhoto: photo.uri });
            } else if (currentStep === "selfie") {
                setFormData({ ...formData, selfiePhoto: photo.uri });
            }
        } catch (error) {
            console.error("Error taking photo:", error);
            showAlert("Error", "Failed to capture photo. Please try again.", "error");
        }
    };

    const uploadImage = async (uri: string, folder: string): Promise<string | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // Read image as base64
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            // Decode base64 to Uint8Array for upload
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const fileName = `${user.id}/${folder}_${Date.now()}.jpg`;

            const { error } = await supabase.storage
                .from("verification-docs")
                .upload(fileName, bytes, { contentType: "image/jpeg", upsert: true });

            if (error) throw error;
            return fileName;
        } catch (error) {
            console.error("Upload error:", error);
            return null;
        }
    };

    const handleSubmit = async () => {
        if (!formData.aadharPhoto || !formData.selfiePhoto) {
            showAlert("Error", "Please capture both Aadhar card and selfie photos", "error");
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Upload images
            const aadharPath = await uploadImage(formData.aadharPhoto, "aadhar");
            const selfiePath = await uploadImage(formData.selfiePhoto, "selfie");

            if (!aadharPath || !selfiePath) {
                throw new Error("Failed to upload images");
            }

            // Create verification request
            const { error } = await supabase.from("worker_verification").insert({
                user_id: user.id,
                aadhar_image_url: aadharPath,
                selfie_image_url: selfiePath,
                alternate_phone: formData.alternatePhone || null,
                service_areas: formData.serviceAreas ? formData.serviceAreas.split(",").map(s => s.trim()) : [],
                certifications: formData.certifications || null,
                status: "pending",
            });

            if (error) throw error;

            // Update profile verification tier
            await supabase
                .from("profiles")
                .update({ verification_tier: "pending" })
                .eq("id", user.id);

            setVerificationStatus("pending");
            setCurrentStep("status");
        } catch (error: any) {
            showAlert("Error", error.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const renderInfoStep = () => (
        <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Worker Information</Text>
            <Text style={styles.stepSubtitle}>
                Tell us about yourself to help customers find you
            </Text>

            {isReupgrade && (
                <View style={styles.reupgradeNotice}>
                    <Ionicons name="warning" size={20} color="#f59e0b" />
                    <Text style={styles.reupgradeText}>
                        Re-upgrade fee: ₹{reupgradeFee} (due after approval)
                    </Text>
                </View>
            )}

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Alternate Phone (Optional)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g., 9876543210"
                    placeholderTextColor="#999"
                    value={formData.alternatePhone}
                    onChangeText={(text) => setFormData({ ...formData, alternatePhone: text })}
                    keyboardType="phone-pad"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Areas</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g., Andheri, Bandra, Juhu"
                    placeholderTextColor="#999"
                    value={formData.serviceAreas}
                    onChangeText={(text) => setFormData({ ...formData, serviceAreas: text })}
                />
                <Text style={styles.inputHint}>Separate areas with commas</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Certifications (Optional)</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="List any relevant certifications or training..."
                    placeholderTextColor="#999"
                    value={formData.certifications}
                    onChangeText={(text) => setFormData({ ...formData, certifications: text })}
                    multiline
                    numberOfLines={3}
                />
            </View>

            <Pressable style={styles.nextButton} onPress={() => setCurrentStep("aadhar")}>
                <Text style={styles.nextButtonText}>Next: Aadhar Photo</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
        </ScrollView>
    );

    const renderCameraStep = (type: "aadhar" | "selfie") => {
        const isAadhar = type === "aadhar";
        const capturedPhoto = isAadhar ? formData.aadharPhoto : formData.selfiePhoto;
        const facing = isAadhar ? "back" : "front";

        if (!permission) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#4f46e5" />
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View style={styles.centerContainer}>
                    <Ionicons name="camera-outline" size={60} color="#999" />
                    <Text style={styles.permissionText}>Camera permission required</Text>
                    <Pressable style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </Pressable>
                </View>
            );
        }

        return (
            <View style={styles.cameraContainer}>
                <View style={styles.cameraHeader}>
                    <Pressable onPress={() => setCurrentStep(isAadhar ? "info" : "aadhar")}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.cameraTitle}>
                        {isAadhar ? "Capture Aadhar Card" : "Capture Selfie"}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {!capturedPhoto ? (
                    <>
                        <View style={styles.cameraWrapper}>
                            <CameraView
                                ref={cameraRef}
                                style={styles.camera}
                                facing={facing}
                            >
                                <View style={styles.cameraOverlay}>
                                    {isAadhar ? (
                                        <View style={styles.aadharFrame}>
                                            <Text style={styles.frameText}>Position Aadhar card here</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.selfieFrame}>
                                            <Text style={styles.frameText}>Position your face here</Text>
                                        </View>
                                    )}
                                </View>
                            </CameraView>
                        </View>
                        <Text style={styles.cameraHint}>
                            {isAadhar
                                ? "Use back camera to capture your Aadhar card clearly"
                                : "Use front camera for a clear selfie"}
                        </Text>
                        <Pressable style={styles.captureButton} onPress={handleTakePhoto}>
                            <View style={styles.captureInner} />
                        </Pressable>
                    </>
                ) : (
                    <>
                        <View style={styles.previewContainer}>
                            <Image source={{ uri: capturedPhoto }} style={styles.previewImage} contentFit="contain" />
                        </View>
                        <View style={styles.previewActions}>
                            <Pressable
                                style={styles.retakeButton}
                                onPress={() => {
                                    if (isAadhar) {
                                        setFormData({ ...formData, aadharPhoto: null });
                                    } else {
                                        setFormData({ ...formData, selfiePhoto: null });
                                    }
                                }}
                            >
                                <Ionicons name="refresh" size={20} color="#fff" />
                                <Text style={styles.retakeText}>Retake</Text>
                            </Pressable>
                            <Pressable
                                style={styles.confirmButton}
                                onPress={() => {
                                    if (isAadhar) {
                                        setCurrentStep("selfie");
                                    } else {
                                        setCurrentStep("review");
                                    }
                                }}
                            >
                                <Ionicons name="checkmark" size={20} color="#fff" />
                                <Text style={styles.confirmText}>Confirm</Text>
                            </Pressable>
                        </View>
                    </>
                )}
            </View>
        );
    };

    const renderReviewStep = () => (
        <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Review & Submit</Text>
            <Text style={styles.stepSubtitle}>Please verify all information is correct</Text>

            <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Service Areas</Text>
                <Text style={styles.reviewValue}>{formData.serviceAreas || "Not specified"}</Text>
            </View>

            {formData.alternatePhone && (
                <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Alternate Phone</Text>
                    <Text style={styles.reviewValue}>{formData.alternatePhone}</Text>
                </View>
            )}

            {formData.certifications && (
                <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Certifications</Text>
                    <Text style={styles.reviewValue}>{formData.certifications}</Text>
                </View>
            )}

            <View style={styles.photosRow}>
                <View style={styles.photoPreview}>
                    <Text style={styles.photoLabel}>Aadhar Card</Text>
                    <Image source={{ uri: formData.aadharPhoto! }} style={styles.reviewPhoto} contentFit="cover" />
                </View>
                <View style={styles.photoPreview}>
                    <Text style={styles.photoLabel}>Selfie</Text>
                    <Image source={{ uri: formData.selfiePhoto! }} style={styles.reviewPhoto} contentFit="cover" />
                </View>
            </View>

            {isReupgrade && (
                <View style={styles.feeBox}>
                    <Text style={styles.feeLabel}>Re-upgrade Fee</Text>
                    <Text style={styles.feeValue}>₹{reupgradeFee}</Text>
                    <Text style={styles.feeNote}>Payment required after admin approval</Text>
                </View>
            )}

            <View style={styles.termsBox}>
                <Ionicons name="information-circle" size={20} color="#4f46e5" />
                <Text style={styles.termsText}>
                    By submitting, you confirm all information is accurate and agree to our worker terms.
                </Text>
            </View>

            <Pressable
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Text style={styles.submitButtonText}>Submit for Verification</Text>
                        <Ionicons name="shield-checkmark" size={20} color="#fff" />
                    </>
                )}
            </Pressable>

            <Pressable style={styles.backLink} onPress={() => setCurrentStep("selfie")}>
                <Ionicons name="arrow-back" size={18} color="#4f46e5" />
                <Text style={styles.backLinkText}>Back to Selfie</Text>
            </Pressable>
        </ScrollView>
    );

    const renderStatusStep = () => (
        <View style={styles.statusContainer}>
            {verificationStatus === "pending" ? (
                <>
                    <View style={styles.statusIconBox}>
                        <Ionicons name="time" size={60} color="#f59e0b" />
                    </View>
                    <Text style={styles.statusTitle}>Verification Pending</Text>
                    <Text style={styles.statusText}>
                        Your application is being reviewed by our admin team. This usually takes 24-48 hours.
                    </Text>
                    <Text style={styles.statusHint}>
                        You'll receive a notification once your application is processed.
                    </Text>
                </>
            ) : verificationStatus === "approved" ? (
                <>
                    <View style={[styles.statusIconBox, { backgroundColor: "#dcfce7" }]}>
                        <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
                    </View>
                    <Text style={styles.statusTitle}>
                        {isReupgrade ? "Verification Approved!" : "Congratulations!"}
                    </Text>
                    <Text style={styles.statusText}>
                        {isReupgrade
                            ? "Your re-upgrade request has been approved. Complete payment to activate your worker account."
                            : "You're now a verified worker. Start receiving service requests today!"
                        }
                    </Text>

                    {isReupgrade && (
                        <Pressable
                            style={styles.paymentButton}
                            onPress={() => router.push({
                                pathname: "/PaymentScreen",
                                params: { amount: reupgradeFee.toString(), type: "reupgrade" }
                            })}
                        >
                            <Ionicons name="card" size={20} color="#fff" />
                            <Text style={styles.paymentButtonText}>Pay ₹{reupgradeFee} to Activate</Text>
                        </Pressable>
                    )}
                </>
            ) : (
                <>
                    <View style={[styles.statusIconBox, { backgroundColor: "#fee2e2" }]}>
                        <Ionicons name="close-circle" size={60} color="#ef4444" />
                    </View>
                    <Text style={styles.statusTitle}>Verification Rejected</Text>
                    <Text style={styles.statusText}>
                        Please check your documents and try again. Make sure your photos are clear and readable.
                    </Text>
                </>
            )}

            <Pressable style={styles.homeButton} onPress={() => router.back()}>
                <Text style={styles.homeButtonText}>Back to Account</Text>
            </Pressable>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {currentStep === "info" && (
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Become a Worker</Text>
                    <View style={{ width: 32 }} />
                </View>
            )}

            {/* Progress indicator */}
            {currentStep !== "status" && (
                <View style={styles.progressContainer}>
                    {["info", "aadhar", "selfie", "review"].map((step, idx) => (
                        <View
                            key={step}
                            style={[
                                styles.progressDot,
                                currentStep === step && styles.progressDotActive,
                                ["aadhar", "selfie", "review"].indexOf(currentStep) >= idx && styles.progressDotComplete,
                            ]}
                        />
                    ))}
                </View>
            )}

            {currentStep === "info" && renderInfoStep()}
            {currentStep === "aadhar" && renderCameraStep("aadhar")}
            {currentStep === "selfie" && renderCameraStep("selfie")}
            {currentStep === "review" && renderReviewStep()}
            {currentStep === "status" && renderStatusStep()}
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
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
    progressContainer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 16,
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#e2e8f0",
    },
    progressDotActive: { backgroundColor: "#4f46e5", transform: [{ scale: 1.2 }] },
    progressDotComplete: { backgroundColor: "#22c55e" },
    stepContainer: { flex: 1, padding: 20 },
    stepTitle: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 8 },
    stepSubtitle: { fontSize: 15, color: "#64748b", marginBottom: 24 },
    reupgradeNotice: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fef3c7",
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        gap: 8,
    },
    reupgradeText: { color: "#92400e", fontWeight: "600", flex: 1 },
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 8 },
    input: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: "#1e293b",
    },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    inputHint: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
    nextButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#4f46e5",
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        marginTop: 20,
    },
    nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
    permissionText: { fontSize: 16, color: "#64748b", marginTop: 16, marginBottom: 20 },
    permissionButton: { backgroundColor: "#4f46e5", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    permissionButtonText: { color: "#fff", fontWeight: "600" },
    cameraContainer: { flex: 1, backgroundColor: "#000" },
    cameraHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        paddingTop: 8,
    },
    cameraTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
    cameraWrapper: { flex: 1, margin: 16, borderRadius: 16, overflow: "hidden" },
    camera: { flex: 1 },
    cameraOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
    aadharFrame: {
        width: width - 64,
        height: (width - 64) * 0.63,
        borderWidth: 2,
        borderColor: "#fff",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        borderStyle: "dashed",
    },
    selfieFrame: {
        width: 200,
        height: 260,
        borderWidth: 2,
        borderColor: "#fff",
        borderRadius: 100,
        justifyContent: "center",
        alignItems: "center",
        borderStyle: "dashed",
    },
    frameText: { color: "#fff", fontSize: 14, opacity: 0.8 },
    cameraHint: { color: "#fff", textAlign: "center", fontSize: 14, opacity: 0.8, marginBottom: 16 },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "rgba(255,255,255,0.3)",
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
        marginBottom: 30,
    },
    captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
    previewContainer: { flex: 1, margin: 16 },
    previewImage: { flex: 1, borderRadius: 16 },
    previewActions: { flexDirection: "row", justifyContent: "center", gap: 20, marginBottom: 30 },
    retakeButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#64748b",
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    retakeText: { color: "#fff", fontWeight: "600" },
    confirmButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#22c55e",
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    confirmText: { color: "#fff", fontWeight: "600" },
    reviewSection: {
        backgroundColor: "#fff",
        padding: 14,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    reviewLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
    reviewValue: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
    photosRow: { flexDirection: "row", gap: 12, marginVertical: 16 },
    photoPreview: { flex: 1 },
    photoLabel: { fontSize: 12, color: "#64748b", marginBottom: 6, textAlign: "center" },
    reviewPhoto: { height: 150, borderRadius: 12, backgroundColor: "#e2e8f0" },
    feeBox: {
        backgroundColor: "#fef3c7",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        alignItems: "center",
    },
    feeLabel: { fontSize: 12, color: "#92400e" },
    feeValue: { fontSize: 28, fontWeight: "bold", color: "#92400e" },
    feeNote: { fontSize: 12, color: "#92400e", marginTop: 4 },
    termsBox: {
        flexDirection: "row",
        backgroundColor: "#eef2ff",
        padding: 14,
        borderRadius: 12,
        gap: 10,
        marginBottom: 20,
    },
    termsText: { flex: 1, fontSize: 13, color: "#4f46e5" },
    submitButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#4f46e5",
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    submitButtonDisabled: { opacity: 0.6 },
    submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    backLink: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
        gap: 6,
    },
    backLinkText: { color: "#4f46e5", fontWeight: "500" },
    statusContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
    statusIconBox: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#fef9c3",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },
    statusTitle: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 },
    statusText: { fontSize: 15, color: "#64748b", textAlign: "center", marginBottom: 8 },
    statusHint: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
    homeButton: {
        backgroundColor: "#4f46e5",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 32,
    },
    homeButtonText: { color: "#fff", fontWeight: "600" },
    paymentButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#22c55e",
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        marginTop: 20,
    },
    paymentButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
