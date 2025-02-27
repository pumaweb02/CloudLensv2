import React from 'react';
import { Button } from './ui/button';
import { generateInspectionReport } from '@/lib/report-generator';
import { Photo } from '@db/schema';
import { useToast } from '@/hooks/use-toast';

interface InspectionReportProps {
  propertyId: number;
  inspectionId: number;
  selectedPhotos: Photo[];
  onClose?: () => void;
}

export function InspectionReport({ propertyId, inspectionId, selectedPhotos, onClose }: InspectionReportProps) {
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    try {
      await generateInspectionReport(propertyId, inspectionId, selectedPhotos);
      toast({
        title: "Success",
        description: "Report generated successfully",
      });
      if (onClose) onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Generate Inspection Report</h2>
      <p className="mb-4">Selected {selectedPhotos.length} photos for the report.</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleGenerateReport}>Generate Report</Button>
      </div>
    </div>
  );
}

export default InspectionReport;