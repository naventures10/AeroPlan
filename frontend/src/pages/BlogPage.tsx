import { Link } from 'react-router';
import { ArrowLeft, BookOpen, Mail } from 'lucide-react';
import { useState } from 'react';

export default function BlogPage() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-surface text-on-background flex flex-col font-sans relative">
      {/* Animated CSS mesh background */}
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-30 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/30 blur-[120px] animate-pulse-slow"></div>
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[120px] animate-pulse-slow"
          style={{ animationDelay: '4s' }}
        ></div>
      </div>

      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-outline-variant/20 glass-morphism z-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors focus:outline-none"
        >
          <ArrowLeft size={18} />
          <span className="font-ui text-sm font-medium">Back to Home</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* SVG Favicon inline */}
          <svg className="w-6 h-6 text-primary" viewBox="1182 1460 335 314" fill="currentColor">
            <path
              d="M1236,1615L1441,1535L1402,1710L1346,1670C1346,1670 1315.017,1699.885 1315,1697C1314.936,1685.984 1316.3,1653.412 1318,1649C1320.295,1643.045 1409.522,1571.367 1403,1569C1397.705,1567.079 1298.865,1637.2 1292,1638C1284.405,1638.885 1236,1615 1236,1615Z"
              fill="var(--color-primary, #4c7a77)"
            />
          </svg>
          <span className="font-display font-bold tracking-tight text-on-background">AeroInfo</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center px-6 text-center max-w-2xl mx-auto z-10">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-primary mb-6 glow-accent animate-bounce">
          <BookOpen size={32} />
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          AeroInfo Blog
        </h1>
        <p className="font-ui text-lg text-on-surface-variant/80 mb-8 leading-relaxed">
          Deep dives into Indian airspace architecture, meteorological datasets, regulatory updates,
          and the engineering behind our high-performance vector rendering engines. Coming soon.
        </p>

        {subscribed ? (
          <div className="glass-morphism p-6 rounded-2xl border-status-success/30 max-w-md w-full animate-subtle-zoom">
            <p className="text-status-success font-medium text-lg mb-1">✓ You're on the list!</p>
            <p className="text-on-surface-variant text-sm">
              We'll notify you as soon as our first publication drops.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-on-surface-variant/50">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                placeholder="Enter your email for updates"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-container border border-outline/30 rounded-xl focus:border-primary focus:outline-none transition-colors text-on-background text-sm font-ui"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-primary hover:bg-opacity-90 text-on-primary font-ui font-semibold text-sm rounded-xl active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-md"
            >
              Notify Me
            </button>
          </form>
        )}
      </main>

      <footer className="w-full py-6 text-center border-t border-outline-variant/10 text-xs text-on-surface-variant/50 font-ui z-10">
        © 2026 AeroInfo. All rights reserved.
      </footer>
    </div>
  );
}
