import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="topbar">
      <div className="row">
        <Link to="/dashboard" style={{ fontWeight: 700, textDecoration: "none" }}>
          Role-Based Chat
        </Link>
      </div>
      <div className="row">
        <span>
          {user.name}
          <span className={`role-badge role-${user.role}`}>{user.role}</span>
        </span>
        <button className="secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
