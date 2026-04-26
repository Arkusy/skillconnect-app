import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../utils/supabase";

import { useAdminTheme } from "../context/AdminThemeContext";



// Fallback content in case DB is not set up yet
const FALLBACK_CONTENT: Record<string, { title: string; content: string }> = {
    privacy: {
        title: "Privacy Policy",
        content: `Last updated: January 25, 2026

1. Introduction
Welcome to our application. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our app and tell you about your privacy rights and how the law protects you.

2. Data We Collect
We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows: Identity Data, Contact Data, and Usage Data.

3. How We Use Your Data
We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances: Where we need to perform the contract we are about to enter into or have entered into with you.

4. Data Retention
We will only retain your personal data for as long as necessary to fulfil the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.

5. Account Deletion
If you choose to delete your account, your data will be retained for a 30-day grace period before permanent deletion, unless otherwise required by law. During this period, your account will be disabled.`,
    },
    terms: {
        title: "Terms of Service",
        content: `Last updated: January 25, 2026

1. Agreement to Terms
By accessing our application, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.

2. Use License
Permission is granted to temporarily download one copy of the materials (information or software) on our application for personal, non-commercial transitory viewing only.

3. Disclaimer
The materials on our application are provided on an "as is" basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

4. Limitations
In no event shall we be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our application.

5. Governing Law
These terms and conditions are governed by and construed in accordance with the laws of the state and you irrevocably submit to the exclusive jurisdiction of the courts in that state.`,
    },
};

// In-memory cache for legal docs to save DB calls
// This persists during the app session but clears on restart
const LEGAL_CACHE: Record<string, { title: string; content: string }> = {};

export default function LegalPage() {
    const { colors, mode } = useAdminTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => getStyles(colors, mode, insets), [colors, mode, insets]);
    const params = useLocalSearchParams();
    const type = (params.type as string) || "privacy";

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(LEGAL_CACHE[type] || FALLBACK_CONTENT[type]);

    useEffect(() => {
        fetchContent();
    }, [type]);

    const fetchContent = async () => {
        // Check cache first
        if (LEGAL_CACHE[type]) {
            console.log("Serving from cache:", type);
            setData(LEGAL_CACHE[type]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Try to fetch from DB
            const { data: doc, error } = await supabase
                .from("app_legal_docs")
                .select("title, content")
                .eq("doc_type", type)
                .single();

            if (doc && !error) {
                LEGAL_CACHE[type] = doc; // Cache the result
                setData(doc);
            } else {
                // Silent fail to fallback
                console.log("Using fallback content for", type);
                if (FALLBACK_CONTENT[type]) {
                    setData(FALLBACK_CONTENT[type]);
                }
            }
        } catch (err) {
            console.error("Error fetching legal doc:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatContent = (rawContent: string) => {
        if (!rawContent) return null;
        return rawContent.split(/\n/).map((line, index) => {
            const cleanLine = line.trim();
            if (!cleanLine) return <View key={index} style={{ height: 12 }} />;

            // Header detection (simple regex for lines starting with number dot)
            const isHeader = /^\d+\./.test(cleanLine) || cleanLine.toLowerCase().startsWith("last updated");

            return (
                <Text
                    key={index}
                    style={[
                        styles.paragraph,
                        { color: mode === 'light' ? '#4f4f4fff' : colors.textSecondary },
                        isHeader && [styles.headerText, { color: colors.text }]
                    ]}
                >
                    {cleanLine}
                </Text>
            );
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* StatusBar already handled by provider */}

            {/* Header */}
            <View style={[styles.headerContainer, { backgroundColor: colors.headerBg }]}>
                <View style={[styles.headerTopRow, { justifyContent: 'center' }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{data?.title || "Legal"}</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={{ padding: 40 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {formatContent(data?.content || "")}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// ---------- Styles ----------
const getStyles = (colors: any, mode: any, insets: any) => StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 80 },
    headerContainer: {
        paddingTop: Math.max(insets.top, 10) + 10,
        paddingBottom: 10,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        zIndex: 10,
    },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "800",
    },
    card: {
        borderRadius: 16,
        padding: 24,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    paragraph: {
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 4,
    },
    headerText: {
        fontSize: 16,
        fontWeight: "700",
        marginTop: 12,
        marginBottom: 8,
    },
});
