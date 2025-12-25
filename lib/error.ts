export class KnownError extends Error {
    constructor(public code: number, public message: string) {
        super();
    }
}