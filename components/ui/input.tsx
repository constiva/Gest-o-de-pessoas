import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('border rounded p-2 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', className)}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
