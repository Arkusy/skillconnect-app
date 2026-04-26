// utils/useAuth.ts
import { useState } from "react";
import { useCustomAlert } from "../components/CustomAlert";
import { supabase } from "./supabase";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertComponent } = useCustomAlert();

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showAlert("Login Error", error.message);
    setLoading(false);
    return !error;
  };

  const signUpWithEmail = async (email: string, password: string, username?: string) => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: username || "Anonymous" } // save username as 'name'
      },
    });

    if (error) showAlert("Registration Error", error.message);
    else showAlert("Pending", "Please check your inbox for email verification!", "info");

    setLoading(false);
    return !error;
  };

  // Reset password function
  const resetPassword = async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) showAlert("Reset Password Error", error.message);
    else showAlert("Recovery Email Sent", "Check your inbox to reset password.", "info");
    setLoading(false);
    return !error;
  };

  return { loading, signInWithEmail, signUpWithEmail, resetPassword };
}
