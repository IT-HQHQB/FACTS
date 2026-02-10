import React, { useState, useRef, useEffect, useMemo } from 'react';

const SearchableSelect = ({ 
  options = [],
  value = '',
  onChange,
  label,
  placeholder = "Select option...",
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    (option.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle option selection
  const handleOptionClick = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Get selected option for display - handle type coercion for value comparison
  const selectedOption = useMemo(() => {
    // Find the option that matches the value, handling type coercion
    return options.find(option => {
      // Handle empty string comparison
      if (value === '' && option.value === '') return true;
      if (value === null || value === undefined) {
        return option.value === null || option.value === undefined || option.value === '';
      }
      // Handle both string and number comparisons
      return String(option.value) === String(value) || option.value === value;
    });
  }, [options, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

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
            ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
            focus:outline-none focus:ring-2 focus:border-transparent
          `}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              setIsOpen(!isOpen);
            }
          }}
        >
          <div className="flex items-center justify-between min-h-[20px] pr-8">
            <span 
              className={`block truncate flex-1 ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}
              style={{ 
                visibility: 'visible', 
                opacity: 1, 
                display: 'block',
                minHeight: '20px',
                lineHeight: '20px',
                color: selectedOption ? '#111827' : '#6B7280',
                width: '100%'
              }}
            >
              {selectedOption?.label || placeholder || 'Select option...'}
            </span>
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
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
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
            <div className="max-h-80 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map(option => {
                  const isSelected = value === option.value;
                  return (
                    <div
                      key={option.value}
                      className={`
                        px-3 py-2 cursor-pointer hover:bg-gray-100
                        ${isSelected ? 'bg-primary-50' : ''}
                      `}
                      onClick={() => handleOptionClick(option)}
                    >
                      <span 
                        className={`text-sm ${isSelected ? 'text-primary-700 font-medium' : 'text-gray-900'}`}
                        style={{
                          color: isSelected ? '#0d47a1' : '#111827',
                          display: 'block',
                          visibility: 'visible',
                          opacity: 1,
                          lineHeight: '1.5'
                        }}
                      >
                        {option.label || 'Unassigned'}
                      </span>
                    </div>
                  );
                })
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

export default SearchableSelect;

