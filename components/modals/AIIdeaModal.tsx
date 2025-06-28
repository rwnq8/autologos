
import React, { useState, useRef, ChangeEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface AIIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (idea: string, file: File | null, guidance: string) => Promise<void>;
  isLoading: boolean;
  apiError: string | null;
}

export const AIIdeaModal: React.FC<AIIdeaModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading, 
  apiError 
}) => {
  const [ideaInput, setIdeaInput] = useState('');
  const [ideaFile, setIdeaFile] = useState<File | null>(null);
  const [guidanceComments, setGuidanceComments] = useState('');
  const ideaFileInputRef = useRef<HTMLInputElement>(null);
  const [internalError, setInternalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setInternalError(null);
    if (!ideaInput.trim() && !ideaFile) {
      setInternalError("Please provide a project idea or upload a file.");
      return;
    }
    await onSubmit(ideaInput, ideaFile, guidanceComments);
    // Only close if submission was successful (isLoading is false and no apiError)
    // App.tsx's handleAIIdeaSubmit will manage closing or keeping open based on outcome.
    if (!isLoading && !apiError) {
        // Reset internal state for next time modal opens
        setIdeaInput('');
        setIdeaFile(null);
        setGuidanceComments('');
        if(ideaFileInputRef.current) ideaFileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setIdeaInput('');
    setIdeaFile(null);
    setGuidanceComments('');
    setInternalError(null);
    if(ideaFileInputRef.current) ideaFileInputRef.current.value = "";
    onClose();
  }

  const currentError = apiError || internalError;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI New Project Assistant">
        <div className="space-y-4">
            <div>
                <label htmlFor="aiIdeaInput" className="block text-sm font-medium text-gray-300">Describe your project idea or topic</label>
                <textarea
                    id="aiIdeaInput"
                    rows={3}
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                    placeholder="e.g., A marketing campaign for a new product, A research paper on AI ethics..."
                    disabled={isLoading}
                />
            </div>
            <div>
                <label htmlFor="aiIdeaFile" className="block text-sm font-medium text-gray-300 mb-1">Or Upload a Document (Optional: .txt, .md)</label>
                <input 
                    type="file" 
                    id="aiIdeaFile"
                    ref={ideaFileInputRef}
                    accept=".txt,.md"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setIdeaFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700"
                    disabled={isLoading}
                />
                {ideaFile && <p className="text-xs text-gray-400 mt-1">Selected: {ideaFile.name}</p>}
            </div>
            <div>
                <label htmlFor="aiIdeaGuidance" className="block text-sm font-medium text-gray-300">Additional Guidance/Comments for AI (Optional)</label>
                <textarea
                    id="aiIdeaGuidance"
                    rows={2}
                    value={guidanceComments}
                    onChange={(e) => setGuidanceComments(e.target.value)}
                    className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                    placeholder="e.g., Focus on creating 3 main tasks, Ensure a task for final review is included..."
                    disabled={isLoading}
                />
            </div>
            {currentError && <p className="text-sm text-red-400">{currentError}</p>}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" onClick={handleClose} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isLoading || (!ideaInput.trim() && !ideaFile)}>
                {isLoading ? <LoadingSpinner size="sm" /> : "Generate Project Structure"}
            </Button>
        </div>
    </Modal>
  );
};
