'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { GridEntry } from '@models/tes';
import CandleGridViewer from '../CandleGrid';

export interface CopTesGridProps {
  moneytype: string;
  selectCallback: (eventKey: ChangeEvent<HTMLFormElement>) => void;
}

export default function CopTesGrid({
  moneytype,
  selectCallback,
}: CopTesGridProps) {
  const supabase = createClientComponentClient();

  const [gridEntries, setGridEntries] = useState<GridEntry[]>([]);

  const fetchTesNames = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .rpc('get_tes_grid_raw', { money: moneytype });

    if (error) {
      setGridEntries([]);
    }

    if (data) {
      setGridEntries(data as GridEntry[]);
    } else {
      setGridEntries([] as GridEntry[]);
    }
  }, [supabase, moneytype]);

  useEffect(() => {
    fetchTesNames();
  }, [fetchTesNames]);

  return (
    <CandleGridViewer allTes={gridEntries} selectCallback={selectCallback} />
  );
}
