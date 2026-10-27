import { supabase } from './supabase';
import type { ChatMessage } from '../components/AiChatWidget';

// Each student's BuckAI conversation, kept in public.chat_messages (own rows only, via RLS).

const HISTORY_LIMIT = 200;

interface ChatRow {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta: Partial<ChatMessage> | null;
  created_at: string;
}

// The student's most recent messages, oldest first.
export async function loadChatLog(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, text, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    console.warn('Could not load chat history:', error);
    return [];
  }
  return (data as ChatRow[])
    .reverse()
    .map((r) => ({ ...(r.meta ?? {}), id: `db-${r.id}`, role: r.role, text: r.text, sentAt: r.created_at }));
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  const { id: _id, role, text, pending: _pending, sentAt: _sentAt, ...meta } = msg;
  const { error } = await supabase.from('chat_messages').insert({ role, text: text.slice(0, 20000), meta });
  if (error) console.warn('Could not save chat message:', error);
}
