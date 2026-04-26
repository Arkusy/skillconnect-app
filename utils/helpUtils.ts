
import { HelpMessage, HelpTicket } from './helpTypes';
import { supabase } from './supabase';

/**
 * Get tickets for a user
 */
export async function getUserTickets(userId: string): Promise<{ data: HelpTicket[] | null; error: any }> {
    try {
        const { data, error } = await supabase
            .from('help_tickets')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return { data: null, error };
    }
}

/**
 * Get all tickets for admin
 */
export async function getAllTickets(): Promise<{ data: HelpTicket[] | null; error: any }> {
    try {
        const { data, error } = await supabase
            .from('help_tickets')
            .select(`
                *,
                user:profiles!help_tickets_user_id_fkey(full_name, avatar_url, email)
            `)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        
        // Compute unread counts logic might be complex here, so maybe fetch separate or assume UI handles it via subscription
        return { data: data || [], error: null };
    } catch (error) {
        console.error('Error fetching all tickets:', error);
        return { data: null, error };
    }
}

/**
 * Get specific ticket details
 */
export async function getTicketDetails(ticketId: string): Promise<{ data: HelpTicket | null; error: any }> {
    try {
        const { data, error } = await supabase
            .from('help_tickets')
            .select(`
                *,
                user:profiles!help_tickets_user_id_fkey(full_name, avatar_url, email)
            `)
            .eq('id', ticketId)
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching ticket details:', error);
        return { data: null, error };
    }
}

/**
 * Create a new ticket
 */
export async function createTicket(
    userId: string, 
    subject: string, 
    initialMessage: string, 
    mediaUrl?: string
): Promise<{ data: HelpTicket | null; error: any }> {
    try {
        // 1. Create Ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('help_tickets')
            .insert({
                user_id: userId,
                subject: subject,
                status: 'open'
            })
            .select()
            .single();

        if (ticketError) throw ticketError;

        // 2. Create Initial Message
        const { error: messageError } = await supabase
            .from('help_messages')
            .insert({
                ticket_id: ticket.id,
                sender_id: userId,
                message_type: mediaUrl ? 'image' : 'text',
                message_text: initialMessage,
                media_url: mediaUrl || null,
                is_read: false
            });

        if (messageError) throw messageError;

        return { data: ticket, error: null };

    } catch (error) {
        console.error('Error creating ticket:', error);
        return { data: null, error };
    }
}

/**
 * Get messages for a ticket
 */
export async function getTicketMessages(ticketId: string): Promise<{ data: HelpMessage[] | null; error: any }> {
    try {
        const { data, error } = await supabase
            .from('help_messages')
            .select(`
                *,
                 sender:profiles!help_messages_sender_id_fkey(full_name, avatar_url)
            `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const transformed = data?.map(msg => ({
            ...msg,
            sender_name: msg.sender?.full_name || 'Support',
            sender_avatar: msg.sender?.avatar_url || null
        })) || [];

        return { data: transformed, error: null };
    } catch (error) {
        console.error('Error fetching ticket messages:', error);
        return { data: null, error };
    }
}

/**
 * Send a message in a ticket
 */
export async function sendHelpMessage(
    ticketId: string,
    senderId: string,
    messageText: string | null,
    mediaUrl?: string
): Promise<{ data: HelpMessage | null; error: any }> {
    try {
        const { data, error } = await supabase
            .from('help_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: senderId,
                message_type: mediaUrl ? 'image' : 'text',
                message_text: messageText,
                media_url: mediaUrl,
                is_read: false
            })
            .select()
            .single();

        if (error) throw error;

        // Update ticket updated_at
        await supabase
            .from('help_tickets')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', ticketId);

        return { data, error: null };
    } catch (error) {
        console.error('Error sending help message:', error);
        return { data: null, error };
    }
}

/**
 * Mark messages as read
 */
export async function markTicketAsRead(ticketId: string, userId: string): Promise<void> {
    try {
        // Mark messages NOT sent by me as read
        await supabase
            .from('help_messages')
            .update({ is_read: true })
            .eq('ticket_id', ticketId)
            .neq('sender_id', userId)
            .eq('is_read', false);
    } catch (error) {
        console.error('Error marking ticket read:', error);
    }
}

/**
 * Subscribe to ticket messages
 */
export function subscribeToTicketMessages(
    ticketId: string,
    onMessage: (message: HelpMessage) => void
) {
    const channel = supabase
        .channel(`help_messages:${ticketId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'help_messages',
                filter: `ticket_id=eq.${ticketId}`,
            },
            async (payload) => {
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', payload.new.sender_id)
                    .single();

                const message: HelpMessage = {
                    ...(payload.new as any),
                    sender_name: sender?.full_name || 'Support',
                    sender_avatar: sender?.avatar_url || null
                };
                onMessage(message);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
