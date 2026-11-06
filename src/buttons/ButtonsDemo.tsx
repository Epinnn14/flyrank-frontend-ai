import { useCallback, useId, useRef, useState } from "react";
import { AsyncButton } from "./AsyncButton";
import { fakeRequest } from "./useAsyncAction";
import "./ButtonsDemo.css";

type Outcome = "random" | "success" | "failure";
const RATE: Record<Outcome, number> = { random: 0.2, success: 0, failure: 1 };

function SendIcon() {
  return (
    <svg className="abtn__icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 10l14-6-5 13-2.5-5.5L3 10z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="abtn__icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.5 3.5h2l2 9h9l1.5-6.5H5.6M8 16.5h.01M15 16.5h.01" />
    </svg>
  );
}

export function ButtonsDemo() {
  const [outcome, setOutcome] = useState<Outcome>("random");
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const name = useId();

  const send = useCallback(async () => {
    const text = draftRef.current.trim();
    await fakeRequest(RATE[outcome]);
    setSent((s) => [...s, text]);
    setDraft("");
  }, [outcome]);

  const addToCart = useCallback(() => fakeRequest(RATE[outcome], 500, 1200), [outcome]);

  return (
    <div className="bdemo">
      <header>
        <h1>Buttons with a Brain</h1>
        <p className="muted">
          One button, every state: idle, hover/focus, pressed, sending, sent, failed (retry), and disabled. Try
          spam-clicking it, tabbing to it, or turning on “reduce motion” in your OS.
        </p>
      </header>

      <fieldset className="bdemo__outcome card">
        <legend>Fake server</legend>
        {(
          [
            ["random", "Random: 0.7–1.6 s, 20 % failure"],
            ["success", "Always succeed"],
            ["failure", "Always fail"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name={name} value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
            {label}
          </label>
        ))}
      </fieldset>

      <section className="card bdemo__chat" aria-labelledby="chat-title">
        <h2 id="chat-title">Chat composer</h2>
        <ol className="bdemo__messages" aria-label="Sent messages">
          {sent.length === 0 && <li className="muted">No messages yet.</li>}
          {sent.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ol>
        <div className="bdemo__composer">
          <label htmlFor="message" className="visually-hidden">
            Message
          </label>
          <textarea
            id="message"
            rows={2}
            placeholder="Ask the assistant something…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <AsyncButton
            labels={{ idle: "Send", loading: "Sending", success: "Sent", error: "Retry" }}
            announcements={{ loading: "Sending message", success: "Message sent", error: "Couldn't send. Press Retry." }}
            icon={<SendIcon />}
            action={send}
            disabledReason={draft.trim() ? undefined : "Type a message first"}
          />
        </div>
      </section>

      <section className="card bdemo__product" aria-labelledby="product-title">
        <div>
          <h2 id="product-title">Same motion language, another button</h2>
          <p className="muted">Flat white, 250 ml · $3.40</p>
        </div>
        <AsyncButton
          labels={{ idle: "Add to cart", loading: "Adding", success: "Added", error: "Try again" }}
          announcements={{ loading: "Adding to cart", success: "Added to cart", error: "Couldn't add. Try again." }}
          icon={<CartIcon />}
          action={addToCart}
        />
      </section>

      <section className="card" aria-labelledby="notes-title">
        <h2 id="notes-title">Why these durations and easings</h2>
        <ul className="bdemo__notes">
          <li><strong>Press 80 ms, ease-out:</strong> a press has to feel instant; anything slower reads as lag.</li>
          <li><strong>Hover 140 ms, ease-out:</strong> follows the cursor without flickering when you sweep across.</li>
          <li><strong>Label swap 220 ms, emphasized decelerate:</strong> the new label arrives fast and settles, so the state change “lands”; the old label leaves upwards, which reads as moving on.</li>
          <li><strong>Success check 320 ms, slight overshoot:</strong> a tiny reward, held 1.4 s, then back to idle.</li>
          <li><strong>Error shake 360 ms, once:</strong> enough to catch the eye, not enough to feel like punishment. The red tint and “Retry” label stay for 2.6 s; a click retries immediately.</li>
          <li><strong>No width animation:</strong> the button is sized to its widest label up front, so state changes only move transform and opacity, and the textarea next to it never reflows.</li>
          <li><strong>Reduced motion:</strong> no slide, no shake, no spinning; labels cross-fade, the colours and the screen-reader announcements stay.</li>
        </ul>
      </section>
    </div>
  );
}
