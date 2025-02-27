import { useQuery } from "@tanstack/react-query";
import { ReportTemplateEditor } from "@/components/report-template-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export function TemplateManager() {
  const [, setLocation] = useLocation();
  const [showEditor, setShowEditor] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["reportTemplates"],
    queryFn: async () => {
      const response = await fetch("/api/report-templates");
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Report Templates</h1>
        </div>
        {!showEditor && (
          <Button onClick={() => setShowEditor(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      {showEditor ? (
        <div className="mb-6">
          <ReportTemplateEditor />
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates?.map((template: any) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/templates/${template.id}`)}
                  >
                    Edit Template
                  </Button>
                  {template.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Default
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
