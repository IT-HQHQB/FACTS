import React from 'react';

const Notifications = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
        <p className="text-gray-600">View and manage notifications</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications Page</h3>
          <p className="text-gray-600 mb-4">This page is being updated to use Tailwind CSS</p>
          <p className="text-sm text-gray-500">The full functionality will be restored once the migration is complete.</p>
        </div>
      </div>
    </div>
  );
};

export default Notifications;