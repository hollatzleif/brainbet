
import { useEffect, useState } from "react";
import Login from "./Login";
import HeaderBar from "./HeaderBar";
import TimerButton from "./TimerButton";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));

  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("access_token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
