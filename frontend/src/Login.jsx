
import { useEffect, useState } from "react";

const API_BASE = "https://brainbet-4jx2.onrender.com";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));

  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("access_token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const logout = () => {
    localStorage.removeItem("access_token");
    setToken(null);
    window.dispatchEvent(new Event("storage"));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isSignup) {
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Signup failed");
        setMessage("Signup successful. Please sign in.");
        setIsSignup(false);
        return;
      } else {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Login failed");

        if (data && data.access_token) {
          localStorage.setItem("access_token", data.access_token);
          setToken(data.access_token);
          setMessage("");
        } else {
          throw new Error("No access token returned");
        }
      }
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (token) {
    return (
      <div className="w-full max-w-md p-6 rounded-xl bg-white shadow flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Signed in</p>
          <p className="text-sm text-gray-500">You can use the timer now.</p>
        </div>
        <button
          onClick={logout}
          className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-6 rounded-xl bg-white shadow">
      <h1 className="text-2xl font-semibold mb-4">{isSignup ? "Sign up" : "Log in"}</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignup && (
          <input
            type="text"
            placeholder="Username"
            className="w-full border rounded px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          {isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-center">
        {isSignup ? "Already have an account?" : "Don't have an account yet?"}{" "}
        <button
          onClick={() => setIsSignup(!isSignup)}
          className="text-blue-500 underline"
        >
          {isSignup ? "Log in here" : "Sign up here"}
        </button>
      </p>
      {message && <p className="mt-4 text-center text-red-500">{message}</p>}
    </div>
  );
}
