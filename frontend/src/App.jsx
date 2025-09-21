
import Login from "./Login";
import TimerButton from "./TimerButton";

function App() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="flex flex-col gap-6 items-center">
        <Login />
        <TimerButton />
      </div>
    </div>
  );
}

export default App;
