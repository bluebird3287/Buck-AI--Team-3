import { supabase } from './supabase';
import type { ChatMessage } from '../components/AiChatWidget';

// Each student's BuckAI chats: public.chat_conversations holds the list, and
// public.chat_messages the messages in each (own rows only, via RLS).

const HISTORY_LIMIT = 200;

export interface ChatConversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatRow {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta: Partial<ChatMessage> | null;
  created_at: string;
}

// The student's chats, most recently used first.
export async function listConversations(): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('Could not load chats:', error);
    return [];
  }
  return data.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
}

// Starts a chat; the database names it after the first question.
export async function createConversation(): Promise<string | null> {
  const { data, error } = await supabase.from('chat_conversations').insert({}).select('id').single();
  if (error) {
    console.warn('Could not start a chat:', error);
    return null;
  }
  return data.id;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('chat_conversations').update({ title: title.slice(0, 200) }).eq('id', id);
  if (error) console.warn('Could not rename chat:', error);
}

// Deletes the chat and its messages.
export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
  if (error) console.warn('Could not delete chat:', error);
}

// A chat's most recent messages, oldest first.
export async function loadChatLog(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, text, meta, created_at')
    .eq('conversation_id', conversationId)
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

export async function saveChatMessage(conversationId: string, msg: ChatMessage): Promise<void> {
  const { id: _id, role, text, pending: _pending, sentAt: _sentAt, ...meta } = msg;
  const { error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, role, text: text.slice(0, 20000), meta });
  if (error) console.warn('Could not save chat message:', error);
}
