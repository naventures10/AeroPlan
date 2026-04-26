import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TableRenderer from '../../features/aip/renderers/TableRenderer';

vi.mock('../../../utils/sanitize', () => ({
  sanitizeHtml: (val: string) => val, // return as is for test
}));

describe('TableRenderer', () => {
  it('renders NO DATA AVAILABLE when empty', () => {
    const { unmount } = render(<TableRenderer data={null} />);
    expect(screen.getByText('NO DATA AVAILABLE')).toBeInTheDocument();
    unmount();

    render(<TableRenderer data={[]} />);
    expect(screen.getByText('NO DATA AVAILABLE')).toBeInTheDocument();
  });

  it('renders with auto generated columns if no config', () => {
    const data = [{ test_key: 'Test Value 1' }, { test_key: 'Test Value 2' }];
    render(<TableRenderer data={data} />);
    expect(screen.getByText('Test Key')).toBeInTheDocument();
    expect(screen.getByText('Test Value 1')).toBeInTheDocument();
    expect(screen.getByText('Test Value 2')).toBeInTheDocument();
  });

  it('renders with column config correctly', () => {
    const data = [{ key1: 'Value 1', key2: 'Value 2\nLine2|Line3' }];
    const config = [
      { key: 'key1', header: 'First Header' },
      { key: 'key2', header: 'Second Header' }, // testing width logic mapping
    ];

    render(<TableRenderer data={data} columnConfig={config as any} />);

    // from config
    expect(screen.getByText('First Header')).toBeInTheDocument();
    expect(screen.getByText('Second Header')).toBeInTheDocument();
    expect(screen.getByText('Value 1')).toBeInTheDocument();

    const td = screen
      .getAllByRole('cell')
      .find(
        (cell) =>
          cell.innerHTML.includes('Value 2<br>Line2<br>Line3') ||
          cell.innerHTML.includes('Value 2<br/>Line2<br/>Line3'),
      );
    expect(td).toBeDefined();
  });
});
