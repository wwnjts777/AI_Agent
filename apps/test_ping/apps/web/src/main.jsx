import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

export function App() {
  return React.createElement(
    "main",
    { className: "app-shell" },
    React.createElement(
      "section",
      { className: "hero" },
      React.createElement("p", null, "NetWatch"),
      React.createElement("h1", null, "Dashboard monitoring IP"),
      React.createElement(
        "span",
        null,
        "Project setup siap. Lanjutkan task NW-003 untuk database dan Prisma."
      )
    )
  );
}

const rootElement = typeof document !== "undefined" ? document.getElementById("root") : null;
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
