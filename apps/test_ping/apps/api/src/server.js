import cors from "cors";
import express from "express";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "netwatch-api" });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.API_PORT ?? 4101);
  createApp().listen(port, () => {
    console.log(`netwatch-api listening on ${port}`);
  });
}
