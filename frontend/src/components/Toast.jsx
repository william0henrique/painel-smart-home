// src/components/Toast.jsx
import { CheckCircle, XCircle, Info } from 'lucide-react';

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null;

  const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {icons[toast.type]}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
