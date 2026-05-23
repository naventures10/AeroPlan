import { X, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { fetchAirspaceNotams } from '../../api/client';
import type { NotamData } from '../../types';
import './AirspaceNotamsModal.css';

export function AirspaceNotamsModal() {
  const isAirspaceNotamsModalOpen = useMapStore((s) => s.isAirspaceNotamsModalOpen);
  const setAirspaceNotamsModalOpen = useMapStore((s) => s.setAirspaceNotamsModalOpen);
  const viewMode = useMapStore((s) => s.viewMode);
  const pitch = useMapStore((s) => s.viewState.pitch);
  const [notams, setNotams] = useState<NotamData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFir, setSelectedFir] = useState<string>('All');

  useEffect(() => {
    if (isAirspaceNotamsModalOpen) {
      const loadNotams = async () => {
        setIsLoading(true);
        try {
          const data = await fetchAirspaceNotams();
          setNotams(data);
        } catch (error) {
          console.error('Failed to load airspace NOTAMs:', error);
          setNotams([]);
        } finally {
          setIsLoading(false);
        }
      };
      loadNotams();
    }
  }, [isAirspaceNotamsModalOpen]);

  if (!isAirspaceNotamsModalOpen || viewMode !== 'ENROUTE' || pitch > 0) return null;

  const onClose = () => setAirspaceNotamsModalOpen(false);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'PERM / UFN';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  };

  const uniqueFirs = Array.from(
    new Set(notams.flatMap((n) => [n.fir, n.combined_fir]).filter(Boolean) as string[]),
  ).sort();

  const filteredNotams = notams.filter((notam) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      notam.notam_id.toLowerCase().includes(q) ||
      (notam.description && notam.description.toLowerCase().includes(q)) ||
      (notam.fir && notam.fir.toLowerCase().includes(q)) ||
      (notam.combined_fir && notam.combined_fir.toLowerCase().includes(q));

    const matchesFir =
      selectedFir === 'All' || notam.fir === selectedFir || notam.combined_fir === selectedFir;

    return matchesSearch && matchesFir;
  });

  return (
    <AnimatePresence>
      <motion.div
        key="airspace-notams-modal"
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: -20, y: 20 }}
        transition={{ duration: 0.2 }}
        className="airspace-notams-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="airspace-notams-header">
          <h2 className="airspace-notams-header-title">Enroute Notams</h2>
          <button onClick={onClose} className="airspace-notams-close-btn" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="airspace-notams-controls">
          <div className="airspace-notams-search-wrapper">
            <Search size={18} className="airspace-notams-search-icon" />
            <input
              type="text"
              placeholder="Search by ID, FIR, or keyword..."
              className="airspace-notams-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="airspace-notams-fir-wrapper">
            <Filter size={16} className="airspace-notams-fir-icon" />
            <select
              className="airspace-notams-fir-select"
              value={selectedFir}
              onChange={(e) => setSelectedFir(e.target.value)}
              aria-label="Filter by FIR"
            >
              <option value="All">All FIRs</option>
              {uniqueFirs.map((fir) => (
                <option key={fir} value={fir}>
                  {fir}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="airspace-notams-content aip-scrollbar">
          {isLoading ? (
            <div className="airspace-notams-loading">
              <div className="airspace-notams-spinner" />
              <span>Loading Enroute Notams...</span>
            </div>
          ) : filteredNotams.length === 0 ? (
            <div className="airspace-notams-empty">
              <span>No matching NOTAMs found.</span>
            </div>
          ) : (
            <div className="airspace-notams-grid">
              {filteredNotams.map((notam) => (
                <div key={notam.notam_id} className="airspace-notam-card">
                  <div className="airspace-notam-header">
                    <div className="airspace-notam-id">{notam.notam_id}</div>
                    <div className="airspace-notam-badges">
                      {notam.fir && (
                        <span className="airspace-notam-badge fir">FIR: {notam.fir}</span>
                      )}
                      {notam.combined_fir && (
                        <span className="airspace-notam-badge fir">FIR: {notam.combined_fir}</span>
                      )}
                    </div>
                  </div>

                  <div className="airspace-notam-dates">
                    <span>Valid: {formatDate(notam.valid_from)}</span>
                    <span>—</span>
                    <span>{notam.is_permanent ? 'PERM' : formatDate(notam.valid_to)}</span>
                  </div>

                  <div className="airspace-notam-desc">{notam.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
