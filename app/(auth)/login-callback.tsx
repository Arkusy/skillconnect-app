// app/(auth)/login-callback.tsx
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCustomAlert } from "../../components/CustomAlert";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../utils/useAuth";

const myIcon = require("../../assets/images/icon-transparent.png");

export default function LoginX() {
  const { showAlert, AlertComponent } = useCustomAlert();
  const [height1, setHeight1] = useState(320);
  const router = useRouter();
  const { loading, signInWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "reset" | "verify-otp">("login");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP verification
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  // Reset password flow
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // CAPTCHA state
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState(0);

  const captchaBorderColor = "#4def96ff";
  const captchaBorderWidth = 2;

  // Check if user is already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // We don't redirect here anymore, _layout handles it.
      // We just need to stop the initial checking state if no session.
      if (!session) {
        setCheckingAuth(false);
      }
    });

    // We also don't need the onAuthStateChange listener for redirection here.
  }, []);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setCorrectAnswer(n1 + n2);
    setCaptchaAnswer("");
  };

  const clearFields = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setNewPassword("");
    setConfirmNewPassword("");
    setOtp("");
    setShowConfirmPassword(false);
    setShowPassword(false);
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleButtonPress = () => {
    // Validate fields first
    if (mode === "verify-otp") {
      if (!otp || otp.length !== 6) {
        showAlert("Error", "Please enter the 6-digit OTP sent to your email.");
        return;
      }
      // No CAPTCHA for OTP verification
      handleVerifyOtp();
      return;
    }

    if (mode === "reset") {
      if (!email) {
        showAlert("Error", "Email is required.");
        return;
      }
      if (!isValidEmail(email)) {
        showAlert("Error", "Please enter a valid email address.");
        return;
      }
    } else {
      if (!email || !password) {
        showAlert("Error", "Email and Password are required.");
        return;
      }

      if (!isValidEmail(email)) {
        showAlert("Error", "Please enter a valid email address.");
        return;
      }

      if (mode === "register") {
        if (!confirmPassword) {
          showAlert("Error", "Please confirm your password.");
          return;
        }
        if (password !== confirmPassword) {
          showAlert("Error", "Passwords do not match.");
          return;
        }
      }
    }

    // Show CAPTCHA popup
    generateCaptcha();
    setShowCaptcha(true);
  };

  const handleCaptchaSubmit = () => {
    const userAnswer = parseInt(captchaAnswer);

    if (isNaN(userAnswer)) {
      showAlert("Error", "Please enter a valid number.");
      return;
    }

    if (userAnswer !== correctAnswer) {
      showAlert("Error", "Incorrect answer. Please try again.");
      generateCaptcha();
      return;
    }

    // CAPTCHA passed, close modal and proceed
    setShowCaptcha(false);
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "skill1://login-callback",
      });
      if (error) {
        showAlert("Error", error.message);
      } else {
        showAlert("Success", "Password reset link sent to your email.");
        setHeight1(220);
      }
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: username, role: 2 },
        },
      });

      if (error) {
        showAlert("Error", error.message);
      } else if (data.user) {
        // Store email for OTP verification
        setPendingEmail(email);

        showAlert(
          "Registration Started",
          "A 6-digit OTP has been sent to your email. Please verify to complete registration."
        );

        // Switch to OTP verification mode
        setMode("verify-otp");
        setHeight1(280);
      }
    } else {
      // Login mode
      const success = await signInWithEmail(email, password);
      if (success) {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          showAlert(
            "Login Successful",
            `Welcome back ${profile?.full_name || email}!`
          );
        }

        clearFields();
        router.replace("/(tabs)/Home");
      }
    }
  };

  const handleVerifyOtp = async () => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: otp,
      type: 'signup'
    });

    if (error) {
      showAlert("Error", error.message);
      return;
    }

    if (data.user) {
      // Create profile after successful OTP verification
      console.log("OTP verified, creating profile...");

      // Wait a bit for any triggers
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      // If no profile, create it
      if (!existingProfile) {
        console.log("Creating profile...");
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: username || data.user.email?.split('@')[0] || 'User',
            email: data.user.email!,
            role: 2,
          });

        if (profileError) {
          console.error("Profile creation failed:", profileError);
        } else {
          console.log("✅ Profile created");
        }
      }

      showAlert(
        "Verification Successful",
        "Your account has been verified! You can now log in."
      );

      clearFields();
      setMode("login");
      setHeight1(320);
    }
  };

  const handleResendOtp = async () => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
    });

    if (error) {
      showAlert("Error", error.message);
    } else {
      showAlert("Success", "New OTP sent to your email.");
    }
  };

  if (checkingAuth) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={60}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.innerContainer}>
          <Image source={myIcon} style={styles.imageStyle} />
          <Text style={styles.textStyle}>SkillConnect</Text>

          <View style={[styles.loginContainer, { minHeight: height1 }]}>
            <Text style={styles.loginTitle}>
              {mode === "login"
                ? "Login"
                : mode === "register"
                  ? "Register"
                  : mode === "verify-otp"
                    ? "Verify OTP"
                    : "Reset Password"}
            </Text>

            {mode === "verify-otp" ? (
              <>
                <Text style={styles.otpInstruction}>
                  Enter the 6-digit code sent to {pendingEmail}
                </Text>

                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus={true}
                />

                <Pressable style={styles.button} onPress={handleButtonPress}>
                  <Text style={styles.buttonText}>Verify OTP</Text>
                </Pressable>

                <Pressable onPress={handleResendOtp}>
                  <Text style={styles.miniLinkText}>Resend OTP</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setMode("register");
                    setHeight1(380);
                    setOtp("");
                  }}
                >
                  <Text style={styles.linkText}>Back to Registration</Text>
                </Pressable>
              </>
            ) : (
              <>
                {mode === "register" && (
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#ccc"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#ccc"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                {mode !== "reset" && (
                  <>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor="#ccc"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((p) => !p)}
                        style={styles.eyeButton}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off" : "eye"}
                          size={22}
                          color="#ccc"
                        />
                      </TouchableOpacity>
                    </View>

                    {mode === "register" && (
                      <View style={styles.passwordContainer}>
                        <TextInput
                          style={styles.passwordInput}
                          placeholder="Confirm Password"
                          placeholderTextColor="#ccc"
                          secureTextEntry={!showConfirmPassword}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword((p) => !p)}
                          style={styles.eyeButton}
                        >
                          <Ionicons
                            name={showConfirmPassword ? "eye-off" : "eye"}
                            size={22}
                            color="#ccc"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                <Pressable style={styles.button} onPress={handleButtonPress} disabled={loading}>
                  <Text style={styles.buttonText}>
                    {mode === "login"
                      ? "Login"
                      : mode === "register"
                        ? "Sign Up"
                        : "Send Recovery Email"}
                  </Text>
                </Pressable>

                {mode === "login" && (
                  <>
                    <Pressable
                      onPress={() => {
                        setMode("reset");
                        setHeight1(220);
                      }}
                    >
                      <Text style={styles.miniLinkText}>Forgot Password?</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setMode("register");
                        setHeight1(380);
                        clearFields();
                      }}
                    >
                      <Text style={styles.linkText}>
                        Don't have an account? Register
                      </Text>
                    </Pressable>
                  </>
                )}

                {mode === "register" && (
                  <Pressable
                    onPress={() => {
                      setMode("login");
                      setHeight1(320);
                      clearFields();
                    }}
                  >
                    <Text style={styles.linkText}>Already have an account? Login</Text>
                  </Pressable>
                )}

                {mode === "reset" && (
                  <Pressable
                    onPress={() => {
                      setMode("login");
                      clearFields();
                      setHeight1(320);
                    }}
                  >
                    <Text style={styles.linkText}>Back to Login</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* CAPTCHA Modal */}
      <Modal
        visible={showCaptcha}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCaptcha(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.captchaContainer,
            { borderColor: captchaBorderColor, borderWidth: captchaBorderWidth }
          ]}>
            <Text style={styles.captchaTitle}>Verify You're Human</Text>

            <View style={[
              styles.mathProblem,
              { borderColor: captchaBorderColor, borderWidth: captchaBorderWidth }
            ]}>
              <Text style={styles.mathText}>{num1} + {num2} = ?</Text>
            </View>

            <TextInput
              style={[
                styles.captchaInput,
                { borderColor: captchaBorderColor, borderWidth: captchaBorderWidth }
              ]}
              placeholder="Enter answer"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={captchaAnswer}
              onChangeText={setCaptchaAnswer}
              autoFocus={true}
            />

            <View style={styles.captchaButtons}>
              <Pressable
                style={[styles.captchaButton, styles.cancelButton]}
                onPress={() => setShowCaptcha(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.captchaButton, styles.submitButton]}
                onPress={handleCaptchaSubmit}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <AlertComponent />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: "#fff" },
  innerContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  imageStyle: {
    width: 100,
    height: 100,
    marginTop: 60,
    marginBottom: 10,
  },
  textStyle: {
    color: "#fff",
    fontSize: 22,
    marginBottom: 30,
    fontWeight: "bold",
  },
  loginContainer: {
    width: "95%",
    minHeight: 320,
    padding: 20,
    paddingBottom: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 10,
  },
  loginTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  input: {
    width: "100%",
    backgroundColor: "#444",
    color: "#fff",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    borderRadius: 6,
    marginBottom: 15,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  otpInstruction: {
    color: "#ccc",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  otpInput: {
    width: "100%",
    backgroundColor: "#444",
    color: "#fff",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 15,
    marginBottom: 20,
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 8,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#4def96ff",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
  },
  linkText: {
    color: "#4def96ff",
    textAlign: "center",
    textDecorationLine: "underline",
    fontSize: 16,
    marginTop: 20,
  },
  miniLinkText: {
    color: "#4def96ff",
    textAlign: "center",
    textDecorationLine: "underline",
    fontSize: 16,
    marginTop: 20,
  },
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
    marginBottom: 20,
    color: "#333",
  },
  captchaButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  captchaButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
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
    backgroundColor: "#4def96ff",
  },
  submitButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
});