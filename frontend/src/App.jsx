
import { useEffect, useState } from "react";
import Login from "./Login";
import TimerButton from "./TimerButton";
import HeaderBar from "./HeaderBar";

const API_BASE = "https://brainbet-4jx2.onrender.com";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [checked, setChecked] = useState(false); // finished server check

  async function verifyToken() {
    const t = localStorage.getItem("access_token");
    if (!t) { setToken(null); setChecked(true); return; }
    try {
      const res = await fetch(`${API_BASE}/users/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) { throw new Error("unauth"); }
      setToken(t);
    } catch (e) {
      localStorage.removeItem("access_token");
      setToken(null);
      // trigger listeners (TimerButton/HeaderBar) to update
      window.dispatchEvent(new Event("storage"));
    } finally {
      setChecked(true);
    }
  }

  useEffect(() => {
    verifyToken();
    const onStorage = () => setToken(localStorage.getItem("access_token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!checked) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <HeaderBar />
      <div className="flex flex-col gap-6 items-center">
        {!token ? <Login /> : null}
        <TimerButton />
      </div>
    </div>
  );
}
