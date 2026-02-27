import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply persisted theme before first render to avoid flash
const stored = localStorage.getItem("indexxorcist-theme-v1");
try {
  const parsed = stored ? JSON.parse(stored) : null;
  if (parsed?.state?.theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
} catch {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
