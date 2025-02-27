import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, MapPin, Building, Map, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

interface AddressSearchProps {
  onSearch: (address: string, coordinates?: { lat: number; lng: number }, locationType?: string) => void;
}

interface GooglePlace {
  place_id: string;
  description: string;
  types: string[];
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function AddressSearch({ onSearch }: AddressSearchProps) {
  const [searchInput, setSearchInput] = useState("");
  const [predictions, setPredictions] = useState<GooglePlace[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const autocompleteTimeout = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    if (searchInput.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoadingPredictions(true);

    if (autocompleteTimeout.current) {
      clearTimeout(autocompleteTimeout.current);
    }

    autocompleteTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(searchInput)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        setPredictions(data.predictions || []);
        setShowPredictions(true);
      } catch (error: any) {
        console.error('Error fetching predictions:', error);
        toast({
          title: "Search Error",
          description: "Failed to fetch suggestions. Please try again later.",
          variant: "destructive",
        });
        setPredictions([]);
      } finally {
        setIsLoadingPredictions(false);
      }
    }, 300);

    return () => {
      if (autocompleteTimeout.current) {
        clearTimeout(autocompleteTimeout.current);
      }
    };
  }, [searchInput, toast]);

  const getLocationType = (types: string[]): string => {
    if (types.includes('street_address') || types.includes('premise')) return 'address';
    if (types.includes('sublocality') || types.includes('neighborhood')) return 'neighborhood';
    if (types.includes('locality') || types.includes('postal_code')) return 'city';
    if (types.includes('administrative_area_level_1')) return 'state';
    if (types.includes('country')) return 'country';
    return 'location';
  };

  const handlePredictionSelect = async (prediction: GooglePlace) => {
    if (!prediction?.place_id) {
      toast({
        title: "Error",
        description: "Invalid location selected. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setSearchInput(prediction.description);
    setShowPredictions(false);

    try {
      const locationType = getLocationType(prediction.types);
      const geocodeResponse = await fetch(
        `/api/geocode?placeId=${prediction.place_id}&type=${locationType}`
      );

      if (!geocodeResponse.ok) {
        const errorData = await geocodeResponse.json();
        throw new Error(errorData.message || 'Failed to get location coordinates');
      }

      const geocodeData = await geocodeResponse.json();
      onSearch(prediction.description, geocodeData.location, locationType);
    } catch (error: any) {
      console.error('Geocoding error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to get location coordinates. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getLocationIcon = (types: string[]) => {
    if (types.includes('street_address') || types.includes('premise')) return <Home className="w-4 h-4" />;
    if (types.includes('sublocality') || types.includes('neighborhood')) return <Building className="w-4 h-4" />;
    if (types.includes('locality')) return <Building className="w-4 h-4" />;
    if (types.includes('administrative_area_level_1')) return <Map className="w-4 h-4" />;
    return <MapPin className="w-4 h-4" />;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && predictions.length > 0) {
      handlePredictionSelect(predictions[0]);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          placeholder="Search for any address, city, or region..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pr-24"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoadingPredictions && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoadingPredictions || !searchInput}
            onClick={() => predictions.length > 0 && handlePredictionSelect(predictions[0])}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showPredictions && predictions.length > 0 && (
        <Card className="absolute mt-1 w-full z-50 py-2 shadow-lg">
          <ul className="max-h-60 overflow-auto">
            {predictions.map((prediction) => (
              <li
                key={prediction.place_id}
                className="px-4 py-2 hover:bg-accent cursor-pointer"
                onClick={() => handlePredictionSelect(prediction)}
              >
                <div className="flex items-center gap-2">
                  {getLocationIcon(prediction.types)}
                  <div>
                    <div className="font-medium">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}