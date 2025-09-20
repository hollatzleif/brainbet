import { useState } from "react";

function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const endpoint = isSignup
      ? `https://dein-backend.onrender.com/auth/signup?username=${username}&email=${email}&password=${password}`
      : `https://dein-backend.onrender.com/auth/login?email=${email}&password=${password}`;

    const res = await fetch(endpoint, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.detail || "Fehler beim Login/Signup");
    } else {
      setMessage(isSignup ? data.message : "Login erfolgreich!");
      if (!isSignup) {
        alert("Token: " + data.access_token);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 border p-4 rounded">
      <h2 className="text-xl font-bold mb-4">
        {isSignup ? "Sign Up" : "Login"}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {isSignup && (
          <input
            type="text"
            placeholder="Benutzername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2"
          required
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2"
          required
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          {isSignup ? "Sign Up" : "Login"}
        </button>
      </form>
      <p className="mt-4 text-sm text-center">
        {isSignup ? "Schon registriert?" : "Noch keinen Account?"}{" "}
        <button
          onClick={() => setIsSignup(!isSignup)}
          className="text-blue-500 underline"
        >
          {isSignup ? "Hier einloggen" : "Hier registrieren"}
        </button>
      </p>
      {message && <p className="mt-4 text-red-500 text-center">{message}</p>}
    </div>
  );
}

export default Login;
