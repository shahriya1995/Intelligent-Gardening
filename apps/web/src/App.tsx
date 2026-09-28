import { useEffect, useState } from "react";

type ApiState = "checking" | "connected" | "unavailable";

const capabilities = [
  { title: "Gardens", text: "Create garden profiles with location and hardiness-zone context." },
  { title: "Plants", text: "Remember varieties, quantities, planting dates, and notes." },
  { title: "Tasks", text: "Plan dated garden work and track completed activities." },
  { title: "Knowledge", text: "Search source-attributed gardening references." },
];

export function App() {
  const [apiState, setApiState] = useState<ApiState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("API health check failed");
        setApiState("connected");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiState("unavailable");
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <nav>
        <a className="brand" href="/" aria-label="Intelligent Gardening home">
          <span className="brand-mark">IG</span>
          <span>Intelligent Gardening</span>
        </a>
        <span className={`status status-${apiState}`}>
          <span className="status-dot" />
          {apiState === "checking"
            ? "Checking server"
            : apiState === "connected"
              ? "Server connected"
              : "Server unavailable"}
        </span>
      </nav>

      <section className="hero">
        <p className="eyebrow">Your garden. Your model. Open tools.</p>
        <h1>A calm, practical home for your garden.</h1>
        <p className="intro">
          Plan what to grow, remember what you planted, and bring the AI model you prefer. The same gardening tools also work through MCP clients such as Open WebUI.
        </p>
        <div className="actions">
          <button type="button">Create your first garden</button>
          <a href="/api/openapi.json">Explore the API</a>
        </div>
      </section>

      <section className="capabilities" aria-label="Gardening capabilities">
        {capabilities.map((capability) => (
          <article key={capability.title}>
            <h2>{capability.title}</h2>
            <p>{capability.text}</p>
          </article>
        ))}
      </section>

      <section className="architecture">
        <div>
          <p className="eyebrow">One backend, multiple interfaces</p>
          <h2>Use this dashboard or connect your own AI workspace.</h2>
        </div>
        <div className="flow" aria-label="Connection architecture">
          <span>Your web app</span>
          <b>REST</b>
          <span>Gardener server</span>
          <b>MCP</b>
          <span>Open WebUI</span>
        </div>
      </section>
    </main>
  );
}
