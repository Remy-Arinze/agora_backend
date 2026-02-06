'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (items: number) => void;
  totalItems: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalItems,
  className,
}: PaginationProps) {
  const pageNumbers: (number | string)[] = [];
  
  // Generate page numbers with ellipsis
  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    // Show first page
    pageNumbers.push(1);
    
    if (currentPage > 3) {
      pageNumbers.push('...');
    }
    
    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pageNumbers.push('...');
    }
    
    // Show last page
    pageNumbers.push(totalPages);
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {/* Page info and navigation */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#9ca3af] dark:text-[#9ca3af]">
          Page {currentPage} of {totalPages}
        </span>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-[#9ca3af] dark:text-[#9ca3af]">
                  ...
                </span>
              );
            }
            
            const pageNum = page as number;
            const isActive = pageNum === currentPage;
            
            return (
              <Button
                key={pageNum}
                variant={isActive ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'h-8 min-w-8 px-3',
                  isActive && 'bg-[#2490FD] dark:bg-[#2490FD] text-white'
                )}
              >
                {pageNum}
              </Button>
            );
          })}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Items per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#9ca3af] dark:text-[#9ca3af]">Items per page:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="bg-[#151a23] dark:bg-[#151a23] border border-[#1a1f2e] dark:border-[#1a1f2e] text-white dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
}
