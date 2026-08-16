"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   A simple stored thread, not real-time chat — used on both /portal
   (role="client") and /coach/[leadId] (role="coach"). Polls on an
   interval instead of a websocket since near-instant delivery isn't
   the point here.
-------------------------------------------------------------------*/

export default function MessageThread({ leadId, role, initialMessages = [] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = () => {
    fetch(`/api/messages?leadId=${encodeURIComponent(leadId)}`)
      .then((r) => r.json())
      .then((res) => res.messages && setMessages(res.messages))
      .catch(() => {});
  };

  useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, body: text.trim() }),
      });
      setText("");
      refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="thread">
      <div className="thread-log">
        {messages.length === 0 && <p className="thread-empty">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={"thread-msg " + (m.sender === role ? "mine" : "theirs")}>
            <span className="thread-who">{m.sender === "coach" ? "Liz" : "You"}</span>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
      <div className="thread-compose">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={role === "coach" ? "Message this client…" : "Message Liz…"}
          rows={2}
        />
        <button className="cta small" onClick={send} disabled={sending || !text.trim()}>
          Send
        </button>
      </div>
      <style>{`
.thread{border:1px solid var(--edge);border-radius:4px;background:var(--tide);padding:16px;display:flex;flex-direction:column;gap:12px}
.thread-log{display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto}
.thread-empty{color:var(--mute);font-size:13px;margin:0}
.thread-msg{max-width:80%;padding:8px 12px;border-radius:6px;background:var(--ink)}
.thread-msg.mine{align-self:flex-end;background:var(--edge-lit)}
.thread-who{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-bottom:2px}
.thread-msg.mine .thread-who{color:rgba(255,255,255,.75)}
.thread-msg p{margin:0;font-size:14px;line-height:1.4;color:var(--chalk)}
.thread-msg.mine p{color:#FFFFFF}
.thread-compose{display:flex;gap:8px;align-items:flex-end}
.thread-compose textarea{flex:1;background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--body);font-size:14px;padding:10px;border-radius:3px;resize:vertical}
.thread-compose .cta.small{width:auto;padding:10px 16px}
      `}</style>
    </div>
  );
}
