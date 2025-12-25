import "./src/styles/global.scss"

// Global error handler to catch and suppress react-lottie destroy errors
// This is a known issue with react-lottie where destroy() is called when anim is null
if (typeof window !== 'undefined') {
  // Catch runtime errors specifically from react-lottie
  const originalErrorHandler = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    // Check if this is the react-lottie destroy error
    if (error && error.message && 
        error.message.includes('Cannot read properties of null') &&
        (error.message.includes('destroy') || error.stack?.includes('react-lottie'))) {
      // Suppress this specific error - it's safe to ignore
      return true; // Prevent default error handling
    }
    // Call original error handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && 
        event.reason.message.includes('Cannot read properties of null') &&
        (event.reason.message.includes('destroy') || event.reason.stack?.includes('react-lottie'))) {
      event.preventDefault();
      return;
    }
  });
}