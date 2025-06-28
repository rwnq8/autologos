
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  color?: string; // e.g., 'border-sky-500', 'border-white'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text, 
  className = '',
  color = 'border-sky-500' // Default to sky blue
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2', // Made sm slightly smaller
    md: 'w-6 h-6 border-[3px]', // Made md slightly smaller
    lg: 'w-10 h-10 border-4',  // Made lg slightly smaller
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`${sizeClasses[size]} ${color} border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label={text || "Loading"}
      >
      </div>
      {text && <p className="mt-1.5 text-xs text-gray-400">{text}</p>}
    </div>
  );
};
