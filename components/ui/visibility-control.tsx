import { cn } from '@/lib/utils';

interface VisibilityControlProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

export function VisibilityControl({
  children,
  className,
  visible = true,
}: VisibilityControlProps) {
  return (
    <div
      className={cn('data-[visible=false]:hidden', className)}
      data-visible={visible}
    >
      {children}
    </div>
  );
}
