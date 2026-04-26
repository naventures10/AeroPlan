import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionRenderer from '../../features/aip/SectionRenderer';

vi.mock('../../features/aip/renderers/TableRenderer', () => ({
  default: () => <div data-testid="table-renderer" />,
}));

vi.mock('../../features/aip/renderers/ObjectRenderer', () => ({
  default: () => <div data-testid="object-renderer" />,
}));

vi.mock('../../features/aip/renderers/HybridRenderer', () => ({
  default: () => <div data-testid="hybrid-renderer" />,
}));

describe('SectionRenderer', () => {
  it('renders array data type', () => {
    render(<SectionRenderer data={[]} dataType="array" sectionId="AD_2_2" />);
    expect(screen.getByTestId('table-renderer')).toBeInTheDocument();
  });

  it('renders object data type', () => {
    render(<SectionRenderer data={{}} dataType="object" sectionId="AD_2_2" />);
    expect(screen.getByTestId('object-renderer')).toBeInTheDocument();
  });

  it('renders hybrid data type', () => {
    render(<SectionRenderer data={{}} dataType="hybrid" sectionId="AD_2_2" />);
    expect(screen.getByTestId('hybrid-renderer')).toBeInTheDocument();
  });

  it('falls back to array renderer', () => {
    render(<SectionRenderer data={[]} dataType="unknown" sectionId="AD_2_2" />);
    expect(screen.getByTestId('table-renderer')).toBeInTheDocument();
  });

  it('falls back to object renderer', () => {
    render(<SectionRenderer data={{}} dataType="unknown" sectionId="AD_2_2" />);
    expect(screen.getByTestId('object-renderer')).toBeInTheDocument();
  });

  it('falls back to hybrid renderer', () => {
    render(<SectionRenderer data={'test'} dataType="unknown" sectionId="AD_2_2" />);
    expect(screen.getByTestId('hybrid-renderer')).toBeInTheDocument();
  });
});
