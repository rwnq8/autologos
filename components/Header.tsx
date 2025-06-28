import React from 'react';
import { LightBulbIcon } from './icons'; // Assuming LightBulbIcon represents the app well

interface HeaderProps {
  // Props for theme toggling can be added later if user override is implemented
  // onToggleTheme: () => void;
  // currentTheme: 'light' | 'dark';
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="bg-gray-800 shadow-md p-4 sticky top-0 z-40 border-b border-gray-700">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <LightBulbIcon className="w-8 h-8 text-sky-400" />
          <h1 className="text-2xl font-semibold text-sky-400">Critical Analysis Toolkit</h1>
        </div>
        {/* Theme toggle button can be added here if needed */}
        {/* 
        <button 
          onClick={onToggleTheme} 
          className="p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label={currentTheme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
        >
          {currentTheme === 'dark' ? <SunIcon className="w-5 h-5 text-yellow-400" /> : <MoonIcon className="w-5 h-5 text-gray-300" />}
        </button> 
        */}
      </div>
    </header>
  );
};