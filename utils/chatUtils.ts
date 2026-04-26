// utils/chatUtils.ts
import type {
    ConversationWithParticipants,
    Message,
    MessageWithSender
} from './chatTypes';
import { notifyNewMessage } from './sendNotification';
import { supabase } from './supabase';

/**
 * Get or create a conversation between two users
 */
export async function getOrCreateConversation(
  userId: string,
  workerId: string,
  isHelpChannel: boolean = false
): Promise<{ data: string | null; error: any }> {
  try {
// Check if conversation exists (either direction)
    // We search without is_help_channel filter because there can only be one chat per pair
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('id, is_help_channel')
      .or(`and(participant_1.eq.${userId},participant_2.eq.${workerId}),and(participant_1.eq.${workerId},participant_2.eq.${userId})`)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching conversation:', fetchError);
      return { data: null, error: fetchError };
    }

    if (existing) {
      console.log('✅ Found existing conversation:', existing.id);
      
      // If the conversation exists but has a different help status, we might want to update it
      // OR just return it as is. Given the user wants "only one", we just return it.
      return { data: existing.id, error: null };
    }

    // Create new conversation
    console.log('📝 Creating new conversation...');
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1: userId,
        participant_2: workerId,
        is_help_channel: isHelpChannel
      })
      .select('id')
      .single();

    if (createError) {
      // Handle duplicate key error - conversation was created between our check and insert
      if (createError.code === '23505') {
        console.log('⚡ Race condition detected, retrying lookup...');
        // Retry the lookup without is_help_channel filter
        const { data: retryExisting, error: retryError } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant_1.eq.${userId},participant_2.eq.${workerId}),and(participant_1.eq.${workerId},participant_2.eq.${userId})`)
          .maybeSingle();

        if (retryError) {
          console.error('❌ Error on retry lookup:', retryError);
          return { data: null, error: retryError };
        }

        if (retryExisting) {
          console.log('✅ Found conversation on retry:', retryExisting.id);
          return { data: retryExisting.id, error: null };
        }
      }
      
      console.error('❌ Error creating conversation:', createError);
      return { data: null, error: createError };
    }

    console.log('✅ Created new conversation:', newConv.id);
    return { data: newConv.id, error: null };
  } catch (error) {
    console.error('❌ Exception in getOrCreateConversation:', error);
    return { data: null, error };
  }
}

/**
 * Get the Help Center conversation for a user (or create if missing)
 * Connects the user with the first Admin found.
 */
export async function getHelpConversation(userId: string): Promise<{ data: string | null; error: any }> {
    try {
        // 1. Find an Admin to chat with (role = 0)
        // In a real app, this might be a specific "Support" user, or round-robin.
        // For MVP, we pick the first admin we find who is NOT the current user.
        const { data: admin, error: adminError } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 0) 
            .neq('id', userId) // Ensure we don't chat with ourselves
            .limit(1)
            .single();
        
        if (adminError || !admin) {
             console.error("No admin found for support chat (or only admin is current user)");
             return { data: null, error: adminError || new Error("No support agent available") };
        }

        // 2. Get/Create conversation marked as is_help_channel
        return await getOrCreateConversation(userId, admin.id, true);

    } catch (error) {
        return { data: null, error };
    }
}

/**
 * Get conversation creation date (stored in UTC, will be converted to local timezone by client)
 */
export async function getConversationCreatedAt(
  conversationId: string
): Promise<{ data: string | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('created_at')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.error('❌ Error fetching conversation date:', error);
      return { data: null, error };
    }

    return { data: data.created_at, error: null };
  } catch (error) {
    console.error('❌ Exception in getConversationCreatedAt:', error);
    return { data: null, error };
  }
}

/**
 * Get all messages for a conversation with sender info
 * Messages are stored in UTC, will be converted to local timezone by client
 */
export async function getConversationMessages(
  conversationId: string
): Promise<{ data: MessageWithSender[] | null; error: any }> {
  try {
    console.log('📥 Loading messages for conversation:', conversationId);

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error loading messages:', error);
      return { data: null, error };
    }

    // Transform the data to include sender info at root level
    const transformedData = data?.map(msg => ({
      ...msg,
      sender_name: msg.sender?.full_name || 'Unknown',
      sender_avatar: msg.sender?.avatar_url || null,
    })) || [];

    console.log(`✅ Loaded ${transformedData.length} messages`);
    return { data: transformedData, error: null };
  } catch (error) {
    console.error('❌ Exception in getConversationMessages:', error);
    return { data: null, error };
  }
}

/**
 * Send a message
 * Message timestamps are stored in UTC automatically by Supabase
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  receiverId: string,
  messageText: string | null,
  mediaUrl?: string
): Promise<{ data: Message | null; error: any }> {
  try {
    console.log('📤 Sending message...', { hasText: !!messageText, hasMedia: !!mediaUrl });

    const messageType = mediaUrl ? 'image' : 'text';

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId,
        message_text: messageText,
        media_url: mediaUrl || null,
        message_type: messageType,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending message:', error);
      return { data: null, error };
    }

    console.log('✅ Message sent:', data.id);

    // Update conversation's last_message_at
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        last_message_preview: mediaUrl ? '📷 Image' : (messageText || 'New Message'), // Store preview
        updated_at: new Date().toISOString() 
      })
      .eq('id', conversationId);

    if (updateError) {
      console.warn('⚠️ Failed to update conversation timestamp:', updateError);
    }

    // --- Send Push Notification ---
    // 1. Get recipient's push token
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', receiverId)
      .single();

    if (recipientProfile?.expo_push_token) {
      // 2. Get sender's name (if we don't have it, we might need a quick fetch or pass it in)
      // For now, let's fetch it to be safe, or we could pass it as an argument to optimize
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .single();

      const senderName = senderProfile?.full_name || 'New Message';

      // 3. Send notification
      await notifyNewMessage(
        recipientProfile.expo_push_token,
        senderName,
        mediaUrl ? '📷 Sent an image' : (messageText || 'New message'),
        senderId
      );
    }
    // -----------------------------

    return { data, error: null };
  } catch (error) {
    console.error('❌ Exception in sendMessage:', error);
    return { data: null, error };
  }
}

/**
 * Mark all messages in a conversation as read for current user
 */
export async function markConversationAsRead(
  conversationId: string,
  currentUserId: string
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString() 
      })
      .eq('conversation_id', conversationId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error marking as read:', error);
    }

    return { error };
  } catch (error) {
    console.error('❌ Exception in markConversationAsRead:', error);
    return { error };
  }
}

/**
 * Subscribe to new messages in a conversation using REALTIME (postgres_changes)
 * This works on FREE TIER - no need for premium Replication
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: MessageWithSender) => void,
  onError?: (error: any) => void
) {
  console.log('🔔 Setting up realtime subscription for:', conversationId);

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        console.log('🔔 Realtime INSERT event:', payload.new.id);
        
        // Fetch sender info for the new message
        const { data: sender } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();

        const messageWithSender: MessageWithSender = {
          ...(payload.new as Message),
          sender_name: sender?.full_name || 'Unknown',
          sender_avatar: sender?.avatar_url || null,
        };

        onMessage(messageWithSender);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        console.log('🔔 Realtime UPDATE event:', payload.new.id);
        
        // Fetch sender info
        const { data: sender } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();

        const messageWithSender: MessageWithSender = {
          ...(payload.new as Message),
          sender_name: sender?.full_name || 'Unknown',
          sender_avatar: sender?.avatar_url || null,
        };

        onMessage(messageWithSender);
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error');
        if (onError) onError(new Error('Channel error'));
      } else if (status === 'TIMED_OUT') {
        console.error('❌ Subscription timed out');
        if (onError) onError(new Error('Subscription timed out'));
      } else if (status === 'CLOSED') {
        console.log('🔌 Channel closed');
      }
    });

  // Return cleanup function
  return () => {
    console.log('🔌 Unsubscribing from realtime channel');
    supabase.removeChannel(channel);
  };
}

/**
 * Get all conversations for a user with participant info
 */
export async function getUserConversations(
  userId: string
): Promise<{ data: ConversationWithParticipants[] | null; error: any }> {
  try {
    console.log('📥 Loading conversations for user:', userId);

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        last_message_preview, 
        participant1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url),
        participant2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url)
      `)
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .eq('is_help_channel', false) // Exclude help channels
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('❌ Error loading conversations:', error);
      return { data: null, error };
    }

    console.log(`✅ Loaded ${data?.length || 0} conversations`);
    return { data: data || [], error: null };
  } catch (error) {
    console.error('❌ Exception in getUserConversations:', error);
    return { data: null, error };
  }
}

/**
 * Get unread message count for a conversation
 */
export async function getUnreadCount(
  conversationId: string,
  userId: string
): Promise<{ data: number; error: any }> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error getting unread count:', error);
      return { data: 0, error };
    }

    return { data: count || 0, error: null };
  } catch (error) {
    console.error('❌ Exception in getUnreadCount:', error);
    return { data: 0, error };
  }
}