// utils/chatTypes.ts

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  created_at: string;
  last_message_at: string | null;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string | null;
  message_type: 'text' | 'image';
  media_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageWithSender extends Message {
  sender_name: string;
  sender_avatar: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ConversationWithParticipants extends Conversation {
  participant1: Profile;
  participant2: Profile;
}