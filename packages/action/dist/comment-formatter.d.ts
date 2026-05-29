import type { ViolationResult } from './api-client';
export interface ActionSummary {
    ecosystem: string;
    manifestPath: string;
    totalPackagesScanned: number;
    blockCount: number;
    warnCount: number;
    approvalCount: number;
    passCount: number;
    runUrl: string;
}
export declare function formatPRComment(violations: ViolationResult[], summary: ActionSummary): string;
