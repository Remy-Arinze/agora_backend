'use client';

import { Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const isExitingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      isExitingRef.current = false;
      gsap.killTweensOf([backdropRef.current, panelRef.current].filter(Boolean));
      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      if (backdrop) gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      if (panel) gsap.fromTo(panel, { opacity: 0, scale: 0.95, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'all' });
    } else if (shouldRender && !isExitingRef.current) {
      isExitingRef.current = true;
      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      const complete = () => {
        setShouldRender(false);
        isExitingRef.current = false;
      };
      gsap.killTweensOf([backdrop, panel].filter(Boolean));
      const tl = gsap.timeline({ onComplete: complete });
      if (panel) tl.to(panel, { opacity: 0, scale: 0.95, y: 20, duration: 0.2, ease: 'power2.in' }, 0);
      if (backdrop) tl.to(backdrop, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  return (
    <Fragment>
      <div
        ref={backdropRef}
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50"
        style={{ opacity: 0 }}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          className={`bg-light-card dark:bg-dark-surface rounded-lg shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto`}
          style={{ opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-dark-border">
            <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">{children}</div>
        </div>
      </div>
    </Fragment>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const confirmButtonVariant = variant === 'warning' ? 'primary' : variant;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className={`p-4 rounded-lg ${
          variant === 'warning'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <p className={`text-sm ${
            variant === 'warning'
              ? 'text-yellow-800 dark:text-yellow-300'
              : 'text-red-800 dark:text-red-300'
          }`}>
            {message}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant={confirmButtonVariant} onClick={handleConfirm} isLoading={isLoading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
