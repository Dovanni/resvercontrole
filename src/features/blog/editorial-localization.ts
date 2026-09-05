import type { BlogPostStatus } from "./types";

const EDITORIAL_ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  editor: "Editor",
  author: "Autor",
  reviewer: "Revisor",
};

const BLOG_POST_STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

export function editorialRoleLabel(role: string) {
  return EDITORIAL_ROLE_LABELS[role] ?? role;
}

export function blogPostStatusLabel(status: BlogPostStatus) {
  return BLOG_POST_STATUS_LABELS[status];
}

export function workflowStatusLabel(status: BlogPostStatus | null) {
  return status ? blogPostStatusLabel(status) : "Início";
}

export function revisionLabel(revisionNumber: number) {
  return `revisão ${revisionNumber}`;
}
