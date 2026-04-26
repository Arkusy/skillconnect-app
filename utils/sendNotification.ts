// utils/sendNotification.ts
// Helper functions to send push notifications to users

interface NotificationData {
  screen?: string;
  orderId?: number;
  chatId?: string;
  [key: string]: any;
}

/**
 * Send push notification via Expo's push notification service
 * @param expoPushToken - The Expo push token from database
 * @param title - Notification title
 * @param body - Notification body/message
 * @param data - Optional data to pass with notification (for deep linking)
 */
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: NotificationData,
  collapseKey?: string
): Promise<boolean> {
  // Validate token format
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken[')) {
    console.error('❌ Invalid Expo push token format');
    return false;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data || {},
    priority: 'high',
    channelId: 'default',
    _displayInForeground: true, // Keep app behavior consistent
    // iOS functionality
    threadId: collapseKey, // Collapse logic on iOS
    // Android functionality (Expo doesn't fully expose 'tag' in simple HTTP API, but we can try passing it)
    // Actually, distinct channelId per user could group them in settings, but that's not 'collapsing'.
    // We will rely on threadId and hope Expo maps it or just accept iOS support mostly.
    // However, some sources suggest 'collapseId' might be accepted by Expo service.
    collapseId: collapseKey, 
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data && result.data.status === 'ok') {
      console.log('✅ Push notification sent successfully');
      return true;
    } else {
      console.error('❌ Failed to send push notification:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return false;
  }
}

/**
 * Send notification to multiple users at once
 * @param notifications - Array of notification objects with tokens and messages
 */
export async function sendBulkPushNotifications(
  notifications: Array<{
    token: string;
    title: string;
    body: string;
    data?: NotificationData;
  }>
): Promise<void> {
  const messages = notifications
    .filter(n => n.token && n.token.startsWith('ExponentPushToken['))
    .map(n => ({
      to: n.token,
      sound: 'default',
      title: n.title,
      body: n.body,
      data: n.data || {},
      priority: 'high',
      channelId: 'default',
    }));

  if (messages.length === 0) {
    console.error('❌ No valid push tokens to send notifications to');
    return;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`✅ Sent ${messages.length} push notifications`, result);
  } catch (error) {
    console.error('❌ Error sending bulk push notifications:', error);
  }
}

// ========================================
// Pre-built notification templates
// ========================================

/**
 * Notify worker about a new order
 */
export async function notifyWorkerNewOrder(
  workerPushToken: string,
  customerName: string,
  orderId: number,
  categoryName: string
) {
  return sendPushNotification(
    workerPushToken,
    '🔔 New Order Received!',
    `${customerName} needs ${categoryName} service`,
    { screen: 'DisplayOrder', orderId }
  );
}

/**
 * Notify customer that worker accepted the order
 */
export async function notifyCustomerOrderAccepted(
  customerPushToken: string,
  workerName: string,
  orderId: number
) {
  return sendPushNotification(
    customerPushToken,
    '✅ Order Accepted!',
    `${workerName} has accepted your order`,
    { screen: 'DisplayOrder', orderId }
  );
}

/**
 * Notify customer that worker rejected the order
 */
export async function notifyCustomerOrderRejected(
  customerPushToken: string,
  workerName: string,
  orderId: number
) {
  return sendPushNotification(
    customerPushToken,
    '❌ Order Rejected',
    `${workerName} has rejected your order`,
    { screen: 'DisplayOrder', orderId }
  );
}

/**
 * Notify customer that order has been initiated
 */
export async function notifyCustomerOrderInitiated(
  customerPushToken: string,
  workerName: string,
  orderId: number
) {
  return sendPushNotification(
    customerPushToken,
    '🚀 Work Started!',
    `${workerName} has started working on your order`,
    { screen: 'DisplayOrder', orderId }
  );
}

/**
 * Notify customer that order has been completed
 */
export async function notifyCustomerOrderCompleted(
  customerPushToken: string,
  workerName: string,
  orderId: number
) {
  return sendPushNotification(
    customerPushToken,
    '🎉 Order Completed!',
    `${workerName} has completed your order. Please verify and rate!`,
    { screen: 'DisplayOrder', orderId }
  );
}

/**
 * Notify user about a new chat message
 */
export async function notifyNewMessage(
  recipientPushToken: string,
  senderName: string,
  messagePreview: string,
  senderId: string // The ID of the person sending the message (becomes workerId/user param)
) {
  return sendPushNotification(
    recipientPushToken,
    `💬 ${senderName}`,
    messagePreview.length > 50
      ? `${messagePreview.substring(0, 50)}...`
      : messagePreview,
    { 
      screen: 'ChatScreen', 
      workerId: senderId,
      user: senderName
    },
    senderId // Use senderId as the collapseKey to group messages from this sender
  );
}

/**
 * Notify worker about a new rating
 */
export async function notifyWorkerRated(
  workerPushToken: string,
  rating: number,
  customerName: string
) {
  const stars = '⭐'.repeat(rating);
  return sendPushNotification(
    workerPushToken,
    '⭐ New Rating Received!',
    `${customerName} rated you ${stars} (${rating}/5)`,
    { screen: 'Account' }
  );
}

/**
 * Example usage in your order creation logic:
 *
 * import { notifyWorkerNewOrder } from '../utils/sendNotification';
 * import { supabase } from '../utils/supabase';
 *
 * // After creating order, get worker's push token
 * const { data: workerProfile } = await supabase
 *   .from('profiles')
 *   .select('expo_push_token, full_name')
 *   .eq('id', workerId)
 *   .single();
 *
 * if (workerProfile?.expo_push_token) {
 *   await notifyWorkerNewOrder(
 *     workerProfile.expo_push_token,
 *     customerName,
 *     newOrderId,
 *     categoryName
 *   );
 * }
 */
