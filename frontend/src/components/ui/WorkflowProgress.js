import React from 'react';

const WorkflowProgress = ({ steps, currentStep, completedSteps = [], className = '', compact = false, onStepClick }) => {
  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id) || index < currentStep;
          const isCurrent = index === currentStep;
          const isCurrentAndCompleted = isCurrent && isCompleted;
          const isCurrentOnly = isCurrent && !isCompleted;
          
          return (
            <React.Fragment key={step.id}>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-all duration-200 ${
                  isCurrentAndCompleted
                    ? 'bg-green-500 text-white shadow-green-200 ring-2 ring-blue-500 ring-offset-1'
                    : isCurrentOnly
                    ? 'bg-primary-500 text-white shadow-primary-200'
                    : isCompleted
                    ? 'bg-green-500 text-white shadow-green-200'
                    : 'bg-gray-200 text-gray-600'
                } ${onStepClick ? 'cursor-pointer hover:opacity-80 hover:scale-105' : ''}`}
                onClick={onStepClick ? () => onStepClick(step.id, index) : undefined}
                title={onStepClick ? `Click to go to ${step.label}` : step.label}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-1 rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                ></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`bg-white p-6 rounded-lg border border-gray-200 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Progress</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id) || index < currentStep;
          const isCurrent = index === currentStep;
          const isCurrentAndCompleted = isCurrent && isCompleted;
          const isCurrentOnly = isCurrent && !isCompleted;
          const isPending = index > currentStep && !isCompleted;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 relative ${
                    isCurrentAndCompleted
                      ? 'bg-green-500 text-white ring-4 ring-blue-500 ring-offset-2 shadow-lg'
                      : isCurrentOnly
                      ? 'bg-blue-500 text-white'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  } ${onStepClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={onStepClick ? () => onStepClick(step.id, index) : undefined}
                  title={onStepClick ? `Click to go to ${step.title}` : step.title}
                >
                  {step.number}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-sm font-medium ${
                    isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </div>
                  {step.date && (
                    <div className="text-xs text-gray-500 mt-1">
                      {step.date}
                    </div>
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className="h-0.5 bg-gray-200 relative">
                    <div
                      className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                      style={{ width: isCompleted ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowProgress;
