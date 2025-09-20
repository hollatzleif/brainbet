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

    const url = isSignup
  ? "https://brainbet-4jx2.onrender.com/auth/signup"
  : "https://brainbet-4jx2.onrender.com/auth/login";


    const payload = isSignup
      ? { username, email, password }
      : { email, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || "An error occurred.");
      } else {
        setMessage(isSignup ? data.message : "Login successful!");
        if (!isSignup) {
          alert("Your token: " + data.access_token);
        }
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 border p-4 rounded bg-white shadow">
      <h2 className="text-xl font-bold mb-4 text-center">
        {isSignup ? "Sign Up" : "Login"}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {isSignup && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 rounded"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
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

export default Login;
