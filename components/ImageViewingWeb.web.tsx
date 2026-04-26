// Web-compatible replacement for react-native-image-viewing
// The native library has no web support, so we provide a basic modal viewer here.

import React, { useEffect, useCallback } from 'react';
import { Modal, View, Image, Pressable, Text, StyleSheet, Platform } from 'react-native';

interface ImageSource {
  uri: string;
}

interface ImageViewingProps {
  images: ImageSource[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  // These are native-only props — accepted but unused on web
  swipeToCloseEnabled?: boolean;
  doubleTapToZoomEnabled?: boolean;
  keyExtractor?: (imageSrc: ImageSource, index: number) => string;
  animationType?: 'none' | 'fade' | 'slide';
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  backgroundColor?: string;
  HeaderComponent?: React.ComponentType<{ imageIndex: number }>;
  FooterComponent?: React.ComponentType<{ imageIndex: number }>;
}

export default function ImageViewing({
  images,
  imageIndex,
  visible,
  onRequestClose,
}: ImageViewingProps) {
  const [currentIndex, setCurrentIndex] = React.useState(imageIndex);

  useEffect(() => {
    setCurrentIndex(imageIndex);
  }, [imageIndex, visible]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onRequestClose();
    },
    [visible, goNext, goPrev, onRequestClose]
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  if (!visible || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={onRequestClose}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {/* Counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* Prev arrow */}
        {currentIndex > 0 && (
          <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={goPrev}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
        )}

        {/* Image */}
        <Pressable style={styles.imagePressable} onPress={onRequestClose}>
          <Image
            source={{ uri: currentImage.uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </Pressable>

        {/* Next arrow */}
        {currentIndex < images.length - 1 && (
          <Pressable style={[styles.arrow, styles.arrowRight]} onPress={goNext}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePressable: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    maxWidth: 900,
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  counter: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
  },
  arrowLeft: { left: 16 },
  arrowRight: { right: 16 },
  arrowText: {
    color: '#fff',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '300',
  },
});
