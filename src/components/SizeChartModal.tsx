import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";

interface SizeChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  chartUrl?: string;
}

export const SizeChartModal = ({ open, onOpenChange, title, chartUrl }: SizeChartModalProps) => {
  if (!chartUrl) return null;

  const isPdf = chartUrl.toLowerCase().endsWith('.pdf');
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Size Chart"}</DialogTitle>
          <DialogDescription>
            {isPdf ? "Size chart (PDF)" : "Size chart (Image)"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-6">
          {isPdf ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-muted-foreground">PDF size charts are best viewed in full size.</p>
              <Button asChild>
                <a href={chartUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open PDF
                </a>
              </Button>
            </div>
          ) : (
            <img
              src={chartUrl}
              alt={title || "Size Chart"}
              className="max-w-full max-h-[60vh] object-contain rounded-md"
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
