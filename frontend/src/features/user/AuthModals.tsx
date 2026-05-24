import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import './AuthModals.css';

interface AuthModalsProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModals({ isOpen, onClose, initialMode = 'login' }: AuthModalsProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { loginUser, registerUser, isLoading, error, clearError } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await loginUser({ email, password });
    } else {
      await registerUser({ email, password });
    }
    // If successful, the auth store updates state and redirects (handled elsewhere).
  };

  const toggleMode = () => {
    clearError();
    setMode(mode === 'login' ? 'register' : 'login');
  };

  const handleClose = () => {
    clearError();
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="auth-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="auth-modal-backdrop"
        onClick={handleClose}
      >
        <motion.div
          key="auth-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="auth-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="auth-modal-header">
            <h2 className="auth-modal-title">
              {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
            </h2>
            <button onClick={handleClose} className="auth-modal-close-btn">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-modal-body">
            {error && <div className="auth-error-msg">{error}</div>}

            <div className="auth-input-group">
              <label className="auth-label">Email</label>
              <input
                type="email"
                required
                className="auth-input"
                placeholder="pilot@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Password</label>
              <input
                type="password"
                required
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
            </div>

            <button type="submit" disabled={isLoading} className="auth-submit-btn">
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>

            <div className="auth-toggle-text">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button type="button" onClick={toggleMode} className="auth-toggle-btn">
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
