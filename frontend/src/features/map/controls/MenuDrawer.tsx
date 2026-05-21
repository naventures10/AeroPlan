import { AnimatePresence, motion } from 'framer-motion';
import './MenuDrawer.css';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const drawerSections = [
  {
    id: 'user-profile',
    title: 'User Profile',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
    description: 'Manage your account settings and preferences',
    badge: null,
  },
  {
    id: 'aip',
    title: 'AIP',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    description: 'Aeronautical Information Publication documents',
    badge: null,
  },
  {
    id: 'aip-supplements',
    title: 'AIP Supplements',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="12" x2="12" y2="18" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    description: 'Temporary changes to the AIP via supplements',
    badge: 'NEW',
  },
  {
    id: 'airspace-notams',
    title: 'Airspace NOTAMs',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    description: 'Active notices to airmen for managed airspaces',
    badge: '12',
  },
  {
    id: 'airspace-use-plans',
    title: 'Airspace Use Plans',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="10" y2="14" />
        <line x1="14" y1="14" x2="16" y2="14" />
      </svg>
    ),
    description: 'Scheduled and conditional use of airspace sectors',
    badge: null,
  },
];

// Stagger container — children animate in sequence
const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.15 },
  },
  exit: {
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 28 },
  },
  exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

export default function MenuDrawer({ isOpen, onClose }: MenuDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="aip-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            id="aip-menu-drawer"
            className="aip-menu-drawer"
            aria-label="Navigation menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.9 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.3, right: 0 }}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -60) onClose();
            }}
          >
            {/* Header */}
            <div className="aip-drawer-header">
              <div className="aip-drawer-logo">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="aip-drawer-title-group">
                <span className="aip-drawer-title">eAIP</span>
                <span className="aip-drawer-subtitle">Navigation</span>
              </div>
              <button
                className="aip-drawer-close"
                onClick={onClose}
                aria-label="Close menu"
                id="aip-drawer-close-btn"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="aip-drawer-divider" />

            {/* Sections */}
            <nav className="aip-drawer-nav" aria-label="Menu sections">
              <motion.ul
                className="aip-drawer-list"
                role="list"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {drawerSections.map(({ id, title, icon, description, badge }) => (
                  <motion.li key={id} variants={itemVariants}>
                    <button
                      id={`aip-drawer-item-${id}`}
                      className="aip-drawer-item"
                      aria-label={title}
                    >
                      <span className="aip-drawer-item-icon">{icon}</span>
                      <span className="aip-drawer-item-text">
                        <span className="aip-drawer-item-title">{title}</span>
                        <span className="aip-drawer-item-desc">{description}</span>
                      </span>
                      {badge && (
                        <span className={`aip-drawer-badge ${badge === 'NEW' ? 'new' : ''}`}>
                          {badge}
                        </span>
                      )}
                      <span className="aip-drawer-item-arrow">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            </nav>

            {/* Footer */}
            <div className="aip-drawer-footer">
              <span className="aip-drawer-version">eAIP v1.0</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
