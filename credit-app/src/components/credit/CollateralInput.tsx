import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Wallet } from 'lucide-react';
import { type Token, COLLATERAL_OPTIONS } from '../../config/tokens';
import { TokenIcon } from '../common/TokenIcon';
import { CurrencyDisplay } from '../common/NumberDisplay';

interface CollateralInputProps {
  token: Token;
  amount: string;
  onTokenChange: (token: Token) => void;
  onAmountChange: (amount: string) => void;
  balance?: string;
  usdValue?: number;
  disabled?: boolean;
}

export function CollateralInput({
  token,
  amount,
  onTokenChange,
  onAmountChange,
  balance = '0',
  usdValue = 0,
  disabled = false,
}: CollateralInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMaxClick = () => {
    onAmountChange(balance);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimals
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      onAmountChange(value);
    }
  };

  return (
    <div
      className={`
        glass-panel-sm p-4 transition-all duration-200
        ${isFocused ? 'ring-2 ring-accent/50' : ''}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-tertiary text-sm">Deposit</span>
        <button
          onClick={handleMaxClick}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <Wallet className="w-4 h-4" />
          <span>Bal: {parseFloat(balance).toFixed(4)}</span>
        </button>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-3">
        {/* Token selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <TokenIcon token={token} size="md" />
            <span className="font-semibold text-text-primary">{token.symbol}</span>
            <ChevronDown
              className={`w-4 h-4 text-text-tertiary transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-2 w-48 glass-panel-sm p-2 z-50"
              >
                {COLLATERAL_OPTIONS.map((option) => (
                  <button
                    key={option.symbol}
                    onClick={() => {
                      onTokenChange(option);
                      setIsDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg
                      transition-colors
                      ${option.symbol === token.symbol
                        ? 'bg-accent/20 text-accent'
                        : 'hover:bg-white/5 text-text-primary'
                      }
                    `}
                  >
                    <TokenIcon token={option} size="sm" />
                    <div className="text-left">
                      <div className="font-medium">{option.symbol}</div>
                      <div className="text-xs text-text-tertiary">{option.name}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Amount input */}
        <div className="flex-1 text-right">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full bg-transparent text-right text-3xl font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
            disabled={disabled}
          />
          <div className="text-sm text-text-tertiary mt-1">
            <CurrencyDisplay value={usdValue} decimals={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
