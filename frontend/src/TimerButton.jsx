
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
  const [audioCtx, setAudioCtx] = useState(null);
  const [checkTimer, setCheckTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [startIso, setStartIso] = useState(null);


  function requestAudioCtx() {
    if (!audioCtx) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        setAudioCtx(ctx);
        return ctx;
      } catch (e) { return null; }
    }
    return audioCtx;
  }

  function beep(durationMs=250, freq=880) {
    const ctx = requestAudioCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.03, ctx.currentTime); // subtle
    o.start();
    o.stop(ctx.currentTime + durationMs/1000);
  }

  async function ensureNotifPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
  }

  async function scheduleRandomCheck() {
    // testing: 60-120s; later adjust to 5-45 min
    if (status !== 'running') return;
    const delay = Math.floor(60 + Math.random()*60) * 1000;
    const id = setTimeout(triggerCheck, delay);
    setCheckTimer(id);
  }

  async function triggerCheck() {
    if (status !== 'running') return;
    const token = getToken();
    if (!token) return;
    // register check with backend (2-minute window)
    try {
      await fetch(`${API_BASE}/timers/check/start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    const ok = await ensureNotifPermission();
    if (ok) {
      try {
        const n = new Notification('Attention check', { body: 'Please confirm within 2 minutes to keep this session.', silent: false });
        beep(200, 880);
        n.onclick = async () => {
          window.focus();
          try { await fetch(`${API_BASE}/timers/check/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch {}
          n.close();
          scheduleRandomCheck();
        };
      } catch (e) {
        // fallback sound
        beep(200, 880);
      }
    } else {
      // No permission: fallback sound and rely on on-page controls
      beep(200, 880);
    }
  }

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
    setStartIso(data.start_time);
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
    // handle timer actions and show popup on stop
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
      if (checkTimer) clearTimeout(checkTimer);
      setElapsed(0);
      setStartIso(null);
      return;
    }
    if (path === "start") {
      // we start fresh or resume; set UI to reasonable initial state
      setStatus("running");
      requestAudioCtx();
      // schedule first random attention check
      setTimeout(scheduleRandomCheck, 500);
      // on resume, backend has elapsed; fetch a fresh status shortly
      setTimeout(fetchStatus, 50);
      return;
    }
    // pause
    setStatus("paused");
    if (checkTimer) clearTimeout(checkTimer);
    setTimeout(fetchStatus, 50);
  }

  // live ticking if running
  useEffect(() => {
    let id;
    if (status === "running") {
      id = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
      // ensure a check gets scheduled if none
      setTimeout(scheduleRandomCheck, 1000);
    }
    return () => clearInterval(id);
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl shadow bg-white">
      <div className="text-2xl font-mono">{formatSeconds(elapsed)}</div>
      {status === "unauth" ? (
        <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => alert("Please sign in first.")}>
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
          Start timer
        </button>
      )}
    </div>
  );
}
