import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ObjectRenderer from '../features/aip/renderers/ObjectRenderer';

vi.mock('../../../utils/sanitize', () => ({
  sanitizeHtml: (val: string) => val // return as is for test
}));

describe('ObjectRenderer', () => {
  it('renders NO DATA AVAILABLE when empty', () => {
    const { unmount } = render(<ObjectRenderer data={null} />);
    expect(screen.getByText('NO DATA AVAILABLE')).toBeInTheDocument();
    unmount();

    render(<ObjectRenderer data={{}} />);
    expect(screen.getByText('NO DATA AVAILABLE')).toBeInTheDocument();
  });

  it('renders with auto generated keys if no column config', () => {
    const data = {
      test_key: 'Test Value'
    };
    render(<ObjectRenderer data={data} />);
    expect(screen.getByText('Test Key')).toBeInTheDocument();
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });

  it('renders with column config correctly', () => {
    const data = {
      key1: 'Value 1',
      key2: 'Value 2\nLine2|Line3'
    };
    const config = [
      { key: 'key1', label: 'First Key' }
    ];

    render(<ObjectRenderer data={data} columnConfig={config as any} />);
    // from config
    expect(screen.getByText('First Key')).toBeInTheDocument();
    expect(screen.getByText('Value 1')).toBeInTheDocument();

    // extra data not in config
    expect(screen.getByText('Key2')).toBeInTheDocument();

    // Testing line break replacements
    // "Value 2\nLine2|Line3" -> "Value 2<br/>Line2<br/>Line3"
    const td = screen.getAllByRole('cell').find(cell => cell.innerHTML.includes('Value 2<br>Line2<br>Line3') || cell.innerHTML.includes('Value 2<br/>Line2<br/>Line3'));
    expect(td).toBeDefined();
  });
});
