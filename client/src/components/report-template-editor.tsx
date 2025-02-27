import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPicker } from "@/components/color-picker";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  theme: z.object({
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      text: z.string(),
      headerBackground: z.string(),
      footerBackground: z.string(),
    }),
    fonts: z.object({
      header: z.string(),
      body: z.string(),
      size: z.object({
        title: z.number(),
        subtitle: z.number(),
        heading: z.number(),
        body: z.number(),
        small: z.number(),
      }),
    }),
    spacing: z.object({
      margins: z.object({
        top: z.number(),
        bottom: z.number(),
        left: z.number(),
        right: z.number(),
      }),
      lineHeight: z.number(),
      paragraphSpacing: z.number(),
    }),
  }),
  layout: z.object({
    sections: z.array(z.object({
      type: z.string(),
      height: z.number().optional(),
      components: z.array(z.object({
        type: z.string(),
        position: z.string(),
      })).optional(),
      style: z.string().optional(),
      background: z.string().optional(),
      columns: z.number().optional(),
      size: z.string().optional(),
    })),
  }),
  isDefault: z.boolean().default(false),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export function ReportTemplateEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("theme");

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      theme: {
        colors: {
          primary: "#1a365d",
          secondary: "#2d3748",
          accent: "#e53e3e",
          background: "#ffffff",
          text: "#000000",
          headerBackground: "#f8f8f8",
          footerBackground: "#f0f9ff",
        },
        fonts: {
          header: "Helvetica-Bold",
          body: "Helvetica",
          size: {
            title: 24,
            subtitle: 16,
            heading: 14,
            body: 11,
            small: 8,
          },
        },
        spacing: {
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50,
          },
          lineHeight: 1.5,
          paragraphSpacing: 1,
        },
      },
      layout: {
        sections: [
          {
            type: "header",
            height: 100,
            components: [
              { type: "logo", position: "center" },
              { type: "title", position: "center" },
              { type: "subtitle", position: "center" },
            ],
          },
          // ... other default sections
        ],
      },
      isDefault: false,
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await fetch("/api/report-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save template");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["reportTemplates"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
      });
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    saveTemplate.mutate(data);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Report Template Editor</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter template name" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter template description" />
                  </FormControl>
                </FormItem>
              )}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="theme">Theme</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="theme" className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="theme.colors.primary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <ColorPicker {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* Add other color pickers */}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="theme.fonts.header"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Font</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* Add other font settings */}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="theme.spacing.margins.top"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Top Margin</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* Add other spacing settings */}
                </div>
              </TabsContent>

              <TabsContent value="layout" className="space-y-6">
                {/* Add layout configuration UI */}
              </TabsContent>

              <TabsContent value="preview" className="space-y-6">
                {/* Add preview component */}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" type="button" onClick={() => form.reset()}>
                Reset
              </Button>
              <Button type="submit" disabled={saveTemplate.isPending}>
                {saveTemplate.isPending ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
