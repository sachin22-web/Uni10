import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type Page = {
  id: string;
  _id: string;
  name: string;
  slug: string;
  content: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

type PageForm = {
  name: string;
  slug: string;
  content: string;
  status: 'active' | 'inactive';
};

const EMPTY_FORM: PageForm = {
  name: '',
  slug: '',
  content: '',
  status: 'active',
};


export const AdminPages: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [pageForm, setPageForm] = useState<PageForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPages = async () => {
    try {
      setLoading(true);
      const res = await api('/api/admin/pages/list');
      if (!res.ok) {
        throw new Error(res.json?.message || res.json?.error || 'Failed to fetch pages');
      }
      const data = res.json?.data || [];
      setPages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch pages:', err);
      toast.error(err?.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const openCreateDialog = () => {
    setEditingPage(null);
    setPageForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (page: Page) => {
    setEditingPage(page);
    setPageForm({
      name: page.name,
      slug: page.slug,
      content: page.content,
      status: page.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pageForm.name.trim()) {
      toast.error('Page name is required');
      return;
    }

    if (!pageForm.slug.trim()) {
      toast.error('Slug is required');
      return;
    }

    try {
      setSaving(true);

      let res;
      if (editingPage) {
        res = await api(`/api/admin/pages/${editingPage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pageForm),
        });
        if (!res.ok) {
          throw new Error(res.json?.message || 'Failed to update page');
        }
        toast.success('Page updated successfully');
      } else {
        res = await api('/api/admin/pages/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pageForm),
        });
        if (!res.ok) {
          throw new Error(res.json?.message || 'Failed to create page');
        }
        toast.success('Page created successfully');
      }

      setDialogOpen(false);
      setPageForm(EMPTY_FORM);
      setEditingPage(null);
      await fetchPages();
    } catch (error: any) {
      toast.error(`Failed to save page: ${error?.message ?? 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (page: Page) => {
    const ok = confirm(`Delete page "${page.name}"?`);
    if (!ok) return;

    try {
      const res = await api(`/api/admin/pages/${page.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(res.json?.message || 'Failed to delete page');
      }
      toast.success('Page deleted successfully');
      await fetchPages();
    } catch (error: any) {
      toast.error(`Failed to delete page: ${error?.message ?? 'Unknown error'}`);
    }
  };

  const filteredPages = pages.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User–Admin Settings</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Page
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingPage ? 'Edit Page' : 'Create New Page'}</DialogTitle>
              <DialogDescription>
                {editingPage ? 'Update the page details below.' : 'Add a new page to your site.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="page-name">Page Name</Label>
                <Input
                  id="page-name"
                  type="text"
                  value={pageForm.name}
                  onChange={(e) => setPageForm({ ...pageForm, name: e.target.value })}
                  placeholder="e.g., Privacy Policy"
                />
              </div>

              <div>
                <Label htmlFor="page-slug">Slug</Label>
                <Input
                  id="page-slug"
                  type="text"
                  value={pageForm.slug}
                  onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                  placeholder="e.g., privacy-policy"
                />
              </div>

              <div>
                <Label htmlFor="page-content">Content</Label>
                <Textarea
                  id="page-content"
                  value={pageForm.content}
                  onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })}
                  placeholder="Enter page content..."
                  className="min-h-[200px]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="page-status"
                  checked={pageForm.status === 'active'}
                  onCheckedChange={(checked) =>
                    setPageForm({ ...pageForm, status: checked ? 'active' : 'inactive' })
                  }
                />
                <Label htmlFor="page-status" className="font-normal">
                  {pageForm.status === 'active' ? 'Active' : 'Inactive'}
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPage ? 'Update Page' : 'Create Page'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <Input
          type="text"
          placeholder="Search pages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card className="p-4 rounded-xl shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {pages.length === 0 ? 'No pages yet. Create one to get started!' : 'No pages match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Page Name</TableHead>
                  <TableHead className="text-xs font-medium">Slug / Path</TableHead>
                  <TableHead className="text-xs font-medium">Last Updated</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="text-sm font-medium">{page.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">/{page.slug}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          page.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {page.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(page)}
                        className="text-xs"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(page)}
                        className="text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};
