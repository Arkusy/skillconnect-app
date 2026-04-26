// components/LoadingOverlay.tsx
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({
  visible,
  message = "Loading..."
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(47, 79, 79, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingBox: {
    backgroundColor: 'rgba(213, 224, 219, 0.1)',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 15,
    fontWeight: '600',
  },
});