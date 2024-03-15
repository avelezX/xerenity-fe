import { useEffect, useState } from 'react';
import { Carousel } from 'react-bootstrap';
import CandleSerieViewer from '@components/compare/candleViewer';
import { CandleSerie, TesYields } from '@models/tes';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

function LoginChart() {
  const supabase = createClientComponentClient();
  const [tesCandeSerie, setTESCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.schema('public').rpc('tes_33');
      if (error) {
        setTESCandleSerie({ name: '', values: [] });
      } else if (data) {
        setTESCandleSerie({
          name: 'COLTES 13.25 09/02/33',
          values: data as TesYields[],
        });
      } else {
        setTESCandleSerie({ name: '', values: [] });
      }
    };

    fetchData();
  }, [supabase]);

  return (
    <div className="min-h-100 col-xs-12 col-md-6 col-lg-5 py-3">
      <div className="w-100 h-100 d-flex justify-content-center align-items-center">
        <Carousel className="w-100">
          <Carousel.Item>
            <CandleSerieViewer
              candleSerie={tesCandeSerie}
              otherSeries={[]}
              fit
              shorten={false}
              normalyze={false}
              chartHeight="21rem"
              watermarkText="Xerenity"
            />
          </Carousel.Item>
          <Carousel.Item>
            <CandleSerieViewer
              candleSerie={tesCandeSerie}
              otherSeries={[]}
              fit
              shorten={false}
              normalyze={false}
              chartHeight="21rem"
              watermarkText="Xerenity"
            />
          </Carousel.Item>
        </Carousel>
      </div>
    </div>
  );
}

export default LoginChart;
