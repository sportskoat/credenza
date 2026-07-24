import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  buildSignupUrl,
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
  SEG,
  SUB,
} from "../credenza-fashion.jsx";

// A2: buying-agent picker + referral slots + outbound-click counts. Buy keeps
// working with empty referral slots — codes only attach at open time (recordOpen).
export default function AgentSheet({ preferredAgent, onSelectAgent, affiliateCodes, onAffiliateCodeChange, storageBackend, onClose }) {
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

        <Caption style={{ color: BLUE, margin: "18px 0 8px" }}>Referral codes (optional)</Caption>
        <div style={{ display: "grid", gap: 8 }}>
          {listAgents()
            .filter((a) => a.referralParam || a.signupTemplate)
            .map((agent) => {
              const signupUrl = buildSignupUrl(agent.id, { referralOverrides: affiliateCodes });
              return (
                <div key={agent.id}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: SUB }}>
                    <span style={{ width: 80, flexShrink: 0, fontWeight: 600 }}>{agent.name}</span>
                    <input
                      type="text"
                      value={affiliateCodes[agent.id] || ""}
                      onChange={(e) => onAffiliateCodeChange(agent.id, e.target.value)}
                      placeholder="Paste code when your affiliate account is approved"
                      style={{
                        flex: 1,
                        fontFamily: FONT,
                        fontSize: 12.5,
                        color: INK,
                        background: SEG,
                        border: "1px solid " + HAIR,
                        borderRadius: 10,
                        padding: "8px 10px",
                      }}
                    />
                  </label>
                  {signupUrl ? (
                    <a
                      href={signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", margin: "4px 0 0 90px", fontSize: 11, color: BLUE }}
                    >
                      Test sign-up link ↗
                    </a>
                  ) : null}
                </div>
              );
            })}
        </div>

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
