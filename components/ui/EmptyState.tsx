import { ReactNode } from 'react';
import Icon from './Icon';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Friendly placeholder for empty lists: icon, short explanation, optional next step. */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-up">
      <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Icon name={icon} filled className="text-[28px]" />
      </span>
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      <p className="text-sm text-on-surface-variant max-w-xs mt-1 mb-5">{description}</p>
      {action}
    </div>
  );
}
