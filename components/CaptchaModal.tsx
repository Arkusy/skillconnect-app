// components/CaptchaModal.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface CaptchaModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function CaptchaModal({
  visible,
  onSuccess,
  onCancel,
  isSubmitting = false,
}: CaptchaModalProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [error, setError] = useState("");

  const captchaBorderColor = "#000";
  const captchaBorderWidth = 2;

  useEffect(() => {
    if (visible) {
      generateCaptcha();
    }
  }, [visible]);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setCorrectAnswer(n1 + n2);
    setCaptchaAnswer("");
    setError("");
  };

  const handleSubmit = () => {
    const userAnswer = parseInt(captchaAnswer);

    if (isNaN(userAnswer)) {
      setError("Please enter a valid number.");
      return;
    }

    if (userAnswer !== correctAnswer) {
      setError("Incorrect answer. Please try again.");
      generateCaptcha();
      return;
    }

    // CAPTCHA passed
    setError("");
    onSuccess();
  };

  const handleCancel = () => {
    setCaptchaAnswer("");
    setError("");
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => !isSubmitting && handleCancel()}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.captchaContainer,
            { borderColor: captchaBorderColor, borderWidth: captchaBorderWidth },
          ]}
        >
          <Text style={styles.captchaTitle}>Verify You're Human</Text>

          <View
            style={[
              styles.mathProblem,
              { borderColor: captchaBorderColor, borderWidth: captchaBorderWidth },
            ]}
          >
            <Text style={styles.mathText}>
              {num1} + {num2} = ?
            </Text>
          </View>

          <TextInput
            style={[
              styles.captchaInput,
              { borderColor: captchaBorderColor, borderWidth: captchaBorderWidth },
              error ? styles.inputError : null,
            ]}
            placeholder="Enter answer"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={captchaAnswer}
            onChangeText={(text) => {
              setCaptchaAnswer(text);
              setError("");
            }}
            autoFocus={true}
            editable={!isSubmitting}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.captchaButtons}>
            <Pressable
              style={[
                styles.captchaButton,
                styles.cancelButton,
                isSubmitting && { opacity: 0.5 },
              ]}
              onPress={handleCancel}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.captchaButton,
                styles.submitButton,
                isSubmitting && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  captchaContainer: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  captchaTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  mathProblem: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 20,
  },
  mathText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2f4f4f",
  },
  captchaInput: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  inputError: {
    borderColor: "#ff4d4d",
  },
  errorText: {
    color: "#ff4d4d",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  captchaButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 10,
  },
  captchaButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
  },
  cancelButtonText: {
    color: "#555",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#000000ff",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});