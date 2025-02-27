import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export type MapSettings = {
  defaultViewMode: "map" | "list"
  defaultZoom: number
  enableTerrainView: boolean
  enableSatelliteView: boolean
  darkModeMap: boolean
}

interface SettingsDialogProps {
  settings: MapSettings
  onSave: (settings: MapSettings) => void
  onClose?: () => void
}

export const DEFAULT_SETTINGS: MapSettings = {
  defaultViewMode: "list",
  defaultZoom: 12,
  enableTerrainView: false,
  enableSatelliteView: false,
  darkModeMap: false,
};

export function SettingsDialog({
  settings,
  onSave,
  onClose,
}: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<MapSettings>(settings)
  const [isOpen, setIsOpen] = useState(true)

  const handleSave = () => {
    onSave(localSettings)
    setIsOpen(false)
    onClose?.()
  }

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-[425px]"
        onEscapeKeyDown={handleClose}
        onInteractOutside={handleClose}
        role="dialog"
        aria-labelledby="settings-dialog-title"
      >
        <DialogHeader>
          <DialogTitle id="settings-dialog-title">Map Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="defaultViewMode">Default View Mode</Label>
            <Select
              value={localSettings.defaultViewMode}
              onValueChange={(value: "map" | "list") =>
                setLocalSettings({ ...localSettings, defaultViewMode: value })
              }
              aria-label="Select default view mode"
            >
              <SelectTrigger id="defaultViewMode">
                <SelectValue placeholder="Select view mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="map">Map View</SelectItem>
                <SelectItem value="list">List View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="defaultZoom">Default Zoom Level</Label>
            <div className="flex items-center gap-4">
              <Slider
                id="defaultZoom"
                min={1}
                max={20}
                step={1}
                value={[localSettings.defaultZoom]}
                onValueChange={([value]) =>
                  setLocalSettings({ ...localSettings, defaultZoom: value })
                }
                aria-label="Adjust default zoom level"
              />
              <span className="w-12 text-sm" aria-live="polite">
                {localSettings.defaultZoom}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="terrainView" className="flex-grow">
              Enable Terrain View
            </Label>
            <Switch
              id="terrainView"
              checked={localSettings.enableTerrainView}
              onCheckedChange={(checked) =>
                setLocalSettings({ ...localSettings, enableTerrainView: checked })
              }
              aria-label="Toggle terrain view"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="satelliteView" className="flex-grow">
              Enable Satellite View
            </Label>
            <Switch
              id="satelliteView"
              checked={localSettings.enableSatelliteView}
              onCheckedChange={(checked) =>
                setLocalSettings({ ...localSettings, enableSatelliteView: checked })
              }
              aria-label="Toggle satellite view"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="darkModeMap" className="flex-grow">
              Dark Mode Map
            </Label>
            <Switch
              id="darkModeMap"
              checked={localSettings.darkModeMap}
              onCheckedChange={(checked) =>
                setLocalSettings({ ...localSettings, darkModeMap: checked })
              }
              aria-label="Toggle dark mode map"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            aria-label="Cancel changes"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            aria-label="Save changes"
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}