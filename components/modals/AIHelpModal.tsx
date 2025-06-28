
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface AIHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (query: string) => Promise<void>;
  isLoading: boolean;
  response: string;
  apiError?: string | null;
}

export const AIHelpModal: React.FC<AIHelpModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading, 
  response,
  apiError
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    if (!query.trim()) return;
    onSubmit(query);
  };

  const handleClose = () => {
    setQuery(''); // Reset query on close
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Assistant">
      <div className="space-y-3">
        <textarea
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
          placeholder="Ask a question about the app or how to do something..."
          disabled={isLoading}
        />
        <Button onClick={handleSubmit} disabled={isLoading || !query.trim()}>
          {isLoading ? <LoadingSpinner size="sm"/> : "Ask AI"}
        </Button>
        {apiError && <p className="text-sm text-red-400">{apiError}</p>}
        {response && !apiError && (
          <div className="mt-3 p-3 bg-gray-700/50 rounded-md max-h-60 overflow-y-auto">
            <h4 className="font-semibold text-sky-300 mb-1">AI Response:</h4>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap">{response}</pre>
          </div>
        )}
      </div>
       <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={handleClose}>Close</Button>
      </div>
    </Modal>
  );
};
