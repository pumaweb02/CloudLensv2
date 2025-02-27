import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { WeatherAlertNotification } from "@/components/weather-alert-notification";
import { createElement } from "react";

export interface WeatherAlert {
  id: string;
  type: string;
  severity: string;
  location: string;
  message: string;
  timestamp: string;
}

export function useWeatherAlerts() {
  const { toast } = useToast();
  const alertQueueRef = useRef<WeatherAlert[]>([]);
  const isProcessingRef = useRef<boolean>(false);

  const showNextAlert = () => {
    if (isProcessingRef.current || alertQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    const alert = alertQueueRef.current.shift();

    if (alert) {
      toast({
        title: "",
        description: createElement(WeatherAlertNotification, {
          type: alert.type,
          severity: alert.severity,
          location: alert.location,
          message: alert.message,
          timestamp: format(new Date(alert.timestamp), "h:mm a")
        }),
        duration: 5000,
      });

      // Process next alert after a delay
      setTimeout(() => {
        isProcessingRef.current = false;
        showNextAlert();
      }, 300);
    }
  };

  const addAlert = (alert: Omit<WeatherAlert, "id">) => {
    const newAlert = {
      ...alert,
      id: Math.random().toString(36).substring(7),
    };
    alertQueueRef.current.push(newAlert);
    showNextAlert();
  };

  const clearAlerts = () => {
    alertQueueRef.current = [];
    isProcessingRef.current = false;
  };

  return {
    addAlert,
    clearAlerts,
  };
}