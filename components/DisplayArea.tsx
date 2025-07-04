
import React from 'react';
import { useEngine } from '../contexts/ApplicationContext.tsx';
import DocumentMap from './display/DocumentMap.tsx';
import ProcessStatusDisplay from './display/ProcessStatusDisplay.tsx';
import ProductOutputDisplay from './display/ProductOutputDisplay.tsx';
import IterationLog from './display/IterationLog.tsx';

const DisplayArea: React.FC = () => {
  const { process: processCtx, projectIO } = useEngine();

  const handleSaveFinalProduct = () => {
    // Logic is now centralized in App.tsx to access all necessary state.
    // This component will just render the UI. The actual save logic is passed
    // down to ProductOutputDisplay from App.tsx.
    console.log("Save triggered from DisplayArea, but logic is in App.tsx");
  };

  return (
    <main className="flex-1 flex overflow-y-hidden">
      {!processCtx.isOutlineMode && processCtx.documentChunks && processCtx.documentChunks.length > 0 && <DocumentMap />}

      <div className="flex-1 overflow-y-auto space-y-8 p-6">
        <ProcessStatusDisplay />
        <ProductOutputDisplay onSaveFinalProduct={handleSaveFinalProduct} />
        <IterationLog
          onSaveLog={projectIO.handleExportProject}
        />
      </div>
    </main>
  );
};

export default DisplayArea;
