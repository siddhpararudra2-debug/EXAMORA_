import React, { useRef, useEffect } from 'react';
import { useDevicePermissions } from '../hooks/useDevicePermissions';

interface DeviceCheckModalProps {
  isOpen?: boolean;
  onProceed?: () => void;
  title?: string;
}

export const DeviceCheckModal: React.FC<DeviceCheckModalProps> = ({
  isOpen = true,
  onProceed,
  title = 'Hardware & Proctoring Verification',
}) => {
  const {
    isLoading,
    hasPermission,
    errorMessage,
    stream,
    cameraAllowed,
    micAllowed,
    requestPermissions,
  } = useDevicePermissions();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!isOpen) return null;

  return (
    <div className="examora-modal-overlay">
      <div className="examora-modal-card">
        {/* Header */}
        <div className="examora-modal-header">
          <div className="examora-badge-container">
            <span className="examora-shield-icon">🛡️</span>
            <span className="examora-badge-text">System Pre-check</span>
          </div>
          <h2 className="examora-modal-title">{title}</h2>
          <p className="examora-modal-subtitle">
            Examora requires active webcam and microphone access for AI-powered automated proctoring.
          </p>
        </div>

        {/* Body Content */}
        <div className="examora-modal-body">
          {isLoading ? (
            <div className="examora-state-container loading">
              <div className="examora-spinner" />
              <p className="examora-state-title">Checking Hardware Permissions...</p>
              <p className="examora-state-desc">Please allow browser prompts for Camera and Microphone access.</p>
            </div>
          ) : hasPermission ? (
            <div className="examora-state-container success">
              {/* Video Preview */}
              <div className="examora-video-wrapper">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="examora-video-preview"
                />
                <div className="examora-live-badge">
                  <span className="examora-pulse-dot" /> LIVE FEED
                </div>
              </div>

              {/* Success Message Banner */}
              <div className="examora-alert success-alert">
                <div className="examora-alert-icon-wrap">
                  <svg className="examora-check-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="examora-alert-title">Hardware Verification Complete!</h4>
                  <p className="examora-alert-desc">Webcam and microphone are fully functional and authorized.</p>
                </div>
              </div>

              {/* Status Chips */}
              <div className="examora-status-row">
                <div className={`examora-status-chip ${cameraAllowed ? 'active' : ''}`}>
                  <span className="examora-chip-icon">📷</span>
                  <span>Camera: {cameraAllowed ? 'Connected' : 'Disabled'}</span>
                </div>
                <div className={`examora-status-chip ${micAllowed ? 'active' : ''}`}>
                  <span className="examora-chip-icon">🎙️</span>
                  <span>Microphone: {micAllowed ? 'Connected' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="examora-state-container error">
              {/* Error Alert Banner */}
              <div className="examora-alert error-alert">
                <div className="examora-alert-icon-wrap error-icon">
                  <svg className="examora-error-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="examora-alert-title">Device Access Denied or Failed</h4>
                  <p className="examora-alert-desc">{errorMessage || 'Unable to access your webcam or microphone.'}</p>
                </div>
              </div>

              <div className="examora-troubleshoot-box">
                <h5>How to resolve permission issues:</h5>
                <ul>
                  <li>Look for the camera/padlock icon in your browser search/URL bar.</li>
                  <li>Ensure permissions for <strong>Camera</strong> and <strong>Microphone</strong> are set to <strong>Allow</strong>.</li>
                  <li>Close other video apps (Zoom, Teams, Skype) that may be using your camera.</li>
                  <li>Click <strong>Retry Hardware Check</strong> below after granting permission.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="examora-modal-footer">
          {!isLoading && !hasPermission && (
            <button
              type="button"
              className="examora-btn examora-btn-retry"
              onClick={requestPermissions}
            >
              <svg className="examora-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Hardware Check
            </button>
          )}

          {!isLoading && hasPermission && (
            <button
              type="button"
              className="examora-btn examora-btn-primary"
              onClick={onProceed}
            >
              Start Exam Now
              <svg className="examora-btn-icon-right" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Embedded Modern Styling */}
      <style jsx>{`
        .examora-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 15, 29, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1.5rem;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .examora-modal-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          width: 100%;
          max-width: 560px;
          color: #f9fafb;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .examora-modal-header {
          padding: 1.75rem 1.75rem 1rem;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .examora-badge-container {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .examora-modal-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px 0;
        }

        .examora-modal-subtitle {
          font-size: 0.875rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.4;
        }

        .examora-modal-body {
          padding: 1.5rem 1.75rem;
        }

        .examora-state-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .examora-spinner {
          width: 48px;
          height: 48px;
          border: 3.5px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 1.25rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .examora-state-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #f3f4f6;
          margin: 0 0 6px 0;
        }

        .examora-state-desc {
          font-size: 0.875rem;
          color: #9ca3af;
          margin: 0;
        }

        .examora-video-wrapper {
          position: relative;
          width: 100%;
          height: 240px;
          background: #030712;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 1rem;
        }

        .examora-video-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }

        .examora-live-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          color: #10b981;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          letter-spacing: 0.5px;
        }

        .examora-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        .examora-alert {
          display: flex;
          gap: 12px;
          padding: 1rem;
          border-radius: 10px;
          text-align: left;
          width: 100%;
          margin-bottom: 1rem;
          box-sizing: border-box;
        }

        .success-alert {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .error-alert {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .examora-alert-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #10b981;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .examora-alert-icon-wrap.error-icon {
          background: #ef4444;
        }

        .examora-check-svg, .examora-error-svg {
          width: 22px;
          height: 22px;
        }

        .examora-alert-title {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0 0 2px 0;
        }

        .success-alert .examora-alert-title {
          color: #34d399;
        }

        .error-alert .examora-alert-title {
          color: #f87171;
        }

        .examora-alert-desc {
          font-size: 0.825rem;
          color: #d1d5db;
          margin: 0;
          line-height: 1.35;
        }

        .examora-status-row {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .examora-status-chip {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #1f2937;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .examora-status-chip.active {
          border-color: rgba(16, 185, 129, 0.4);
          color: #e5e7eb;
        }

        .examora-troubleshoot-box {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 10px;
          padding: 1rem;
          text-align: left;
          width: 100%;
          box-sizing: border-box;
        }

        .examora-troubleshoot-box h5 {
          font-size: 0.85rem;
          font-weight: 600;
          color: #d1d5db;
          margin: 0 0 8px 0;
        }

        .examora-troubleshoot-box ul {
          margin: 0;
          padding-left: 1.2rem;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .examora-troubleshoot-box li {
          margin-bottom: 4px;
        }

        .examora-modal-footer {
          padding: 1rem 1.75rem 1.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .examora-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          width: 100%;
        }

        .examora-btn-retry {
          background: #374151;
          color: #ffffff;
        }

        .examora-btn-retry:hover {
          background: #4b5563;
        }

        .examora-btn-primary {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #ffffff;
          box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);
        }

        .examora-btn-primary:hover {
          background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
          transform: translateY(-1px);
        }

        .examora-btn-icon, .examora-btn-icon-right {
          width: 18px;
          height: 18px;
        }
      `}</style>
    </div>
  );
};

export default DeviceCheckModal;
