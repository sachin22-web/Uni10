import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { escapeHtml } from "@/lib/utils";

interface SizeChartRow {
  sizeLabel: string;
  chest: string;
  brandSize: string;
}

interface SizeChartTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  rows?: SizeChartRow[];
  guidelines?: string;
  diagramUrl?: string;
}

export const SizeChartTableModal = ({ 
  open, 
  onOpenChange, 
  title, 
  rows, 
  guidelines, 
  diagramUrl 
}: SizeChartTableModalProps) => {
  if (!rows || rows.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Size Chart"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Size Chart Table */}
          {rows && rows.length > 0 && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Size</th>
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Chest</th>
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Brand Size</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-4 py-3 text-foreground">{row.sizeLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.chest}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.brandSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Measurement Guidelines */}
          {guidelines && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Measurement Guidelines</h3>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {escapeHtml(guidelines)}
              </div>
            </div>
          )}

          {/* Diagram Image */}
          {diagramUrl && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Measurement Diagram</h3>
              <div className="flex items-center justify-center py-4">
                <img
                  src={diagramUrl}
                  alt="Size chart diagram"
                  className="max-w-full max-h-[40vh] object-contain rounded-md"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
