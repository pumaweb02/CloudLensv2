import { motion } from "framer-motion";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Wind, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeatherAlertNotificationProps {
  type: string;
  severity: string;
  location: string;
  message: string;
  timestamp: string;
}

const getAlertIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'rain':
    case 'precipitation':
      return <CloudRain className="h-5 w-5" />;
    case 'snow':
      return <CloudSnow className="h-5 w-5" />;
    case 'storm':
    case 'thunderstorm':
      return <CloudLightning className="h-5 w-5" />;
    case 'wind':
      return <Wind className="h-5 w-5" />;
    case 'severe':
      return <AlertTriangle className="h-5 w-5" />;
    default:
      return <Cloud className="h-5 w-5" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'severe':
      return 'text-destructive border-destructive/50 bg-destructive/10';
    case 'moderate':
      return 'text-yellow-600 border-yellow-500/50 bg-yellow-500/10';
    default:
      return 'text-blue-600 border-blue-500/50 bg-blue-500/10';
  }
};

export function WeatherAlertNotification({
  type,
  severity,
  location,
  message,
  timestamp,
}: WeatherAlertNotificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className={cn(
        "rounded-lg border p-4 shadow-lg",
        getSeverityColor(severity)
      )}
    >
      <div className="flex items-start gap-3">
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {getAlertIcon(type)}
        </motion.div>
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h4 className="font-semibold mb-1">{type} Alert</h4>
            <p className="text-sm mb-2">{message}</p>
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>{location}</span>
              <span>{timestamp}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
