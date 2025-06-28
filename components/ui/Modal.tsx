

import React, { Fragment } from 'react'; // React and Fragment are default imports
import { XCircleIcon } from '../icons'; // XCircleIcon is a named import

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 text-gray-100 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-700"
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-sky-400">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <XCircleIcon className="w-7 h-7" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-end space-x-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};