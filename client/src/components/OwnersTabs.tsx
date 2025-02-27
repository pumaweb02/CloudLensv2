import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const OwnersTabs = ({ property }) => {

  if (!property) return <p>Loading...</p>;

  const owners = [];
  for (let i = 1; i <= 5; i++) {
    const firstName = property[`owner${i}FirstName`];
    const lastName = property[`owner${i}LastName`];
    
    if (firstName && lastName && !(firstName.toLowerCase() === "no" && lastName.toLowerCase() === "no")) {
      owners.push({
        id: `owner${i}`,
        firstName,
        lastName,
        company: property[`owner${i}Company`] || "N/A",
        phones: [
          property[`owner${i}Phone`],
          property[`owner${i}Phone1`],
          property[`owner${i}Phone2`],
          property[`owner${i}Phone3`],
          property[`owner${i}Phone4`],
        ].filter(Boolean), // Remove null values
        emails: [
          property[`owner${i}Email`],
          property[`owner${i}Email1`],
          property[`owner${i}Email2`],
          property[`owner${i}Email3`],
          property[`owner${i}Email4`],
        ].filter(Boolean), // Remove null values
      });
    }
  }

  // Show message if no owners are found
  if (owners.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Owner Data Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No owners available for this property.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue={owners[0].id} className="w-full">
      <TabsList className="flex gap-2">
        {owners.map((owner) => (
          <TabsTrigger key={owner.id} value={owner.id}>
            {owner.firstName} {owner.lastName}
          </TabsTrigger>
        ))}
      </TabsList>

      {owners.map((owner) => (
        <TabsContent key={owner.id} value={owner.id}>
          <Card>
            <CardHeader>
              <CardTitle>Owner Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name</label>
                    <div className="font-medium">{owner.firstName}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <div className="font-medium">{owner.lastName}</div>
                  </div>
                </div>
               {property?.ownershipType?.toLowerCase()==="corporate" && <div>
                  <label className="text-sm font-medium">Company</label>
                  <div className="font-medium">{owner.company}</div>
                </div>}

                {/* Phone Numbers & Emails - Bullet Points */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Phone Numbers</label>
                    <ul className="list-disc ml-5">
                      {owner.phones.length > 0 ? (
                        owner.phones.map((phone, index) => (
                          <li key={index} className="font-medium">{phone}</li>
                        ))
                      ) : (
                        <li className="text-muted-foreground">No phone numbers available</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Emails</label>
                    <ul className="list-disc ml-5">
                      {owner.emails.length > 0 ? (
                        owner.emails.map((email, index) => (
                          <li key={index} className="font-medium">{email}</li>
                        ))
                      ) : (
                        <li className="text-muted-foreground">No emails available</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default OwnersTabs;