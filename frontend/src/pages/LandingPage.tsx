import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Map,
  Cloud,
  Bell,
  Layers,
  Route,
  FileText,
  Mail,
  ArrowRight,
  Menu,
  X,
  ShieldAlert,
} from 'lucide-react';
import './LandingPage.css';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Monitor the scroll position inside our custom container
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setScrolled(containerRef.current.scrollTop > 50);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureItems = [
    {
      icon: <Map className="w-6 h-6" />,
      title: 'Interactive Indian Aeronautical Map',
      description:
        'Enroute & terminal views with real-time Indian vector data layers, custom styling, and responsive filters.',
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: 'Indian Meteorological Overlays',
      description:
        'Live Indian METAR/TAF weather data integrated directly into the map view for quick pilot briefings.',
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: 'NOTAMs & AIP Supplements',
      description:
        'Real-time notices to airmen and regulatory updates from Indian flight information regions, parsed by location.',
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: 'Airspace Visualization',
      description:
        'Explore detailed Indian FIR, TMA, and CTR boundaries with clear classification and altitudinal labels.',
    },
    {
      icon: <Route className="w-6 h-6" />,
      title: 'Indian Route Network',
      description:
        'Browse domestic RNAV routes, ATS airways, waypoint databases, and terminal arrival/departure gates.',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'AIP Charts & Data',
      description:
        'Instant access to Indian aerodrome information, SID/STAR charts, and airport instrument approach procedures.',
    },
  ];

  return (
    <div ref={containerRef} className="landing-container font-sans aip-scrollbar">
      {/* ─────────────────────────────────────────────────────────────────────────
         Header
         ───────────────────────────────────────────────────────────────────────── */}
      <header
        className={`landing-header px-6 py-4 flex items-center justify-between ${scrolled ? 'header-scrolled' : 'bg-transparent'}`}
      >
        <div className="flex items-center gap-2">
          {/* SVG Favicon inline */}
          <svg className="w-8 h-8 text-primary" viewBox="1182 1460 335 314" fill="currentColor">
            <path
              d="M1236,1615L1441,1535L1402,1710L1346,1670C1346,1670 1315.017,1699.885 1315,1697C1314.936,1685.984 1316.3,1653.412 1318,1649C1320.295,1643.045 1409.522,1571.367 1403,1569C1397.705,1567.079 1298.865,1637.2 1292,1638C1284.405,1638.885 1236,1615 1236,1615Z"
              fill="var(--color-primary, #4c7a77)"
            />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight text-on-background">
            AeroInfo India
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-ui font-medium text-on-surface-variant">
          <a
            href="#about"
            onClick={(e) => handleAnchorClick(e, 'about')}
            className="nav-link-underline hover:text-on-background transition-colors"
          >
            About
          </a>
          <a
            href="#features"
            onClick={(e) => handleAnchorClick(e, 'features')}
            className="nav-link-underline hover:text-on-background transition-colors"
          >
            Features
          </a>
          <a
            href="#use-cases"
            onClick={(e) => handleAnchorClick(e, 'use-cases')}
            className="nav-link-underline hover:text-on-background transition-colors"
          >
            Use Cases
          </a>
          <Link
            to="/blog"
            className="nav-link-underline hover:text-on-background transition-colors"
          >
            Blog
          </Link>
          <a
            href="#contact"
            onClick={(e) => handleAnchorClick(e, 'contact')}
            className="nav-link-underline hover:text-on-background transition-colors"
          >
            Contact
          </a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <button
            type="button"
            onClick={() => setShowDisclaimerModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-opacity-95 text-sm font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-md"
          >
            Launch App
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg bg-surface-container border border-outline/20 text-on-surface hover:text-primary transition-colors focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile Navigation Dropdown */}
        <div className={`mobile-nav-menu ${mobileMenuOpen ? 'is-open' : ''}`}>
          <a
            href="#about"
            onClick={(e) => handleAnchorClick(e, 'about')}
            className="py-2 text-on-surface hover:text-primary transition-colors border-b border-outline-variant/10"
          >
            About
          </a>
          <a
            href="#features"
            onClick={(e) => handleAnchorClick(e, 'features')}
            className="py-2 text-on-surface hover:text-primary transition-colors border-b border-outline-variant/10"
          >
            Features
          </a>
          <a
            href="#use-cases"
            onClick={(e) => handleAnchorClick(e, 'use-cases')}
            className="py-2 text-on-surface hover:text-primary transition-colors border-b border-outline-variant/10"
          >
            Use Cases
          </a>
          <Link
            to="/blog"
            className="py-2 text-on-surface hover:text-primary transition-colors border-b border-outline-variant/10"
          >
            Blog
          </Link>
          <a
            href="#contact"
            onClick={(e) => handleAnchorClick(e, 'contact')}
            className="py-2 text-on-surface hover:text-primary transition-colors border-b border-outline-variant/10"
          >
            Contact
          </a>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setShowDisclaimerModal(true);
            }}
            className="mt-2 py-3 flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary font-semibold text-center text-sm shadow-md w-full"
          >
            Launch App
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────────
         Hero Section
         ───────────────────────────────────────────────────────────────────────── */}
      <section className="hero-section">
        {/* Fast Static Background */}
        <div className="hero-static-bg"></div>

        <div className="hero-content relative">
          <div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-on-background mb-6 leading-tight max-w-4xl mx-auto">
              Comprehensive Digital Platform for Aeronautical Information{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-500">
                of India
              </span>
            </h1>
            <p className="font-ui text-base sm:text-lg text-on-surface-variant max-w-xl mx-auto mb-10 leading-relaxed">
              A modern aviation data platform that puts interactive Indian airspace structures,
              navigation routes, live weather layers, and aeronautical charts at your fingertips.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowDisclaimerModal(true)}
                className="w-full sm:w-auto px-8 py-4 flex items-center justify-center gap-2 rounded-2xl bg-primary text-on-primary font-ui font-bold text-base hover:bg-opacity-95 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                Explore the Map
                <ArrowRight size={18} />
              </button>
              <a
                href="#features"
                onClick={(e) => handleAnchorClick(e, 'features')}
                className="w-full sm:w-auto px-8 py-4 flex items-center justify-center gap-2 rounded-2xl bg-surface-container-high border border-outline/30 text-on-surface font-ui font-bold text-base hover:bg-surface-container-highest transition-all duration-150 cursor-pointer"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
         About Section
         ───────────────────────────────────────────────────────────────────────── */}
      <section
        id="about"
        className="py-24 px-6 max-w-7xl mx-auto border-t border-outline-variant/10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold tracking-widest uppercase text-primary font-ui">
              About AeroInfo India
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-on-background">
              The Sky, Redefined in Vector Data.
            </h2>
            <p className="font-ui text-base text-on-surface-variant/90 leading-relaxed">
              AeroInfo India is built for the curious minds, flight dispatchers, and aviation
              students who demand high-performance visual tools. By translating Indian airspace
              definitions and meteorological feeds into a unified vector engine, we render complex
              airway networks and terminal areas seamlessly in three dimensions.
            </p>
            <p className="font-ui text-base text-on-surface-variant/90 leading-relaxed">
              Whether you are analyzing a regional Terminal Control Area (TMA) or tracing RNAV
              routes in Indian skies, our platform delivers an intuitive layout built for visual
              clarity, sub-second queries, and offline-ready responsiveness.
            </p>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-sm aspect-square rounded-3xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center overflow-hidden">
              <img
                src="/about_image.png"
                alt="About AeroInfo India"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
         Features Section
         ───────────────────────────────────────────────────────────────────────── */}
      <section
        id="features"
        className="py-24 px-6 bg-surface-dim border-t border-outline-variant/10"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-bold tracking-widest uppercase text-primary font-ui">
              Capabilities
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-on-background">
              What You'll Discover
            </h2>
            <p className="font-ui text-base text-on-surface-variant/80">
              AeroInfo India packs power into a highly responsive, modern client shell designed for
              interactive explorations.
            </p>
          </div>

          <div className="features-grid">
            {featureItems.map((item, index) => (
              <div
                key={index}
                className="feature-card p-6 rounded-2xl bg-surface-container border border-outline-variant/30 flex flex-col items-start text-left"
              >
                <div className="feature-icon-wrapper">{item.icon}</div>
                <h3 className="font-display text-lg font-bold text-on-background mb-2">
                  {item.title}
                </h3>
                <p className="font-ui text-sm text-on-surface-variant/80 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
         Use Cases Section
         ───────────────────────────────────────────────────────────────────────── */}
      <section
        id="use-cases"
        className="py-24 px-6 max-w-7xl mx-auto border-t border-outline-variant/10 text-center"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          <span className="text-xs font-bold tracking-widest uppercase text-primary font-ui">
            Built For Explorers
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-on-background leading-tight">
            For anyone who wants to explore and understand airspace.
          </h2>
          <p className="font-ui text-base sm:text-lg text-on-surface-variant/90 leading-relaxed max-w-2xl mx-auto">
            AeroInfo India is custom-tailored for aviation students, simulation flight simulator
            pilots, and airspace hobbyists who need a clear, visual reference of complex terminal
            environments and Indian airways. We make aeronautical data approachable, interactive,
            and beautifully visual.
          </p>
          <div className="pt-6">
            <button
              type="button"
              onClick={() => setShowDisclaimerModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-on-primary font-ui font-semibold text-base hover:bg-opacity-95 transition-all duration-150 cursor-pointer shadow-md"
            >
              Start Exploring Now
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
         Contact Section
         ───────────────────────────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="py-24 px-6 bg-surface-dim border-t border-outline-variant/10 text-center"
      >
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-on-background">
            Get in Touch
          </h2>
          <p className="font-ui text-sm sm:text-base text-on-surface-variant/80 max-w-md mx-auto">
            Have suggestions, questions, or ideas for new integrations? We'd love to hear from you.
          </p>
          <div className="pt-2">
            <a
              href="mailto:naventures10@gmail.com"
              className="inline-flex items-center gap-2 text-lg sm:text-xl font-semibold text-primary hover:text-cyan-500 transition-colors focus:outline-none"
            >
              <Mail size={22} className="text-primary" />
              naventures10@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
         Footer
         ───────────────────────────────────────────────────────────────────────── */}
      <footer className="w-full py-8 text-center border-t border-outline-variant/10 bg-surface-dim text-xs text-on-surface-variant/50 font-ui">
        © 2026 AeroInfo India. All rights reserved.
      </footer>

      {/* Non-Operational Use Disclaimer Modal */}
      {showDisclaimerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowDisclaimerModal(false)}
        >
          <div
            className="glass-morphism relative w-full max-w-lg p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl border border-outline/20 text-on-surface bg-surface-container/95 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="disclaimer-title"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowDisclaimerModal(false)}
              className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-container-high transition-colors focus:outline-none"
              aria-label="Close disclaimer modal"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pr-8">
              <div className="p-3 rounded-2xl bg-accent-cyan/15 text-accent-cyan shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h2
                  id="disclaimer-title"
                  className="font-display text-lg sm:text-xl font-bold text-on-background"
                >
                  Non-Operational Use Disclaimer
                </h2>
                <p className="font-ui text-xs sm:text-sm text-on-surface-variant">
                  Notice for flight visualization & research platform
                </p>
              </div>
            </div>

            {/* Body Content */}
            <div className="font-ui text-sm sm:text-base text-on-surface-variant leading-relaxed flex flex-col gap-3">
              <p>
                <strong className="text-on-surface font-semibold">Aero Plan</strong> is an
                interactive digital platform created strictly for situational awareness, airspace
                visualization, research, and educational purposes.
              </p>
              <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-outline/10 text-xs sm:text-sm leading-relaxed">
                <strong className="text-on-surface font-semibold block mb-1">
                  Important Requirement:
                </strong>
                This platform and its data layers are{' '}
                <span className="font-semibold text-on-surface underline">NOT</span> certified for
                real-world flight navigation or operational flight planning. Pilots and flight
                personnel must rely exclusively on official Aeronautical Information Publications.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowDisclaimerModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-outline/30 text-on-surface hover:bg-surface-container-high text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisclaimerModal(false);
                  navigate('/app');
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-opacity-95 text-sm font-semibold transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                I Understand & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
