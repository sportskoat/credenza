import { Check } from "lucide-react";
import QuietLegal from "../components/QuietLegal.jsx";
import { listAgents } from "../agents.js";
import {
  Caption,
  ModalShell,
} from "../credenza-fashion.jsx";

// A2: buying-agent picker. Referral codes are build-time env only (audit
// 2026-07-24, the revenue leak): no user-editable code field exists — a
// visitor must never be able to replace Kyle's attribution with their own.
// `embedded` renders the body alone, for the Profile modal's sub-page stack
// (Kyle 2026-07-26). The stack owns the shell, the title, and the back button.
//
// Kyle 2026-08-04: one card, no body scroll. Dense rows + two columns on a
// wide window. Open counts removed — the list is a picker, not a log.
export default function AgentSheet({ preferredAgent, onSelectAgent, onClose, embedded = false }) {
  const body = (
    <div className="cz-agent-sheet">
      <div className="cz-agent-kicker">
        <Caption>Buy opens in</Caption>
      </div>
      <div
        role="radiogroup"
        aria-label="Preferred buying agent"
        className="cz-agent-list"
      >
        {listAgents().map((agent) => {
          const active = agent.id === preferredAgent;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={active}
              key={agent.id}
              className={"cz-agent-row" + (active ? " is-active" : "")}
              onClick={() => onSelectAgent(agent.id)}
            >
              <span className="cz-agent-row-name">{agent.name}</span>
              {active ? (
                <Check size={14} aria-hidden="true" className="cz-agent-row-check" />
              ) : (
                <span className="cz-agent-row-check-slot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      <p className="cz-agent-note">
        Change anytime. Saved links stay the same. The agent applies only when you tap Buy.
      </p>
      {/* Round 5 point 5.3: one quiet disclosure line; the full wording
          sits behind the "i" control. */}
      <QuietLegal
        className="cz-quiet-legal cz-agent-legal"
        style={{ textAlign: "left" }}
        line="Disclosure: Buy links may include a referral code."
        more="Credenza may earn a commission on agent shipping fees. It never changes your item price."
      />
    </div>
  );

  if (embedded) return body;
  return (
    <ModalShell
      title="Buying agent"
      onClose={onClose}
      maxWidth={560}
      surfaceClassName="cz-agent-sheet-surface"
    >
      {body}
    </ModalShell>
  );
}
