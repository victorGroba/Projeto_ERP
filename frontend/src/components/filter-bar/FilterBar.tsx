import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PresetKey } from '@/utils/periodPresets';
import { PeriodPicker, type PeriodApplyArgs } from './PeriodPicker';
import { FacetFilter } from './FacetFilter';
import { useIsMobile } from './useIsMobile';
import type { FacetConfig } from './types';

export interface FilterBarTab {
    key: string;
    label: string;
    count?: number;
}

interface FilterBarProps {
    de: string;
    ate: string;
    preset: PresetKey;
    compareEnabled: boolean;
    compareDe: string;
    compareAte: string;
    onPeriodApply: (args: PeriodApplyArgs) => void;
    facets?: FacetConfig[];
    tabs?: FilterBarTab[];
    activeTab?: string;
    onTabChange?: (key: string) => void;
    sticky?: boolean;
    className?: string;
}

/**
 * Barra de filtros global (Fase 2) — seletor de período em popover + facetas
 * multisseleção em chips, sem nenhum controle nativo do navegador. Usada em
 * Visão Geral, Clientes & Grupos e Inadimplência; o período fica sincronizado
 * entre as três via GlobalPeriodContext (ver context/GlobalPeriodContext.tsx).
 */
export function FilterBar({
    de, ate, preset, compareEnabled, compareDe, compareAte,
    onPeriodApply,
    facets = [], tabs, activeTab, onTabChange, sticky = true, className,
}: FilterBarProps) {
    const isMobile = useIsMobile();
    const [sheetOpen, setSheetOpen] = useState(false);

    const activeFacetCount = facets.reduce((n, f) => n + f.selected.length, 0);
    const hasAnyFilter = activeFacetCount > 0;

    const chips = facets.flatMap(f =>
        f.selected.map(value => {
            const opt = f.options.find(o => o.value === value);
            return { facetKey: f.key, value, label: opt?.label || value, onRemove: () => f.onChange(f.selected.filter(v => v !== value)) };
        }),
    );

    const clearAll = () => facets.forEach(f => f.selected.length && f.onChange([]));

    const periodAndFacets = (
        <>
            <PeriodPicker
                de={de} ate={ate} preset={preset}
                compareEnabled={compareEnabled} compareDe={compareDe} compareAte={compareAte}
                onApply={onPeriodApply}
            />
            {facets.map(f => <FacetFilter key={f.key} facet={f} />)}
        </>
    );

    if (isMobile) {
        return (
            <div className={cn('flex items-center gap-2', className)}>
                <Button variant="outline" className="h-9 gap-2 text-sm font-semibold" onClick={() => setSheetOpen(true)}>
                    <SlidersHorizontal size={16} />
                    Filtros
                    {hasAnyFilter && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                            {activeFacetCount}
                        </span>
                    )}
                </Button>
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>Filtros</SheetTitle>
                        </SheetHeader>
                        <div className="flex flex-col gap-3 pt-2">
                            {periodAndFacets}
                            {chips.length > 0 && (
                                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                                    {chips.map(c => (
                                        <Chip key={`${c.facetKey}-${c.value}`} label={c.label} onRemove={c.onRemove} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        );
    }

    return (
        <div className={cn(sticky && 'sticky top-0 z-30 -mx-6 bg-surface/95 px-6 backdrop-blur', className)}>
            <div className="flex flex-wrap items-center gap-2 py-2">
                {periodAndFacets}
            </div>

            {tabs && tabs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-2">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => onTabChange?.(t.key)}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                                activeTab === t.key
                                    ? 'bg-primary text-white'
                                    : 'bg-background text-muted hover:text-foreground',
                            )}
                        >
                            {t.label}
                            {t.count !== undefined && (
                                <span className={cn('rounded-full px-1.5 text-[0.6875rem]', activeTab === t.key ? 'bg-white/20' : 'bg-surface-hover')}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pb-2.5">
                    {chips.map(c => (
                        <Chip key={`${c.facetKey}-${c.value}`} label={c.label} onRemove={c.onRemove} />
                    ))}
                    <button
                        onClick={clearAll}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground"
                    >
                        <X size={12} /> Limpar tudo
                    </button>
                </div>
            )}
        </div>
    );
}
