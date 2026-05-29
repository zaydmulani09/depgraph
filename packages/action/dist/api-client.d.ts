export interface ViolationResult {
    packageName: string;
    action: 'block' | 'warn' | 'require_approval';
    ruleName: string;
    remediation: string;
    compositeScore: number;
}
export interface PackageRiskResult {
    name: string;
    ecosystem: string;
    compositeScore: number;
    securityScore: number;
    maintenanceScore: number;
    advisoryCount: number;
}
export interface ActionApiClient {
    evaluatePackages(packages: Array<{
        name: string;
        ecosystem: string;
        version: string;
    }>): Promise<ViolationResult[]>;
    getPackageRisk(ecosystem: string, name: string): Promise<PackageRiskResult | null>;
}
export declare function createApiClient(options: {
    apiUrl: string;
    apiKey: string;
}): ActionApiClient;
