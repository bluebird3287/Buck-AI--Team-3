// Keeps the harness from writing to the real database: Supabase writes are answered locally.
const real = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (url.includes('/rest/v1/') && method !== 'GET' && method !== 'HEAD') {
    let body: any = {};
    try { body = JSON.parse(String(init?.body ?? '{}')); } catch {}
    const row = { id: crypto.randomUUID(), status: 'new', ai_review: null, decision: null, appointment: null, details: null,
      submitted_at: new Date().toISOString(), ...(Array.isArray(body) ? body[0] : body) };
    console.info('[harness] faked', method, url.split('?')[0]);
    return new Response(JSON.stringify(row), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/rest/v1/') && /chat_conversations|chat_messages|advising_requests|advisor_closed_slots/.test(url)) {
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } });
  }
  return real(input as any, init);
};
