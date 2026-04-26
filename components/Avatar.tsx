// components/Avatar.tsx
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { useCustomAlert } from "../components/CustomAlert";
import { supabase } from "../utils/supabase";

interface Props {
  size: number;
  url: string | null;
  onUpload: (filePath: string) => void;
  editable?: boolean;
}

export default function Avatar({ url, size = 120, onUpload, editable = true }: Props) {
  const { showAlert, AlertComponent } = useCustomAlert();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarSize = { height: size, width: size, borderRadius: size / 2 };

  useEffect(() => {
    if (url) {
      downloadImage(url);
    } else {
      setAvatarUrl(null);
    }
  }, [url]);

  async function downloadImage(path: string) {
    try {
      // Skip if it's a malformed URL (should be just a path)
      if (path.startsWith('http')) {
        console.warn('⚠️ Malformed avatar URL detected, skipping download');
        setAvatarUrl(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from("avatars")
        .download(path);

      if (error) throw error;

      const fr = new FileReader();
      fr.readAsDataURL(data);
      fr.onload = () => {
        setAvatarUrl(fr.result as string);
        console.log('✅ Avatar image downloaded successfully');
      };
    } catch (error) {
      if (error instanceof Error) {
        console.log("Error downloading image:", error);
      }
      setAvatarUrl(null);
    }
  }

  async function uploadAvatar() {
    try {
      setUploading(true);

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert("Permission Required", "Please grant photo library access");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        console.log('Image selection cancelled');
        return;
      }

      const image = result.assets[0];
      console.log('📸 Image selected, compressing...');

      // Compress image before upload
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        image.uri,
        [{ resize: { width: 600, height: 600 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      console.log('✅ Image compressed');

      // Convert to ArrayBuffer for React Native
      const response = await fetch(manipulatedImage.uri);
      const arraybuffer = await response.arrayBuffer();

      // Get current user ID for folder structure
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const timestamp = Date.now();
      const path = `${user.id}/${timestamp}.jpeg`;

      console.log('⬆️ Uploading to:', path);

      // DELETE OLD FILE FROM STORAGE (if url exists and is a valid path)
      if (url && !url.startsWith('http')) {
        try {
          const { error: deleteError } = await supabase.storage
            .from('avatars')
            .remove([url]);

          if (!deleteError) {
            console.log('🗑️ Old avatar deleted from storage');
          }
        } catch (err) {
          console.log('⚠️ Could not delete old avatar:', err);
        }
      }

      // Upload compressed image
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arraybuffer, {
          contentType: "image/jpeg",
          upsert: false
        });

      if (uploadError) throw uploadError;

      console.log('✅ Upload successful');

      // Immediately download the new image
      await downloadImage(path);

      // Notify parent component with the path
      onUpload(path);

    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Upload error:', error);
        showAlert("Error", error.message);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={editable ? uploadAvatar : undefined} disabled={uploading || !editable}>
        {uploading ? (
          <View style={[avatarSize, styles.avatar, styles.loadingContainer]}>
            <ActivityIndicator size="large" color="#059ef1" />
          </View>
        ) : (
          <Image
            key={url} // Force re-render when URL changes
            source={
              avatarUrl
                ? { uri: avatarUrl }
                : require("../assets/images/cutey.jpg")
            }
            style={[avatarSize, styles.avatar]}
          />
        )}
      </Pressable>
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginBottom: 20 },
  avatar: {
    backgroundColor: "#444",
    borderWidth: 2,
    borderColor: "#4def96ff",
    top: 35,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});