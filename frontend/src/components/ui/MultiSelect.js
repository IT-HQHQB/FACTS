import React, { useState, useRef, useEffect } from 'react';

const MultiSelect = ({ 
  options = [],
  value = [],
  onChange,
  label,
  placeholder = "Select options...",
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  showSelectAll = false,
  selectAllLabel = "Select All",
  onSelectAll,
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle option selection
  const handleOptionClick = (option) => {
    const newValue = value.includes(option.value)
      ? value.filter(v => v !== option.value)
      : [...value, option.value];
    
    onChange(newValue);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      // Default behavior: select all filtered options
      const allFilteredValues = filteredOptions.map(option => option.value);
      const allSelected = allFilteredValues.every(val => value.includes(val));
      
      if (allSelected) {
        // Deselect all filtered options
        const newValue = value.filter(val => !allFilteredValues.includes(val));
        onChange(newValue);
      } else {
        // Select all filtered options
        const newValue = [...new Set([...value, ...allFilteredValues])];
        onChange(newValue);
      }
    }
  };

  // Check if all filtered options are selected
  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(option => value.includes(option.value));

  // Handle remove chip
  const handleRemoveChip = (valueToRemove) => {
    const newValue = value.filter(v => v !== valueToRemove);
    onChange(newValue);
  };

  // Get selected options for display
  const selectedOptions = options.filter(option => value.includes(option.value));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`w-full ${className}`} {...props}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative" ref={dropdownRef}>
        {/* Input field */}
        <div
          className={`
            w-full px-3 py-2 border rounded-lg cursor-pointer
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            focus:outline-none focus:ring-2 focus:border-transparent
          `}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <div className="flex flex-wrap gap-1 min-h-[2rem] items-center">
            {selectedOptions.length > 0 ? (
              selectedOptions.map(option => (
                <span
                  key={option.value}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-800"
                >
                  {option.label}
                  {!disabled && (
                    <button
                      type="button"
                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveChip(option.value);
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
        </div>

        {/* Dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-200">
              <input
                ref={inputRef}
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto">
              {/* Select All option */}
              {showSelectAll && filteredOptions.length > 0 && (
                <div
                  className={`
                    px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center border-b border-gray-200
                    ${allFilteredSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-900'}
                  `}
                  onClick={handleSelectAll}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={() => {}} // Handled by parent div click
                      className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium">{selectAllLabel}</span>
                  </div>
                </div>
              )}
              
              {filteredOptions.length > 0 ? (
                filteredOptions.map(option => (
                  <div
                    key={option.value}
                    className={`
                      px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center
                      ${value.includes(option.value) ? 'bg-primary-50 text-primary-700' : 'text-gray-900'}
                    `}
                    onClick={() => handleOptionClick(option)}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value.includes(option.value)}
                        onChange={() => {}} // Handled by parent div click
                        className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-sm">{option.label}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No options found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

export default MultiSelect;
