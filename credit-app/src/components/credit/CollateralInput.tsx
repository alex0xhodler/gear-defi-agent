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
  minPositionLabel?: string;
  minPositionValue?: string;
}

export function CollateralInput({
  token,
  amount,
  onTokenChange,
  onAmountChange,
  balance = '0',
  usdValue = 0,
  disabled = false,
  minPositionLabel,
  minPositionValue,
}: CollateralInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      onAmountChange(value);
    }
  };

  return (
    <motion.div
      className={`
        glass-inner p-5 transition-all duration-300 relative
        ${isFocused ? 'ring-2 ring-accent/30 border-accent/30' : ''}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
      animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Subtle glow when focused */}
      {isFocused && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-accent/5 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-label-gold">Deposit</span>
        <div className="flex items-center gap-4">
          {minPositionLabel && (
            <motion.button
              onClick={() => {
                if (minPositionValue) {
                  onAmountChange(minPositionValue);
                  inputRef.current?.focus();
                }
              }}
              className="text-[11px] font-medium text-text-muted hover:text-accent transition-colors duration-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {minPositionLabel}
            </motion.button>
          )}
          <motion.button
            onClick={handleMaxClick}
            className="flex items-center gap-2 text-text-secondary hover:text-accent transition-colors duration-200 group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Wallet className="w-4 h-4 group-hover:text-accent transition-colors" />
            <span className="text-[11px] font-semibold tabular-nums">{parseFloat(balance).toFixed(4)}</span>
          </motion.button>
        </div>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-4">
        {/* Token selector */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-bg-surface/60 hover:bg-bg-surface border border-glass-border hover:border-glass-border-light transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <TokenIcon token={token} size="md" />
            <span className="font-semibold text-text-primary">{token.symbol}</span>
            <motion.div
              animate={{ rotate: isDropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            </motion.div>
          </motion.button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="absolute top-full left-0 mt-2 w-52 glass-panel-sm p-2 z-50 shadow-xl"
              >
                {COLLATERAL_OPTIONS.map((option, index) => (
                  <motion.button
                    key={option.symbol}
                    onClick={() => {
                      onTokenChange(option);
                      setIsDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                      transition-all duration-200
                      ${option.symbol === token.symbol
                        ? 'bg-accent/15 text-accent border border-accent/20'
                        : 'hover:bg-bg-surface/60 text-text-primary border border-transparent'
                      }
                    `}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <TokenIcon token={option} size="sm" />
                    <div className="text-left">
                      <div className="font-medium">{option.symbol}</div>
                      <div className="text-xs text-text-tertiary">{option.name}</div>
                    </div>
                    {option.symbol === token.symbol && (
                      <motion.div
                        className="ml-auto w-2 h-2 rounded-full bg-accent"
                        layoutId="selectedToken"
                      />
                    )}
                  </motion.button>
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
            className="w-full bg-transparent text-right text-input text-text-primary placeholder:text-text-muted focus:outline-none tabular-nums"
            disabled={disabled}
          />
          <motion.div
            className="text-sm text-text-tertiary mt-1.5 font-medium tabular-nums"
            key={usdValue}
            initial={{ opacity: 0.5, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <CurrencyDisplay value={usdValue} decimals={2} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
