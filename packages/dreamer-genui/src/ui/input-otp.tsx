'use client';

import { createContext, forwardRef, useContext, useId, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cx } from './lib';

interface OtpContextValue {
  id: string;
  maxLength: number;
  value: string;
  setChar: (index: number, char: string) => void;
  focusIndex: (index: number) => void;
  register: (index: number, el: HTMLInputElement | null) => void;
}

const OtpContext = createContext<OtpContextValue | null>(null);

function useOtp(component: string): OtpContextValue {
  const ctx = useContext(OtpContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <InputOTP>`);
  return ctx;
}

export interface InputOTPProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  maxLength: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Accessible group label. */
  label?: string;
}

/** One-time-code entry (§7.16 host-only kit). */
export const InputOTP = forwardRef<HTMLDivElement, InputOTPProps>(function InputOTP(
  { maxLength, value, defaultValue = '', onChange, label = 'One-time code', className, children, ...props },
  ref,
) {
  const id = useId();
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const setChar = (index: number, char: string) => {
    const next = current.split('');
    next[index] = char;
    const joined = next.join('').slice(0, maxLength);
    if (value === undefined) setInternal(joined);
    onChange?.(joined);
  };

  const focusIndex = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), maxLength - 1);
    inputs.current[clamped]?.focus();
  };

  return (
    <OtpContext.Provider
      value={{
        id,
        maxLength,
        value: current,
        setChar,
        focusIndex,
        register: (index, el) => {
          inputs.current[index] = el;
        },
      }}
    >
      <div ref={ref} role="group" aria-label={label} className={cx('dg-ui-input-otp', className)} {...props}>
        {children}
      </div>
    </OtpContext.Provider>
  );
});

export const InputOTPGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(function InputOTPGroup(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx('dg-ui-input-otp-group', className)} {...props} />;
});

export interface InputOTPSlotProps extends Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange'> {
  index: number;
}

export const InputOTPSlot = forwardRef<HTMLInputElement, InputOTPSlotProps>(function InputOTPSlot(
  { index, className, onKeyDown, onPaste, ...props },
  ref,
) {
  const otp = useOtp('InputOTPSlot');
  const char = otp.value[index] ?? '';
  return (
    <input
      ref={(el) => {
        otp.register(index, el);
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      inputMode="text"
      autoComplete="one-time-code"
      aria-label={`Digit ${index + 1}`}
      maxLength={1}
      value={char}
      className={cx('dg-ui-input-otp-slot', char ? 'dg-ui-input-otp-slot-filled' : undefined, className)}
      onChange={(event) => {
        const next = event.target.value.replace(/\s/g, '').slice(-1);
        otp.setChar(index, next);
        if (next) otp.focusIndex(index + 1);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Backspace' && !char) otp.focusIndex(index - 1);
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          otp.focusIndex(index - 1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          otp.focusIndex(index + 1);
        }
      }}
      onPaste={(event) => {
        onPaste?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        const pasted = event.clipboardData.getData('text').replace(/\s/g, '').slice(0, otp.maxLength - index);
        for (let i = 0; i < pasted.length; i++) otp.setChar(index + i, pasted[i]!);
        otp.focusIndex(index + pasted.length);
      }}
      {...props}
    />
  );
});

export const InputOTPSeparator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function InputOTPSeparator({ className, children, ...props }, ref) {
    return (
      <div ref={ref} role="presentation" aria-hidden="true" className={cx('dg-ui-input-otp-separator', className)} {...props}>
        {children ?? '–'}
      </div>
    );
  },
);

export function InputOTPWithSeparator({ slots = 6 }: { slots?: number }): ReactNode {
  return (
    <InputOTP maxLength={slots}>
      <InputOTPGroup>
        {Array.from({ length: slots }, (_, i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

export type InputOTPRef = ElementRef<'input'>;
