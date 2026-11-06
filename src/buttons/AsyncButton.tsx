import type { ReactNode } from "react";
import { useAsyncAction, type ButtonState } from "./useAsyncAction";
import "./AsyncButton.css";

export type Labels = Record<ButtonState, string>;

type Props = {
  labels: Labels;
  /** What the button does. Resolve = success, reject = error. */
  action: () => Promise<void>;
  /** Icon shown next to the idle label. */
  icon?: ReactNode;
  /** Disabled, but still focusable, with the reason read out to screen readers. */
  disabledReason?: string;
  /** What screen readers hear when the state changes. */
  announcements?: Partial<Labels>;
  className?: string;
};

const ORDER: ButtonState[] = ["idle", "loading", "success", "error"];

function Spinner() {
  return <span className="abtn__spinner" aria-hidden="true" />;
}

function Check() {
  return (
    <svg className="abtn__icon abtn__check" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

function Retry() {
  return (
    <svg className="abtn__icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.5 9.5a5.5 5.5 0 1 1-1.6-3.9M15.5 3.5v3.2h-3.2" />
    </svg>
  );
}

/**
 * One button, four labelled layers stacked in the same grid cell. Only the layer for the current state is visible;
 * switching state cross-fades and slides the layers (transform + opacity only). The button's width never animates:
 * an invisible "sizer" holds the widest label, so nothing around it reflows.
 */
export function AsyncButton({ labels, action, icon, disabledReason, announcements, className }: Props) {
  const disabled = Boolean(disabledReason);
  const { state, trigger } = useAsyncAction(action, disabled);
  const busy = state === "loading";
  const icons: Record<ButtonState, ReactNode> = { idle: icon, loading: <Spinner />, success: <Check />, error: <Retry /> };
  const reasonId = disabledReason ? `${labels.idle.replace(/\W+/g, "-").toLowerCase()}-reason` : undefined;
  const said = { loading: labels.loading, success: labels.success, error: labels.error, ...announcements };

  return (
    <>
      <button
        type="button"
        className={`abtn ${className ?? ""}`}
        data-state={state}
        aria-disabled={disabled || busy || undefined}
        aria-busy={busy || undefined}
        aria-describedby={reasonId}
        onClick={trigger}
      >
        <span className="abtn__face">
          <span className="abtn__tint abtn__tint--success" aria-hidden="true" />
          <span className="abtn__tint abtn__tint--error" aria-hidden="true" />
          <span className="abtn__sizer" aria-hidden="true">
            {ORDER.map((s) => (
              <span key={s} className="abtn__row">
                <span className="abtn__icon-slot" />
                {labels[s]}
              </span>
            ))}
          </span>
          {ORDER.map((s) => (
            <span key={s} className={`abtn__layer abtn__layer--${s}`} aria-hidden="true">
              {icons[s] && <span className="abtn__icon-slot">{icons[s]}</span>}
              {labels[s]}
            </span>
          ))}
          <span className="visually-hidden">{labels[state]}</span>
        </span>
      </button>
      {reasonId && (
        <span id={reasonId} className="visually-hidden">
          {disabledReason}
        </span>
      )}
      <span role="status" className="visually-hidden">
        {state === "idle" ? "" : said[state]}
      </span>
    </>
  );
}
