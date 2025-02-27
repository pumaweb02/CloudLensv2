import { useEffect, useRef } from 'react';
import ImageEditor from '@toast-ui/react-image-editor';
import '@toast-ui/react-image-editor/dist/toastui-react-image-editor.css';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface TuiPhotoEditorProps {
  imageUrl: string;
  onSave: (editedImageDataUrl: string) => Promise<void>;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  currentPhotoIndex?: number;
  totalPhotos?: number;
}

const theme = {
  'common.bi.image': '', // Remove default branding
  'common.bisize.width': '0',
  'common.bisize.height': '0',
  'common.backgroundColor': '#fff',
  // Theme colors matched to your app
  'common.border': '#e2e8f0',
  'downloadButton.backgroundColor': '#007bff',
  'downloadButton.borderColor': '#007bff',
  'downloadButton.color': '#fff',
};

export function TuiPhotoEditor({
  imageUrl,
  onSave,
  onNext,
  onPrev,
  canGoNext,
  canGoPrev,
  currentPhotoIndex,
  totalPhotos,
}: TuiPhotoEditorProps) {
  const editorRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load the image when imageUrl changes
    if (editorRef.current) {
      const editor = editorRef.current.getInstance();
      editor.loadImageFromURL(imageUrl, 'image').then(() => {
        // Reset zoom and position after loading
        editor.resetZoom();
      });
    }
  }, [imageUrl]);

  const handleSave = async () => {
    if (!editorRef.current) return;

    try {
      const editor = editorRef.current.getInstance();
      const dataUrl = editor.toDataURL();
      await onSave(dataUrl);
      
      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="text-sm text-muted-foreground">
          {currentPhotoIndex !== undefined && totalPhotos !== undefined && (
            `Photo ${currentPhotoIndex + 1} of ${totalPhotos}`
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 relative">
        <ImageEditor
          ref={editorRef}
          includeUI={{
            loadImage: {
              path: imageUrl,
              name: 'image',
            },
            theme: theme,
            menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'mask', 'filter'],
            initMenu: 'shape',
            uiSize: {
              width: '100%',
              height: '100%',
            },
            menuBarPosition: 'bottom',
          }}
          cssMaxHeight={800}
          cssMaxWidth={1200}
          selectionStyle={{
            cornerSize: 20,
            rotatingPointOffset: 70,
          }}
          usageStatistics={false}
        />
      </div>

      {/* Navigation Controls */}
      {(onPrev || onNext) && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-2">
          {onPrev && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          )}
          {onNext && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!canGoNext}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default TuiPhotoEditor;
