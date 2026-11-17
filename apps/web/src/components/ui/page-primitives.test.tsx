import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageState } from '../shared/page-state';
import { Button } from './button';

describe('shared page primitives', () => {
  it('preserves native button behavior and disabled state', () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" disabled onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces loading and empty states', () => {
    const { rerender } = render(<PageState kind="loading" title="Loading records" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading records');

    rerender(<PageState kind="empty" title="No records" description="Try another date." />);
    expect(screen.getByRole('status')).toHaveTextContent('No records');
    expect(screen.getByText('Try another date.')).toBeInTheDocument();
  });

  it('announces errors and invokes retry', () => {
    const onRetry = vi.fn();
    render(<PageState kind="error" title="Could not load" onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
