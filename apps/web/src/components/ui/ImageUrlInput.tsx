'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, X, Check, AlertCircle } from 'lucide-react';
import { Input } from './Input';
import { EntityAvatar } from './EntityAvatar';

interface ImageUrlInputProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  entityName: string;
  label?: string;
  placeholder?: string;
}

export function ImageUrlInput({
  value,
  onChange,
  entityName,
  label = 'Image URL',
  placeholder = 'https://example.com/image.jpg',
}: ImageUrlInputProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isValid, setIsValid] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
    setPreviewUrl(value || '');
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setInputValue(url);
    
    if (url === '') {
      setIsValid(true);
      setPreviewUrl('');
      onChange(undefined);
    } else if (isValidUrl(url)) {
      setIsValid(true);
      setPreviewUrl(url);
      onChange(url);
    } else {
      setIsValid(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setPreviewUrl('');
    setIsValid(true);
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
        {label}
      </label>
      
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="flex-shrink-0">
          <EntityAvatar
            name={entityName || 'Preview'}
            imageUrl={previewUrl}
            size="lg"
            variant="square"
          />
        </div>

        {/* Input */}
        <div className="flex-1 space-y-2">
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              className={`pl-10 pr-10 ${!isValid ? 'border-red-500 focus:ring-red-500' : ''}`}
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-light-text-muted hover:text-light-text-primary dark:text-dark-text-muted dark:hover:text-dark-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {!isValid && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              Please enter a valid URL
            </p>
          )}
          
          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
            Enter a URL to an image. Leave empty to use initials.
          </p>
        </div>
      </div>
    </div>
  );
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

