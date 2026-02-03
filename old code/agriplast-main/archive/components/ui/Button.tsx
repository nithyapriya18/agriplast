'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary';
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  children, 
  className = '', 
  disabled,
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-full border-gray-400 border bg-transparent font-medium text-center text-base text-page leading-snug transition py-3.5 px-6 ease-in duration-200 focus:ring-blue-500 focus:ring-offset-blue-200 focus:ring-2 focus:ring-offset-2 hover:bg-gray-100 hover:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'font-semibold bg-primary text-white border-primary hover:bg-secondary hover:border-secondary hover:text-white',
    secondary: 'text-[#14130B] border-2 border-[#14130B] hover:border-[#14130B] hover:bg-[#14130B] hover:text-white',
    tertiary: 'border-none shadow-none text-muted hover:text-gray-900',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
