const base = import.meta.env.BASE_URL;

const items = [
  { href: "settings/", code: "FE-04", title: "AI-assisted workflow drill", text: "A settings form built twice: lazy prompt vs precise prompt." },
  { href: "buttons/", code: "FE-AA1", title: "Buttons with a Brain", text: "A send button that tells you what it's doing, in every state." },
  { href: "viewer/", code: "FE-AA2", title: "First 3D experience", text: "A GLB viewer with a small configurator." },
  { href: "hero/", code: "FE-AA3", title: "Signature Hero", text: "A fullscreen fragment shader behind real content." },
];

export function Home() {
  return (
    <main className="page">
      <h1>Front-end AI Engineering</h1>
      <p className="muted">FlyRank internship assignments by Alessandro Kevin Aprilio.</p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {items.map((i) => (
          <li key={i.href} className="card">
            <a href={base + i.href}>
              <strong>{i.code} · {i.title}</strong>
            </a>
            <div className="muted">{i.text}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
