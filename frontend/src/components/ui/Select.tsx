import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
}

export function Select({
  label,
  error,
  placeholder = 'Select...',
  value,
  onValueChange,
  options,
  disabled,
  className,
}: SelectProps) {
  return (
    <div className={`${styles.field} ${error ? styles.error : ''} ${className ?? ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <RadixSelect.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <RadixSelect.Trigger className={styles.trigger} aria-label={label}>
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className={styles.triggerIcon}>
            <ChevronDown size={16} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content className={styles.content} position="popper" sideOffset={4}>
            <RadixSelect.Viewport>
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className={styles.item}
                >
                  <RadixSelect.ItemText>
                    {option.label}
                  </RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className={styles.itemIndicator}>
                    <Check size={14} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}
