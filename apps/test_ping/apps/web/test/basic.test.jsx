import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/main.jsx";

describe("NetWatch landing shell", () => {
  it("renders the dashboard title", () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain("Dashboard monitoring IP");
    expect(html).toContain("NetWatch");
  });
});
