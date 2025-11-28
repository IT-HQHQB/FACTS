import React from 'react';
import { Badge } from './ui';

const CaseSLAStatus = ({ slaInfo, slaValue, slaUnit }) => {
  if (!slaInfo || !slaValue || !slaUnit) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'on_time':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'breached':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'on_time':
        return 'On Time';
      case 'warning':
        return 'Warning';
      case 'breached':
        return 'Breached';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (hours) => {
    if (hours === null || hours === undefined) return 'N/A';
    
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      if (m > 0) {
        return `${h}h ${m}m`;
      }
      return `${h} hour${h !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      if (remainingHours > 0) {
        return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'on_time':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'breached':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const status = slaInfo.status || 'on_time';
  const hoursRemaining = slaInfo.hoursRemaining;
  const hoursOverdue = slaInfo.hoursOverdue;

  return (
    <div className="flex flex-col items-start space-y-1">
      <Badge 
        variant="outline" 
        className={`flex items-center space-x-1 text-xs ${getStatusColor(status)}`}
      >
        {getStatusIcon(status)}
        <span className="font-medium">{getStatusLabel(status)}</span>
      </Badge>
      <span className="text-xs text-gray-600">
        {status === 'breached' ? (
          <span className="text-red-600">
            {formatTime(hoursOverdue)} overdue
          </span>
        ) : (
          <span className={status === 'warning' ? 'text-yellow-600' : 'text-green-600'}>
            {formatTime(hoursRemaining)} remaining
          </span>
        )}
      </span>
    </div>
  );
};

export default CaseSLAStatus;

