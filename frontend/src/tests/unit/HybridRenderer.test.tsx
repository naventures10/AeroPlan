import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HybridRenderer from '../../features/aip/renderers/HybridRenderer';

vi.mock('../../utils/sanitize', () => ({
  sanitizeHtml: (val: string) => val, // return as is for test
}));

vi.mock('../../features/aip/renderers/TableRenderer', () => ({
  default: () => <div data-testid="table-renderer" />,
}));

vi.mock('../../features/aip/renderers/ObjectRenderer', () => ({
  default: () => <div data-testid="object-renderer" />,
}));

describe('HybridRenderer', () => {
  it('renders NIL for null/undefined/empty', () => {
    const { unmount } = render(<HybridRenderer data={null} />);
    expect(screen.getByText('NIL')).toBeInTheDocument();
    unmount();

    render(<HybridRenderer data={'   '} />);
    expect(screen.getByText('NIL')).toBeInTheDocument();
  });

  it('renders plain string', () => {
    render(<HybridRenderer data={'Line 1\nLine 2'} />);
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
  });

  it('renders array of objects using TableRenderer', () => {
    render(<HybridRenderer data={[{ key: 'value' }]} />);
    expect(screen.getByTestId('table-renderer')).toBeInTheDocument();
  });

  it('renders array of typed blocks', () => {
    const data = [
      { type: 'paragraph', content: 'Test paragraph' },
      {
        type: 'table',
        content: [
          ['H1', 'H2'],
          ['R1C1', 'R1C2'],
        ],
      },
      { type: 'unknown', content: 'Fallback text' },
      { type: 'table', content: [{ k: 'v' }] }, // object table
      { type: 'table', content: 'Invalid table' }, // fallback table
      { type: 'paragraph', content: 'NIL' }, // should be ignored
    ];
    render(<HybridRenderer data={data} />);

    expect(screen.getByText('Test paragraph')).toBeInTheDocument();
    expect(screen.getByText('H1')).toBeInTheDocument();
    expect(screen.getByText('R1C1')).toBeInTheDocument();
    expect(screen.getByText('Fallback text')).toBeInTheDocument();
    expect(screen.getByTestId('table-renderer')).toBeInTheDocument();
    expect(screen.getByText('Invalid table')).toBeInTheDocument();
  });

  it('renders object with all scalar values using ObjectRenderer', () => {
    render(<HybridRenderer data={{ key: 'value' }} />);
    expect(screen.getByTestId('object-renderer')).toBeInTheDocument();
  });

  it('renders mixed object values recursively', () => {
    const data = {
      str_key: 'string value',
      arr_key: [{ k: 'v' }],
      obj_key: { inner: 'v' },
      num_key: 42,
      typed_arr_key: [{ type: 'paragraph', content: 'deep paragraph' }],
    };
    render(<HybridRenderer data={data} />);

    expect(screen.getByText('Str Key')).toBeInTheDocument();
    expect(screen.getByText('string value')).toBeInTheDocument();
    expect(screen.getAllByTestId('table-renderer').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('object-renderer').length).toBeGreaterThan(0);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('deep paragraph')).toBeInTheDocument();
  });

  it('renders primitive fallback', () => {
    render(<HybridRenderer data={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
