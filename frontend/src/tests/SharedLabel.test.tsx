import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabelVal } from '../features/map/components/SharedLabel';

describe('SharedLabel', () => {
  it('renders label and value when value is present', () => {
    render(<LabelVal label="Test Label" val="Test Value" />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });

  it('renders null when value is not present', () => {
    const { container } = render(<LabelVal label="Test Label" val={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when value is empty string', () => {
    const { container } = render(<LabelVal label="Test Label" val="" />);
    expect(container.firstChild).toBeNull();
  });
});
