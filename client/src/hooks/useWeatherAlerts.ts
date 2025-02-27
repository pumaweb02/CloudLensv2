import { create } from 'zustand';

export interface WeatherAlert {
  id?: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  location: string;
}

interface WeatherAlertsStore {
  alerts: WeatherAlert[];
  addAlert: (alert: WeatherAlert) => void;
  clearAlerts: () => void;
}

export const useWeatherAlerts = create<WeatherAlertsStore>((set) => ({
  alerts: [],
  addAlert: (alert) =>
    set((state) => ({
      alerts: [...state.alerts, { ...alert, id: crypto.randomUUID() }],
    })),
  clearAlerts: () => set({ alerts: [] }),
}));
