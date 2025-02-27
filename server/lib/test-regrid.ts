import { RegridService } from "./regrid-service";

async function testRegridAPI() {
  try {
    console.log("Testing Regrid API integration...");
    const regridService = new RegridService();

    // Test coordinates (Dallas area - using coordinates from API documentation examples)
    const latitude = 32.8277929786983;
    const longitude = -96.77737790638413;

    console.log(`Querying location: ${latitude}, ${longitude}`);
    console.log('API Key present:', !!process.env.REGRID_API_KEY);

    const result = await regridService.queryParcelAtLocation(latitude, longitude);

    console.log("\nAPI Response:");
    console.log(JSON.stringify(result, null, 2));

    if (result.parcel) {
      console.log("\nSuccessfully retrieved parcel data:");
      console.log(`Match Method: ${result.matchMethod}`);
      console.log(`Confidence: ${result.confidence}`);

      console.log("\nBasic Information:");
      console.log("------------------");
      console.log(`Parcel ID: ${result.parcel.parcelId}`);
      console.log(`Parcel Number: ${result.parcel.parcelNumber}`);
      console.log(`Address: ${result.parcel.address.fullAddress}`);

      console.log("\nOwner Information:");
      console.log("------------------");
      console.log(`Owner: ${result.parcel.ownerInfo.name}`);
      if (result.parcel.ownerInfo.careOf) {
        console.log(`Care Of: ${result.parcel.ownerInfo.careOf}`);
      }
      console.log(`Mailing Address: ${result.parcel.ownerInfo.mailingAddress.fullAddress}`);

      console.log("\nProperty Details:");
      console.log("------------------");
      if (result.parcel.yearBuilt) {
        console.log(`Year Built: ${result.parcel.yearBuilt}`);
      }
      console.log(`Property Value: $${result.parcel.propertyValue.total.toLocaleString()}`);
      console.log(`Improvement Value: $${result.parcel.propertyValue.improvements.toLocaleString()}`);
      console.log(`Land Value: $${result.parcel.propertyValue.land.toLocaleString()}`);
      if (result.parcel.useDescription) {
        console.log(`Use Description: ${result.parcel.useDescription}`);
      }
      if (result.parcel.zoning) {
        console.log(`Zoning: ${result.parcel.zoning.code} - ${result.parcel.zoning.description}`);
      }

      console.log("\nGeographic Data:");
      console.log("------------------");
      console.log(`Latitude: ${result.parcel.coordinates.latitude}`);
      console.log(`Longitude: ${result.parcel.coordinates.longitude}`);

      if (result.confidenceFactors) {
        console.log("\nConfidence Factors:");
        console.log("------------------");
        console.log(`Location: ${(result.confidenceFactors.location * 100).toFixed(1)}%`);
        console.log(`Parcel Boundary: ${(result.confidenceFactors.parcelBoundary * 100).toFixed(1)}%`);
        console.log(`Address Match: ${(result.confidenceFactors.addressMatch * 100).toFixed(1)}%`);
        console.log(`Ownership Match: ${(result.confidenceFactors.ownershipMatch * 100).toFixed(1)}%`);
      }
    } else {
      console.log("\nNo parcel data found at location");
    }

  } catch (error) {
    console.error("Error testing Regrid API:", error);
    if (error instanceof Error && error.message.includes('API key')) {
      console.error("Please verify your Regrid API key is correctly set in the environment variables");
    }
    process.exit(1);
  }
}

// Run the test
testRegridAPI();