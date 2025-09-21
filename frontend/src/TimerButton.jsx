
import { useEffect, useState, useRef } from "react";

const API_BASE = "https://brainbet-4jx2.onrender.com";

function getToken() {
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

  // inactivity attention check (frontend)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(120);
  const inactivityMsRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const checkActiveRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const confirmTimeoutRef = useRef(null);

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
      // token invalid -> clear and prompt login
      setStatus("unauth");
      localStorage.removeItem("access_token");
      window.dispatchEvent(new Event("storage"));
      return;
    }
    const data = await res.json();
    setStatus(data.status);
    setElapsed(data.elapsed_seconds || 0);
  }

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, []);

  async function action(path) {
    // confirm before stopping
    if (path === "stop") {
      const ok = window.confirm("Are you sure that you want to end your training session?");
      if (!ok) return;
    }

    const token = getToken();
    if (!token) {
      setStatus("unauth");
      return;
    }
    const res = await fetch(`${API_BASE}/timers/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "Error");
      return;
    }
    if (path === "stop") {
      const secs = typeof data.elapsed_seconds === "number" ? data.elapsed_seconds : 0;
      const mins = Math.floor(secs/60);
      const baseCoins = data.base_coins ?? Math.floor(secs/180);
      const level = data.level ?? 1;
      const mult = data.multiplier ?? 1.0;
      const earned = data.earned_coins ?? (baseCoins * mult);
      const lines = [
        `${mins} minutes of learning = ${Math.floor(baseCoins)} Coins`,
        `Level ${level} = ${Number(mult).toFixed(1)} Multiplier`,
        `${Math.floor(baseCoins)} x ${Number(mult).toFixed(1)} = ${Number(earned).toFixed(2)}`,
        `Summary of training session: ${formatSeconds(secs)} min, ${Number(earned).toFixed(2)} Coins.`
      ];
      alert(lines.join("\n"));
      // reset UI state to zeroed timer and keep it zero even if status polling runs
      setStatus("stopped");
      clearCheckTimers();
      setElapsed(0);
      return;
    }
    if (path === "start") {
      // we start fresh or resume; set UI to reasonable initial state
      setStatus("running");
      resetInactivity();
      // on resume, backend has elapsed; fetch a fresh status shortly
      setTimeout(fetchStatus, 50);
      return;
    }
    // pause
    setStatus("paused");
    clearCheckTimers();
    setTimeout(fetchStatus, 50);
  }

  // ---- Inactivity detection ----
  function resetInactivity() {
    lastActivityRef.current = Date.now();
    inactivityMsRef.current = 0;
  }

  function clearCheckTimers() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
    checkActiveRef.current = false;
    setIsModalOpen(false);
    setConfirmCountdown(120);
  }

  async function startAttentionCheck() {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE}/timers/check/start?window_seconds=120`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    // open modal
    checkActiveRef.current = true;
    setIsModalOpen(true);
    setConfirmCountdown(120);
    countdownIntervalRef.current = setInterval(() => {
      setConfirmCountdown((x) => (x > 0 ? x - 1 : 0));
    }, 1000);
    confirmTimeoutRef.current = setTimeout(async () => {
      // time elapsed, backend will mark session invalid on confirm or stop
      checkActiveRef.current = false;
      setIsModalOpen(false);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      // Optional: inform user the session is at risk; we keep timer running as requested
      alert("Attention check timed out. This session will yield 0 Coins unless restarted.");
    }, 120000);
  }

  async function confirmAttentionCheck() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/timers/check/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // If invalidated already (late), tell user
      if (data && data.invalidated) {
        alert("Too late – this session has been invalidated and will yield 0 Coins.");
      }
    } catch {}
    clearCheckTimers();
    resetInactivity();
  }

  useEffect(() => {
    // events counting as activity
    const mark = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => window.addEventListener(evt, mark, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, mark));
    };
  }, []);

  useEffect(() => {
    // check inactivity every 5s
    const interval = setInterval(() => {
      if (status !== "running") return;
      const now = Date.now();
      const inactiveMs = now - lastActivityRef.current;
      // Testing threshold: 60s (you'll change to 15 * 60 * 1000 later)
      const thresholdMs = 60 * 1000;
      if (!checkActiveRef.current && inactiveMs >= thresholdMs) {
        startAttentionCheck();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status]);

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
    <div className="flex flex-col items-start gap-3 p-4 rounded-xl shadow bg-white">
      {/* Inactivity modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div style={{ background: "white", padding: 20, borderRadius: 12, maxWidth: 480 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Still there?</h3>
            <p style={{ marginBottom: 12 }}>
              Hey. We noticed you haven't used your device for 15 minutes (cause thats what I will be changing it to later on).
              Please confirm, that you are still learning.
            </p>
            <p style={{ marginBottom: 16, fontFamily: "monospace" }}>
              Time left to confirm: {confirmCountdown}s
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={confirmAttentionCheck}
                className="px-4 py-2 rounded bg-emerald-600 text-white"
              >
                I'm still learning
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-2xl font-mono">{formatSeconds(elapsed)}</div>
      {status === "unauth" ? (
        <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => alert("Please sign in first.")}>
          Sign in required
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
            Resume
          </button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={() => action("stop")}>
            Stop
          </button>
        </div>
      ) : (
        <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={() => action("start")}>
          Start timer
        </button>
      )}
    </div>
  );
}
