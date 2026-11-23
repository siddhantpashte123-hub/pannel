import React, { useState } from 'react';

export default function IconButton({
  icon: Icon,
  active = false,
  onClick,
  title,
  label,
  size = 18,
  className = '',
  disabled = false,
  variant = 'tile', // 'tile' | 'nav'
  type = 'button',
}) {
  const [clickedPulse, setClickedPulse] = useState(false);

  const handleClick = (e) => {
    if (disabled) return;
    setClickedPulse(true);
    setTimeout(() => setClickedPulse(false), 380);
    if (onClick) onClick(e);
  };

  const isWhite = active || clickedPulse;

  if (variant === 'nav') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={title || label}
        className={`group relative flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl transition-all duration-300 ease-out ${
          isWhite
            ? 'bg-white/[0.09] text-white border border-white/25 shadow-[0_0_24px_rgba(255,255,255,0.09)]'
            : 'text-zinc-500 border border-transparent hover:text-zinc-200 hover:bg-white/[0.03]'
        } ${clickedPulse ? 'animate-white-pop' : ''} ${className}`}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-white transition-all duration-300 ${
            active ? 'h-5 opacity-100 shadow-[0_0_10px_#fff]' : 'h-0 opacity-0'
          }`}
        />
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ${
            isWhite
              ? 'bg-white/15 text-white shadow-[0_0_16px_rgba(255,255,255,0.3)] scale-105'
              : 'bg-white/[0.03] text-zinc-500 group-hover:text-zinc-200 group-hover:bg-white/[0.06]'
          }`}
        >
          <Icon
            size={size}
            strokeWidth={isWhite ? 2.2 : 1.75}
            className={isWhite ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]' : ''}
          />
        </span>
        {label && (
          <span
            className={`text-sm font-medium tracking-tight transition-colors duration-300 ${
              isWhite ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
            }`}
          >
            {label}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      title={title || label}
      className={`icon-tile inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-40 disabled:pointer-events-none ${
        isWhite ? 'is-white-active' : ''
      } ${clickedPulse ? 'animate-white-pop' : ''} ${className}`}
    >
      <Icon size={size} strokeWidth={isWhite ? 2.2 : 1.75} />
      {label && (
        <span className={isWhite ? 'text-white' : 'text-zinc-400'}>{label}</span>
      )}
    </button>
  );
}
