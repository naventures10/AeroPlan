import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionModal from '../../features/aip/SectionModal';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className, style, onClick }: any) => (
        <div className={className} style={style} onClick={onClick}>
          {children}
        </div>
      ),
    },
  };
});

vi.mock('../../features/aip/SectionRenderer', () => ({
  default: () => <div data-testid="mock-section-renderer" />,
}));

describe('SectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    const onClose = vi.fn();
    render(
      <SectionModal
        isOpen={true}
        onClose={onClose}
        data={{}}
        title="Test Section"
        sectionId="AD_2_2"
        dataType="object"
        isLoading={false}
      />,
    );
    expect(screen.getByText('AD 2 2')).toBeInTheDocument();
    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByTestId('mock-section-renderer')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <SectionModal
        isOpen={true}
        onClose={vi.fn()}
        data={null}
        title="Test Section"
        sectionId="AD_2_2"
        dataType="object"
        isLoading={true}
      />,
    );
    expect(screen.getByText('Loading Section...')).toBeInTheDocument();
  });
});
