import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { getSocket, disconnectSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  memberCount: number;
  joined: boolean;
  creator: { id: string; name: string; email: string };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MODERATOR" | "MEMBER";
  createdAt: string;
}

interface PresenceEvent {
  userId: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"channels" | "users">("channels");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const isAdmin = user?.role === "ADMIN";

  async function loadChannels() {
    setLoadingChannels(true);
    setError(null);
    try {
      const { data } = await api.get("/channels");
      setChannels(data.channels);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load channels");
    } finally {
      setLoadingChannels(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data.users);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    const socket = getSocket();
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

    socket.on("online_users", onOnlineUsers);
    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    return () => {
      socket.off("online_users", onOnlineUsers);
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (tab === "users" && isAdmin) loadUsers();
  }, [tab, isAdmin]);

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/channels", {
        name: newName,
        description: newDescription || undefined,
        isPrivate: newPrivate,
      });
      setNewName("");
      setNewDescription("");
      setNewPrivate(false);
      setShowCreate(false);
      await loadChannels();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create channel");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteChannel(id: string) {
    if (!confirm("Delete this channel? This cannot be undone.")) return;
    try {
      await api.delete(`/channels/${id}`);
      await loadChannels();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete channel");
    }
  }

  async function handleJoin(id: string) {
    try {
      await api.post(`/channels/${id}/join`);
      await loadChannels();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to join channel");
    }
  }

  async function handleLeave(id: string) {
    try {
      await api.post(`/channels/${id}/leave`);
      await loadChannels();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to leave channel");
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      await api.patch(`/users/${userId}/role`, { role });
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update role");
    }
  }

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main-content">
        {error && <div className="error-text">{error}</div>}

        <nav className="tabs">
          <button
            className={tab === "channels" ? "active" : ""}
            onClick={() => setTab("channels")}
          >
            Channels
          </button>
          {isAdmin && (
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              Manage Roles
            </button>
          )}
        </nav>

        {tab === "channels" && (
          <>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Channels</h2>
              {isAdmin && (
                <button onClick={() => setShowCreate((v) => !v)}>
                  {showCreate ? "Cancel" : "+ Create Channel"}
                </button>
              )}
            </div>

            {isAdmin && showCreate && (
              <form
                onSubmit={handleCreateChannel}
                className="card"
                style={{ marginBottom: 20, maxWidth: 420 }}
              >
                <label>Channel name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                <label>Description (optional)</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
                <label className="row" style={{ marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto", marginBottom: 0 }}
                    checked={newPrivate}
                    onChange={(e) => setNewPrivate(e.target.checked)}
                  />
                  Private channel
                </label>
                <button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </button>
              </form>
            )}

            {loadingChannels ? (
              <p className="muted">Loading channels...</p>
            ) : (
              <div className="channel-grid">
                {channels.map((c) => (
                  <div className="card" key={c.id}>
                    <h3>
                      {c.name} {c.isPrivate && <span className="muted">(private)</span>}
                    </h3>
                    <p className="muted">{c.description || "No description"}</p>
                    <p className="muted">
                      {c.memberCount} member{c.memberCount === 1 ? "" : "s"} · created by{" "}
                      {c.creator.name}
                    </p>
                    <div className="row" style={{ marginTop: 12 }}>
                      {c.joined ? (
                        <>
                          <button onClick={() => navigate(`/chat/${c.id}`)}>Open Chat</button>
                          <button className="secondary" onClick={() => handleLeave(c.id)}>
                            Leave
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleJoin(c.id)}>Join</button>
                      )}
                      {isAdmin && (
                        <button className="danger" onClick={() => handleDeleteChannel(c.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "users" && isAdmin && (
          <>
            <h2>Manage User Roles</h2>
            {loadingUsers ? (
              <p className="muted">Loading users...</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className={`online-indicator ${onlineUserIds.has(u.id) ? "online" : ""}`} />
                        {u.name}
                      </td>
                      <td>{onlineUserIds.has(u.id) ? "Online" : "Offline"}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        {u.id === user?.id ? (
                          <span className="muted">(you)</span>
                        ) : (
                          <select
                            value={u.role}
                            style={{ width: "auto", margin: 0 }}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="MODERATOR">MODERATOR</option>
                            <option value="MEMBER">MEMBER</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
