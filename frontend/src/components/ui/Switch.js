import React from 'react';

const Switch = ({ 
  checked, 
  onChange, 
  disabled = false,
  label,
  className = '',
  ...props 
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      <button
        type="button"
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          checked ? 'bg-primary-600' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        {...props}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      {label && (
        <span className="ml-3 text-sm text-gray-700">{label}</span>
      )}
    </div>
  );
};

export default Switch;
















































