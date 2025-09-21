
import { useEffect, useState, useRef } from "react";

const API_BASE = "https://brainbet-4jx2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || null;
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
  const [durationMin, setDurationMin] = useState(() => Number(localStorage.getItem("target_min")) || 25);
  const [remaining, setRemaining] = useState(null);
  const targetSecRef = useRef(Number(localStorage.getItem("target_sec")) || null);

  async function fetchStatus() {
    const token = getToken();
    if (!token) { setStatus("unauth"); return; }
    const res = await fetch(`${API_BASE}/timers/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { setStatus("unauth"); localStorage.removeItem("access_token"); window.dispatchEvent(new Event("storage")); return; }
    setStatus(data.status);
    const serverElapsed = data.elapsed_seconds || 0;
    setElapsed(serverElapsed);
    const target = targetSecRef.current;
    if (target && data.status === "running") {
      const rem = Math.max(0, target - serverElapsed);
      setRemaining(rem);
      if (rem <= 0) {
        // Auto-stop with cap to target seconds
        await stopWithCap(target);
      }
    } else if (data.status !== "running") {
      setRemaining(null);
    }
  }

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, []);

  async function startTimer() {
    const token = getToken();
    if (!token) { setStatus("unauth"); return; }
    const res = await fetch(`${API_BASE}/timers/start`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Error"); return; }
    // save target locally (cap only client-side)
    const targetSec = Math.max(60, Math.min(120, Number(durationMin))) * 60;
    targetSecRef.current = targetSec;
    localStorage.setItem("target_sec", String(targetSec));
    localStorage.setItem("target_min", String(Math.floor(targetSec/60)));
    setStatus("running");
    setTimeout(fetchStatus, 100);
  }

  async function stopWithCap(capSec) {
    const token = getToken();
    if (!token) { setStatus("unauth"); return; }
    const res = await fetch(`${API_BASE}/timers/stop?cap_seconds=${encodeURIComponent(capSec)}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Error"); return; }
    showSummary(data);
    // reset
    targetSecRef.current = null;
    localStorage.removeItem("target_sec");
    setStatus("stopped"); setElapsed(0); setRemaining(null);
  }

  function showSummary(data) {
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
    alert(lines.join("\\n"));
  }

  async function pauseTimer() {
    const token = getToken();
    if (!token) { setStatus("unauth"); return; }
    const res = await fetch(`${API_BASE}/timers/pause`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Error"); return; }
    setStatus("paused"); setTimeout(fetchStatus, 50);
  }

  async function stopTimer() {
    const ok = window.confirm("Are you sure that you want to end your training session?");
    if (!ok) return;
    const cap = targetSecRef.current;
    if (cap) return stopWithCap(cap);
    const token = getToken();
    if (!token) { setStatus("unauth"); return; }
    const res = await fetch(`${API_BASE}/timers/stop`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Error"); return; }
    showSummary(data);
    targetSecRef.current = null;
    localStorage.removeItem("target_sec");
    setStatus("stopped"); setElapsed(0); setRemaining(null);
  }

  // local countdown tick
  useEffect(() => {
    if (status !== "running" || !targetSecRef.current) return;
    const tick = setInterval(() => {
      setRemaining((r) => {
        const newR = (typeof r === "number" ? Math.max(0, r - 1) : null);
        return newR;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [status]);

  return (
    <div className="flex flex-col items-start gap-3 p-4 rounded-xl shadow bg-white w-full max-w-md">
      <div className="grid grid-cols-2 gap-4 w-full">
        <div>
          <div className="text-xs text-gray-500">Elapsed</div>
          <div className="text-2xl font-mono">{formatSeconds(elapsed)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Remaining</div>
          <div className="text-2xl font-mono">
            {typeof remaining === "number" ? formatSeconds(remaining) : "--:--:--"}
          </div>
        </div>
      </div>

      {(status === "stopped" || status === "unauth") ? (
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Session length (max 120 min)</label>
            <div className="flex items-center gap-2">
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="border rounded px-2 py-1"
              >
                {[15, 25, 50, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={120}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, Math.min(120, Number(e.target.value))))}
                className="w-24 border rounded px-2 py-1"
              />
            </div>
          </div>
          <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={startTimer}>
            Start timer
          </button>
        </div>
      ) : status === "running" ? (
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-amber-500 text-white" onClick={pauseTimer}>
            Pause
          </button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={stopTimer}>
            Stop
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={startTimer}>
            Resume
          </button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={stopTimer}>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
