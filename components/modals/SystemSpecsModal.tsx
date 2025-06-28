
import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface SystemSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const SystemSpecsModal: React.FC<SystemSpecsModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  content 
}) => {
  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
    >
      <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-[70vh] overflow-y-auto bg-gray-900 p-3 rounded-md">
          {content}
      </pre>
      <div className="mt-4 text-right">
          <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
};
