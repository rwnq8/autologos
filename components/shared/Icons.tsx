
// components/shared/Icons.tsx
import React from 'react';

export const XCircleIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// If this file is not imported anywhere and serves no purpose, 
// an alternative minimal content to make it a module is:
// export {};
// For now, keeping the placeholder and adding the new icon.

const SharedIconsPlaceholder: React.FC = () => {
  return null; 
};

export default SharedIconsPlaceholder;