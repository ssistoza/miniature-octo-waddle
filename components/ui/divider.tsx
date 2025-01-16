import React from 'react';
import { cn } from '@/lib/utils';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children?: React.ReactNode;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex items-center',
        orientation === 'horizontal' ? 'w-full' : 'h-full flex-col',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex-grow bg-gray-200 dark:bg-gray-700',
          orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full'
        )}
      />
      {children && (
        <div
          className={cn(
            'px-3 text-sm text-gray-500 dark:text-gray-400',
            orientation === 'vertical' && 'py-3'
          )}
        >
          {children}
        </div>
      )}
      {children && (
        <div
          className={cn(
            'flex-grow bg-gray-200 dark:bg-gray-700',
            orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full'
          )}
        />
      )}
    </div>
  );
};
