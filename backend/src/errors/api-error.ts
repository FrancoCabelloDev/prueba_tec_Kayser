export type ValidationFields = Record<string, string[]>;

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields?: ValidationFields;

  constructor(statusCode: number, code: string, message: string, fields?: ValidationFields) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (fields) this.fields = fields;
  }
}
