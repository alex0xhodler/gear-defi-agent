import { useState } from 'react';
import { type Token } from '../../config/tokens';

interface TokenIconProps {
  token: Token;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

// Fallback colors for tokens
const tokenColors: Record<string, string> = {
  ETH: '#627EEA',
  WETH: '#627EEA',
  USDC: '#2775CA',
  USDT: '#50AF95',
  wstETH: '#00A3FF',
  stETH: '#00A3FF',
};

export function TokenIcon({ token, size = 'md', className = '' }: TokenIconProps) {
  const [hasError, setHasError] = useState(false);
  const bgColor = tokenColors[token.symbol] || '#8b5cf6';

  if (hasError || !token.icon) {
    // Fallback to colored circle with symbol
    return (
      <div
        className={`
          ${sizeClasses[size]} ${className}
          rounded-full flex items-center justify-center
          text-white font-bold
        `}
        style={{ backgroundColor: bgColor }}
      >
        <span className={size === 'sm' ? 'text-[8px]' : size === 'md' ? 'text-xs' : 'text-sm'}>
          {token.symbol.slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={token.icon}
      alt={token.symbol}
      className={`${sizeClasses[size]} ${className} rounded-full`}
      onError={() => setHasError(true)}
    />
  );
}

interface TokenBadgeProps {
  token: Token;
  showSymbol?: boolean;
  showName?: boolean;
  className?: string;
}

export function TokenBadge({
  token,
  showSymbol = true,
  showName = false,
  className = '',
}: TokenBadgeProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TokenIcon token={token} size="sm" />
      {showSymbol && (
        <span className="font-medium text-text-primary">{token.symbol}</span>
      )}
      {showName && (
        <span className="text-text-secondary text-sm">{token.name}</span>
      )}
    </div>
  );
}
