export class StudioError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
