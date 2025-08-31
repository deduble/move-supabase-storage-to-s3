import React from 'react';
import { AppState } from '../types';

interface StepperProps {
  currentStep: AppState['step'];
}

const steps = [
  { key: 'credentials', label: 'Credentials' },
  { key: 'options', label: 'Options' },
  { key: 'plan', label: 'Plan' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'complete', label: 'Complete' }
];

const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="stepper">
      {steps.map((step, index) => {
        let className = 'step';
        
        if (index < currentIndex) {
          className += ' completed';
        } else if (index === currentIndex) {
          className += ' active';
        }

        return (
          <div key={step.key} className={className}>
            {index + 1}. {step.label}
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;
