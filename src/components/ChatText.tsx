import React from 'react';

// Renders the light Markdown the advising chat writes: **bold**, [links](https://...), "- " bullets (two-space
// indents nest), and blank-line paragraphs. Anything else shows as plain text; no HTML is ever injected.
const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g;

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${keyBase}-${i++}`}>{m[1]}</strong>);
    else
      out.push(
        <a key={`${keyBase}-${i++}`} href={m[3]} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-[#ba0c2f]">
          {m[2]}
        </a>,
      );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const ChatText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <div className={className}>
      {lines.map((line, n) => {
        if (!line.trim()) return <div key={n} className="h-2" />;
        const bullet = /^(\s*)[-•*]\s+(.*)$/.exec(line);
        if (bullet) {
          const depth = Math.min(3, Math.floor(bullet[1].length / 2));
          return (
            <div key={n} className="flex gap-1.5" style={{ paddingLeft: `${depth * 14}px` }}>
              <span aria-hidden className="select-none">•</span>
              <span className="min-w-0">{inline(bullet[2], String(n))}</span>
            </div>
          );
        }
        const heading = /^#{1,4}\s+(.*)$/.exec(line);
        if (heading) return <div key={n} className="font-bold">{inline(heading[1], String(n))}</div>;
        return <div key={n}>{inline(line, String(n))}</div>;
      })}
    </div>
  );
};
