import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { getSocket, disconnectSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";

interface MessageUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MODERATOR" | "MEMBER";
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: MessageUser;
}

interface Participant extends MessageUser {
  isMuted: boolean;
  joinedAt: string;
}

interface PresenceEvent {
  userId: string;
}

export default function Chat() {
  const { channelId } = useParams<{ channelId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [channelName, setChannelName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canModerate = user?.role === "ADMIN" || user?.role === "MODERATOR";

  useEffect(() => {
    if (!channelId) return;

    let active = true;

    async function load() {
      try {
        const [channelRes, messagesRes, participantsRes] = await Promise.all([
          api.get(`/channels/${channelId}`),
          api.get(`/channels/${channelId}/messages`),
          api.get(`/channels/${channelId}/participants`),
        ]);
        if (!active) return;
        setChannelName(channelRes.data.channel.name);
        setMessages(messagesRes.data.messages);
        setParticipants(participantsRes.data.participants);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load channel");
      }
    }
    load();

    const socket = getSocket();
    socket.emit("join_room", { channelId });

    function onNewMessage({ message }: { message: Message }) {
      setMessages((prev) => [...prev, message]);
    }
    function onMessageDeleted({ messageId }: { messageId: string }) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    function onMemberJoined() {
      api.get(`/channels/${channelId}/participants`).then((r) => setParticipants(r.data.participants));
    }
    function onMemberLeft({ userId }: { userId: string }) {
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    }
    function onMemberMuted({ userId }: { userId: string }) {
      setParticipants((prev) => prev.map((p) => (p.id === userId ? { ...p, isMuted: true } : p)));
    }
    function onMemberUnmuted({ userId }: { userId: string }) {
      setParticipants((prev) => prev.map((p) => (p.id === userId ? { ...p, isMuted: false } : p)));
    }
    function onTyping({ userId, isTyping }: { userId: string; isTyping: boolean }) {
      if (userId === user?.id) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    }
    function onOnlineUsers({ userIds }: { userIds: string[] }) {
      setOnlineUserIds(new Set(userIds));
    }
    function onUserOnline({ userId }: PresenceEvent) {
      setOnlineUserIds((prev) => new Set(prev).add(userId));
    }
    function onUserOffline({ userId }: PresenceEvent) {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
    function onChannelDeleted() {
      alert("This channel was deleted.");
      navigate("/dashboard");
    }
    function onErrorMessage({ message }: { message: string }) {
      setError(message);
    }

    socket.on("new_message", onNewMessage);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("presence_join", onMemberJoined);
    socket.on("member_joined", onMemberJoined);
    socket.on("presence_leave", onMemberLeft);
    socket.on("member_left", onMemberLeft);
    socket.on("member_muted", onMemberMuted);
    socket.on("member_unmuted", onMemberUnmuted);
    socket.on("typing", onTyping);
    socket.on("online_users", onOnlineUsers);
    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("channel_deleted", onChannelDeleted);
    socket.on("error_message", onErrorMessage);

    return () => {
      active = false;
      socket.emit("leave_room", { channelId });
      socket.off("new_message", onNewMessage);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("presence_join", onMemberJoined);
      socket.off("member_joined", onMemberJoined);
      socket.off("presence_leave", onMemberLeft);
      socket.off("member_left", onMemberLeft);
      socket.off("member_muted", onMemberMuted);
      socket.off("member_unmuted", onMemberUnmuted);
      socket.off("typing", onTyping);
      socket.off("online_users", onOnlineUsers);
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("channel_deleted", onChannelDeleted);
      socket.off("error_message", onErrorMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  function handleTyping() {
    const socket = getSocket();
    socket.emit("typing", { channelId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { channelId, isTyping: false });
    }, 1500);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    try {
      await api.post(`/channels/${channelId}/messages`, { content });
      setContent("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to send message");
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      await api.delete(`/channels/${channelId}/messages/${messageId}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete message");
    }
  }

  async function handleMute(userId: string, mute: boolean) {
    try {
      await api.post(`/channels/${channelId}/${mute ? "mute" : "unmute"}`, { userId });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update mute status");
    }
  }

  const typingNames = Object.entries(typingUsers)
    .filter(([, isTyping]) => isTyping)
    .map(([uid]) => participants.find((p) => p.id === uid)?.name)
    .filter(Boolean);

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main-content">
        <button className="secondary" onClick={() => navigate("/dashboard")} style={{ marginBottom: 12 }}>
          ← Back to Dashboard
        </button>
        <h2 style={{ marginTop: 0 }}>#{channelName || "..."}</h2>
        {error && <div className="error-text">{error}</div>}

        <div className="chat-layout">
          <div className="messages-pane">
            <div className="messages-list">
              {messages.map((m) => {
                const own = m.user.id === user?.id;
                const canDelete = own || canModerate;
                return (
                  <div key={m.id} className={`message-bubble ${own ? "own" : ""}`}>
                    <div className="message-meta">
                      {m.user.name}
                      <span className={`role-badge role-${m.user.role}`}>{m.user.role}</span>
                      {"  "}
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                    <div>{m.content}</div>
                    {canDelete && (
                      <div style={{ marginTop: 4 }}>
                        <button
                          className="secondary"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => handleDeleteMessage(m.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="typing-indicator">
              {typingNames.length > 0 && `${typingNames.join(", ")} typing...`}
            </div>
            <form className="message-input-row" onSubmit={handleSend}>
              <input
                placeholder="Type a message..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  handleTyping();
                }}
              />
              <button type="submit">Send</button>
            </form>
          </div>

          <div className="participants-pane">
            <h4 style={{ marginTop: 0 }}>Participants ({participants.length})</h4>
            {participants.map((p) => (
              <div className="participant-row" key={p.id}>
                <span>
                  <span className={`online-indicator ${onlineUserIds.has(p.id) ? "online" : ""}`} />
                  {p.name}
                  <span className="presence-label">
                    {onlineUserIds.has(p.id) ? "Online" : "Offline"}
                  </span>
                  <span className={`role-badge role-${p.role}`}>{p.role}</span>
                  {p.isMuted && <span className="muted"> (muted)</span>}
                </span>
                {canModerate && p.id !== user?.id && (
                  <button
                    className="secondary"
                    style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => handleMute(p.id, !p.isMuted)}
                  >
                    {p.isMuted ? "Unmute" : "Mute"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
