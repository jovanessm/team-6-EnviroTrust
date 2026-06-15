import axios from 'axios';
import type { Park, PredictionResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const parkAPI = {
  searchParks: (query: string) =>
    api.get<Park[]>('/parks/search', { params: { q: query } }),

  getPark: (id: string) =>
    api.get<Park>(`/parks/${id}`),

  listParks: (limit = 50) =>
    api.get<Park[]>('/parks', { params: { limit } }),
};

export const predictionAPI = {
  predict: (parkId: string, scenarioNames: string[] = []) =>
    api.post<PredictionResult>('/predict', {
      parkId,
      scenarios: scenarioNames.length > 0 ? scenarioNames : ['historical', 'ssp245', 'ssp585']
    }),

  getPrediction: (id: string) =>
    api.get<PredictionResult>(`/predictions/${id}`),
};

export default api;
