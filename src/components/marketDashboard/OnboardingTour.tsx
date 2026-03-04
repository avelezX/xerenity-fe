import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Quick check: if already seen on this device, skip the Supabase call
    if (localStorage.getItem(storageKey)) return;

    const checkIfSeen = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const seenInAccount = user?.user_metadata?.[storageKey];

      if (seenInAccount) {
        // Sync to localStorage so next visits skip the Supabase call
        localStorage.setItem(storageKey, 'true');
        return;
      }

      // Not seen anywhere — show the tour after DOM is ready
      const timer = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(timer);
    };

    checkIfSeen();
  }, [storageKey, supabase]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(storageKey, 'true');
      // Persist to Supabase so the tour doesn't show on other devices
      supabase.auth.updateUser({
        data: { [storageKey]: true },
      });
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
