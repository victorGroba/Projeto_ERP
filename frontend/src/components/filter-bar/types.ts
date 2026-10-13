export interface FacetOption {
    value: string;
    label: string;
}

export interface FacetConfig {
    key: string;
    label: string;
    options: FacetOption[];
    selected: string[];
    onChange: (values: string[]) => void;
}
