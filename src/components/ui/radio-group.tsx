"use client";

import * as React from "react";
import { Circle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Radio group built on native inputs inside a fieldset, so arrow-key roving
 * focus and grouping come from the platform (R-32) with no extra dependency.
 */
interface RadioGroupContextValue {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

export interface RadioGroupProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  (
    {
      className,
      name,
      value,
      defaultValue,
      onValueChange,
      disabled,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState(defaultValue);
    const isControlled = value !== undefined;
    const current = isControlled ? value : internal;

    const handleChange = React.useCallback(
      (next: string) => {
        if (!isControlled) setInternal(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const contextValue = React.useMemo(
      () => ({ name, value: current, onValueChange: handleChange, disabled }),
      [name, current, handleChange, disabled],
    );

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <fieldset
          ref={ref}
          className={cn("grid gap-2.5", className)}
          onChange={onChange}
          {...props}
        />
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, disabled, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    if (!context) {
      throw new Error("RadioGroupItem must be used within a RadioGroup");
    }
    const isDisabled = disabled ?? context.disabled;
    const checked = context.value === value;
    const inputId = id ?? `radio-${context.name}-${value}`;

    return (
      <span className={cn("relative inline-flex items-center", className)}>
        <input
          ref={ref}
          id={inputId}
          type="radio"
          name={context.name}
          value={value}
          checked={checked}
          disabled={isDisabled}
          onChange={() => context.onValueChange?.(value)}
          className="peer size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 checked:border-primary checked:bg-primary"
          {...props}
        />
        <Circle
          aria-hidden="true"
          className="pointer-events-none absolute left-[5px] size-1.5 fill-background text-background opacity-0 peer-checked:opacity-100"
        />
      </span>
    );
  },
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
