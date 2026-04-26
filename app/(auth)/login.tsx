// app/(auth)/login.tsx

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CaptchaModal from "../../components/CaptchaModal";
import { useCustomAlert } from "../../components/CustomAlert";
import LoadingOverlay from "../../components/LoadingOverlay";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../utils/useAuth";

const myIcon = require("../../assets/images/icon-transparent.png");

const KEYBOARD_CONFIG = {
  extraBottomPadding: 230,
  iosOffset: 0,
  minBottomPadding: 0,
};

export default function LoginX() {
  const { showAlert, AlertComponent } = useCustomAlert();
  const [height1, setHeight1] = useState(360);
  const router = useRouter();
  const { loading: authLoading, signInWithEmail } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "reset" | "verify-otp" | "reset-otp">("login");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [showCaptcha, setShowCaptcha] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

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

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const clearFields = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setOtp("");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowConfirmPassword(false);
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateFields = () => {
    if (mode === "verify-otp") {
      if (!otp || otp.length !== 6) {
        showAlert("Error", "Please enter the 6-digit OTP sent to your email.");
        return false;
      }
      return true;
    }

    if (mode === "reset-otp") {
      if (!resetOtp || resetOtp.length !== 6) {
        showAlert("Error", "Please enter the 6-digit OTP sent to your email.");
        return false;
      }
      if (!newPassword || newPassword.length < 6) {
        showAlert("Error", "New password must be at least 6 characters long.");
        return false;
      }
      if (newPassword !== confirmNewPassword) {
        showAlert("Error", "Passwords do not match.");
        return false;
      }
      return true;
    }

    if (mode === "reset") {
      if (!email) {
        showAlert("Error", "Email is required.");
        return false;
      }
      if (!isValidEmail(email)) {
        showAlert("Error", "Please enter a valid email address.");
        return false;
      }
      return true;
    }

    if (!email || !password) {
      showAlert("Error", "Email and Password are required.");
      return false;
    }

    if (!isValidEmail(email)) {
      showAlert("Error", "Please enter a valid email address.");
      return false;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        showAlert("Error", "Full name is required.");
        return false;
      }
      if (!confirmPassword) {
        showAlert("Error", "Please confirm your password.");
        return false;
      }
      if (password !== confirmPassword) {
        showAlert("Error", "Passwords do not match.");
        return false;
      }
      if (password.length < 6) {
        showAlert("Error", "Password must be at least 6 characters long.");
        return false;
      }
    }

    return true;
  };

  const handleButtonPress = () => {
    if (!validateFields()) return;

    if (mode === "verify-otp") {
      handleVerifyOtp();
      return;
    }

    if (mode === "reset-otp") {
      handleResetPasswordWithOtp();
      return;
    }

    setShowCaptcha(true);
  };

  const handleCaptchaSuccess = () => {
    setShowCaptcha(false);
    setIsSubmitting(true);

    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  const handleSubmit = async () => {
    try {
      if (mode === "reset") {
        setLoadingMessage("Sending OTP...");
        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
          showAlert("Error", error.message);
        } else {
          setPendingEmail(email);
          showAlert(
            "OTP Sent",
            "A 6-digit OTP has been sent to your email. Please check your inbox."
          );
          setMode("reset-otp");
          setHeight1(460);
        }
        return;
      }

      if (mode === "register") {
        setLoadingMessage("Creating account...");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName.trim(),
              role: 2
            },
          },
        });

        if (error) {
          showAlert("Error", error.message);
        } else if (data.user) {
          setPendingEmail(email);
          setPendingPassword(password);

          showAlert(
            "Registration Started",
            "A 6-digit OTP has been sent to your email. Please verify to complete registration."
          );

          setMode("verify-otp");
          setHeight1(320);
        }
      } else {
        setLoadingMessage("Signing in...");
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
        } else {
          showAlert("Error", "Email or password is incorrect");
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      showAlert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setIsSubmitting(true);
      setLoadingMessage("Verifying OTP...");

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
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: fullName.trim() || data.user.email?.split('@')[0] || 'User',
              email: data.user.email!,
              role: 2,
            });

          if (profileError) {
            showAlert("Warning", "Account verified but profile creation pending. Please try logging in.");
          }
        }

        showAlert(
          "Verification Successful",
          "Your account has been verified! Logging you in..."
        );

        setTimeout(async () => {
          const success = await signInWithEmail(pendingEmail, pendingPassword);
          if (success) {
            clearFields();
            router.replace("/(tabs)/Home");
          } else {
            clearFields();
            setMode("login");
            setHeight1(360);
          }
        }, 1500);
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      showAlert("Error", "Failed to verify OTP. Please try again.");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  };

  const handleResetPasswordWithOtp = async () => {
    try {
      setIsSubmitting(true);
      setLoadingMessage("Resetting password...");

      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: resetOtp,
        type: 'recovery'
      });

      if (error) {
        showAlert("Error", error.message);
        return;
      }

      if (data.session) {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) {
          showAlert("Error", updateError.message);
          return;
        }

        showAlert(
          "Password Reset Successful",
          "Your password has been updated. You can now login with your new password."
        );

        clearFields();
        setMode("login");
        setHeight1(360);
      }
    } catch (err) {
      console.error("Reset password error:", err);
      showAlert("Error", "Failed to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  };

  const handleResendOtp = async () => {
    try {
      setIsSubmitting(true);
      setLoadingMessage("Resending OTP...");

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
      });

      if (error) {
        showAlert("Error", error.message);
      } else {
        showAlert("Success", "New OTP sent to your email.");
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      showAlert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  };

  const handleResendResetOtp = async () => {
    try {
      setIsSubmitting(true);
      setLoadingMessage("Resending OTP...");

      const { error } = await supabase.auth.resetPasswordForEmail(pendingEmail);

      if (error) {
        showAlert("Error", error.message);
      } else {
        showAlert("Success", "New OTP sent to your email.");
      }
    } catch (error) {
      console.error("Resend reset OTP error:", error);
      showAlert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  };

  if (checkingAuth) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#d5e0dbff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={KEYBOARD_CONFIG.iosOffset}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            <Image source={myIcon} style={styles.imageStyle} />
            <Text style={styles.textStyle}>SkillConnect</Text>

            <View style={[styles.loginContainer, { minHeight: height1 }]}>
              <Text style={styles.loginTitle}>
                {mode === "login"
                  ? "Welcome Back"
                  : mode === "register"
                    ? "Create Account"
                    : mode === "verify-otp"
                      ? "Verify Email"
                      : mode === "reset-otp"
                        ? "Reset Password"
                        : "Forgot Password"}
              </Text>

              {mode === "verify-otp" ? (
                <>
                  <Text style={styles.otpInstruction}>
                    Enter the verification code sent to{"\n"}
                    <Text style={styles.emailHighlight}>{pendingEmail}</Text>
                  </Text>

                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor="#888"
                    value={otp}
                    onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="numeric"
                    maxLength={6}
                    autoFocus={true}
                    editable={!isSubmitting}
                  />

                  <Pressable
                    style={[styles.button, isSubmitting && { opacity: 0.6 }]}
                    onPress={handleButtonPress}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.buttonText}>Verify & Continue</Text>
                  </Pressable>

                  <Pressable onPress={handleResendOtp} disabled={isSubmitting}>
                    <Text style={[styles.miniLinkText, isSubmitting && { opacity: 0.5 }]}>
                      Didn't receive code? Resend
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setMode("register");
                      setHeight1(440);
                      setOtp("");
                    }}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.linkText, isSubmitting && { opacity: 0.5 }]}>
                      ← Back to Registration
                    </Text>
                  </Pressable>
                </>
              ) : mode === "reset-otp" ? (
                <>
                  <Text style={styles.otpInstruction}>
                    Enter the verification code sent to{"\n"}
                    <Text style={styles.emailHighlight}>{pendingEmail}</Text>
                  </Text>

                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor="#888"
                    value={resetOtp}
                    onChangeText={(text) => setResetOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isSubmitting}
                  />

                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="New Password"
                      placeholderTextColor="#888"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoCapitalize="none"
                      editable={!isSubmitting}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword((p) => !p)}
                      style={styles.eyeButton}
                      disabled={isSubmitting}
                    >
                      <Ionicons
                        name={showNewPassword ? "eye-off" : "eye"}
                        size={22}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#888"
                      secureTextEntry={!showConfirmNewPassword}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      autoCapitalize="none"
                      editable={!isSubmitting}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmNewPassword((p) => !p)}
                      style={styles.eyeButton}
                      disabled={isSubmitting}
                    >
                      <Ionicons
                        name={showConfirmNewPassword ? "eye-off" : "eye"}
                        size={22}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>

                  <Pressable
                    style={[styles.button, isSubmitting && { opacity: 0.6 }]}
                    onPress={handleButtonPress}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.buttonText}>Reset Password</Text>
                  </Pressable>

                  <Pressable onPress={handleResendResetOtp} disabled={isSubmitting}>
                    <Text style={[styles.miniLinkText, isSubmitting && { opacity: 0.5 }]}>
                      Didn't receive code? Resend
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setMode("reset");
                      setHeight1(260);
                      setResetOtp("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                    }}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.linkText, isSubmitting && { opacity: 0.5 }]}>
                      ← Back
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {mode === "register" && (
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#888"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      editable={!isSubmitting}
                    />
                  )}

                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="#888"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isSubmitting}
                  />

                  {mode !== "reset" && (
                    <>
                      <View style={styles.passwordContainer}>
                        <TextInput
                          style={styles.passwordInput}
                          placeholder="Password"
                          placeholderTextColor="#888"
                          secureTextEntry={!showPassword}
                          value={password}
                          onChangeText={setPassword}
                          autoCapitalize="none"
                          editable={!isSubmitting}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword((p) => !p)}
                          style={styles.eyeButton}
                          disabled={isSubmitting}
                        >
                          <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={22}
                            color="#666"
                          />
                        </TouchableOpacity>
                      </View>

                      {mode === "register" && (
                        <View style={styles.passwordContainer}>
                          <TextInput
                            style={styles.passwordInput}
                            placeholder="Confirm Password"
                            placeholderTextColor="#888"
                            secureTextEntry={!showConfirmPassword}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            autoCapitalize="none"
                            editable={!isSubmitting}
                          />
                          <TouchableOpacity
                            onPress={() => setShowConfirmPassword((p) => !p)}
                            style={styles.eyeButton}
                            disabled={isSubmitting}
                          >
                            <Ionicons
                              name={showConfirmPassword ? "eye-off" : "eye"}
                              size={22}
                              color="#666"
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  <Pressable
                    style={[styles.button, (authLoading || isSubmitting) && { opacity: 0.6 }]}
                    onPress={handleButtonPress}
                    disabled={authLoading || isSubmitting}
                  >
                    <Text style={styles.buttonText}>
                      {mode === "login"
                        ? "Sign In"
                        : mode === "register"
                          ? "Create Account"
                          : "Send Reset Code"}
                    </Text>
                  </Pressable>

                  {mode === "login" && (
                    <>
                      <Pressable
                        onPress={() => {
                          setMode("reset");
                          setHeight1(260);
                        }}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.miniLinkText, isSubmitting && { opacity: 0.5 }]}>
                          Forgot your password?
                        </Text>
                      </Pressable>

                      <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                      </View>

                      <Pressable
                        onPress={() => {
                          setMode("register");
                          setHeight1(440);
                          clearFields();
                        }}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.newAccText, isSubmitting && { opacity: 0.5 }]}>
                          Create new account
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {mode === "register" && (
                    <Pressable
                      onPress={() => {
                        setMode("login");
                        setHeight1(360);
                        clearFields();
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.linkText, isSubmitting && { opacity: 0.5 }]}>
                        Already have an account? Sign in
                      </Text>
                    </Pressable>
                  )}

                  {mode === "reset" && (
                    <Pressable
                      onPress={() => {
                        setMode("login");
                        clearFields();
                        setHeight1(360);
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.linkText, isSubmitting && { opacity: 0.5 }]}>
                        ← Back to Sign In
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>

          <View style={{
            height: keyboardVisible
              ? KEYBOARD_CONFIG.extraBottomPadding
              : KEYBOARD_CONFIG.minBottomPadding
          }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CaptchaModal
        visible={showCaptcha}
        onSuccess={handleCaptchaSuccess}
        onCancel={() => setShowCaptcha(false)}
        isSubmitting={isSubmitting}
      />

      <LoadingOverlay
        visible={isSubmitting && !showCaptcha}
        message={loadingMessage}
      />

      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  innerContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
    bottom: 30,
  },
  imageStyle: {
    width: 80,
    height: 80,
    marginTop: 50,
    marginBottom: 12,
  },
  textStyle: {
    color: "#000",
    fontSize: 26,
    marginBottom: 40,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loginContainer: {
    width: "100%",
    maxWidth: 420,
    minHeight: 360,
    padding: 28,
    paddingBottom: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loginTitle: {
    fontSize: 24,
    color: "#000",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  input: {
    width: "100%",
    backgroundColor: "#F5F5F5",
    color: "#000",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    marginBottom: 14,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  passwordInput: {
    flex: 1,
    color: "#000",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  otpInstruction: {
    color: "#666",
    textAlign: "center",
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  emailHighlight: {
    color: "#000",
    fontWeight: "600",
  },
  otpInput: {
    width: "100%",
    backgroundColor: "#F5F5F5",
    color: "#000",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 20,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 12,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  button: {
    backgroundColor: "#000",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  linkText: {
    color: "#000",
    textAlign: "center",
    fontSize: 15,
    marginTop: 20,
    fontWeight: "500",
  },
  newAccText: {
    color: "#000",
    textAlign: "center",
    fontSize: 15,
    marginTop: 0,
    fontWeight: "500",
    bottom: 0,
  },
  miniLinkText: {
    color: "#666",
    textAlign: "center",
    fontSize: 14,
    marginTop: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    color: "#999",
    paddingHorizontal: 16,
    fontSize: 14,
  },
});