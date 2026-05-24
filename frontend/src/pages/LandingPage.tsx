import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import { Plane, Map as MapIcon, FlaskConical, ChevronRight, UserPlus, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import AuthModals from '../features/user/AuthModals';

/**
 * Premium Landing Page for Aero Plan.
 * Provides a clean, cinematic entry point to the application.
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && isAuthModalOpen) {
      setIsAuthModalOpen(false);
      navigate('/app');
    }
  }, [isAuthenticated, isAuthModalOpen, navigate]);

  const openAuth = (mode: 'login' | 'register') => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      setAuthMode(mode);
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#020617] overflow-hidden flex items-center justify-center font-sans">
      {/* Background Image with Cinematic Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-subtle-zoom will-change-transform"
        style={{ backgroundImage: 'url("/images/hero-bg.png")' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-[#020617]/40 to-[#020617]/90" />

      {/* Subtle Animated Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] animate-pulse-slow" />

      {/* Main Content Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 glass-morphism-heavy p-12 md:p-16 rounded-[32px] max-w-2xl w-full mx-4 flex flex-col items-center text-center border border-white/10 shadow-2xl"
      >
        {/* Logo/Icon Area */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20"
        >
          <Plane className="text-white w-8 h-8 -rotate-45" />
        </motion.div>

        {/* Typography */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-white text-5xl md:text-6xl font-bold tracking-tight mb-4"
        >
          Aero{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Plan
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-on-surface-variant text-lg md:text-xl max-w-md leading-relaxed mb-10"
        >
          Experience high-performance flight planning with real-time AIP visualization and precision
          tools.
        </motion.p>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 w-full justify-center"
        >
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/app')}
              className="bg-surface-bright text-on-primary font-bold px-8 h-14 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 group text-lg w-full sm:w-auto"
            >
              <MapIcon className="w-5 h-5" />
              Launch Application
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <>
              <button
                onClick={() => openAuth('login')}
                className="bg-surface-container text-on-surface font-bold px-8 h-14 rounded-xl hover:bg-surface-container-highest border border-glass-border transition-colors flex items-center justify-center gap-2 group text-lg flex-1"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </button>
              <button
                onClick={() => openAuth('register')}
                className="bg-surface-bright text-on-primary font-bold px-8 h-14 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 group text-lg flex-1"
              >
                <UserPlus className="w-5 h-5" />
                Create Account
              </button>
            </>
          )}
        </motion.div>

        {/* Secondary Links/Shader Lab Access */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-12 pt-8 border-t border-white/5 w-full flex justify-center"
        >
          <button
            onClick={() => navigate('/shader-lab')}
            className="flex items-center gap-2 text-on-surface-variant hover:text-orange-400 transition-colors text-sm font-medium group"
          >
            <FlaskConical className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            Open Shader Lab
          </button>
        </motion.div>
      </motion.div>

      {/* Footer Decoration */}
      <div className="absolute bottom-8 text-on-surface-variant text-[10px] uppercase tracking-[0.3em] font-bold">
        Next-Gen Aviation Intelligence
      </div>

      <AuthModals
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
