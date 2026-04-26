// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAdminTheme } from "../../context/AdminThemeContext";

export default function TabsLayout() {
  const { colors, mode } = useAdminTheme();

  return (
    <Tabs
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        headerTitleStyle: {
          fontSize: 25,
          fontWeight: 'bold',
          color: mode === 'dark' ? colors.text : "#000"
        },
        headerStyle: {
          backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: mode === 'dark' ? colors.border : "#F0F0F0",
        },
        tabBarStyle: {
          backgroundColor: mode === 'dark' ? colors.card : "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: mode === 'dark' ? colors.border : "#F0F0F0",
        },
        headerLeft: () => <></>,
        tabBarActiveTintColor: mode === 'dark' ? colors.primary : "#000000",
        tabBarInactiveTintColor: mode === 'dark' ? colors.textSecondary : "#000",
      }}
    >
      <Tabs.Screen
        name="Home"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused, color }) =>
            <Ionicons
              name={focused ? "home-sharp" : "home-outline"}
              size={30}
              color={color}
            />,
        }}
      />
      <Tabs.Screen
        name="Chat"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused, color }) =>
            <Ionicons
              name={focused ? "chatbubble-ellipses-sharp" : "chatbubble-ellipses-outline"}
              size={30}
              color={color}
            />,
        }}
      />
      <Tabs.Screen
        name="MyOrders"
        options={{
          headerTitle: "My Orders",
          tabBarIcon: ({ focused, color }) =>
            <Ionicons
              name={focused ? "construct-sharp" : "construct-outline"}
              size={30}
              color={color}
            />,
        }}
      />
      <Tabs.Screen
        name="Account"
        options={{
          headerTitle: "Account",
          tabBarIcon: ({ focused, color }) =>
            <Ionicons
              name={focused ? "person-circle-sharp" : "person-circle-outline"}
              size={30}
              color={color}
            />,
        }}
      />
    </Tabs>
  );
}