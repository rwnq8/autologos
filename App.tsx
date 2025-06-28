
import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import {
  AnalysisType,
  AnalysisResult,
  AnalysisResultsState,
  ALL_ANALYSIS_TYPES,
  initializeAnalysisResults,
} from './types';
import { runAnalysisStream } from './services/geminiService';
import { PROMPT_TEMPLATES, INPUT_PLACEHOLDER, SUPPORTED_FILE_TYPES, ANALYSIS_TYPE_DESCRIPTIONS, GEMINI_MODEL_NAME } from './constants';
import { AnalysisCard } from './components/AnalysisCard';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Button } from './components/ui/Button';
import { LoadingSpinner } from './components/LoadingSpinner'; // Updated import
import { ChevronDownIcon, UploadIcon, SaveIcon, PlayIcon, TrashIcon } from './components/icons';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const DISPLAYABLE_ANALYSIS_TYPES = ALL_ANALYSIS_TYPES.filter(
  type => type !== AnalysisType.FULL_REPORT_EXPORT
);

const App: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('');
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResultsState>(initializeAnalysisResults());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState<boolean>(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false); // General loading for "Run Selected"
  const [activeAnalysesCount, setActiveAnalysesCount] = useState<number>(0);
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  const [selectedAnalysisTypes, setSelectedAnalysisTypes] = useState<AnalysisType[]>(
    () => DISPLAYABLE_ANALYSIS_TYPES // All displayable types selected by default
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check API Key status (conceptual - actual check happens in geminiService)
    // process.env.API_KEY is accessed within geminiService.ts
    // We can simulate a check or rely on the service's error reporting.
    // For UI purposes, let's assume it's initially checking, then becomes valid/invalid based on first API call.
    // This is a simplified check. A more robust solution might involve a dedicated health check endpoint or mechanism.
    if (process.env.API_KEY) {
        setApiKeyStatus('valid'); // Assume valid if present, geminiService will handle actual errors
    } else {
        setApiKeyStatus('invalid');
        setGlobalError("Error: API_KEY environment variable is not set. Please configure it to use the AI features.");
    }
  }, []);

  const handleUserInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(event.target.value);
    setOriginalFileName(null); // Reset file name if user types
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (SUPPORTED_FILE_TYPES.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setUserInput(text);
          setOriginalFileName(file.name);
          setGlobalError(null);
        };
        reader.onerror = () => {
          setGlobalError(`Error reading file: ${file.name}`);
          setOriginalFileName(null);
        };
        reader.readAsText(file);
      } else {
        setGlobalError(`Unsupported file type: ${file.type || file.name.split('.').pop()}. Please upload a .txt or .md file.`);
        setOriginalFileName(null);
      }
    }
    // Reset file input to allow uploading the same file again
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleRunSingleAnalysis = useCallback(async (analysisType: AnalysisType) => {
    if (!userInput.trim()) {
      setAnalysisResults(prev => ({
        ...prev,
        [analysisType]: {
          ...prev[analysisType],
          error: 'User input is empty.',
          isLoading: false,
          isStreaming: false,
        }
      }));
      return;
    }
     if (apiKeyStatus === 'invalid') {
      setAnalysisResults(prev => ({
        ...prev,
        [analysisType]: {
          ...prev[analysisType],
          error: 'API Key is not configured or invalid. Cannot run analysis.',
          isLoading: false,
          isStreaming: false,
        }
      }));
      return;
    }

    setAnalysisResults(prev => ({
      ...prev,
      [analysisType]: {
        type: analysisType,
        isLoading: true,
        isStreaming: false,
        content: '',
        error: null,
        originalFileName: prev[analysisType]?.originalFileName || originalFileName,
      }
    }));
    setActiveAnalysesCount(prev => prev + 1);

    const promptTemplate = PROMPT_TEMPLATES[analysisType];
    const fullPrompt = promptTemplate.replace(INPUT_PLACEHOLDER, userInput);

    let accumulatedContent = '';
    try {
      await runAnalysisStream(
        fullPrompt,
        (chunk) => {
          accumulatedContent += chunk;
          setAnalysisResults(prev => ({
            ...prev,
            [analysisType]: {
              ...prev[analysisType],
              content: accumulatedContent,
              isLoading: true, // Still loading until onComplete
              isStreaming: true,
              error: null,
            }
          }));
        },
        (errorMsg) => {
          setAnalysisResults(prev => ({
            ...prev,
            [analysisType]: {
              ...prev[analysisType],
              error: errorMsg,
              isLoading: false,
              isStreaming: false,
            }
          }));
          // If API key becomes invalid after a call
          if (errorMsg.toLowerCase().includes("api key") || errorMsg.toLowerCase().includes("permission denied")) {
            setApiKeyStatus('invalid');
            setGlobalError("Critical API Error: API Key is invalid or permissions are insufficient. Please check your API key.");
          }
        },
        () => { // onComplete
          setAnalysisResults(prev => ({
            ...prev,
            [analysisType]: {
              ...prev[analysisType],
              isLoading: false,
              isStreaming: false,
            }
          }));
          setActiveAnalysesCount(prev => Math.max(0, prev - 1));
           if (apiKeyStatus === 'checking') setApiKeyStatus('valid'); // First successful call
        }
      );
    } catch (error: any) {
      setAnalysisResults(prev => ({
        ...prev,
        [analysisType]: {
          ...prev[analysisType],
          error: error.message || 'An unexpected error occurred during analysis.',
          isLoading: false,
          isStreaming: false,
        }
      }));
      setActiveAnalysesCount(prev => Math.max(0, prev - 1));
      if (apiKeyStatus === 'checking') setApiKeyStatus('invalid');
    }
  }, [userInput, originalFileName, apiKeyStatus]);

  const handleRunSelectedAnalyses = useCallback(async () => {
    if (!userInput.trim()) {
      setGlobalError('User input is empty. Cannot run analyses.');
      return;
    }
    if (selectedAnalysisTypes.length === 0) {
      setGlobalError('No analysis types selected.');
      return;
    }
     if (apiKeyStatus === 'invalid') {
      setGlobalError('API Key is not configured or invalid. Cannot run analyses.');
      return;
    }

    setGlobalError(null);
    setIsLoading(true); // General loading state for the "Run Selected" button

    // Reset only selected analysis results before running
    setAnalysisResults(prev => {
        const newState = { ...prev };
        selectedAnalysisTypes.forEach(type => {
            newState[type] = {
                ...initializeAnalysisResults()[type], // Get a fresh initial state for this type
                originalFileName: originalFileName,
            };
        });
        return newState;
    });


    // Sequentially run analyses to avoid overwhelming the browser or hitting API rate limits too quickly.
    // For parallel execution, Promise.all could be used, but careful state management for activeAnalysesCount would be needed.
    for (const type of selectedAnalysisTypes) {
        await handleRunSingleAnalysis(type);
    }

    setIsLoading(false);
  }, [userInput, selectedAnalysisTypes, handleRunSingleAnalysis, originalFileName, apiKeyStatus]);

  const handleClearAll = () => {
    setUserInput('');
    setOriginalFileName(null);
    setAnalysisResults(initializeAnalysisResults());
    setGlobalError(null);
    setActiveAnalysesCount(0);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the file input
    }
  };

  const handleCopyToClipboard = (content: string, type: AnalysisType) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        // Optionally, show a success message
        console.log(`${type} content copied to clipboard.`);
      })
      .catch(err => {
        console.error(`Failed to copy ${type} content: `, err);
        setGlobalError(`Failed to copy to clipboard. Your browser might not support this feature or permissions might be denied.`);
      });
  };

  const handleSaveAsMarkdown = (type: AnalysisType, content: string, currentOriginalFileName?: string | null) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    const baseFileName = currentOriginalFileName ? currentOriginalFileName.substring(0, currentOriginalFileName.lastIndexOf('.')) || currentOriginalFileName : 'analysis';
    const analysisTypeName = type.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1); // e.g. structural-critique
    link.download = `${baseFileName}-${analysisTypeName}.md`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleSaveFullReport = () => {
    let fullReport = `# Critical Analysis Report\n\n`;
    if (originalFileName) {
      fullReport += `Original Document: ${originalFileName}\n\n`;
    }
    fullReport += `Date: ${new Date().toISOString()}\n\n`;
    fullReport += `## Input Text\n\n\`\`\`\n${userInput}\n\`\`\`\n\n`;

    DISPLAYABLE_ANALYSIS_TYPES.forEach(type => {
      const result = analysisResults[type];
      if (result && result.content && !result.error) {
        const formattedTypeName = type.replace(/([A-Z])/g, ' $1').trim();
        fullReport += `## ${formattedTypeName}\n\n${result.content}\n\n`;
      }
    });

    handleSaveAsMarkdown(AnalysisType.FULL_REPORT_EXPORT, fullReport, originalFileName || "full-report");
  };

  const handleToggleAnalysisSelection = (type: AnalysisType) => {
    setSelectedAnalysisTypes(prevSelected =>
      prevSelected.includes(type)
        ? prevSelected.filter(t => t !== type)
        : [...prevSelected, type]
    );
  };

  const handleSelectAllAnalyses = () => {
    setSelectedAnalysisTypes(DISPLAYABLE_ANALYSIS_TYPES);
  };

  const handleDeselectAllAnalyses = () => {
    setSelectedAnalysisTypes([]);
  };
  
  const instructionsContent = `
### Welcome to the Critical Analysis Toolkit!

Powered by Google's Gemini API (${GEMINI_MODEL_NAME}), this tool helps you dissect and evaluate text from various critical perspectives.

**How to Use:**
1.  **Input Text:** Paste your text into the textarea below or upload a \`.txt\` or \`.md\` file.
2.  **Select Analyses:** Choose one or more analysis types you want to perform. By default, all are selected.
    *   **Structural Critique:** Examines logical flow, consistency, and structural soundness.
    *   **Risk Assessment & Failure Modes:** Identifies potential vulnerabilities and worst-case scenarios.
    *   **Assumption Challenge:** Questions underlying premises and beliefs.
    *   **Gap & Omission Analysis:** Uncovers missing information or overlooked perspectives.
    *   **Alternative Strategies:** Proposes different approaches to the core problem/goal.
    *   **Rhetorical & Fallacy Critique:** Dissects arguments for logical fallacies and manipulative rhetoric.
3.  **Run Analysis:** Click "Run Selected Analyses". The AI will generate critiques for each selected type.
4.  **Review Results:** Each analysis will appear in its own card. You can copy the content or save it as a Markdown file.
5.  **Export:** Use "Save Full Report" to get a combined Markdown document of all successful analyses.

**Tips:**
*   For best results, provide clear and concise input text.
*   The quality of AI-generated analysis can vary. Use it as a starting point for your own critical thinking.
*   Ensure your \`API_KEY\` environment variable is correctly set up for the Gemini API.
`;


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 space-y-6">
        {apiKeyStatus === 'invalid' && globalError && (
          <div className="bg-red-800 border border-red-600 text-white p-3 rounded-md shadow-lg" role="alert">
            <p className="font-semibold">API Key Error:</p>
            <p>{globalError}</p>
          </div>
        )}
         {apiKeyStatus === 'checking' && (
            <div className="bg-yellow-700 border border-yellow-500 text-white p-3 rounded-md flex items-center space-x-2">
                <LoadingSpinner size="sm" color="border-white" />
                <span>Checking API Key status...</span>
            </div>
        )}

        {/* Instructions Section */}
        <section className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
          <button
            onClick={() => setIsInstructionsCollapsed(!isInstructionsCollapsed)}
            className="flex justify-between items-center w-full text-left text-sky-400 hover:text-sky-300"
            aria-expanded={!isInstructionsCollapsed}
            aria-controls="instructions-content"
          >
            <h2 className="text-xl font-semibold">Instructions & Overview</h2>
            <ChevronDownIcon className={`w-6 h-6 transition-transform duration-200 ${isInstructionsCollapsed ? 'rotate-0' : 'rotate-180'}`} />
          </button>
          {!isInstructionsCollapsed && (
            <div id="instructions-content" className="mt-3 prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1.5"
                 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(instructionsContent))}}
            />
          )}
        </section>

        {/* Input Section */}
        <section className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
          <button
            onClick={() => setIsInputCollapsed(!isInputCollapsed)}
            className="flex justify-between items-center w-full text-left text-sky-400 hover:text-sky-300"
            aria-expanded={!isInputCollapsed}
            aria-controls="input-content"
          >
            <h2 className="text-xl font-semibold">Input & Controls</h2>
            <ChevronDownIcon className={`w-6 h-6 transition-transform duration-200 ${isInputCollapsed ? 'rotate-0' : 'rotate-180'}`} />
          </button>
          {!isInputCollapsed && (
            <div id="input-content" className="mt-4 space-y-4">
              <div>
                <label htmlFor="userInput" className="block text-sm font-medium text-gray-300 mb-1">
                  Enter text to analyze:
                </label>
                <textarea
                  id="userInput"
                  value={userInput}
                  onChange={handleUserInputChange}
                  placeholder="Paste your text here or upload a file..."
                  className="w-full h-48 p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-400 resize-y"
                  aria-label="Text input for analysis"
                  disabled={isLoading || activeAnalysesCount > 0 || apiKeyStatus !== 'valid'}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2">
                    <label
                        htmlFor="fileUpload"
                        className={`inline-flex items-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 cursor-pointer transition-colors
                                  ${(isLoading || activeAnalysesCount > 0 || apiKeyStatus !== 'valid') ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-disabled={isLoading || activeAnalysesCount > 0 || apiKeyStatus !== 'valid'}
                    >
                        <UploadIcon className="w-4 h-4 mr-2" />
                        Upload File (.txt, .md)
                    </label>
                    <input
                        id="fileUpload"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="sr-only"
                        accept=".txt,.md,text/plain,text/markdown"
                        disabled={isLoading || activeAnalysesCount > 0 || apiKeyStatus !== 'valid'}
                    />
                    {originalFileName && <span className="text-xs text-gray-400 truncate max-w-[150px]" title={originalFileName}>File: {originalFileName}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={handleClearAll}
                        variant="secondary"
                        size="sm"
                        leftIcon={<TrashIcon className="w-4 h-4" />}
                        disabled={isLoading || activeAnalysesCount > 0}
                        aria-label="Clear input and results"
                    >
                        Clear All
                    </Button>
                    <Button
                        onClick={handleSaveFullReport}
                        variant="secondary"
                        size="sm"
                        leftIcon={<SaveIcon className="w-4 h-4" />}
                        disabled={isLoading || activeAnalysesCount > 0 || DISPLAYABLE_ANALYSIS_TYPES.every(type => !analysisResults[type]?.content || analysisResults[type]?.error)}
                        aria-label="Save full report as Markdown"
                    >
                        Save Full Report
                    </Button>
                </div>
              </div>
              
              {globalError && !globalError.toLowerCase().includes("api key") && ( // Don't show non-API key global errors if API key error is already shown
                <p className="text-red-400 text-sm bg-red-900/30 p-2 rounded border border-red-700">{globalError}</p>
              )}
            </div>
          )}
        </section>

        {/* Analysis Type Selection */}
        {!isInputCollapsed && apiKeyStatus === 'valid' && (
        <section className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
            <h3 className="text-lg font-semibold text-sky-400 mb-3">Select Analyses to Run:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {DISPLAYABLE_ANALYSIS_TYPES.map(type => (
                <label key={type} className="flex items-center space-x-2 p-2 bg-gray-700/50 hover:bg-gray-700 rounded-md cursor-pointer transition-colors border border-gray-600 hover:border-sky-600 has-[:checked]:bg-sky-700/30 has-[:checked]:border-sky-500">
                <input
                    type="checkbox"
                    checked={selectedAnalysisTypes.includes(type)}
                    onChange={() => handleToggleAnalysisSelection(type)}
                    className="form-checkbox h-4 w-4 text-sky-500 bg-gray-600 border-gray-500 rounded focus:ring-sky-400 focus:ring-offset-gray-800"
                    disabled={isLoading || activeAnalysesCount > 0}
                />
                <span className="text-sm text-gray-200">{type.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
            ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <Button
                    onClick={handleRunSelectedAnalyses}
                    variant="primary"
                    size="md"
                    leftIcon={isLoading ? <LoadingSpinner size="sm" color="border-white"/> : <PlayIcon className="w-5 h-5" />}
                    disabled={isLoading || activeAnalysesCount > 0 || userInput.trim() === '' || selectedAnalysisTypes.length === 0 || apiKeyStatus !== 'valid'}
                    aria-label="Run selected analyses"
                >
                    {isLoading ? 'Running Analyses...' : (activeAnalysesCount > 0 ? `Running (${activeAnalysesCount})...` : 'Run Selected Analyses')}
                </Button>
                <Button onClick={handleSelectAllAnalyses} variant="ghost" size="sm" disabled={isLoading || activeAnalysesCount > 0}>Select All</Button>
                <Button onClick={handleDeselectAllAnalyses} variant="ghost" size="sm" disabled={isLoading || activeAnalysesCount > 0}>Deselect All</Button>
            </div>
        </section>
        )}


        {/* Analysis Results Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-sky-300 sr-only">Analysis Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {DISPLAYABLE_ANALYSIS_TYPES.map(type => (
              (selectedAnalysisTypes.includes(type) || analysisResults[type]?.content || analysisResults[type]?.error) && // Show card if selected or has content/error
              <AnalysisCard
                key={type}
                result={analysisResults[type]}
                onCopyToClipboard={handleCopyToClipboard}
                onSaveAsMarkdown={handleSaveAsMarkdown}
              />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default App;
