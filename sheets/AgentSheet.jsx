import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  listAgents,
  loadOutboundClicks,
  summarizeOutbound,
} from "../agents.js";
import {
  BLUE,
  CARD,
  Caption,
  FONT,
  HAIR,
  INK,
  ModalShell,
  SUB,
} from "../credenza-fashion.jsx";

// A2: buying-agent picker + outbound-click counts. Referral codes are
// build-time env only (audit 2026-07-24, the revenue leak): no user-editable
// code field exists — a visitor must never be able to replace Kyle's
// attribution with their own.
export default function AgentSheet({ preferredAgent, onSelectAgent, storageBackend, onClose }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let live = true;
    loadOutboundClicks(storageBackend).then((clicks) => {
      if (live) setSummary(summarizeOutbound(clicks));
    });
    return () => {
      live = false;
    };
  }, [storageBackend]);

  return (
    <ModalShell title="Buying agent" onClose={onClose} maxWidth={520}>
      <div style={{ padding: "20px 22px 22px", fontFamily: FONT }}>
        <Caption style={{ color: BLUE, marginBottom: 10 }}>Buy opens in</Caption>
        <div
          role="radiogroup"
          aria-label="Preferred buying agent"
          style={{ display: "grid", gap: 6 }}
        >
          {listAgents().map((agent) => {
            const active = agent.id === preferredAgent;
            const clicks = summary && summary.byAgent[agent.id];
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  color: active ? INK : SUB,
                  background: active ? CARD : "transparent",
                  border: "1px solid " + (active ? "var(--cz-hair-strong)" : HAIR),
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ flex: 1 }}>{agent.name}</span>
                {clicks ? (
                  <span style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>{clicks} opened</span>
                ) : null}
                {active ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: SUB, margin: "12px 0 0" }}>
          Change anytime — your saved links are never rewritten. The agent is applied only when you
          tap Buy. Disclosure: Buy links may include a referral code; Credenza may earn a commission
          on agent shipping fees. It never changes your item price.
        </p>

        {summary && summary.total > 0 ? (
          <p style={{ fontSize: 11.5, color: SUB, margin: "16px 0 0" }}>
            {summary.total} outbound {summary.total === 1 ? "click" : "clicks"} logged locally
            {summary.wrapped ? " · " + summary.wrapped + " through an agent" : ""}.
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
