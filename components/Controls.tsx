
import React, { useRef, useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import type { LoadedFile, ProcessingMode, SettingsSuggestionSource, ParameterAdvice } from '../types';
import InfoIcon from './InfoIcon'; 

interface ControlsProps {
  initialPromptFromApp: string;
  onInitialPromptChange: (value: string) => void;
  maxIterations: number;
  onMaxIterationsChange: (value: number) => void;
  isProcessing: boolean;
  onStart: () => void;
  onReset: () => void;
  apiKeyAvailable: boolean;
  finalProduct: string | null;
  loadedFilesFromApp: LoadedFile[];
  onLoadedFilesChange: (files: LoadedFile[]) => void;
  processingMode: ProcessingMode;
  onProcessingModeChange: (mode: ProcessingMode) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
  topK: number;
  onTopKChange: (value: number) => void;
  settingsSuggestionSource: SettingsSuggestionSource;
  modelConfigWarnings: string[];
  modelConfigRationales: string[]; // New
  modelParameterAdvice: ParameterAdvice; // New
  startProcessButtonText: string; 
}

const PlayIcon: React.FC<{className?: string}> = ({className}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5 mr-2"}>
    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
  </svg>
);

const ResetIcon: React.FC<{className?: string}> = ({className}) => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5 mr-2"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const FileUploadIcon: React.FC<{className?: string}> = ({className}) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5 mr-2"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 5.75 5.75 0 0 1 4.912 5.818C20.978 19.128 20.07 20 18.75 20H6.75Z" />
  </svg>
);

const WarningIcon: React.FC<{className?: string}> = ({className = "w-4 h-4 mr-1 inline-block"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
);

const LightbulbIcon: React.FC<{className?: string}> = ({className = "w-4 h-4 mr-1 inline-block"}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M10 2a.75.75 0 01.75.75v1.25a.75.75 0 01-1.5 0V2.75A.75.75 0 0110 2zM8.75 15.25a.75.75 0 01.75-.75h1a.75.75 0 010 1.5h-1a.75.75 0 01-.75-.75zM10 4.75a2.25 2.25 0 00-2.25 2.25c0 1.043.68 1.937 1.627 2.223V12.5a.75.75 0 001.5 0V9.223A2.24 2.24 0 0012.25 7 2.25 2.25 0 0010 4.75zM12.913 2.613a.75.75 0 01.624 1.159 7.499 7.499 0 00-5.074 8.765.75.75 0 01-1.4.527A8.999 8.999 0 0112.913 2.613zM4.142 5.32c.31-.392.21-.97-.22-1.28A8.999 8.999 0 0110 2.003V.75a.75.75 0 00-1.5 0v1.253a7.499 7.499 0 00-4.138 2.087.75.75 0 00.78 1.227z" />
    <path fillRule="evenodd" d="M5.21 16.28a.75.75 0 011.06 0l.72.72a.75.75 0 010 1.06l-.72.72a.75.75 0 01-1.06 0l-.72-.72a.75.75 0 010-1.06l.72-.72zM12.94 17.34a.75.75 0 10-1.06-1.06l-.72.72a.75.75 0 101.06 1.06l.72-.72zm2.819-2.18a.75.75 0 000-1.06l-.72-.72a.75.75 0 00-1.06 0l-.72.72a.75.75 0 101.06 1.06l.72-.72z" clipRule="evenodd" />
  </svg>
);


const Controls: React.FC<ControlsProps> = ({
  initialPromptFromApp,
  onInitialPromptChange,
  maxIterations,
  onMaxIterationsChange,
  isProcessing,
  onStart,
  onReset,
  apiKeyAvailable,
  finalProduct,
  loadedFilesFromApp,
  onLoadedFilesChange,
  processingMode,
  onProcessingModeChange,
  temperature,
  onTemperatureChange,
  topP,
  onTopPChange,
  topK,
  onTopKChange,
  settingsSuggestionSource,
  modelConfigWarnings,
  modelConfigRationales, // New
  modelParameterAdvice,  // New
  startProcessButtonText,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModelConfigInfo, setShowModelConfigInfo] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFilePromises = Array.from(files).map(file => {
        return new Promise<LoadedFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({ name: file.name, content: e.target?.result as string });
          };
          reader.onerror = (e) => {
            console.error("Failed to read file:", file.name, e);
            reject(new Error(`Failed to read file: ${file.name}`));
          };
          reader.readAsText(file);
        });
      });

      try {
        const newFilesContent = await Promise.all(newFilePromises);
        onLoadedFilesChange([...loadedFilesFromApp, ...newFilesContent]);
      } catch (error) {
        console.error("Error processing files:", error);
      }
    }
    if(event.target) event.target.value = ''; 
  };
  
  const getLoadedFileNamesDisplay = () => {
    if (loadedFilesFromApp.length === 0) return null;
    const MAX_DISPLAY_FILENAMES = 3;
    const names = loadedFilesFromApp.map(f => f.name);
    if (names.length > MAX_DISPLAY_FILENAMES) {
      return `Loaded: ${names.slice(0, MAX_DISPLAY_FILENAMES).join(', ')}, +${names.length - MAX_DISPLAY_FILENAMES} more`;
    }
    return `Loaded: ${names.join(', ')}`;
  }

  const modelConfigTooltipText = `Control the AI's behavior:
- Temperature: Higher (e.g., 0.9) for creative/diverse, lower (e.g., 0.2) for focused output. Range: 0.0-2.0.
- Top-P: Filters by cumulative probability (nucleus sampling). Range: 0.0-1.0.
- Top-K: Filters to K most likely tokens. Range: 1-100.`;

  const getSettingsNoteAndRationales = () => {
    let noteText = "";
    switch (settingsSuggestionSource) {
      case 'mode':
        noteText = "Values are defaults for the current mode. Adjust as needed.";
        break;
      case 'input':
        noteText = "Values suggested based on input. Feel free to override.";
        break;
      case 'manual':
        noteText = "Values manually set. Auto-suggestions paused until next mode/prompt change, file load, or reset.";
        break;
      default:
        noteText = "Adjust model parameters as needed.";
    }

    return (
      <>
        <p className="text-xs text-slate-400 -mt-1 mb-3">
          {noteText}
        </p>
        {(settingsSuggestionSource === 'input' || (settingsSuggestionSource === 'mode' && modelConfigRationales.length > 0)) && modelConfigRationales.length > 0 && (
          <div className="mb-3 p-3 bg-sky-900 bg-opacity-30 border border-sky-700 rounded-md space-y-1">
            <p className="text-xs font-semibold text-sky-300 flex items-center"><LightbulbIcon className="w-4 h-4 mr-1.5 flex-shrink-0" /> AI Rationale for Suggestions:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {modelConfigRationales.map((rationale, index) => (
                <li key={index} className="text-xs text-sky-400">{rationale}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl space-y-6">
      <div>
        <label htmlFor="initialPrompt" className="block text-sm font-medium text-sky-300 mb-1">
          Input Data / Prompt
        </label>
        <textarea
          id="initialPrompt"
          value={initialPromptFromApp} 
          onChange={(e) => onInitialPromptChange(e.target.value)} 
          rows={loadedFilesFromApp.length > 0 ? 8 : 4}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-slate-100"
          placeholder="Describe the initial concept, or load from file(s)..."
          disabled={isProcessing}
          aria-label="Input Data or Prompt"
        />
        {getLoadedFileNamesDisplay() && (
          <p className="text-xs text-sky-400 mt-1">{getLoadedFileNamesDisplay()}</p>
        )}
      </div>
      
      <div>
         <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".txt,.md,.json,.csv,.xml,.html,.js,.py,.java,.c,.cpp,.h,.hpp,.cs,.rb,.php,.swift,.kt,.go,.rs,.ts,.css,.scss,.less,.sh,.bat" 
          disabled={isProcessing}
          multiple
          aria-hidden="true" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-50 transition-colors"
          aria-label="Load input data from file(s)"
        >
          <FileUploadIcon />
          Load Input from File(s)
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-sky-300 mb-2">Processing Mode</label>
        <fieldset className="space-y-2 sm:space-y-0 sm:flex sm:space-x-4" role="radiogroup" aria-labelledby="processing-mode-label">
          <legend id="processing-mode-label" className="sr-only">Processing Mode</legend>
          <div className="flex items-center">
            <input
              id="mode-expansive"
              name="processingMode"
              type="radio"
              value="expansive"
              checked={processingMode === 'expansive'}
              onChange={() => onProcessingModeChange('expansive')}
              disabled={isProcessing}
              className="h-4 w-4 text-sky-600 border-slate-500 focus:ring-sky-500 bg-slate-700"
            />
            <label htmlFor="mode-expansive" className="ml-2 block text-sm text-slate-200">
              Expansive <span className="text-slate-400 text-xs">(Grow & Elaborate)</span>
            </label>
          </div>
          <div className="flex items-center">
            <input
              id="mode-convergent"
              name="processingMode"
              type="radio"
              value="convergent"
              checked={processingMode === 'convergent'}
              onChange={() => onProcessingModeChange('convergent')}
              disabled={isProcessing}
              className="h-4 w-4 text-sky-600 border-slate-500 focus:ring-sky-500 bg-slate-700"
            />
            <label htmlFor="mode-convergent" className="ml-2 block text-sm text-slate-200">
              Convergent <span className="text-slate-400 text-xs">(Distill & Simplify)</span>
            </label>
          </div>
        </fieldset>
      </div>
      
      <div className="space-y-4 pt-4 border-t border-slate-700">
        <div className="flex items-center mb-1 relative">
            <h3 className="text-md font-semibold text-sky-300 mr-2">Model Configuration</h3>
            <div 
              className="relative"
              onMouseEnter={() => setShowModelConfigInfo(true)}
              onMouseLeave={() => setShowModelConfigInfo(false)}
              onFocus={() => setShowModelConfigInfo(true)}
              onBlur={() => setShowModelConfigInfo(false)}
              tabIndex={0}
              aria-describedby="model-config-tooltip"
            >
              <InfoIcon className="w-4 h-4 text-sky-400 cursor-pointer" />
              {showModelConfigInfo && (
                <div
                  id="model-config-tooltip"
                  role="tooltip" 
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 bg-slate-600 text-slate-200 text-xs p-3 rounded-md shadow-lg z-20 border border-slate-500"
                >
                  {modelConfigTooltipText.split('\n').map((line, i) => <p key={i} className={line.startsWith('-') ? 'ml-2' : ''}>{line}</p>)}
                </div>
              )}
            </div>
        </div>
        
        {getSettingsNoteAndRationales()}

        {modelConfigWarnings.length > 0 && (
            <div className="p-3 bg-amber-900 bg-opacity-30 border border-amber-700 rounded-md mb-3 space-y-1">
                {modelConfigWarnings.map((warning, index) => (
                    <p key={index} className="text-xs text-amber-300 flex items-start">
                        <WarningIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-px" />
                        <span>{warning}</span>
                    </p>
                ))}
            </div>
        )}

        <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-sky-400 mb-1">
            Temperature: <span className="text-white font-mono">{temperature.toFixed(2)}</span>
            </label>
            <input
            type="range"
            id="temperature"
            min="0"
            max="2"
            step="0.01" 
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            disabled={isProcessing}
            aria-label="Temperature setting"
            />
            {modelParameterAdvice.temperature && <p className="text-xs text-sky-200 mt-1">{modelParameterAdvice.temperature}</p>}
        </div>
        <div>
            <label htmlFor="topP" className="block text-sm font-medium text-sky-400 mb-1">
            Top-P: <span className="text-white font-mono">{topP.toFixed(2)}</span>
            </label>
            <input
            type="range"
            id="topP"
            min="0"
            max="1"
            step="0.01"
            value={topP}
            onChange={(e) => onTopPChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            disabled={isProcessing}
            aria-label="Top-P setting"
            />
            {modelParameterAdvice.topP && <p className="text-xs text-sky-200 mt-1">{modelParameterAdvice.topP}</p>}
        </div>
        <div>
            <label htmlFor="topK" className="block text-sm font-medium text-sky-400 mb-1">
            Top-K: <span className="text-white font-mono">{topK}</span>
            </label>
            <input
            type="range"
            id="topK"
            min="1"
            max="100" 
            step="1"
            value={topK}
            onChange={(e) => onTopKChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            disabled={isProcessing}
            aria-label="Top-K setting"
            />
            {modelParameterAdvice.topK && <p className="text-xs text-sky-200 mt-1">{modelParameterAdvice.topK}</p>}
        </div>
      </div>


      <div>
        <label htmlFor="maxIterations" className="block text-sm font-medium text-sky-300 mb-1">
          Max Iterations
        </label>
        <input
          type="number"
          id="maxIterations"
          value={maxIterations}
          onChange={(e) => onMaxIterationsChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
          min="1"
          max="100"
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100"
          disabled={isProcessing}
          aria-label="Maximum number of iterations"
        />
      </div>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <button
          onClick={onStart}
          disabled={isProcessing || !apiKeyAvailable || !initialPromptFromApp.trim()}
          className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
          aria-label={startProcessButtonText}
        >
          {isProcessing ? (
            <>
              <LoadingSpinner size="sm" color="text-white"/>
              <span className="ml-2">Processing...</span>
            </>
          ) : (
            <>
              <PlayIcon />
              {startProcessButtonText}
            </>
          )}
        </button>
        <button
          onClick={onReset} 
          disabled={isProcessing && finalProduct === null} 
          className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-slate-500 text-base font-medium rounded-md shadow-sm text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Reset all inputs, results, and model settings to defaults for the current mode"
        >
          <ResetIcon />
          Reset
        </button>
      </div>
      {!apiKeyAvailable && (
        <p className="text-xs text-amber-400 text-center mt-2">
          Warning: API_KEY is not configured. The AI process cannot start.
        </p>
      )}
    </div>
  );
};

export default Controls;
