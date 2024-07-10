import { useEffect, useState } from 'react';
import { Carousel } from 'react-bootstrap';
import { CandleSerie, TesYields } from 'src/types/tes';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Chart from '@components/chart/Chart';
import tokens from 'design-tokens/tokens.json';
import { LightSerieValue } from 'src/types/lightserie';

const designSystem = tokens.xerenity;
const GRAY_COLOR_300 = designSystem['gray-300'].value;

function LoginChart() {
  const supabase = createClientComponentClient();
  const [volumenSerie, setvolumenSerie] = useState<LightSerieValue[]>([]);
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
        const allData = data as TesYields[];
        setTESCandleSerie({
          name: 'COLTES 13.25 09/02/33',
          values: allData,
        });
        const volData: { time: string; value: number }[] = [];
        allData.forEach((tes) => {
          volData.push({ time: tes.day.split('T')[0], value: tes.volume });
        });
        setvolumenSerie(volData);
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
            <Chart chartHeight={400}>
              <Chart.Candle data={tesCandeSerie.values} scaleId="right" />
              <Chart.Volume
                data={volumenSerie}
                scaleId="left"
                title="Volumen"
                color={GRAY_COLOR_300}
              />
            </Chart>
          </Carousel.Item>
        </Carousel>
      </div>
    </div>
  );
}

export default LoginChart;
