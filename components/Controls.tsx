import React from 'react';
import type { CommonControlProps } from '../types.ts'; 

import ProjectActions from './controls/ProjectActions.tsx';
import InputDataControls from './controls/InputDataControls.tsx';
import IterativePlanEditor from './controls/IterativePlanEditor.tsx';
import ModelParameterControls from './controls/ModelParameterControls.tsx';
import OutputStructureDefaults from './controls/OutputStructureDefaults.tsx';
import MainActionButtons from './controls/MainActionButtons.tsx';
import DevLogControls from './controls/DevLogControls.tsx'; // Import new component

interface ControlsProps {
  commonControlProps: CommonControlProps;
}

const Controls: React.FC<ControlsProps> = ({ commonControlProps }) => {
  return (
    <div className="p-6 space-y-6">
      <ProjectActions {...commonControlProps} />
      <InputDataControls {...commonControlProps} />
      <IterativePlanEditor {...commonControlProps} />
      
      <ModelParameterControls {...commonControlProps}>
         <OutputStructureDefaults {...commonControlProps} />
      </ModelParameterControls>

      <DevLogControls {...commonControlProps} /> {/* Add new component */}
      
      <MainActionButtons {...commonControlProps} />
    </div>
  );
};

export default Controls;