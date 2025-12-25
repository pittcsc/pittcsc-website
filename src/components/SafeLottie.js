import React, { Suspense } from "react";

const Lottie = React.lazy(() => import("react-lottie"));

// Simple wrapper component for Lottie
// The destroy error is handled globally in gatsby-browser.js
const SafeLottie = ({ options, className, eventListeners = [] }) => {
  return (
    <Suspense fallback={null}>
      <Lottie
        options={options}
        className={className}
        eventListeners={eventListeners}
      />
    </Suspense>
  );
};

export default SafeLottie;

