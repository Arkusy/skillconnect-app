// components/CustomAlert.tsx
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAdminTheme } from "../context/AdminThemeContext";

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  type?: "success" | "error" | "warning" | "info";
  buttonText?: string;
  showCancel?: boolean;
}

export default function CustomAlert({
  visible,
  title,
  message,
  onClose,
  onConfirm,
  type = "error",
  buttonText = "OK",
  showCancel = false,
}: CustomAlertProps) {
  const { colors } = useAdminTheme();

  const typeColors = {
    success: "#4def96",
    error: "#ff4d4d",
    warning: "#4da6ff",
    info: "#4da6ff",
  };

  const borderColor = typeColors[type];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.alertBox, { backgroundColor: colors.card, borderColor, borderWidth: 3 }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Divider Line */}
          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {/* Message */}
          <Text style={[styles.message, { color: colors.text }]}>{message}</Text>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', width: '100%' }}>
            {showCancel && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#ccc", flex: 1 }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: borderColor,
                  flex: showCancel ? 1 : 0,
                  minWidth: showCancel ? undefined : 100
                }
              ]}
              onPress={() => {
                if (onConfirm) {
                  onConfirm();
                } else {
                  onClose();
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertBox: {
    width: "85%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 12,
  },
  divider: {
    height: 2,
    width: "100%",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

// ============================================
// USAGE EXAMPLE & HELPER HOOK
// ============================================

import { useState } from "react";

export function useCustomAlert() {
  const [alert, setAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "error" as "success" | "error" | "warning" | "info",
    showCancel: false,
    onConfirm: undefined as (() => void) | undefined,
    buttonText: "OK",
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "error",
    options?: { showCancel?: boolean; onConfirm?: () => void; buttonText?: string }
  ) => {
    setAlert({
      visible: true,
      title,
      message,
      type,
      showCancel: options?.showCancel || false,
      onConfirm: options?.onConfirm,
      buttonText: options?.buttonText || "OK",
    });
  };

  const hideAlert = () => {
    setAlert((prev) => ({ ...prev, visible: false }));
  };

  const AlertComponent = () => (
    <CustomAlert
      visible={alert.visible}
      title={alert.title}
      message={alert.message}
      type={alert.type}
      onClose={hideAlert}
      onConfirm={() => {
        if (alert.onConfirm) alert.onConfirm();
        hideAlert();
      }}
      showCancel={alert.showCancel}
      buttonText={alert.buttonText}
    />
  );

  return { showAlert, AlertComponent };
}

// ============================================
// HOW TO USE IN YOUR COMPONENT:
// ============================================

/*
import { useCustomAlert } from "./components/CustomAlert";

export default function YourScreen() {
  const { showAlert, AlertComponent } = useCustomAlert();

  const handleSubmit = () => {
    if (!isValid) {
      showAlert("Error", "Please enter a valid number.", "error");
      return;
    }
    
    // On success:
    showAlert("Success", "Operation completed!", "success");
  };

  return (
    <View>
      {/* Your screen content *//*}
 
{/* Add the alert component *//*}
<AlertComponent />
</View>
);
}
*/