export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new HttpError(400, message, details);
}

export function unauthorized(message = "Unauthorized") {
  return new HttpError(401, message);
}

export function forbidden(message = "Forbidden", details?: unknown) {
  return new HttpError(403, message, details);
}

export function notFound(message = "Not found") {
  return new HttpError(404, message);
}

export function conflict(message: string, details?: unknown) {
  return new HttpError(409, message, details);
}

export function unprocessable(message: string, details?: unknown) {
  return new HttpError(422, message, details);
}

export interface ConnectorRequiredDetails {
  code: "CONNECTOR_REQUIRED";
  connectorSlug: string;
  connectorLabel: string | null;
  connectFlowUrl: string;
}

export function connectorRequired(slug: string, label?: string | null) {
  const details: ConnectorRequiredDetails = {
    code: "CONNECTOR_REQUIRED",
    connectorSlug: slug,
    connectorLabel: label ?? null,
    connectFlowUrl: `/settings/accounts?focus=${encodeURIComponent(slug)}`,
  };
  return new HttpError(
    412,
    `Connecteur "${slug}" requis pour cette action — l'utilisateur doit lier son compte.`,
    details,
  );
}
