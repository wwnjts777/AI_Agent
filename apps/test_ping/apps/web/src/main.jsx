import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p>NetWatch</p>
        <h1>Dashboard monitoring IP</h1>
        <span>Project setup siap. Lanjutkan task NW-002 untuk quality foundation.</span>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
