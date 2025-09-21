
import { useEffect, useState } from "react";

const API_BASE = "https://brainbet-4jx2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token");
}

export default function HeaderBar() {
  const [me, setMe] = useState(null);

  async function fetchMe() {
    const token = getToken();
    if (!token) { setMe(null); return; }
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setMe(data);
    } else {
      setMe(null);
    }
  }

  useEffect(() => {
    fetchMe();
    const onStorage = () => fetchMe();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!me) return null;

  return (
    <div className="fixed top-4 right-4 px-3 py-2 rounded-lg bg-white shadow text-sm">
      <div className="font-medium">{me.username}</div>
      <div className="text-gray-600">Level {me.level} (x{Number(me.multiplier).toFixed(1)})</div>
      <div className="text-gray-800 font-medium">{Number(me.coins).toFixed(1)} Coins</div>
    </div>
  );
}
