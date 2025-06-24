
import React, { useState, useEffect, useCallback } from 'react';
import type { IterationLogEntry, ProcessState, LoadedFile, ProcessingMode, StaticAiModelDetails, SettingsSuggestionSource, ModelConfig, DisplayAreaExternalProps, ParameterAdvice, SuggestedParamsResponse, ModelParameterGuidance } from './types';
import * as geminiService from './services/geminiService';
import Controls from './components/Controls';
import DisplayArea from './components/DisplayArea';
import * as Diff from 'diff';


// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// Safely initialize parts of the state that depend on geminiService
let safeInitialApiKeyStatus: 'loaded' | 'missing' = 'missing';
let safeInitialTemp = 0.8; // Fallback default
let safeInitialTopP = 0.95; // Fallback default
let safeInitialTopK = 60;   // Fallback default
let safeInitialModelConfigRationales: string[] = ["Using fallback default model settings."];

try {
  // Check if geminiService and its properties are available
  if (geminiService && typeof geminiService.isApiKeyAvailable === 'function') {
    safeInitialApiKeyStatus = geminiService.isApiKeyAvailable() ? 'loaded' : 'missing';
  } else {
    console.warn("geminiService.isApiKeyAvailable is not available. Defaulting apiKeyStatus to 'missing'.");
  }

  if (geminiService && geminiService.EXPANSIVE_MODE_DEFAULTS) {
    safeInitialTemp = geminiService.EXPANSIVE_MODE_DEFAULTS.temperature;
    safeInitialTopP = geminiService.EXPANSIVE_MODE_DEFAULTS.topP;
    safeInitialTopK = geminiService.EXPANSIVE_MODE_DEFAULTS.topK;
    safeInitialModelConfigRationales = [`Using default settings for 'expansive' mode.`];
  } else {
    console.warn("geminiService.EXPANSIVE_MODE_DEFAULTS is not available. Using fallback model parameters.");
  }
} catch (e) {
  console.error("Error accessing geminiService during initial state setup. Using fallback defaults.", e);
}


const App: React.FC = () => {
  const [staticAiModelDetails, setStaticAiModelDetails] = useState<StaticAiModelDetails | null>(null);
  const [modelConfigWarnings, setModelConfigWarnings] = useState<string[]>([]);
  const [promptChangedByFileLoad, setPromptChangedByFileLoad] = useState(false); // New state flag


  const initialProcessState: ProcessState = {
    initialPrompt: "",
    currentProduct: null,
    iterationHistory: [],
    currentIteration: 0,
    maxIterations: 10,
    isProcessing: false,
    finalProduct: null,
    statusMessage: "Select processing mode, configure model, enter input data or load from file(s) to begin.",
    apiKeyStatus: safeInitialApiKeyStatus,
    loadedFiles: [],
    promptSourceName: null,
    processingMode: 'expansive', 
    temperature: safeInitialTemp,
    topP: safeInitialTopP,
    topK: safeInitialTopK,
    settingsSuggestionSource: 'mode',
    userManuallyAdjustedSettings: false,
    modelConfigRationales: safeInitialModelConfigRationales,
    modelParameterAdvice: {},
    // overallEvolutionSummary: null, 
    configAtFinalization: null,
  };
  
  const [state, setState] = useState<ProcessState>(initialProcessState);

  const {
    initialPrompt,
    currentProduct,
    iterationHistory,
    currentIteration,
    maxIterations,
    isProcessing,
    finalProduct,
    statusMessage,
    apiKeyStatus,
    loadedFiles,
    promptSourceName,
    processingMode,
    temperature,
    topP,
    topK,
    settingsSuggestionSource,
    userManuallyAdjustedSettings,
    modelConfigRationales,
    modelParameterAdvice,
    // overallEvolutionSummary,
    configAtFinalization,
  } = state;

  const debouncedInitialPrompt = useDebounce(initialPrompt, 750);

  useEffect(() => {
    try {
      if (geminiService && typeof geminiService.getStaticModelDetails === 'function') {
        setStaticAiModelDetails(geminiService.getStaticModelDetails());
      } else {
        console.warn("geminiService.getStaticModelDetails is not available. Static model details will be unavailable.");
        setStaticAiModelDetails({ modelName: "N/A", tools: "N/A" }); // Fallback
      }
    } catch (error) {
        console.error("Error getting static model details from geminiService:", error);
        setStaticAiModelDetails({ modelName: "Error", tools: "Error" }); // Error state
    }
  }, []);

  useEffect(() => {
    try {
      if (geminiService && typeof geminiService.getModelParameterGuidance === 'function') {
        const guidance: ModelParameterGuidance = geminiService.getModelParameterGuidance({ temperature, topP, topK });
        setModelConfigWarnings(guidance.warnings);
        updateProcessState({ modelParameterAdvice: guidance.advice });
      } else {
        console.warn("geminiService.getModelParameterGuidance is not available. Model parameter advice will be unavailable.");
        setModelConfigWarnings(["Model parameter advice service not available."]);
        updateProcessState({ modelParameterAdvice: {} });
      }
    } catch (error) {
      console.error("Error getting model parameter guidance:", error);
      setModelConfigWarnings(["Error loading model parameter advice from service."]);
      updateProcessState({ modelParameterAdvice: {} }); // Default to empty advice
    }
  }, [temperature, topP, topK]);


  const updateProcessState = (updates: Partial<ProcessState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };
  
  const getProductSummary = (product: string | undefined | null): string => {
    if (!product) return "N/A";
    const limit = 100;
    return product.length > limit ? product.substring(0, limit - 3) + "..." : product;
  };

  const addLogEntry = useCallback((logData: { iteration: number; product: string | null; status: string; previousProduct?: string | null }) => {
    let linesAdded = 0;
    let linesRemoved = 0;

    if (logData.iteration > 0 && logData.previousProduct && logData.product) {
        const changes = Diff.diffLines(logData.previousProduct, logData.product, { newlineIsToken: false, ignoreWhitespace: false });
        changes.forEach(part => {
            if (part.added) linesAdded += part.count || 0;
            if (part.removed) linesRemoved += part.count || 0;
        });
    }

    const newEntry: IterationLogEntry = {
      iteration: logData.iteration,
      productSummary: getProductSummary(logData.product),
      status: logData.status,
      timestamp: new Date().toLocaleTimeString(),
      fullProduct: logData.product ?? undefined,
      linesAdded: linesAdded > 0 ? linesAdded : undefined,
      linesRemoved: linesRemoved > 0 ? linesRemoved : undefined,
    };
    setState(prev => {
        const existingEntryIndex = prev.iterationHistory.findIndex(entry => entry.iteration === newEntry.iteration);
        if (existingEntryIndex !== -1) {
            const updatedHistory = [...prev.iterationHistory];
            updatedHistory[existingEntryIndex] = newEntry; 
            return { ...prev, iterationHistory: updatedHistory };
        }
        return { ...prev, iterationHistory: [...prev.iterationHistory, newEntry] };
    });
  }, []);

  // Effect for mode-based default settings
  useEffect(() => {
    if (isProcessing || userManuallyAdjustedSettings) return;

    if (settingsSuggestionSource === 'mode' || !initialPrompt.trim()) {
        let baseConfig: ModelConfig | null = null;
        try {
            baseConfig = processingMode === 'expansive' ? 
                               geminiService.EXPANSIVE_MODE_DEFAULTS : 
                               geminiService.CONVERGENT_MODE_DEFAULTS;
        } catch (e) {
            console.warn("Could not access default model configs from geminiService.", e);
        }

        if (!baseConfig) { // Fallback if geminiService constants are unavailable
            baseConfig = processingMode === 'expansive' ? 
                         { temperature: 0.8, topP: 0.95, topK: 60 } : 
                         { temperature: 0.4, topP: 0.9, topK: 40 };
        }
        
        const currentRationales = processingMode === 'expansive' ? 
                                 [`Using default settings for 'expansive' mode.`] : 
                                 [`Using default settings for 'convergent' mode.`];

        if (temperature !== baseConfig.temperature || topP !== baseConfig.topP || topK !== baseConfig.topK) {
            updateProcessState({ 
                temperature: baseConfig.temperature,
                topP: baseConfig.topP,
                topK: baseConfig.topK,
                settingsSuggestionSource: 'mode', 
                modelConfigRationales: currentRationales,
            });
        } else if (settingsSuggestionSource !== 'mode') { 
             updateProcessState({ 
                settingsSuggestionSource: 'mode',
                modelConfigRationales: currentRationales,
            });
        }
    }
  }, [processingMode, isProcessing, userManuallyAdjustedSettings, settingsSuggestionSource, initialPrompt, temperature, topP, topK]);

  // Effect for input-based suggested settings (debounced)
  useEffect(() => {
    if (promptChangedByFileLoad) {
        setPromptChangedByFileLoad(false); 
        return;
    }

    if (isProcessing || userManuallyAdjustedSettings) return;
    if (!debouncedInitialPrompt.trim()) {
      if (settingsSuggestionSource !== 'mode') {
         let baseConfig: ModelConfig | null = null;
         try {
            baseConfig = processingMode === 'expansive' ? 
                               geminiService.EXPANSIVE_MODE_DEFAULTS : 
                               geminiService.CONVERGENT_MODE_DEFAULTS;
         } catch (e) { console.warn("Could not access default model configs from geminiService.", e); }
         
         if (!baseConfig) { // Fallback
            baseConfig = processingMode === 'expansive' ? 
                         { temperature: 0.8, topP: 0.95, topK: 60 } : 
                         { temperature: 0.4, topP: 0.9, topK: 40 };
         }

          updateProcessState({
            temperature: baseConfig.temperature,
            topP: baseConfig.topP,
            topK: baseConfig.topK,
            settingsSuggestionSource: 'mode',
            modelConfigRationales: [`No prompt; using default settings for '${processingMode}' mode.`],
          });
      }
      return;
    }
    
    try {
        if (geminiService && typeof geminiService.suggestModelParameters === 'function') {
            const suggested: SuggestedParamsResponse = geminiService.suggestModelParameters(debouncedInitialPrompt, processingMode);
            
            if (suggested.config.temperature !== temperature || 
                suggested.config.topP !== topP || 
                suggested.config.topK !== topK) {
              updateProcessState({
                temperature: suggested.config.temperature,
                topP: suggested.config.topP,
                topK: suggested.config.topK,
                settingsSuggestionSource: 'input',
                modelConfigRationales: suggested.rationales,
              });
            } else if (settingsSuggestionSource !== 'input' && settingsSuggestionSource !== 'manual') {
               updateProcessState({
                settingsSuggestionSource: 'input',
                modelConfigRationales: suggested.rationales,
              });
            }
        } else {
            console.warn("geminiService.suggestModelParameters is not available. Cannot suggest parameters based on input.");
        }
    } catch (error) {
        console.error("Error suggesting model parameters:", error);
    }
  }, [debouncedInitialPrompt, processingMode, isProcessing, userManuallyAdjustedSettings, temperature, topP, topK, settingsSuggestionSource, promptChangedByFileLoad]);


  useEffect(() => {
    let active = true;

    const runIterationCycle = async () => {
      if (!active || !isProcessing || !initialPrompt || currentProduct === null || finalProduct !== null) {
        if (finalProduct !== null && isProcessing) { 
            updateProcessState({ 
                isProcessing: false, 
            });
        }
        return;
      }

      const nextIterationNumber = currentIteration + 1;
      const previousProductForLog = currentProduct; 

      if (nextIterationNumber > maxIterations) {
        let finalStatusMsg = `Max iterations (${maxIterations}) reached. `;
        finalStatusMsg += processingMode === 'convergent' ? "Product may not be fully converged. " : "";
        finalStatusMsg += "Process stopped.";
        
        const finalConfig: ModelConfig = {temperature, topP, topK};
        updateProcessState({
          statusMessage: finalStatusMsg,
          finalProduct: currentProduct, 
          isProcessing: false, 
          configAtFinalization: finalConfig,
        });
        addLogEntry({
            iteration: currentIteration, 
            product: currentProduct,
            status: `Completed (Max iterations ${maxIterations} reached)`,
            previousProduct: iterationHistory.find(e => e.iteration === currentIteration -1)?.fullProduct
        });
        return;
      }

      updateProcessState({ statusMessage: `Processing iteration ${nextIterationNumber} of ${maxIterations} in ${processingMode} mode...`});
      try {
        if (!geminiService || typeof geminiService.iterateProduct !== 'function') {
            throw new Error("geminiService.iterateProduct is not available. Cannot process iteration.");
        }
        const modelConfigForThisIteration: ModelConfig = { temperature, topP, topK };
        const geminiResponseText = await geminiService.iterateProduct(
          currentProduct,
          nextIterationNumber,
          maxIterations,
          initialPrompt, 
          processingMode,
          modelConfigForThisIteration
        );

        if (!active) return;

        if (geminiResponseText.startsWith("CONVERGED:")) {
          const convergedProduct = geminiResponseText.replace("CONVERGED:", "").trim();
          let finalStatusMsg = "Convergence signaled by AI. ";
          finalStatusMsg += processingMode === 'convergent' ? "Distillation complete. " : "Further expansion deemed not beneficial by AI. ";
          finalStatusMsg += "Process complete.";

          const finalConfig: ModelConfig = {temperature, topP, topK};
          updateProcessState({
            finalProduct: convergedProduct, 
            currentProduct: convergedProduct,
            statusMessage: finalStatusMsg,
            isProcessing: false, 
            configAtFinalization: finalConfig,
          });
          addLogEntry({
            iteration: nextIterationNumber,
            product: convergedProduct,
            status: "Converged by AI",
            previousProduct: previousProductForLog,
          });
        } else {
          updateProcessState({
            currentProduct: geminiResponseText,
            currentIteration: nextIterationNumber,
            statusMessage: `Iteration ${nextIterationNumber} complete in ${processingMode} mode. Continuing...`,
          });
          addLogEntry({
            iteration: nextIterationNumber,
            product: geminiResponseText,
            status: `Iteration ${nextIterationNumber} complete`,
            previousProduct: previousProductForLog,
          });
        }
      } catch (error) {
        console.error("Error during iteration:", error);
        if (active) {
          const errorMessage = (error instanceof Error) ? error.message : "Unknown error";
          const finalConfig: ModelConfig = {temperature, topP, topK};
          updateProcessState({
            statusMessage: `Error during iteration ${nextIterationNumber}: ${errorMessage}. Stopping process.`,
            finalProduct: currentProduct, 
            isProcessing: false, 
            configAtFinalization: finalConfig,
          });
          addLogEntry({
            iteration: nextIterationNumber, 
            product: currentProduct, 
            status: `Error: ${errorMessage}`,
            previousProduct: previousProductForLog,
          });
        }
      }
    };

    if (isProcessing && finalProduct === null) {
      const timeoutId = setTimeout(runIterationCycle, 100); 
      return () => {
        active = false;
        clearTimeout(timeoutId);
      };
    } else if (finalProduct !== null && isProcessing) { 
        updateProcessState({ isProcessing: false });
    }
    
    return () => { active = false; };
  }, [
      isProcessing, 
      currentIteration, 
      finalProduct, 
      initialPrompt,
      currentProduct, 
      maxIterations, 
      addLogEntry, 
      processingMode,
      temperature, topP, topK,
      iterationHistory, 
    ]);


  const handleStartProcess = () => {
    if (!initialPrompt.trim()) {
      updateProcessState({statusMessage: "Please enter input data or load from file(s)."});
      return;
    }
    
    let currentApiKeyStatus = 'missing';
    try {
        if (geminiService && typeof geminiService.isApiKeyAvailable === 'function') {
            currentApiKeyStatus = geminiService.isApiKeyAvailable() ? 'loaded' : 'missing';
        }
    } catch (e) { console.warn("Could not check API key status from geminiService.", e); }

    if (currentApiKeyStatus === 'missing') {
      updateProcessState({statusMessage: "API Key is missing. Cannot start process."});
      return;
    }

    const isContinuingFromRewind = state.currentIteration > 0 && state.finalProduct === null;
    
    let rationalesForStart = state.modelConfigRationales;
    if (!isContinuingFromRewind) {
        try {
            if (geminiService && typeof geminiService.suggestModelParameters === 'function' && initialPrompt.trim()) {
                rationalesForStart = geminiService.suggestModelParameters(initialPrompt, state.processingMode).rationales;
            } else {
                 rationalesForStart = [`Initial settings for '${state.processingMode}' mode.`];
            }
        } catch (e) {
            console.warn("Could not get model parameter rationales from geminiService for start.", e);
            rationalesForStart = [`Error fetching rationales; using current settings for '${state.processingMode}' mode.`];
        }
    }


    updateProcessState({ 
        configAtFinalization: null,
        modelConfigRationales: rationalesForStart,
        userManuallyAdjustedSettings: isContinuingFromRewind ? state.userManuallyAdjustedSettings : false,
    });

    if (!isContinuingFromRewind) {
      const currentPromptSourceName = state.loadedFiles.length > 0 ? state.loadedFiles[0].name : (initialPrompt.trim() ? "typed_prompt" : null);
      const initialLogEntryContent = state.initialPrompt;
      const newInitialLogEntry: IterationLogEntry = {
        iteration: 0,
        productSummary: getProductSummary(initialLogEntryContent),
        status: "Initial state",
        timestamp: new Date().toLocaleTimeString(),
        fullProduct: initialLogEntryContent,
      };
      updateProcessState({
        iterationHistory: [newInitialLogEntry],
        currentProduct: state.initialPrompt,
        currentIteration: 0,
        finalProduct: null,
        isProcessing: true,
        statusMessage: `Initializing ${state.processingMode} process...`,
        promptSourceName: currentPromptSourceName,
      });
    } else {
      updateProcessState({
        currentProduct: state.initialPrompt, 
        isProcessing: true,
        finalProduct: null, 
        statusMessage: `Continuing ${state.processingMode} process from iteration ${state.currentIteration}...`,
      });
    }
  };

  const handleReset = () => {
    const currentMode = state.processingMode; 
    const currentMaxIterations = state.maxIterations; 

    let baseConfig: ModelConfig = { temperature: 0.8, topP: 0.95, topK: 60 }; // Fallback
    let newApiKeyStatus: 'loaded' | 'missing' = 'missing';
    let newRationales: string[] = [`Using fallback default settings for '${currentMode}' mode.`];

    try {
        if (geminiService) {
             if (typeof geminiService.isApiKeyAvailable === 'function') {
                newApiKeyStatus = geminiService.isApiKeyAvailable() ? 'loaded' : 'missing';
             }
             const defaults = currentMode === 'expansive' ? 
                               geminiService.EXPANSIVE_MODE_DEFAULTS : 
                               geminiService.CONVERGENT_MODE_DEFAULTS;
             if (defaults) {
                baseConfig = defaults;
                newRationales = [`Using default settings for '${currentMode}' mode.`];
             }
        }
    } catch (e) {
        console.warn("Could not access defaults from geminiService on reset.", e);
    }
    
    updateProcessState({
      ...initialProcessState, 
      processingMode: currentMode, 
      maxIterations: currentMaxIterations, 
      apiKeyStatus: newApiKeyStatus,
      temperature: baseConfig.temperature, 
      topP: baseConfig.topP,
      topK: baseConfig.topK,
      settingsSuggestionSource: 'mode', 
      userManuallyAdjustedSettings: false, 
      modelConfigRationales: newRationales,
      statusMessage: "Process reset. Configure model, enter input data or load file(s).",
      configAtFinalization: null,
    });
  };
  
  const handleLoadedFilesChange = (newFiles: LoadedFile[]) => {
    let newInitialPrompt = "";
    let newPromptSourceName = null;

    if (newFiles.length > 0) {
        newInitialPrompt = newFiles.map(file => 
            `--- START FILE: ${file.name} ---\n${file.content}\n--- END FILE: ${file.name} ---`
        ).join('\n\n');
        newPromptSourceName = newFiles[0].name; 
    }
    
    let suggestedConfig: ModelConfig = { temperature: state.temperature, topP: state.topP, topK: state.topK };
    let suggestedRationales: string[] = state.modelConfigRationales;

    try {
        if (geminiService && typeof geminiService.suggestModelParameters === 'function') {
            const suggested = geminiService.suggestModelParameters(newInitialPrompt, state.processingMode);
            suggestedConfig = suggested.config;
            suggestedRationales = suggested.rationales;
        } else {
            console.warn("geminiService.suggestModelParameters not available for file load. Using current settings.");
        }
    } catch (e) {
        console.error("Error suggesting model parameters on file load.", e);
    }


    updateProcessState({ 
      loadedFiles: newFiles,
      initialPrompt: newInitialPrompt,
      promptSourceName: newPromptSourceName,
      temperature: suggestedConfig.temperature, 
      topP: suggestedConfig.topP,            
      topK: suggestedConfig.topK,            
      settingsSuggestionSource: 'input',      
      userManuallyAdjustedSettings: false,    
      modelConfigRationales: suggestedRationales,
      currentProduct: null, 
      finalProduct: null, 
      iterationHistory: [], 
      currentIteration: 0, 
      configAtFinalization: null,
    });
    setPromptChangedByFileLoad(true); 
  };

  const handleInitialPromptChange = (prompt: string) => {
    const isModifyingLoadedContent = loadedFiles.length > 0 && 
                                   prompt !== loadedFiles.map(f => `--- START FILE: ${f.name} ---\n${f.content}\n--- END FILE: ${f.name} ---`).join('\n\n');

    updateProcessState({ 
      initialPrompt: prompt,
      userManuallyAdjustedSettings: false, 
      loadedFiles: isModifyingLoadedContent ? [] : loadedFiles, 
      promptSourceName: isModifyingLoadedContent ? null : promptSourceName,
    });
    setPromptChangedByFileLoad(false); 
  };

  const handleProcessingModeChange = (mode: ProcessingMode) => {
    updateProcessState({ 
      processingMode: mode,
      userManuallyAdjustedSettings: false, 
    });
  };

  const handleTemperatureChange = useCallback((val: number) => {
    updateProcessState({ temperature: val, userManuallyAdjustedSettings: true, settingsSuggestionSource: 'manual', modelConfigRationales: [] });
    setPromptChangedByFileLoad(false);
  }, []);
  const handleTopPChange = useCallback((val: number) => {
    updateProcessState({ topP: val, userManuallyAdjustedSettings: true, settingsSuggestionSource: 'manual', modelConfigRationales: [] });
    setPromptChangedByFileLoad(false);
  }, []);
  const handleTopKChange = useCallback((val: number) => {
    updateProcessState({ topK: val, userManuallyAdjustedSettings: true, settingsSuggestionSource: 'manual', modelConfigRationales: [] });
    setPromptChangedByFileLoad(false);
  }, []);

  const handleRewindToIteration = useCallback((iterationNum: number) => {
    const logEntry = state.iterationHistory.find(entry => entry.iteration === iterationNum);
    if (logEntry && logEntry.fullProduct) {
      const newHistory = state.iterationHistory.slice(0, state.iterationHistory.findIndex(entry => entry.iteration === iterationNum) + 1);
      
      updateProcessState({
        initialPrompt: logEntry.fullProduct, 
        currentProduct: logEntry.fullProduct,
        iterationHistory: newHistory,
        currentIteration: logEntry.iteration,
        finalProduct: null,
        isProcessing: false,
        statusMessage: `Rewound to Iteration ${logEntry.iteration}. Modify input or settings, then click "Continue..." to proceed.`,
        promptSourceName: `Rewound_from_Iter_${logEntry.iteration}`,
        userManuallyAdjustedSettings: true, 
        settingsSuggestionSource: 'manual', 
        modelConfigRationales: ["Settings manually controlled after rewind."],
        configAtFinalization: null,
      });
      setPromptChangedByFileLoad(false); 
    }
  }, [state.iterationHistory]); 


  const getStartButtonText = (): string => {
    if (isProcessing && finalProduct === null) return "Processing..."; 
    
    if (currentIteration > 0 && finalProduct === null) { 
        return `Continue from Iteration ${currentIteration}`;
    }
    if (finalProduct !== null) { 
        return "Start New Process";
    }
    return "Start Process"; 
  };

  const displayAreaProps: DisplayAreaExternalProps & Omit<Parameters<typeof DisplayArea>[0], keyof DisplayAreaExternalProps> = {
      statusMessage,
      currentProduct,
      finalProduct,
      iterationHistory,
      currentIteration,
      maxIterations,
      isProcessing: isProcessing && finalProduct === null, 
      promptSourceName,
      processingMode,
      onRewind: handleRewindToIteration,
      initialPromptForYAML: initialPrompt, 
      configAtFinalizationForYAML: configAtFinalization,
      staticAiModelDetailsForYAML: staticAiModelDetails,
  };


  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900">
      <header className="w-full py-6 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
            Automated Process Engine
          </h1>
          <p className="mt-2 text-slate-300 text-sm sm:text-base">
            Configure model, input data, select a mode, and let the AI iteratively process it.
          </p>
        </div>
      </header>

      <main className="w-full flex-grow px-4 sm:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-4">
            <Controls
              initialPromptFromApp={initialPrompt}
              onInitialPromptChange={handleInitialPromptChange}
              maxIterations={maxIterations}
              onMaxIterationsChange={(val) => updateProcessState({maxIterations: val})}
              isProcessing={isProcessing} 
              onStart={handleStartProcess}
              onReset={handleReset}
              apiKeyAvailable={apiKeyStatus === 'loaded'}
              finalProduct={finalProduct}
              loadedFilesFromApp={loadedFiles}
              onLoadedFilesChange={handleLoadedFilesChange}
              processingMode={processingMode}
              onProcessingModeChange={handleProcessingModeChange}
              temperature={temperature}
              onTemperatureChange={handleTemperatureChange}
              topP={topP}
              onTopPChange={handleTopPChange}
              topK={topK}
              onTopKChange={handleTopKChange}
              settingsSuggestionSource={settingsSuggestionSource}
              modelConfigWarnings={modelConfigWarnings}
              modelConfigRationales={modelConfigRationales}
              modelParameterAdvice={modelParameterAdvice}
              startProcessButtonText={getStartButtonText()}
            />
          </section>
          
          <section className="lg:col-span-8">
            <DisplayArea {...displayAreaProps} />
          </section>
        </div>
      </main>

       <footer className="w-full py-6 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <p className="text-xs text-slate-500">
            Powered by Google Gemini. API Key status: 
            <span className={apiKeyStatus === 'loaded' ? 'text-green-400' : 'text-red-400'}>
              {apiKeyStatus === 'loaded' ? ' Loaded' : ' Missing'}
            </span>.
            Current Mode: <span className="text-sky-400">{processingMode.charAt(0).toUpperCase() + processingMode.slice(1)}</span>.
          </p>
          {staticAiModelDetails && (
            <p className="text-xs text-slate-500 mt-1">
              Model: <span className="text-slate-400">{staticAiModelDetails.modelName}</span> | 
              Temp: <span className="text-slate-400">{temperature.toFixed(2)}</span> | 
              TopP: <span className="text-slate-400">{topP.toFixed(2)}</span> | 
              TopK: <span className="text-slate-400">{topK}</span> | 
              Tools: <span className="text-slate-400">{staticAiModelDetails.tools}</span>
            </p>
          )}
          <p className="text-xs text-slate-600 mt-1">
              Note: File operations (load/save) are handled client-side in your browser.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
