import React, { useState } from 'react';

interface TOSModalProps {
  onAccept: () => void;
}

const TOSModal: React.FC<TOSModalProps> = ({ onAccept }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="tos-modal">
      <div className="tos-content" style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>Before you continue</h2>

        <div style={{ textAlign: 'left', maxHeight: '50vh', overflowY: 'auto', margin: '1em 0', lineHeight: 1.6, fontSize: '1rem' }}>
          <p><strong>Use at your own risk.</strong> This tool transfers files between Supabase Storage and Cloudflare R2. It is non-destructive by default, but any data operation can carry risk.</p>

          <h3 style={{ marginTop: '1.2em' }}>What you should know</h3>
          <ul>
            <li>No warranties or guarantees are provided. Results may vary.</li>
            <li>Your API credentials stay in your browser unless you choose to save them.</li>
            <li>We are not liable for any data loss, costs, or damages.</li>
            <li>Third-party services (Supabase, R2) may rate-limit or fail outside our control.</li>
            <li>This is an early-stage tool and may have bugs.</li>
          </ul>

          <h3 style={{ marginTop: '1.2em' }}>Recommendations</h3>
          <ul>
            <li>Back up important data first</li>
            <li>Start with a small dry run</li>
            <li>Review conflict policies (default is “Skip existing”)</li>
            <li>Monitor progress and verify after completion</li>
          </ul>

          <p><strong>By proceeding, you confirm that you understand and accept these terms.</strong></p>
        </div>

        <div className="checkbox-group" style={{ marginTop: '0.5em' }}>
          <input
            type="checkbox"
            id="agree-tos"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <label htmlFor="agree-tos">
            I have read and agree to the notice above.
          </label>
        </div>

        <div style={{ marginTop: '1em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="https://buymeacoffee.com/deduble" target="_blank" rel="noreferrer" style={{ opacity: 0.9 }}>
            Buy me a coffee ☕
          </a>
          <button
            className="btn btn-primary"
            disabled={!agreed}
            onClick={onAccept}
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default TOSModal;
