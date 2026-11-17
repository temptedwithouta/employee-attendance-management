import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface PageStateProps {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  description?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function PageState({ kind, title, description, onRetry, children }: PageStateProps) {
  return (
    <section
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-12 text-center"
    >
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {children}
      {kind === 'error' && onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}
