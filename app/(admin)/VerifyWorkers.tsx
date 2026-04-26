import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import ImageViewing from "../../components/ImageViewingWeb";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCustomAlert } from "../../components/CustomAlert";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { supabase } from "../../utils/supabase";
import { getWorkerHistory } from "../../utils/workerUtils";

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=6366f1&color=fff&name=U&bold=true";

interface VerificationRequest {
    id: string;
    user_id: string;
    aadhar_image_url: string;
    selfie_image_url: string;
    alternate_phone: string | null;
    service_areas: string[] | null;
    certifications: string | null;
    status: string;
    rejection_reason: string | null;
    created_at: string;
    profile: {
        id: string;
        full_name: string;
        avatar_url: string | null;
        email: string;
        phone: string | null;
    };
}

interface WorkerHistory {
    isFirstTime: boolean;
    previousWorkerPeriods: number;
    demotionCount: number;
    lastDemotionReason: string | null;
    lastDemotionAt: Date | null;
    previousAvgRating: number | null;
    previousTotalReviews: number;
}

type FilterStatus = "pending" | "docs_approved" | "payment_pending" | "approved" | "rejected" | "all";

export default function VerifyWorkers() {
    const { colors, mode } = useAdminTheme();
    const { showAlert, AlertComponent } = useCustomAlert();
    const [requests, setRequests] = useState<VerificationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterStatus>("pending");
    const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
    const [workerHistory, setWorkerHistory] = useState<WorkerHistory | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    // Separate processing states to avoid double loading on both buttons
    const [approvingDocs, setApprovingDocs] = useState(false);
    const [approvingPayment, setApprovingPayment] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const processing = approvingDocs || approvingPayment || rejecting;
    const [docUrls, setDocUrls] = useState<{ aadhar: string | null; selfie: string | null }>({ aadhar: null, selfie: null });
    // Image viewer state
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [imageViewerIndex, setImageViewerIndex] = useState(0);

    const fetchRequests = async () => {
        try {
            let query = supabase
                .from("worker_verification")
                .select(`
          *,
          profile:profiles!user_id(id, full_name, avatar_url, email, phone)
        `)
                .order("created_at", { ascending: false });

            if (filter !== "all") {
                if (filter === "pending") {
                    // Show both pending and payment_pending in the "Pending" tab
                    query = query.in("status", ["pending", "payment_pending"]);
                } else {
                    query = query.eq("status", filter);
                }
            }

            const { data, error } = await query;

            if (error) throw error;

            // Deduplicate by user_id, keeping the most recent one (since sorted by created_at DESC)
            const uniqueRequests = [];
            const userIds = new Set();
            for (const req of (data || [])) {
                if (!userIds.has(req.user_id)) {
                    userIds.add(req.user_id);
                    uniqueRequests.push(req);
                }
            }

            setRequests(uniqueRequests);
        } catch (error) {
            console.error("Error fetching verification requests:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRequests();
        }, [filter])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    const openRequestDetails = async (request: VerificationRequest) => {
        setSelectedRequest(request);
        setModalVisible(true);
        setDocUrls({ aadhar: null, selfie: null });

        // Fetch worker history
        const history = await getWorkerHistory(request.user_id);
        setWorkerHistory(history);

        // Fetch signed URLs for documents
        const [aadharUrl, selfieUrl] = await Promise.all([
            getStorageUrl(request.aadhar_image_url),
            getStorageUrl(request.selfie_image_url),
        ]);
        setDocUrls({ aadhar: aadharUrl, selfie: selfieUrl });
    };

    const getStorageUrl = async (path: string): Promise<string | null> => {
        if (!path) return null;
        if (path.startsWith('http')) return path; // Handle default/external URLs
        try {
            const { data, error } = await supabase.storage
                .from("verification-docs")
                .createSignedUrl(path, 3600); // 1 hour expiry
            if (error) throw error;
            return data?.signedUrl || null;
        } catch (error) {
            console.error("Error getting signed URL:", error);
            return null;
        }
    };

    const getAvatarSource = (path: string | null | undefined) => {
        if (!path) return { uri: DEFAULT_AVATAR };
        if (path.startsWith('http')) return { uri: path };
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        return { uri: data.publicUrl };
    };

    // Approve DOCUMENTS only - user must pay before becoming worker
    const handleApproveDocs = async () => {
        if (!selectedRequest) return;

        setApprovingDocs(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log("🔷 Approving documents for user:", selectedRequest.user_id);

            // Update verification status to docs_approved (waiting for payment)
            const { error: verifyError } = await supabase
                .from("worker_verification")
                .update({
                    status: "docs_approved",
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", selectedRequest.id);

            if (verifyError) {
                console.error("🔴 Verification update error:", verifyError);
                throw verifyError;
            }
            console.log("✅ Documents approved - awaiting payment");

            // Log to history
            await supabase.from("worker_status_history").insert({
                user_id: selectedRequest.user_id,
                action: "docs_approved",
                from_role: 2,
                to_role: 2, // Still a user
                reason: "Documents approved by admin - awaiting payment",
                performed_by: user?.id,
            });

            showAlert(
                "Documents Approved",
                "User's documents have been verified. They will now be prompted to pay ₹499 to become a worker.",
                "success"
            );
            setModalVisible(false);
            setSelectedRequest(null);
            fetchRequests();
        } catch (error: any) {
            console.error("🔴 Document approval error:", error);
            showAlert("Error", error.message, "error");
        } finally {
            setApprovingDocs(false);
        }
    };

    // Approve PAYMENT - makes user a worker
    const handleApprovePayment = async () => {
        if (!selectedRequest) return;

        setApprovingPayment(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log("🔷 Approving payment for user:", selectedRequest.user_id);

            // Copy selfie to avatar
            let newAvatarPath: string | null = null;
            try {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from("verification-docs")
                    .createSignedUrl(selectedRequest.selfie_image_url, 60);

                if (signedUrlError) throw signedUrlError;

                if (signedUrlData?.signedUrl) {
                    const response = await fetch(signedUrlData.signedUrl);
                    const arrayBuffer = await response.arrayBuffer();

                    const avatarPath = `${selectedRequest.user_id}/avatar.jpg`;
                    const { error: uploadError } = await supabase.storage
                        .from("avatars")
                        .upload(avatarPath, arrayBuffer, { contentType: "image/jpeg", upsert: true });

                    if (!uploadError) {
                        newAvatarPath = avatarPath;
                        console.log("✅ Avatar uploaded successfully");
                    }
                }
            } catch (avatarError) {
                console.error("🔴 Error copying selfie to avatar:", avatarError);
            }

            // Update verification status to approved
            const { error: verifyError } = await supabase
                .from("worker_verification")
                .update({
                    status: "approved",
                })
                .eq("id", selectedRequest.id);

            if (verifyError) throw verifyError;

            // Make user a worker
            const profileUpdate: any = {
                role: 1,
                is_verified: true,
                verification_tier: "verified",
            };
            if (newAvatarPath) {
                profileUpdate.avatar_url = newAvatarPath;
            }

            const { error: roleError } = await supabase
                .from("profiles")
                .update(profileUpdate)
                .eq("id", selectedRequest.user_id);

            if (roleError) throw roleError;
            console.log("✅ User is now a worker!");

            // Create or update worker subscription
            // First check if active subscription exists (since user_id is not unique in DB)
            const { data: existingSub } = await supabase
                .from('worker_subscriptions')
                .select('id')
                .eq('user_id', selectedRequest.user_id)
                .eq('is_active', true)
                .maybeSingle();

            const subscriptionData = {
                user_id: selectedRequest.user_id,
                plan_type: 'monthly',
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                base_fee: (selectedRequest as any).payment_amount || 499,
                total_fee: (selectedRequest as any).payment_amount || 499,
                fee_currency: 'INR',
                is_paid: true,
                payment_reference: (selectedRequest as any).utr_number || null,
                is_active: true
            };

            let subError;
            if (existingSub) {
                // Update existing active subscription
                const { error } = await supabase
                    .from('worker_subscriptions')
                    .update(subscriptionData)
                    .eq('id', existingSub.id);
                subError = error;
            } else {
                // Insert new subscription
                const { error } = await supabase
                    .from('worker_subscriptions')
                    .insert(subscriptionData);
                subError = error;
            }

            if (subError) {
                console.error('🟠 Subscription creation warning:', subError);
            } else {
                console.log('✅ Subscription created/updated for 30 days');
            }

            // Log to history
            await supabase.from("worker_status_history").insert({
                user_id: selectedRequest.user_id,
                action: "payment_verified",
                from_role: 2,
                to_role: 1,
                reason: `Payment verified (UTR: ${(selectedRequest as any).utr_number || 'N/A'})`,
                performed_by: user?.id,
            });

            showAlert("Success", "Payment verified! User is now a worker.", "success");
            setModalVisible(false);
            setSelectedRequest(null);
            fetchRequests();
        } catch (error: any) {
            console.error("🔴 Payment approval error:", error);
            showAlert("Error", error.message, "error");
        } finally {
            setApprovingPayment(false);
        }
    };

    const handleReject = () => {
        setRejectReason("");
        setRejectionModalVisible(true);
    };

    const confirmReject = async () => {
        if (!selectedRequest) return;
        if (!rejectReason.trim()) {
            showAlert("Required", "Please provide a rejection reason.", "error");
            return;
        }

        try {
            setRejecting(true);
            const { error } = await supabase
                .from("worker_verification")
                .update({
                    status: "rejected",
                    rejection_reason: rejectReason,
                })
                .eq("id", selectedRequest.id);

            if (error) throw error;

            // ... (rest of logic tailored for rejection)
            // Ideally we should check if we need to insert into history individually if logic differs
            // For now assuming same history insertion as before

            await supabase.from("worker_status_history").insert({
                user_id: selectedRequest.user_id,
                action: "verification_rejected",
                from_role: 2,
                to_role: 2,
                reason: rejectReason,
                performed_by: (await supabase.auth.getUser()).data.user?.id
            });

            showAlert("Excluded", "Worker verification request rejected.", "success");
            setRejectionModalVisible(false);
            setModalVisible(false);
            setSelectedRequest(null);
            setRejectReason("");
            fetchRequests();
        } catch (error: any) {
            console.error("Error rejecting:", error);
            showAlert("Error", error.message, "error");
        } finally {
            setRejecting(false);
        }
    };


    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const FilterChip = ({ status, label }: { status: FilterStatus; label: string }) => (
        <Pressable
            style={[
                styles.filterChip,
                { backgroundColor: filter === status ? colors.text : colors.card },
                filter !== status && { borderWidth: 1, borderColor: colors.border }
            ]}
            onPress={() => setFilter(status)}
        >
            <Text style={[styles.filterText, { color: filter === status ? colors.background : colors.textSecondary }]}>
                {label}
            </Text>
        </Pressable>
    );

    const renderRequestCard = (request: VerificationRequest) => (
        <Pressable
            key={request.id}
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => openRequestDetails(request)}
        >
            <View style={styles.cardHeader}>
                <Image
                    source={getAvatarSource(request.profile?.avatar_url)}
                    style={styles.avatar}
                    contentFit="cover"
                />
                <View style={styles.cardInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                        {request.profile?.full_name || "Unknown"}
                    </Text>
                    <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                        {request.profile?.email}
                    </Text>
                </View>
                <View
                    style={[
                        styles.statusBadge,
                        {
                            backgroundColor:
                                request.status === "pending"
                                    ? colors.warning + "20"
                                    : request.status === "approved"
                                        ? colors.success + "20"
                                        : colors.danger + "20",
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            {
                                color:
                                    request.status === "pending"
                                        ? colors.warning
                                        : request.status === "approved"
                                            ? colors.success
                                            : colors.danger,
                            },
                        ]}
                    >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                </View>
            </View>
            <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {formatDate(request.created_at)}
                    </Text>
                </View>
                {request.alternate_phone && (
                    <View style={styles.metaItem}>
                        <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {request.alternate_phone}
                        </Text>
                    </View>
                )}
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.headerContainer, {
                paddingTop: 10, // Safe area is handled by SafeAreaView 
                backgroundColor: colors.headerBg,
                shadowColor: mode === 'dark' ? '#000' : '#ccc'
            }]}>
                <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Workers</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {requests.filter((r) => ["pending", "payment_pending"].includes(r.status)).length} pending requests
                    </Text>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    <FilterChip status="pending" label="Pending" />
                    <FilterChip status="docs_approved" label="Docs Approved" />
                    <FilterChip status="approved" label="Approved" />
                    <FilterChip status="rejected" label="Rejected" />
                    <FilterChip status="all" label="All" />
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : requests.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="checkmark-circle-outline" size={60} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No {filter !== "all" ? filter : ""} verification requests
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                >
                    {requests.map(renderRequestCard)}
                </ScrollView>
            )}

            {/* Detail Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Verification Details
                                </Text>
                                <Pressable onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </Pressable>
                            </View>

                            {selectedRequest && (
                                <>
                                    {/* User Info */}
                                    <View style={[styles.section, { borderColor: colors.border }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                            Applicant Info
                                        </Text>
                                        <Text style={[styles.detailText, { color: colors.text }]}>
                                            Name: {selectedRequest.profile?.full_name}
                                        </Text>
                                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                            Email: {selectedRequest.profile?.email}
                                        </Text>
                                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                            Phone: {selectedRequest.profile?.phone || "N/A"}
                                        </Text>
                                        {selectedRequest.alternate_phone && (
                                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                                Alt Phone: {selectedRequest.alternate_phone}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Worker History */}
                                    <View style={[styles.section, { borderColor: colors.border }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                            📊 Applicant History
                                        </Text>
                                        {workerHistory ? (
                                            <>
                                                <Text style={[styles.detailText, { color: colors.text }]}>
                                                    First time applicant: {workerHistory.isFirstTime ? "✅ Yes" : "❌ No"}
                                                </Text>
                                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                                    Previous worker periods: {workerHistory.previousWorkerPeriods}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.detailText,
                                                        {
                                                            color:
                                                                workerHistory.demotionCount > 0 ? colors.danger : colors.textSecondary,
                                                        },
                                                    ]}
                                                >
                                                    Times demoted: {workerHistory.demotionCount}
                                                </Text>
                                                {workerHistory.lastDemotionReason && (
                                                    <Text style={[styles.detailText, { color: colors.danger }]}>
                                                        Last demotion: {workerHistory.lastDemotionReason}
                                                    </Text>
                                                )}
                                                {workerHistory.lastDemotionAt && (
                                                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                                        Demotion date: {formatDate(workerHistory.lastDemotionAt.toISOString())}
                                                    </Text>
                                                )}
                                                {workerHistory.previousAvgRating !== null && (
                                                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                                        Previous avg rating: {workerHistory.previousAvgRating} ⭐
                                                    </Text>
                                                )}
                                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                                    Previous total reviews: {workerHistory.previousTotalReviews}
                                                </Text>
                                            </>
                                        ) : (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        )}
                                    </View>

                                    {/* Service Areas */}
                                    {selectedRequest.service_areas && selectedRequest.service_areas.length > 0 && (
                                        <View style={[styles.section, { borderColor: colors.border }]}>
                                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Areas</Text>
                                            <View style={styles.tagsRow}>
                                                {selectedRequest.service_areas.map((area, idx) => (
                                                    <View key={idx} style={[styles.tag, { backgroundColor: colors.iconBg }]}>
                                                        <Text style={{ color: colors.text }}>{area}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Certifications */}
                                    {selectedRequest.certifications && (
                                        <View style={[styles.section, { borderColor: colors.border }]}>
                                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Certifications</Text>
                                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                                {selectedRequest.certifications}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Documents */}
                                    <View style={[styles.section, { borderColor: colors.border }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents</Text>
                                        <View style={styles.docsRow}>
                                            <View style={styles.docItem}>
                                                <Text style={[styles.docLabel, { color: colors.textSecondary }]}>
                                                    Aadhar Card
                                                </Text>
                                                {docUrls.aadhar ? (
                                                    <Pressable onPress={() => {
                                                        setImageViewerIndex(0);
                                                        setImageViewerVisible(true);
                                                    }}>
                                                        <Image
                                                            source={{ uri: docUrls.aadhar }}
                                                            style={styles.docImage}
                                                            contentFit="cover"
                                                        />
                                                    </Pressable>
                                                ) : (
                                                    <View style={[styles.docImage, styles.docLoading]}>
                                                        <ActivityIndicator color={colors.primary} />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.docItem}>
                                                <Text style={[styles.docLabel, { color: colors.textSecondary }]}>
                                                    Selfie
                                                </Text>
                                                {docUrls.selfie ? (
                                                    <Pressable onPress={() => {
                                                        // If aadhar exists, selfie is at index 1, otherwise 0
                                                        setImageViewerIndex(docUrls.aadhar ? 1 : 0);
                                                        setImageViewerVisible(true);
                                                    }}>
                                                        <Image
                                                            source={{ uri: docUrls.selfie }}
                                                            style={styles.docImage}
                                                            contentFit="cover"
                                                        />
                                                    </Pressable>
                                                ) : (
                                                    <View style={[styles.docImage, styles.docLoading]}>
                                                        <ActivityIndicator color={colors.primary} />
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    {/* Actions - Document Approval (for pending) */}
                                    {selectedRequest.status === "pending" && (
                                        <View style={[styles.section, { borderColor: colors.border }]}>
                                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Document Review</Text>

                                            <View style={styles.actionsRow}>
                                                <Pressable
                                                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                                                    onPress={handleApproveDocs}
                                                    disabled={processing}
                                                >
                                                    {approvingDocs ? (
                                                        <ActivityIndicator color="#fff" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="document-text" size={18} color="#fff" />
                                                            <Text style={styles.actionBtnText}>Approve Docs</Text>
                                                        </>
                                                    )}
                                                </Pressable>
                                                <Pressable
                                                    style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                                                    onPress={handleReject}
                                                    disabled={processing}
                                                >
                                                    {rejecting ? (
                                                        <ActivityIndicator color="#fff" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="close-circle" size={18} color="#fff" />
                                                            <Text style={styles.actionBtnText}>Reject</Text>
                                                        </>
                                                    )}
                                                </Pressable>
                                            </View>
                                        </View>
                                    )}

                                    {/* Payment Verification (for payment_pending) */}
                                    {selectedRequest.status === "payment_pending" && (
                                        <View style={[styles.section, { borderColor: colors.primary }]}>
                                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Verification</Text>

                                            <View style={styles.utrContainer}>
                                                <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>UTR Number</Text>
                                                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", letterSpacing: 1 }}>
                                                    {(selectedRequest as any).utr_number || "Not provided"}
                                                </Text>
                                                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                                                    Amount: ₹{(selectedRequest as any).payment_amount || 499}
                                                </Text>
                                            </View>

                                            <View style={styles.actionsRow}>
                                                <Pressable
                                                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                                                    onPress={handleApprovePayment}
                                                    disabled={processing}
                                                >
                                                    {approvingPayment ? (
                                                        <ActivityIndicator color="#fff" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                                            <Text style={styles.actionBtnText}>Verify Payment</Text>
                                                        </>
                                                    )}
                                                </Pressable>
                                                <Pressable
                                                    style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                                                    onPress={handleReject}
                                                    disabled={processing}
                                                >
                                                    {rejecting ? (
                                                        <ActivityIndicator color="#fff" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="close-circle" size={18} color="#fff" />
                                                            <Text style={styles.actionBtnText}>Reject</Text>
                                                        </>
                                                    )}
                                                </Pressable>
                                            </View>
                                        </View>
                                    )}

                                    {/* Docs Approved - Waiting for Payment */}
                                    {selectedRequest.status === "docs_approved" && (
                                        <View style={[styles.section, { borderColor: colors.warning }]}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                <Ionicons name="time" size={20} color={colors.warning} />
                                                <Text style={{ color: colors.warning, fontWeight: "600" }}>
                                                    Waiting for User Payment
                                                </Text>
                                            </View>
                                            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                                                Documents have been verified. User must pay ₹499 to complete registration.
                                            </Text>
                                        </View>
                                    )}

                                    {/* Rejected Reason */}
                                    {selectedRequest.status === "rejected" && selectedRequest.rejection_reason && (
                                        <View style={[styles.section, { borderColor: colors.danger }]}>
                                            <Text style={[styles.sectionTitle, { color: colors.danger }]}>
                                                Rejection Reason
                                            </Text>
                                            <Text style={[styles.detailText, { color: colors.text }]}>
                                                {selectedRequest.rejection_reason}
                                            </Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Rejection Modal */}
            <Modal visible={rejectionModalVisible} animationType="fade" transparent>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
                        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
                                Reject Request
                            </Text>
                            <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
                                Please provide a reason for rejecting this verification request.
                            </Text>

                            <TextInput
                                style={[
                                    styles.reasonInput,
                                    { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, minHeight: 100 },
                                ]}
                                placeholder="Enter rejection reason..."
                                placeholderTextColor={colors.textSecondary}
                                value={rejectReason}
                                onChangeText={setRejectReason}
                                multiline
                                autoFocus
                            />

                            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                                <Pressable
                                    style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                                    onPress={() => setRejectionModalVisible(false)}
                                    disabled={rejecting}
                                >
                                    <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={{
                                        backgroundColor: colors.danger,
                                        paddingVertical: 10,
                                        paddingHorizontal: 20,
                                        borderRadius: 8,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8
                                    }}
                                    onPress={confirmReject}
                                    disabled={rejecting}
                                >
                                    {rejecting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Text style={{ color: "#fff", fontWeight: "600" }}>Confirm Reject</Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Fullscreen Image Viewer */}
            <ImageViewing
                images={[
                    ...(docUrls.aadhar ? [{ uri: docUrls.aadhar }] : []),
                    ...(docUrls.selfie ? [{ uri: docUrls.selfie }] : []),
                ]}
                imageIndex={imageViewerIndex}
                visible={imageViewerVisible}
                onRequestClose={() => setImageViewerVisible(false)}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
            />
            <AlertComponent />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: {
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: "800",
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    filterRow: {
        gap: 10,
        paddingHorizontal: 20,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    filterText: {
        fontWeight: "600",
        fontSize: 13,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
    },
    list: { flex: 1 },
    listContent: {
        padding: 16,
        gap: 12,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 4,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: 16,
        fontWeight: "600",
    },
    userEmail: {
        fontSize: 13,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "600",
    },
    cardMeta: {
        flexDirection: "row",
        marginTop: 12,
        gap: 16,
    },
    metaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    metaText: {
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "90%",
        padding: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
    },
    section: {
        borderTopWidth: 1,
        paddingVertical: 14,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 10,
    },
    detailText: {
        fontSize: 14,
        marginBottom: 6,
    },
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    docsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },
    docItem: {
        flex: 1,
    },
    docLabel: {
        fontSize: 12,
        marginBottom: 6,
        textAlign: "center",
    },
    docImage: {
        width: "100%",
        height: 180,
        borderRadius: 10,
        backgroundColor: "#eee",
    },
    reasonInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 60,
        marginBottom: 12,
    },
    actionsRow: {
        flexDirection: "row",
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 10,
        gap: 6,
    },
    actionBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    docLoading: {
        justifyContent: "center",
        alignItems: "center",
    },
    utrContainer: {
        backgroundColor: "rgba(34, 197, 94, 0.1)", // success color with opacity
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "rgba(34, 197, 94, 0.3)",
        borderStyle: "dashed",
    },
});
