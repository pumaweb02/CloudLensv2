import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/api/weather', async (req, res) => {
  const { lat, lon, start_date, end_date } = req.query;
  const apiKey = process.env.WEATHERSTACK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'WeatherStack API key not configured' });
  }

  try {
    // WeatherStack API only provides current weather in the free plan
    // For historical data, you need a paid plan
    const response = await axios.get(`http://api.weatherstack.com/current`, {
      params: {
        access_key: apiKey,
        query: `${lat},${lon}`,
        units: 'f' // Fahrenheit
      }
    });

    // Transform the weather data into our format
    const weatherData = response.data;
    const events = [];

    if (weatherData.current) {
      const current = weatherData.current;
      
      // Add wind event if wind speed is significant
      if (current.wind_speed > 15) {
        events.push({
          date: new Date().toISOString(),
          type: 'wind',
          severity: current.wind_speed > 30 ? 'high' : 
                   current.wind_speed > 20 ? 'medium' : 'low',
          description: `Wind speed: ${current.wind_speed}mph, Direction: ${current.wind_dir}`
        });
      }

      // Add precipitation event if present
      if (current.precip > 0) {
        events.push({
          date: new Date().toISOString(),
          type: current.temperature < 32 ? 'hail' : 'rain',
          severity: current.precip > 1 ? 'high' :
                   current.precip > 0.5 ? 'medium' : 'low',
          description: `Precipitation: ${current.precip}mm, Temperature: ${current.temperature}°F`
        });
      }
    }

    res.json(events);
  } catch (error) {
    console.error('WeatherStack API error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

export default router;
