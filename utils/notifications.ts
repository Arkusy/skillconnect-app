// utils/notifications.ts
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,  
    shouldShowList: true,    // Add this
  }),
});


/**
 * Register for push notifications and get Expo Push Token
 * Works on both Expo Go and standalone APK builds
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // Configure Android notification channel
  // In registerForPushNotificationsAsync function, around line 24-30
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,  // Already correct
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4def96ff',
      enableVibrate: true,  // Add this
      enableLights: true,    // Add this
      showBadge: true,       // Add this
    });
  }


  // Only proceed if running on a physical device
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permission not granted for push notifications');
      return null;
    }

    try {
      // Get Expo Push Token with project ID
      const projectId = '2be40f3f-8543-4358-8192-3242888e57bf'; // From app.json
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;

      console.log('✅ Push token generated:', token);
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      return null;
    }
  } else {
    console.log('⚠️ Must use physical device for Push Notifications');
    return null;
  }

  return token;
}

/**
 * Save push token to the profiles table in database
 */
export async function savePushTokenToDatabase(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (error) throw error;

    console.log('✅ Push token saved to database for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error saving push token to database:', error);
    return false;
  }
}

/**
 * Remove push token from database (e.g., on logout)
 */
export async function removePushTokenFromDatabase(userId: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('id', userId);

    if (error) throw error;

    console.log('✅ Push token removed from database for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error removing push token from database:', error);
    return false;
  }
}

/**
 * Check if device has notification permissions
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Send a local notification (for testing)
 */
export async function sendLocalNotification(title: string, body: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Send immediately
    });
    console.log('✅ Local notification sent');
  } catch (error) {
    console.error('❌ Error sending local notification:', error);
  }
}
