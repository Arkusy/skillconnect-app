// components/Ratingmodal.tsx

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../utils/supabase';
import { checkOneStarDemotion, demoteWorker } from '../utils/workerUtils';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  workerProfileId: string;
  userId: string;
  onRatingSubmitted: () => void;
}

const MAX_REVIEW_LENGTH = 500;

export default function RatingModal({
  visible,
  onClose,
  orderId,
  workerProfileId,
  userId,
  onRatingSubmitted,
}: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (selectedRating === 0) return;

    setLoading(true);
    try {
      // Check if rating already exists for this order (silently)
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('order_id', orderId)
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() to avoid error when no rows found

      if (existingRating) {
        // Rating exists, just close modal and refresh
        onRatingSubmitted();
        resetAndClose();
        return;
      }

      // Insert rating - the database trigger will automatically update worker_profiles
      const { error: ratingError } = await supabase.from('ratings').insert({
        order_id: orderId,
        worker_profile_id: workerProfileId,
        user_id: userId,
        rating: selectedRating,
        review: review.trim() || null,
      });

      if (ratingError) {
        // Check if it's a duplicate key error
        if (ratingError.code === '23505') {
          alert('You have already rated this service.');
          onRatingSubmitted();
          resetAndClose();
          return;
        }
        throw ratingError;
      }

      // Update order is_rated flag - try to update, but don't fail if RLS blocks it
      try {
        await supabase
          .from('orders')
          .update({ is_rated: true })
          .eq('id', orderId)
          .eq('user_id', userId);
      } catch (updateError) {
        // Silently ignore RLS errors - the rating was saved successfully
        console.log('Order is_rated flag update skipped due to permissions');
      }

      // Success! The database trigger has already updated the worker_profiles table
      onRatingSubmitted();

      // Check for 1-star demotion
      if (selectedRating === 1) {
        try {
          // Get worker's user_id from worker_profiles
          const { data: workerProfile } = await supabase
            .from('worker_profiles')
            .select('user_id')
            .eq('id', workerProfileId)
            .single();

          if (workerProfile) {
            const demotionCheck = await checkOneStarDemotion(workerProfile.user_id);

            if (demotionCheck.shouldDemote) {
              // Auto-demote worker due to 5+ one-star reviews
              await demoteWorker(
                workerProfile.user_id,
                null, // system-initiated
                `Automatic demotion: Received ${demotionCheck.count} one-star reviews from different users`
              );
              console.log('Worker demoted due to excessive 1-star reviews');
            } else if (demotionCheck.count >= 3) {
              // Warning threshold - could trigger notification here
              console.log(`Warning: Worker has ${demotionCheck.count} one-star reviews`);
            }
          }
        } catch (demotionError) {
          // Don't fail the rating submission if demotion check fails
          console.error('Error in demotion check:', demotionError);
        }
      }

      resetAndClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setSelectedRating(0);
    setReview('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Rate this Service</Text>
              <Text style={styles.subtitle}>How was your experience?</Text>
            </View>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  disabled={loading}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= selectedRating ? '#4def96' : '#ccc'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {selectedRating > 0 && (
              <Text style={styles.ratingText}>
                {selectedRating === 1 && 'Poor'}
                {selectedRating === 2 && 'Fair'}
                {selectedRating === 3 && 'Good'}
                {selectedRating === 4 && 'Very Good'}
                {selectedRating === 5 && 'Excellent'}
              </Text>
            )}

            {/* Review Input */}
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Review (Optional)</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                placeholderTextColor="#999"
                value={review}
                onChangeText={setReview}
                multiline
                maxLength={MAX_REVIEW_LENGTH}
                editable={!loading}
                numberOfLines={4}
              />
              <Text style={styles.charCount}>
                {review.length}/{MAX_REVIEW_LENGTH}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={resetAndClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  selectedRating === 0 && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={selectedRating === 0 || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 450,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 3,
    borderColor: '#4def96',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2f4f4f',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4def96',
    textAlign: 'center',
    marginBottom: 24,
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2f4f4f',
    marginBottom: 10,
  },
  reviewInput: {
    borderWidth: 2,
    borderColor: '#4def96',
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    maxHeight: 120,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 6,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#4def96',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#2f4f4f',
    fontSize: 16,
    fontWeight: 'bold',
  },
});