export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function message(error: unknown) {
  return error instanceof AppError ? error.message : 'Something went wrong. Please try again.';
}
