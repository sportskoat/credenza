// InfoBubble — small anchored popover for in-place explanations.
export default function InfoBubble({ title, children, onClose }) {
  return (
    <div className="cz-info-bubble">
      <div className="cz-info-bubble-line" aria-hidden="true" />
      <div className="cz-info-bubble-card">
        <div className="cz-info-bubble-header">
          <span>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>
        <div className="cz-info-bubble-body">{children}</div>
      </div>
    </div>
  );
}
