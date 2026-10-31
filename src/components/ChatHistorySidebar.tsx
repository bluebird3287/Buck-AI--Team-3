import React, { useState } from 'react';
import { Check, MessageSquare, PanelLeftClose, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ChatConversation } from '../lib/chatLog';

interface ChatHistorySidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  disabled: boolean; // while BuckAI is answering, so a reply can't land in another chat
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
}

// Today / Previous 7 days / Previous 30 days / Older, like ChatGPT and Claude.
function groupByAge(conversations: ChatConversation[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const groups: { label: string; items: ChatConversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Previous 30 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const c of conversations) {
    const t = new Date(c.updatedAt).getTime();
    const i = t >= startOfToday.getTime() ? 0 : t >= startOfToday.getTime() - 7 * day ? 1 : t >= startOfToday.getTime() - 30 * day ? 2 : 3;
    groups[i].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  conversations,
  activeConversationId,
  disabled,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onCollapse,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const startRename = (c: ChatConversation) => {
    setEditingId(c.id);
    setDraftTitle(c.title);
  };
  const finishRename = () => {
    const title = draftTitle.trim();
    const current = conversations.find((c) => c.id === editingId);
    if (editingId && title && title !== current?.title) onRename(editingId, title);
    setEditingId(null);
  };

  return (
    <aside
      aria-label="Chat history"
      className="w-64 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden absolute inset-y-0 left-0 z-10 shadow-xl md:static md:shadow-none"
    >
      <div className="p-3 flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={onNewChat}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New chat</span>
        </button>
        <button
          onClick={onCollapse}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          title="Hide chat history"
          aria-label="Hide chat history"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {conversations.length === 0 && (
          <p className="px-2 text-xs text-gray-500">Your chats will appear here. Each one is saved so you can come back to it.</p>
        )}
        {groupByAge(conversations).map((group) => (
          <div key={group.label}>
            <h3 className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group.label}</h3>
            <ul className="space-y-0.5">
              {group.items.map((c) => {
                const isActive = c.id === activeConversationId;
                if (editingId === c.id) {
                  return (
                    <li key={c.id}>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          finishRename();
                        }}
                        className="flex items-center gap-1 px-1 py-1 bg-white border border-[#ba0c2f] rounded-lg"
                      >
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={finishRename}
                          onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                          maxLength={200}
                          aria-label="Chat name"
                          className="flex-1 min-w-0 text-sm px-1.5 py-0.5 focus:outline-none"
                        />
                        <button type="submit" className="p-1 text-gray-500 hover:text-emerald-700" aria-label="Save name">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-500 hover:text-gray-900"
                          aria-label="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </li>
                  );
                }
                return (
                  <li key={c.id} className="group relative">
                    <button
                      onClick={() => onSelect(c.id)}
                      disabled={disabled && !isActive}
                      aria-current={isActive ? 'page' : undefined}
                      title={c.title}
                      className={`w-full flex items-center gap-2 text-left text-sm pl-2 pr-14 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                        isActive ? 'bg-red-50 text-[#8a0a23] font-semibold' : 'text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#ba0c2f]' : 'text-gray-400'}`} />
                      <span className="truncate">{c.title}</span>
                    </button>
                    <div
                      className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center ${
                        isActive ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
                      }`}
                    >
                      <button
                        onClick={() => startRename(c)}
                        className="p-1 text-gray-500 hover:text-gray-900 rounded"
                        title="Rename"
                        aria-label={`Rename "${c.title}"`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${c.title}"? This can't be undone.`)) onDelete(c.id);
                        }}
                        disabled={disabled && isActive}
                        className="p-1 text-gray-500 hover:text-[#ba0c2f] disabled:opacity-40 rounded"
                        title="Delete"
                        aria-label={`Delete "${c.title}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};
