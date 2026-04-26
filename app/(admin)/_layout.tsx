import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useAdminTheme } from "../../context/AdminThemeContext";

function AdminTabs() {
    const { colors, mode } = useAdminTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.card,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    elevation: 10,
                    shadowColor: mode === 'dark' ? '#000' : '#ccc',
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarLabelStyle: {
                    fontWeight: '600',
                    fontSize: 10
                }
            }}
        >
            <Tabs.Screen
                name="Home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="grid" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="Dashboard"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="stats-chart" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="Issue"
                options={{
                    title: "Issues",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="alert-circle" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="Account"
                options={{
                    href: null,
                    title: "Account",
                }}
            />
            <Tabs.Screen
                name="help"
                options={{
                    title: "Help Requests",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="headset" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="VerifyWorkers"
                options={{
                    title: "Verify",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="shield-checkmark" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="users"
                options={{
                    href: null,
                    headerTitle: "Manage Users",
                }}
            />
        </Tabs>
    );
}

export default function AdminLayout() {
    return (
        <AdminTabs />
    );
}
