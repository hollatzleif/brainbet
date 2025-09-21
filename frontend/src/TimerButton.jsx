
import { useEffect, useState } from "react";

const API_BASE = "https://brainbet-4jx2.onrender.com";

function getToken() {
  // try common keys
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function formatSeconds(s) {
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function TimerButton() {
  const [status, setStatus] = useState("stopped");
  const [elapsed, setElapsed] = useState(0);
  const [startIso, setStartIso] = useState(null);

  async function fetchStatus() {
    const token = getToken();
    if (!token) {
      setStatus("unauth");
      return;
    }
    const res = await fetch(`${API_BASE}/timers/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setStatus("unauth");
      return;
    }
    const data = await res.json();
    setStatus(data.status);
    setElapsed(data.elapsed_seconds || 0);
    setStartIso(data.start_time);
  }

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, []);

  async function action(path) {
    const token = getToken();
    if (!token) {
      alert("Bitte logge dich ein.");
      return;
    }
    const res = await fetch(`${API_BASE}/timers/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    await fetchStatus();
    if (!res.ok) {
      alert(data.detail || "Fehler");
    }
  }

  // live ticking if running
  useEffect(() => {
    let id;
    if (status === "running") {
      id = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    }
    return () => clearInterval(id);
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl shadow bg-white">
      <div className="text-2xl font-mono">{formatSeconds(elapsed)}</div>
      {status === "unauth" ? (
        <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => alert("Bitte zuerst einloggen.")}>
          Einloggen erforderlich
        </button>
      ) : status === "running" ? (
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-amber-500 text-white" onClick={() => action("pause")}>
            Pause
          </button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={() => action("stop")}>
            Stop
          </button>
        </div>
      ) : status === "paused" ? (
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={() => action("start")}>
            Fortsetzen
          </button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={() => action("stop")}>
            Stop
          </button>
        </div>
      ) : (
        <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={() => action("start")}>
          Timer starten
        </button>
      )}
    </div>
  );
}
