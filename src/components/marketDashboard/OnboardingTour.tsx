import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

const TOUR_STYLE = {
  options: {
    primaryColor: '#6f42c1',
    zIndex: 10000,
    arrowColor: '#fff',
    backgroundColor: '#fff',
    textColor: '#333',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
};

type OnboardingTourProps = {
  storageKey: string;
  steps: Step[];
};

export default function OnboardingTour({ storageKey, steps }: OnboardingTourProps) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      // Small delay so DOM elements are mounted
      const timer = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [storageKey]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(storageKey, 'true');
      setRun(false);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      disableOverlayClose
      styles={TOUR_STYLE}
      callback={handleCallback}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        open: 'Abrir guía',
        skip: 'Omitir tour',
      }}
    />
  );
}
