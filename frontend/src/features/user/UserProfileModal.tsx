import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, LogOut } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import './UserProfileModal.css';

export default function UserProfileModal() {
  const isOpen = useMapStore((s) => s.isUserProfileModalOpen);
  const setOpen = useMapStore((s) => s.setUserProfileModalOpen);

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  // Handle ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="user-profile-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            key="user-profile-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="user-profile-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="user-profile-modal-header">
              <div className="user-profile-header-group">
                <div className="user-profile-header-icon">
                  <User size={16} />
                </div>
                <h2 className="user-profile-header-title">User Profile</h2>
              </div>
              <button onClick={onClose} className="user-profile-action-btn">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="user-profile-body">
              {/* Profile Header */}
              <div className="profile-hero-section">
                <div className="profile-avatar">
                  <User size={48} className="text-white/60" />
                </div>
                <div className="profile-hero-info">
                  <h3 className="profile-name">John Doe</h3>
                  <p className="profile-role">Aviation Pilot</p>
                </div>
              </div>

              {/* Details List */}
              <div className="profile-details-list">
                <div className="profile-detail-item">
                  <div className="detail-icon">
                    <Mail size={16} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Email Address</span>
                    <span className="detail-value">john.doe@example.com</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="profile-actions">
                <button className="profile-action-button danger">
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
