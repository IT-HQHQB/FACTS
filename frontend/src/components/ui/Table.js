import React from 'react';

const Table = ({ children, className = '', data, columns, keyField, ...props }) => {
  // If data and columns are provided, render as data table
  if (data && columns) {
    return (
      <div className={`overflow-x-auto ${className}`} {...props}>
        <table className="min-w-full divide-y divide-gray-200">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column.key || column.label}>
                  {column.label}
                </TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row[keyField] || row.id} hover>
                {columns.map((column) => (
                  <TableCell key={column.key || column.label}>
                    {column.render ? column.render(row) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    );
  }

  // Otherwise render as regular table
  return (
    <div className={`w-full ${className.includes('table-auto') ? '' : 'overflow-x-auto'} ${className}`} {...props}>
      <table className={`${className.includes('table-auto') ? 'table-auto' : 'min-w-full'} w-full divide-y divide-gray-200`}>
        {children}
      </table>
    </div>
  );
};

const TableHead = ({ children, className = '', ...props }) => (
  <thead className={`bg-gray-50 border-b border-gray-200 ${className}`} {...props}>
    {children}
  </thead>
);

const TableBody = ({ children, className = '', ...props }) => (
  <tbody className={`bg-white divide-y divide-gray-200 ${className}`} {...props}>
    {children}
  </tbody>
);

const TableRow = ({ children, className = '', hover = false, ...props }) => (
  <tr className={`${hover ? 'hover:bg-gray-50 transition-colors duration-150' : ''} ${className}`} {...props}>
    {children}
  </tr>
);

const TableCell = ({ children, className = '', align = 'left', ...props }) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };
  
  // If className includes max-w or break-words, don't use whitespace-nowrap
  const shouldWrap = className.includes('max-w') || className.includes('break-words');
  
  return (
    <td className={`px-6 py-4 ${shouldWrap ? '' : 'whitespace-nowrap'} text-sm text-gray-900 ${alignClasses[align]} ${className}`} {...props}>
      {children}
    </td>
  );
};

const TableHeader = ({ children, className = '', align = 'left', sortable = false, sortDirection = null, onSort, ...props }) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };
  
  const handleClick = () => {
    if (sortable && onSort) {
      onSort();
    }
  };
  
  const getSortIcon = () => {
    if (!sortable) return null;
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else if (sortDirection === 'desc') {
      return (
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
  };
  
  return (
    <th 
      className={`px-6 py-3 text-sm font-semibold text-gray-700 tracking-wider ${alignClasses[align]} ${sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''} ${className}`} 
      onClick={handleClick}
      {...props}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon()}
      </div>
    </th>
  );
};

Table.Head = TableHead;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Cell = TableCell;
Table.Header = TableHeader;

export default Table;

