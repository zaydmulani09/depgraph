export interface ParsedDependency {
    name: string;
    versionRange: string;
    isDev: boolean;
}
export interface ParsedManifest {
    ecosystem: 'npm' | 'pypi' | 'cargo';
    dependencies: ParsedDependency[];
    rawContent: string;
}
export declare function parseManifest(filePath: string, ecosystem: 'npm' | 'pypi' | 'cargo'): Promise<ParsedManifest>;
