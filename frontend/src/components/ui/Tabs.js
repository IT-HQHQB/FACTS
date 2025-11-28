import React, { useState } from 'react';

const Tabs = ({ 
  children, 
  defaultTab = 0,
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  const tabs = React.Children.toArray(children).filter(child => child.type === Tab);
  
  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === index
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.props.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        {tabs[activeTab]?.props.children}
      </div>
    </div>
  );
};

const Tab = ({ children, label }) => {
  return <div>{children}</div>;
};

Tabs.Tab = Tab;

export default Tabs;
















































