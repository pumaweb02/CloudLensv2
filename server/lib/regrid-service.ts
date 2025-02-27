import * as turf from '@turf/turf';

export interface RegridProperty {
  propertyId: string;
  parcelNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    fullAddress: string;
  };
  ownerInfo: {
    name: string;
    mailingAddress: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      fullAddress?: string;
    };
    careOf?: string;
  };
  yearBuilt?: number;
  propertyValue?: {
    total: number;
    improvements: number;
    land: number;
  };
  useDescription?: string;
  zoning?: {
    code: string;
    description: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  boundary: GeoJSON.Feature<GeoJSON.Polygon>;
  nearbyParcelCount?: number;
}

export class RegridService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.REGRID_API_KEY;
    if (!apiKey) {
      throw new Error("REGRID_API_KEY environment variable must be set");
    }
    this.apiKey = apiKey;
    this.baseUrl = 'https://app.regrid.com/api/v2';
  }

  async queryRegridProperty(
    lat: number, 
    lng: number,
    radius: number = 100, // Default radius in meters
    checkDensity: boolean = false
  ): Promise<RegridProperty | null> {
    try {
      // Format coordinates to 6 decimal places for accuracy
      const formattedLat = Number(lat.toFixed(6));
      const formattedLng = Number(lng.toFixed(6));

      console.log('Querying Regrid API with coordinates:', {
        lat: formattedLat,
        lng: formattedLng,
        radius,
        checkDensity
      });

      // Construct the URL for the point endpoint as per API docs
      const url = new URL(`${this.baseUrl}/parcels/point`);

      // Add all required and optional parameters as per API docs
      const params = {
        token: this.apiKey,
        lat: formattedLat.toString(),
        lon: formattedLng.toString(),
        radius: radius.toString(),
        return_geometry: 'true',
        return_custom: 'true',
        return_zoning: 'true',
        return_field_labels: 'true',
        limit: '1'
      };

      // Add parameters to URL
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      // Log the request URL (without exposing the API key)
      const redactedUrl = url.toString().replace(this.apiKey, '[REDACTED]');
      console.log('Making request to Regrid API:', redactedUrl);

      const response = await fetch(url.toString());
      const responseText = await response.text();

      // Handle non-200 responses
      if (!response.ok) {
        console.error('Regrid API error:', {
          status: response.status,
          statusText: response.statusText,
          url: redactedUrl,
          responseBody: responseText.substring(0, 1000) // Log first 1000 chars of error
        });
        throw new Error(`Regrid API error: ${response.status} - ${response.statusText}`);
      }

      // Parse the response as JSON
      const data = JSON.parse(responseText);

      // Validate response structure
      if (!data?.parcels?.features?.length) {
        console.log('No parcels found in Regrid response for coordinates:', {
          lat: formattedLat,
          lng: formattedLng
        });
        return null;
      }

      // Get the first feature and its properties
      const feature = data.parcels.features[0];
      const props = feature.properties?.fields || feature.properties;

      if (!props) {
        console.log('No property data found in feature:', feature);
        return null;
      }

      // Map the response to our RegridProperty interface
      const property: RegridProperty = {
        propertyId: props.ll_uuid || feature.id?.toString(),
        parcelNumber: props.parcelnumb || '',
        address: {
          street: props.address || '',
          city: props.scity || props.city || '',
          state: props.state2 || '',
          zipCode: props.szip || '',
          fullAddress: [
            props.address,
            props.scity || props.city,
            props.state2,
            props.szip
          ].filter(Boolean).join(', ')
        },
        ownerInfo: {
          name: props.owner || '',
          mailingAddress: {
            street: props.mailadd || '',
            city: props.mail_city || '',
            state: props.mail_state2 || '',
            zipCode: props.mail_zip || '',
            country: props.mail_country || 'US',
            fullAddress: [
              props.mailadd,
              props.mail_city,
              props.mail_state2,
              props.mail_zip
            ].filter(Boolean).join(', ')
          },
          careOf: props.careof
        },
        yearBuilt: props.yearbuilt ? parseInt(props.yearbuilt) : undefined,
        propertyValue: {
          total: parseInt(props.parval) || 0,
          improvements: parseInt(props.improvval) || 0,
          land: parseInt(props.landval) || 0
        },
        useDescription: props.usedesc || '',
        zoning: props.zoning ? {
          code: props.zoning,
          description: props.zoning_description || ''
        } : undefined,
        coordinates: {
          latitude: formattedLat,
          longitude: formattedLng
        },
        boundary: feature,
        nearbyParcelCount: checkDensity ? data.parcels.features.length : undefined
      };

      console.log('Successfully mapped Regrid data:', {
        propertyId: property.propertyId,
        address: property.address.fullAddress,
        hasOwner: !!property.ownerInfo.name,
        hasZoning: !!property.zoning
      });

      return property;

    } catch (error) {
      console.error('Error querying Regrid API:', error);
      throw error;
    }
  }
}