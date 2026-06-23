"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { DocumentMetadata } from "@/lib/kb/ingest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocumentMetadata["status"] }) {
  if (status === "ready") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="size-3" />
        Ready
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3 animate-spin" />
        Processing
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="size-3" />
      Error
    </Badge>
  );
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────

function DropZone({
  onFiles,
  uploading,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf",
      );
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={uploading ? -1 : 0}
      aria-label="Upload PDF documents"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer select-none
        ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}
        ${uploading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="size-8 text-primary animate-spin" />
      ) : (
        <Upload className="size-8 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-medium text-foreground">
          {uploading ? "Uploading…" : "Drop PDFs here or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF only · max 20 MB per file
        </p>
      </div>
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onDelete,
  deleting,
}: {
  doc: DocumentMetadata;
  onDelete: (docId: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {doc.fileName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.chunkCount > 0 ? `${doc.chunkCount} chunks · ` : ""}
            {timeAgo(doc.uploadedAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={doc.status} />
        <button
          onClick={() => onDelete(doc.docId)}
          disabled={deleting || doc.status === "processing"}
          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Delete document"
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function KnowledgeBaseTab({ agentKey }: { agentKey: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentKey}/documents`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      toast({ message: "Failed to load documents.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [agentKey, toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploading(true);
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`/api/agents/${agentKey}/documents`, {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? "Upload failed");
          }
          return res.json() as Promise<DocumentMetadata>;
        }),
      );

      let successCount = 0;
      for (const r of results) {
        if (r.status === "fulfilled") {
          successCount++;
          setDocs((prev) => [r.value, ...prev]);
        } else {
          toast({
            message: r.reason?.message ?? "Failed to upload a file.",
            variant: "error",
          });
        }
      }

      if (successCount > 0) {
        toast({
          message: `${successCount} file${successCount > 1 ? "s" : ""} uploaded and indexed.`,
          variant: "success",
        });
      }
      setUploading(false);
    },
    [agentKey, toast],
  );

  const handleDelete = useCallback(
    async (docId: string) => {
      setDeletingId(docId);
      try {
        const res = await fetch(`/api/agents/${agentKey}/documents/${docId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
        setDocs((prev) => prev.filter((d) => d.docId !== docId));
        toast({ message: "Document deleted.", variant: "success" });
      } catch {
        toast({ message: "Failed to delete document.", variant: "error" });
      } finally {
        setDeletingId(null);
      }
    },
    [agentKey, toast],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Knowledge base
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Upload PDFs your agent can reference during calls — property listings,
          menus, inventory sheets, fact sheets, and more.
        </p>
      </div>

      <DropZone onFiles={handleUpload} uploading={uploading} />

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Indexed documents
          </h3>
          {docs.length > 0 && <Badge variant="secondary">{docs.length}</Badge>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No documents yet"
            description="Upload a PDF above to give your agent knowledge to reference."
          />
        ) : (
          <div className="divide-y divide-border">
            {docs.map((doc) => (
              <DocumentRow
                key={doc.docId}
                doc={doc}
                onDelete={handleDelete}
                deleting={deletingId === doc.docId}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
