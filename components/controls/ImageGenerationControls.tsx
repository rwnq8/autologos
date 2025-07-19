import React from 'react';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import type { CommonControlProps } from '../../types/index.ts';
import LoadingSpinner from '../shared/LoadingSpinner.tsx';

const ImageGenerationControls: React.FC<CommonControlProps> = ({ commonInputClasses, commonButtonClasses }) => {
    const { process } = useEngine();
    
    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        process.updateProcessState({ imageGenerationPrompt: e.target.value });
    };
    
    const handleNumImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        process.updateProcessState({ numberOfImagesToGenerate: parseInt(e.target.value, 10) });
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-primary-600 dark:text-primary-300">Image Studio</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Generate images using the Imagen-3 model.</p>
            </div>
            
            <div className="space-y-2">
                <label htmlFor="image-prompt" className="block text-sm font-medium text-primary-600 dark:text-primary-300">Prompt</label>
                <textarea
                    id="image-prompt"
                    rows={3}
                    value={process.imageGenerationPrompt}
                    onChange={handlePromptChange}
                    className={commonInputClasses}
                    placeholder="e.g., A majestic castle on a floating island, digital art."
                    disabled={process.isGeneratingImages}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                    <label htmlFor="num-images" className="block text-sm font-medium text-primary-600 dark:text-primary-300">Number of Images (1-4)</label>
                    <input
                        id="num-images"
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={process.numberOfImagesToGenerate}
                        onChange={handleNumImagesChange}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 mt-2"
                        disabled={process.isGeneratingImages}
                    />
                    <div className="text-center text-sm mt-1">{process.numberOfImagesToGenerate}</div>
                </div>
                <button
                    onClick={process.handleGenerateImages}
                    disabled={process.isGeneratingImages || !process.imageGenerationPrompt}
                    className={`${commonButtonClasses} bg-primary-600 text-white hover:bg-primary-700 h-10 flex items-center justify-center`}
                >
                    {process.isGeneratingImages ? <LoadingSpinner /> : 'Generate'}
                </button>
            </div>

            {(process.generatedImages && process.generatedImages.length > 0) && (
                <div className="pt-4 border-t border-slate-300 dark:border-white/10">
                    <h4 className="text-md font-semibold text-primary-600 dark:text-primary-300 mb-2">Generated Images ({process.generatedImages.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto p-2 bg-slate-100 dark:bg-black/20 rounded-md">
                        {process.isGeneratingImages && Array.from({ length: process.numberOfImagesToGenerate }).map((_, i) => (
                           <div key={`loader-${i}`} className="w-full aspect-square bg-slate-200 dark:bg-slate-700 rounded-md flex items-center justify-center animate-pulse">
                               <LoadingSpinner className="h-8 w-8 text-slate-400" />
                           </div>
                        ))}
                        {process.generatedImages.map((image, index) => (
                            <div key={index} className="group relative">
                                <img 
                                    src={`data:image/jpeg;base64,${image.base64}`} 
                                    alt={image.prompt}
                                    className="w-full h-auto rounded-md shadow-md"
                                />
                                <a 
                                    href={`data:image/jpeg;base64,${image.base64}`} 
                                    download={`autologos-image-${Date.now()}.jpeg`}
                                    className="absolute top-1 right-1 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                    aria-label="Download image"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </a>
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 rounded-md pointer-events-none">
                                    <p className="text-white text-xs text-center">{image.prompt}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageGenerationControls;
