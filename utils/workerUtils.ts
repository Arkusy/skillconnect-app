// utils/workerUtils.ts
import { supabase } from "./supabase";

// Base fee for monthly subscription (INR)
const BASE_FEE = 99;
// Percentage of previous month earnings
const EARNINGS_PERCENTAGE = 0.05;
// Fixed re-upgrade fee after demotion (INR)
const REUPGRADE_FEE = 499;
// One-star threshold for warning
const WARNING_THRESHOLD = 3;
// One-star threshold for demotion
const DEMOTION_THRESHOLD = 5;

interface MonthlyFeeResult {
  earnings: number;
  baseFee: number;
  percentageFee: number;
  totalFee: number;
  currency: string;
}

interface ReupgradeFeeResult {
  totalFee: number;
  currency: string;
}

interface DemotionCheckResult {
  shouldDemote: boolean;
  shouldWarn: boolean;
  count: number;
}

interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  expiresAt: Date | null;
  feeAmount: number;
  daysRemaining: number;
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

/**
 * Calculate monthly subscription fee for a worker
 * Formula: ₹99 base + 5% of previous month earnings
 */
export async function calculateMonthlyFee(userId: string): Promise<MonthlyFeeResult> {
  const now = new Date();
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Get completed orders for previous month
  const { data: orders, error } = await supabase
    .from("orders")
    .select("total_price")
    .eq("worker_id", userId)
    .eq("status", "completed")
    .gte("completed_at", startOfPreviousMonth.toISOString())
    .lte("completed_at", endOfPreviousMonth.toISOString());

  if (error) {
    console.error("Error calculating monthly fee:", error);
    return {
      earnings: 0,
      baseFee: BASE_FEE,
      percentageFee: 0,
      totalFee: BASE_FEE,
      currency: "INR",
    };
  }

  const earnings = orders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0;
  const percentageFee = Math.round(earnings * EARNINGS_PERCENTAGE * 100) / 100;
  const totalFee = BASE_FEE + percentageFee;

  return {
    earnings,
    baseFee: BASE_FEE,
    percentageFee,
    totalFee,
    currency: "INR",
  };
}

/**
 * Get fixed re-upgrade fee for demoted workers
 */
export function calculateReupgradeFee(): ReupgradeFeeResult {
  return {
    totalFee: REUPGRADE_FEE,
    currency: "INR",
  };
}

/**
 * Check if worker should be warned or demoted based on one-star reviews
 * Counts distinct users who gave 1-star ratings
 */
export async function checkOneStarDemotion(workerId: string): Promise<DemotionCheckResult> {
  // Get distinct 1-star ratings from different users
  const { data: ratings, error } = await supabase
    .from("ratings")
    .select(`
      id,
      orders!inner(user_id)
    `)
    .eq("worker_id", workerId)
    .eq("rating", 1);

  if (error) {
    console.error("Error checking one-star demotion:", error);
    return { shouldDemote: false, shouldWarn: false, count: 0 };
  }

  // Count distinct users
  const uniqueUsers = new Set(ratings?.map((r: any) => r.orders?.user_id) || []);
  const count = uniqueUsers.size;

  return {
    shouldDemote: count >= DEMOTION_THRESHOLD,
    shouldWarn: count >= WARNING_THRESHOLD && count < DEMOTION_THRESHOLD,
    count,
  };
}

/**
 * Demote a worker to regular user
 * - Updates role to 2
 * - Increments demotion_count
 * - Deletes worker_profiles entry
 * - Deletes worker_verification entry (force re-KYC)
 * - Logs to worker_status_history
 */
export async function demoteWorker(
  userId: string,
  adminId: string | null,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Start transaction-like operations
    
    // 1. Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: 2,
        demotion_count: supabase.rpc("increment_demotion_count", { row_id: userId }),
        last_demotion_at: new Date().toISOString(),
        one_star_count: 0,
        is_verified: false,
        verification_tier: "none",
      })
      .eq("id", userId);

    if (profileError) {
      // Fallback: increment manually
      const { data: profile } = await supabase
        .from("profiles")
        .select("demotion_count")
        .eq("id", userId)
        .single();
      
      await supabase
        .from("profiles")
        .update({
          role: 2,
          demotion_count: (profile?.demotion_count || 0) + 1,
          last_demotion_at: new Date().toISOString(),
          one_star_count: 0,
          is_verified: false,
          verification_tier: "none",
        })
        .eq("id", userId);
    }

    // 2. First set availability_status to unavailable (backup in case delete fails due to RLS)
    const { error: statusError } = await supabase
      .from("worker_profiles")
      .update({ availability_status: "unavailable" })
      .eq("user_id", userId);

    if (statusError) {
      console.warn("Could not update worker status:", statusError);
    }

    // 3. Delete worker_profiles entry
    const { error: deleteWorkerError } = await supabase
      .from("worker_profiles")
      .delete()
      .eq("user_id", userId);

    if (deleteWorkerError) {
      console.warn("Could not delete worker_profiles:", deleteWorkerError);
      // Worker status already set to unavailable as fallback
    }

    // 4. Delete worker_verification entry (force re-KYC)
    const { error: deleteVerificationError } = await supabase
      .from("worker_verification")
      .delete()
      .eq("user_id", userId);

    if (deleteVerificationError) {
      console.warn("Could not delete worker_verification:", deleteVerificationError);
    }

    // 5. Deactivate subscriptions
    await supabase
      .from("worker_subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    // 6. Log to worker_status_history
    await supabase.from("worker_status_history").insert({
      user_id: userId,
      action: "demoted",
      reason: reason,
      previous_role: 1,
      new_role: 2,
      performed_by: adminId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error demoting worker:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Admin promotes a user to worker directly (bypasses KYC)
 * - Updates role to 1
 * - Creates worker_profiles entry if not exists
 * - Creates subscription with specified duration
 * - Uses free trial on first promotion
 * - Logs to worker_status_history
 */
export async function promoteToWorker(
  userId: string,
  adminId: string,
  durationMonths: number,
  categoryId?: string
): Promise<{ success: boolean; error?: string; isFirstPromotion?: boolean }> {
  try {
    // 1. Check if user has used free trial before
    const { data: existingSubscription } = await supabase
      .from("worker_subscriptions")
      .select("is_free_trial_used")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const isFirstPromotion = !existingSubscription?.is_free_trial_used;

    // 2. Update profiles table - set role to worker
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: 1,
        is_verified: true,
        verification_tier: "admin_promoted",
      })
      .eq("id", userId);

    if (profileError) throw profileError;

    // 3. Check if worker_profiles exists, if not create one
    const { data: existingWorker } = await supabase
      .from("worker_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingWorker) {
      // Create new worker profile
      const { error: createError } = await supabase
        .from("worker_profiles")
        .insert({
          user_id: userId,
          category_id: categoryId || null,
          experience_years: 0,
          availability_status: "available",
          pricing_type: "hourly",
        });

      if (createError) {
        console.warn("Could not create worker profile:", createError);
      }
    } else {
      // Update existing worker profile to available
      await supabase
        .from("worker_profiles")
        .update({ availability_status: "available" })
        .eq("user_id", userId);
    }

    // 4. Create or update worker_verification (mark as approved)
    await supabase
      .from("worker_verification")
      .upsert({
        user_id: userId,
        status: "approved",
        verified_at: new Date().toISOString(),
        verified_by: adminId,
      }, { onConflict: "user_id" });

    // 5. Create subscription with specified duration
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // Deactivate any existing active subscriptions first
    await supabase
      .from("worker_subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    // Create new subscription
    const { error: subError } = await supabase
      .from("worker_subscriptions")
      .insert({
        user_id: userId,
        plan_type: "admin_granted",
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        is_free_trial_used: true, // Mark trial as used
        is_paid: true,
        base_fee: 0,
        total_fee: 0,
      });

    if (subError) {
      console.warn("Could not create subscription:", subError);
    }

    // 6. Log to worker_status_history
    await supabase.from("worker_status_history").insert({
      user_id: userId,
      action: "admin_promoted",
      reason: `Admin granted worker rights for ${durationMonths} month(s)${isFirstPromotion ? " (first promotion - trial used)" : ""}`,
      previous_role: 2,
      new_role: 1,
      performed_by: adminId,
    });

    return { success: true, isFirstPromotion };
  } catch (error: any) {
    console.error("Error promoting user to worker:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check subscription status for a worker
 */
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const { data: subscription, error } = await supabase
    .from("worker_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !subscription) {
    return {
      isActive: false,
      isTrial: false,
      expiresAt: null,
      feeAmount: 0,
      daysRemaining: 0,
    };
  }

  const expiresAt = new Date(subscription.expires_at);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    isActive: expiresAt > now,
    isTrial: subscription.plan_type === "trial",
    expiresAt,
    feeAmount: subscription.total_fee || 0,
    daysRemaining,
  };
}

/**
 * Get worker history for admin verification review
 */
export async function getWorkerHistory(userId: string): Promise<WorkerHistory> {
  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("demotion_count, last_demotion_at")
    .eq("id", userId)
    .single();

  // Get last demotion reason
  const { data: lastDemotion } = await supabase
    .from("worker_status_history")
    .select("reason, created_at")
    .eq("user_id", userId)
    .eq("action", "demoted")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Count previous worker approvals
  const { count: approvalCount } = await supabase
    .from("worker_status_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", "approved");

  // Get previous ratings
  const { data: ratings } = await supabase
    .from("ratings")
    .select("rating")
    .eq("worker_id", userId);

  const totalReviews = ratings?.length || 0;
  const avgRating = totalReviews > 0
    ? ratings!.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : null;

  return {
    isFirstTime: !profile?.demotion_count && !approvalCount,
    previousWorkerPeriods: (approvalCount || 0),
    demotionCount: profile?.demotion_count || 0,
    lastDemotionReason: lastDemotion?.reason || null,
    lastDemotionAt: lastDemotion?.created_at ? new Date(lastDemotion.created_at) : null,
    previousAvgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    previousTotalReviews: totalReviews,
  };
}

/**
 * Update one-star count and check for warning/demotion
 */
export async function handleOneStarRating(
  workerId: string,
  orderId: string
): Promise<{ warned: boolean; demoted: boolean }> {
  // Check current status
  const demotionCheck = await checkOneStarDemotion(workerId);

  // Update profile one_star_count
  await supabase
    .from("profiles")
    .update({ one_star_count: demotionCheck.count })
    .eq("id", workerId);

  if (demotionCheck.shouldDemote) {
    // Auto-demote
    await demoteWorker(workerId, null, "Automatic demotion: 5 one-star reviews from different users");
    return { warned: false, demoted: true };
  }

  if (demotionCheck.shouldWarn) {
    // Update warning timestamp
    await supabase
      .from("profiles")
      .update({ last_warning_at: new Date().toISOString() })
      .eq("id", workerId);

    // Log warning
    await supabase.from("worker_status_history").insert({
      user_id: workerId,
      action: "warned",
      reason: `Warning issued: ${demotionCheck.count} one-star reviews (demotion at 5)`,
      previous_role: 1,
      new_role: 1,
      performed_by: null,
    });

    return { warned: true, demoted: false };
  }

  return { warned: false, demoted: false };
}

/**
 * Create trial subscription for new worker
 */
export async function createTrialSubscription(userId: string): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { error } = await supabase.from("worker_subscriptions").insert({
    user_id: userId,
    plan_type: "trial",
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    previous_month_earnings: 0,
    base_fee: 0,
    percentage_fee: 0,
    total_fee: 0,
    is_paid: true, // Trial is "paid"
    is_active: true,
  });

  return !error;
}

/**
 * Check if user was previously demoted (for re-upgrade fee)
 */
export async function wasPreviouslyDemoted(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("demotion_count")
    .eq("id", userId)
    .single();

  return (profile?.demotion_count || 0) > 0;
}

// ==================== BAN MANAGEMENT ====================

interface BanStatus {
  isBanned: boolean;
  isPermanent: boolean;
  expiresAt: Date | null;
  reason: string | null;
  bannedAt: Date | null;
  daysRemaining: number | null;
}

type BanDuration = 1 | 2 | 3 | 6 | 12 | 'permanent';

/**
 * Ban a user for a specified duration
 * @param userId - User to ban
 * @param adminId - Admin performing the action
 * @param duration - Months to ban (1, 2, 3, 6, 12) or 'permanent'
 * @param reason - Reason for the ban
 */
export async function banUser(
  userId: string,
  adminId: string,
  duration: BanDuration,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();
    let banExpiresAt: string | null = null;

    if (duration !== 'permanent') {
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + duration);
      banExpiresAt = expiryDate.toISOString();
    }

    // Update profiles with ban info
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_banned: true,
        ban_expires_at: banExpiresAt,
        ban_reason: reason,
        banned_by: adminId,
        banned_at: now.toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Log to worker_status_history
    await supabase.from("worker_status_history").insert({
      user_id: userId,
      action: "banned",
      reason: `${duration === 'permanent' ? 'Permanent' : `${duration} month`} ban: ${reason}`,
      performed_by: adminId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error banning user:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove ban from a user
 */
export async function unbanUser(
  userId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_banned: false,
        ban_expires_at: null,
        ban_reason: null,
        banned_by: null,
        banned_at: null,
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Log to worker_status_history
    await supabase.from("worker_status_history").insert({
      user_id: userId,
      action: "unbanned",
      reason: "Admin removed ban",
      performed_by: adminId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error unbanning user:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user is banned and get ban details
 */
export async function checkBanStatus(userId: string): Promise<BanStatus> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_banned, ban_expires_at, ban_reason, banned_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return {
      isBanned: false,
      isPermanent: false,
      expiresAt: null,
      reason: null,
      bannedAt: null,
      daysRemaining: null,
    };
  }

  const now = new Date();
  const expiresAt = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;
  
  // Check if ban has expired (auto-unban)
  if (profile.is_banned && expiresAt && expiresAt < now) {
    // Ban expired, auto-unban
    await supabase
      .from("profiles")
      .update({
        is_banned: false,
        ban_expires_at: null,
        ban_reason: null,
        banned_by: null,
        banned_at: null,
      })
      .eq("id", userId);

    return {
      isBanned: false,
      isPermanent: false,
      expiresAt: null,
      reason: null,
      bannedAt: null,
      daysRemaining: null,
    };
  }

  const daysRemaining = expiresAt
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    isBanned: profile.is_banned || false,
    isPermanent: profile.is_banned && !expiresAt,
    expiresAt,
    reason: profile.ban_reason,
    bannedAt: profile.banned_at ? new Date(profile.banned_at) : null,
    daysRemaining,
  };
}

/**
 * Check if user has already used their one-time free trial
 */
export async function hasUsedFreeTrial(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("worker_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_type", "trial")
    .limit(1);

  return (data?.length || 0) > 0;
}

/**
 * Set worker to unavailable status (for payment due)
 */
export async function setWorkerUnavailable(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("worker_profiles")
      .update({
        availability_status: "unavailable",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) throw error;

    // Log to history
    await supabase.from("worker_status_history").insert({
      user_id: userId,
      action: "set_unavailable",
      reason,
      previous_role: 1,
      new_role: 1,
      performed_by: null,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error setting worker unavailable:", error);
    return { success: false, error: error.message };
  }
}
