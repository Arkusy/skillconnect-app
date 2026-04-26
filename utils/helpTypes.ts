
export interface HelpTicket {
    id: string;
    user_id: string;
    subject: string;
    status: 'open' | 'closed' | 'resolved';
    created_at: string;
    updated_at: string;
    description?: string; // Optional if we decide to add it, but plan said subject + messages
    user?: {
        full_name: string;
        avatar_url: string | null;
        email?: string;
    };
    last_message_preview?: string; // Computed
    unread_count?: number; // Computed
}

export interface HelpMessage {
    id: string;
    ticket_id: string;
    sender_id: string;
    message_type: 'text' | 'image';
    message_text: string | null;
    media_url: string | null;
    is_read: boolean;
    created_at: string;
    sender_name?: string;
    sender_avatar?: string | null;
}
