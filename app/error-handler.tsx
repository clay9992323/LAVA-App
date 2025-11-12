'use client';

import { useEffect } from 'react';

export default function ErrorHandler() {
  useEffect(() => {
    // Suppress browser extension connection errors
    const originalError = console.error;
    console.error = (...args) => {
      const message = args[0]?.toString() || '';
      
      // Filter out browser extension connection errors
      if (
        message.includes('Could not establish connection') ||
        message.includes('Receiving end does not exist') ||
        message.includes('content-scripts.js')
      ) {
        return; // Suppress these errors
      }
      
      // Allow other errors to pass through
      originalError.apply(console, args);
    };

    // Cleanup function
    return () => {
      console.error = originalError;
    };
  }, []);

  return null; // This component doesn't render anything
}
