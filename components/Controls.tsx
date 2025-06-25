import React from 'react';
import type { CommonControlProps } from '../types.ts'; 

import ProjectActions from './controls/ProjectActions';
import InputDataControls from './controls/InputDataControls';
import IterativePlanEditor from './controls/IterativePlanEditor';
import ModelParameterControls from './controls/ModelParameterControls';
import OutputStructureDefaults from './controls/OutputStructureDefaults';
import MainActionButtons from './controls/MainActionButtons';
import DevLogControls from './controls/DevLogControls'; // Import new component

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