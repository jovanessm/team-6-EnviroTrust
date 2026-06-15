export interface Park {
  id: string;
  name: string;
  type: 'solar';
  location: {
    lat: number;
    lng: number;
  };
  capacity: number;
  operatingYear: number;
}

export interface ClimateScenario {
  name: string;
  type: 'historical' | 'ssp126' | 'ssp245' | 'ssp370' | 'ssp585';
  description: string;
}

export interface PredictionResult {
  parkId: string;
  parkName: string;
  baselineOutput: number;
  scenarioOutputs: {
    [scenarioName: string]: {
      output: number;
      lower: number;
      upper: number;
      uncertainty: number;
    };
  };
  historicalOutput?: number;
  divergence?: number;
  assumptions: string[];
}
