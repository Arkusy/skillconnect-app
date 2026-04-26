// app/_layout.tsx
import BannedUserModal from '@/components/BannedUserModal';
import BiometricLockOverlay from '@/components/BiometricLockOverlay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from "@supabase/supabase-js";
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AdminThemeProvider } from "../context/AdminThemeContext";
import {
  registerForPushNotificationsAsync,
  savePushTokenToDatabase
} from "../utils/notifications";
import { supabase } from "../utils/supabase";
import { checkBanStatus } from "../utils/workerUtils";

LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  // Ban state
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<{
    isPermanent: boolean;
    daysRemaining: number | null;
    reason: string | null;
  } | null>(null);

  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Consolidate session and role logic
  useEffect(() => {
    let mounted = true;

    // 1. Initial Session
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);

      if (data.session) {
        const biometricEnabled = await AsyncStorage.getItem("biometrics_enabled");
        if (biometricEnabled === "true") {
          setIsLocked(true);
        }
        // Wait for role fetch - don't set loading false here
      } else {
        // If no session, we are done loading (will redirect to login)
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        console.log("Auth Event:", _event);
        setSession(newSession);
        // If signed out, ensure loading is done so we redirect
        if (!newSession) {
          setRole(null);
          setLoading(false);
          setIsLocked(false); // Reset lock on sign out
        } else {
          // If a new session exists, we should be loading until role is fetched
          setLoading(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authenticate = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock SkillConnect",
      disableDeviceFallback: false,
    });

    if (result.success) {
      setIsLocked(false);
    }
  };

  const handleCreateNewSession = async () => {
    // Logic: Sign out AND disable biometrics so they can log in manually next time
    await AsyncStorage.removeItem("biometrics_enabled");
    await supabase.auth.signOut();
    setIsLocked(false);
    setSession(null);
    // Router replacement is handled by the useEffect listening to session
  };


  // Notification listeners (useEffect)
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📩 Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      const data = response.notification.request.content.data;
      if (data?.screen === 'ChatScreen' && data.workerId && data.user) {
        // Navigate to ChatScreen
        router.push({
          pathname: "/ChatScreen",
          params: {
            user: data.user,
            workerId: data.workerId
          }
        } as any);
      } else if (data?.screen) {
        // Handle other screens if needed
        router.push(data.screen as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  // Fetch role whenever session changes (and is present)
  useEffect(() => {
    let mounted = true;
    if (session?.user) {
      console.log("Fetching role for user:", session.user.id);
      const fetchRoleAndBanStatus = async () => {
        // Check ban status first
        const banStatus = await checkBanStatus(session.user.id);
        if (banStatus.isBanned) {
          setIsBanned(true);
          setBanInfo({
            isPermanent: banStatus.isPermanent,
            daysRemaining: banStatus.daysRemaining,
            reason: banStatus.reason,
          });
          setLoading(false);
          return; // Don't proceed if banned
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (mounted) {
          if (data) {
            console.log("Role fetched:", data.role);
            setRole(data.role);
            registerPushNotifications(session.user.id);
          } else {
            console.error("Role fetch failed:", error);
            // Default to user (2) if fetch fails to avoid getting stuck, 
            // but ideally we should handle this better. 
            // For now, if it fails, let's keep it null so it doesn't redirect wrongly, 
            // or maybe retry.
          }
          setLoading(false);
        }
      };

      fetchRoleAndBanStatus();
    }

    return () => {
      mounted = false;
    };
  }, [session]);

  const registerPushNotifications = async (userId: string) => {
    try {
      // Check if user has disabled push notifications
      const pushSetting = await AsyncStorage.getItem("push_notifications_enabled");
      if (pushSetting === "false") {
        console.log('🔕 Push notifications disabled by user');
        return;
      }

      console.log('🔔 Registering push notifications for user:', userId);
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await savePushTokenToDatabase(userId, token);
      }
    } catch (error) {
      console.error('❌ Error registering push notifications:', error);
    }
  };

  // Navigate after loading finishes
  useEffect(() => {
    if (!loading && !isBanned) {
      if (!session) {
        router.replace("/(auth)/login");
      } else if (role !== null) {
        if (role === 0) {
          router.replace("/(admin)/Home");
        } else {
          router.replace("/(tabs)/Home");
        }
      }
    }
  }, [loading, session, role, isBanned]);

  // Handle banned user sign out
  const handleBannedSignOut = async () => {
    await AsyncStorage.removeItem("biometrics_enabled");
    await supabase.auth.signOut();
    setIsBanned(false);
    setBanInfo(null);
    setSession(null);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#d5e0db" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <AdminThemeProvider>
      <KeyboardProvider>
        <Stack
          screenOptions={{
            headerTitleAlign: "center",
            headerTitleStyle: { fontSize: 26, color: '#fff' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="WorkerUpgrade" options={{ headerShown: false }} />
          <Stack.Screen name="ReportUser" options={{ headerShown: false }} />
          <Stack.Screen name="PaymentScreen" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerTitle: "Not Found" }} />
        </Stack>
        <BiometricLockOverlay
          isLocked={isLocked}
          onUnlock={authenticate}
          onSignOut={handleCreateNewSession}
        />
        <BannedUserModal
          visible={isBanned}
          isPermanent={banInfo?.isPermanent || false}
          daysRemaining={banInfo?.daysRemaining || null}
          reason={banInfo?.reason || null}
          onSignOut={handleBannedSignOut}
        />
      </KeyboardProvider>
    </AdminThemeProvider>
  );
}