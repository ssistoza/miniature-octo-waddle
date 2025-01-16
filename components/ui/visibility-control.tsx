interface VisibilityControlProps {
  children: React.ReactNode;
  visible?: boolean;
}

export function VisibilityControl({
  children,
  visible = true,
}: VisibilityControlProps) {
  return (
    <div className='data-[visible=false]:hidden' data-visible={visible}>
      {children}
    </div>
  );
}
