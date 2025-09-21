
import { useEffect, useState } from "react";

const API_BASE = "https://brainbet-4jx2.onrender.com";

function getToken() { return localStorage.getItem("access_token") || null; }
function formatSeconds(s){const hh=String(Math.floor(s/3600)).padStart(2,"0");const mm=String(Math.floor((s%3600)/60)).padStart(2,"0");const ss=String(Math.floor(s%60)).padStart(2,"0");return `${hh}:${mm}:${ss}`;}

export default function TimerButton(){
  const [status,setStatus]=useState("stopped");
  const [remaining,setRemaining]=useState(null);
  const [durationMin,setDurationMin]=useState(()=>Number(localStorage.getItem("target_min"))||25);

  async function fetchStatus(){
    const t=getToken(); if(!t){setStatus("unauth");return;}
    const res=await fetch(`${API_BASE}/timers/me`,{headers:{Authorization:`Bearer ${t}`}});
    const data=await res.json();
    if(!res.ok){setStatus("unauth");localStorage.removeItem("access_token");window.dispatchEvent(new Event("storage"));return;}
    setStatus(data.status);
    if(typeof data.remaining_seconds==="number") setRemaining(data.remaining_seconds); else setRemaining(null);
    if(data.autostopped){
      const secs=data.last_session_seconds??0;
      const mins=Math.floor(secs/60);
      const baseCoins=data.base_coins??Math.floor(secs/180);
      const level=data.level??1;
      const mult=data.multiplier??1.0;
      const earned=data.earned_coins??(baseCoins*mult);
      alert([
        `${mins} minutes of learning = ${Math.floor(baseCoins)} Coins`,
        `Level ${level} = ${Number(mult).toFixed(1)} Multiplier`,
        `${Math.floor(baseCoins)} x ${Number(mult).toFixed(1)} = ${Number(earned).toFixed(2)}`,
        `Summary of training session: ${formatSeconds(secs)} min, ${Number(earned).toFixed(2)} Coins.`
      ].join("\\n"));
      window.dispatchEvent(new CustomEvent("walletUpdated",{detail:{total:data.wallet_total}}));
    }
  }

  useEffect(()=>{ fetchStatus(); const id=setInterval(fetchStatus,5000); return ()=>clearInterval(id); },[]);

  async function startTimer(){
    const t=getToken(); if(!t){setStatus("unauth");return;}
    const dm=Math.max(1,Math.min(120,Number(durationMin)||25));
    localStorage.setItem("target_min",String(dm));
    const res=await fetch(`${API_BASE}/timers/start?duration_minutes=${encodeURIComponent(dm)}`,{method:"POST",headers:{Authorization:`Bearer ${t}`}});
    const data=await res.json();
    if(!res.ok){alert(data.detail||"Error");return;}
    setStatus("running");
    setTimeout(fetchStatus,100);
  }

  async function pauseTimer(){
    const t=getToken(); if(!t){setStatus("unauth");return;}
    const res=await fetch(`${API_BASE}/timers/pause`,{method:"POST",headers:{Authorization:`Bearer ${t}`}});
    const data=await res.json();
    if(!res.ok){alert(data.detail||"Error");return;}
    setStatus("paused"); setTimeout(fetchStatus,50);
  }

  async function stopTimer(){
    const ok=window.confirm("Are you sure that you want to end your training session?"); if(!ok) return;
    const t=getToken(); if(!t){setStatus("unauth");return;}
    const res=await fetch(`${API_BASE}/timers/stop`,{method:"POST",headers:{Authorization:`Bearer ${t}`}});
    const data=await res.json();
    if(!res.ok){alert(data.detail||"Error");return;}
    const secs=typeof data.elapsed_seconds==="number"?data.elapsed_seconds:0;
    const mins=Math.floor(secs/60);
    const baseCoins=data.base_coins??Math.floor(secs/180);
    const level=data.level??1;
    const mult=data.multiplier??1.0;
    const earned=data.earned_coins??(baseCoins*mult);
    alert([
      `${mins} minutes of learning = ${Math.floor(baseCoins)} Coins`,
      `Level ${level} = ${Number(mult).toFixed(1)} Multiplier`,
      `${Math.floor(baseCoins)} x ${Number(mult).toFixed(1)} = ${Number(earned).toFixed(2)}`,
      `Summary of training session: ${formatSeconds(secs)} min, ${Number(earned).toFixed(2)} Coins.`
    ].join("\\n"));
    setStatus("stopped"); setRemaining(null);
    window.dispatchEvent(new CustomEvent("walletUpdated",{detail:{total:data.wallet_total}}));
  }

  useEffect(()=>{
    if(status!=="running"||typeof remaining!=="number") return;
    const id=setInterval(()=>setRemaining(r=>typeof r==="number"?Math.max(0,r-1):r),1000);
    return ()=>clearInterval(id);
  },[status,remaining]);

  return (
    <div className="flex flex-col items-start gap-3 p-4 rounded-xl shadow bg-white w-full max-w-md">
      <div>
        <div className="text-xs text-gray-500">Remaining</div>
        <div className="text-2xl font-mono">{typeof remaining==="number"?formatSeconds(remaining):"--:--:--"}</div>
      </div>

      {(status==="stopped"||status==="unauth")?(
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Session length (max 120 min)</label>
            <div className="flex items-center gap-2">
              <select value={durationMin} onChange={e=>setDurationMin(Number(e.target.value))} className="border rounded px-2 py-1">
                {[15,25,50,90,120].map(m=>(<option key={m} value={m}>{m} min</option>))}
              </select>
              <input type="number" min={1} max={120} value={durationMin} onChange={e=>setDurationMin(Math.max(1,Math.min(120,Number(e.target.value))))} className="w-24 border rounded px-2 py-1"/>
            </div>
          </div>
          <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={startTimer}>Start timer</button>
        </div>
      ): status==="running"? (
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-amber-500 text-white" onClick={pauseTimer}>Pause</button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={stopTimer}>Stop</button>
        </div>
      ):(
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={startTimer}>Resume</button>
          <button className="px-4 py-2 rounded bg-rose-600 text-white" onClick={stopTimer}>Stop</button>
        </div>
      )}
    </div>
  );
}
