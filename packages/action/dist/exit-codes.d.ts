import type { ViolationResult } from './api-client';
export declare const EXIT_SUCCESS = 0;
export declare const EXIT_WARN = 1;
export declare const EXIT_BLOCK = 2;
export declare function resolveExitCode(violations: ViolationResult[], failOn: 'block' | 'warn' | 'require_approval'): number;
