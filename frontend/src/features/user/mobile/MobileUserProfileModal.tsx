import { useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, User, Mail, LogOut, Calendar } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import './MobileUserProfileModal.css';

export const MobileUserProfileModal = memo(function MobileUserProfileModal() {
  const isOpen = useMapStore((s) => s.isUserProfileModalOpen);
  const setOpen = useMapStore((s) => s.setUserProfileModalOpen);
  const { user, logoutUser } = useAuthStore();
  const dragControls = useDragControls();

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleLogout = async () => {
    await logoutUser();
    onClose();
  };

  // Handle ESC
  useEscapeKey(isOpen, onClose);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="aip-mobile-profile-backdrop"
          />

          {/* Drawer */}
          <motion.div
            key="mobile-profile-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.95 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose();
              }
            }}
            className="aip-mobile-profile-drawer"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Drag Handle Indicator */}
            <div
              className="aip-mobile-profile-drag-zone"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: 'none' }}
            >
              <div className="aip-mobile-profile-drag-handle" />
            </div>

            {/* Header */}
            <div className="aip-mobile-profile-header">
              <div className="aip-mobile-profile-title-group">
                <User className="aip-mobile-profile-title-icon" size={18} />
                <h2 className="aip-mobile-profile-title">User Profile</h2>
              </div>
              <button
                onClick={onClose}
                className="aip-mobile-profile-close-btn"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="aip-mobile-profile-body">
              {/* Profile Header */}
              <div className="aip-mobile-profile-hero">
                <div className="aip-mobile-profile-avatar">
                  <User size={32} className="text-white/60" />
                </div>
                <div className="aip-mobile-profile-hero-info">
                  <h3 className="aip-mobile-profile-name">
                    {user?.username || (user?.email ? user.email.split('@')[0] : 'Unknown User')}
                  </h3>
                  <p className="aip-mobile-profile-role">Registered User</p>
                </div>
              </div>

              {/* Details List */}
              <div className="aip-mobile-profile-details">
                <div className="aip-mobile-profile-item">
                  <div className="aip-mobile-profile-item-icon">
                    <Mail size={16} />
                  </div>
                  <div className="aip-mobile-profile-item-content">
                    <span className="aip-mobile-profile-item-label">Email Address</span>
                    <span className="aip-mobile-profile-item-value">{user?.email || 'N/A'}</span>
                  </div>
                </div>
                {user?.created_at && (
                  <div className="aip-mobile-profile-item">
                    <div className="aip-mobile-profile-item-icon">
                      <Calendar size={16} />
                    </div>
                    <div className="aip-mobile-profile-item-content">
                      <span className="aip-mobile-profile-item-label">Member Since</span>
                      <span className="aip-mobile-profile-item-value">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="aip-mobile-profile-actions">
                <button onClick={handleLogout} className="aip-mobile-profile-btn danger">
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
});
export default MobileUserProfileModal;
