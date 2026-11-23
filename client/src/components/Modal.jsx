import React from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export default function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} obsidian-card rounded-2xl p-6 animate-scale-in border border-white/15`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          <IconButton icon={X} onClick={onClose} title="Close" size={16} className="!p-2" />
        </div>
        {children}
      </div>
    </div>
  );
}
