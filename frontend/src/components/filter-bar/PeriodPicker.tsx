import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PRESETS, computeRange, toISO, type PresetKey } from '@/utils/periodPresets';

const parseISO = (iso: string) => new Date(`${iso}T00:00:00`);

const fmtShort = (iso: string) =>
    parseISO(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
const fmtShortYear = (iso: string) =>
    parseISO(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

export interface PeriodApplyArgs {
    de: string;
    ate: string;
    preset: PresetKey;
    compareEnabled: boolean;
    compareDe: string;
    compareAte: string;
}

interface PeriodPickerProps {
    de: string;
    ate: string;
    preset: PresetKey;
    compareEnabled: boolean;
    compareDe: string;
    compareAte: string;
    onApply: (args: PeriodApplyArgs) => void;
}

/** Botão único que abre o seletor de período: atalhos + calendário de 2 meses + comparação + Aplicar. */
export function PeriodPicker({
    de, ate, preset, compareEnabled, compareDe, compareAte, onApply,
}: PeriodPickerProps) {
    const [open, setOpen] = useState(false);
    const [pendingRange, setPendingRange] = useState<DateRange | undefined>({ from: parseISO(de), to: parseISO(ate) });
    const [pendingPreset, setPendingPreset] = useState<PresetKey>(preset);
    const [pendingCompare, setPendingCompare] = useState(compareEnabled);
    const [pendingCompareRange, setPendingCompareRange] = useState<DateRange | undefined>({
        from: parseISO(compareDe), to: parseISO(compareAte),
    });

    const handleOpenChange = (next: boolean) => {
        if (next) {
            // Reseta o estado pendente pro valor já aplicado toda vez que reabre.
            setPendingRange({ from: parseISO(de), to: parseISO(ate) });
            setPendingPreset(preset);
            setPendingCompare(compareEnabled);
            setPendingCompareRange({ from: parseISO(compareDe), to: parseISO(compareAte) });
        }
        setOpen(next);
    };

    const handleShortcut = (key: PresetKey) => {
        const range = computeRange(key, { de, ate });
        setPendingPreset(key);
        setPendingRange({ from: parseISO(range.de), to: parseISO(range.ate) });
    };

    const handleCalendarSelect = (range: DateRange | undefined) => {
        setPendingPreset('custom');
        setPendingRange(range);
    };

    const handleApply = () => {
        if (!pendingRange?.from) return;
        const novoDe = toISO(pendingRange.from);
        const novoAte = toISO(pendingRange.to || pendingRange.from);
        onApply({
            de: novoDe,
            ate: novoAte,
            preset: pendingPreset,
            compareEnabled: pendingCompare,
            compareDe: pendingCompareRange?.from ? toISO(pendingCompareRange.from) : compareDe,
            compareAte: pendingCompareRange?.from ? toISO(pendingCompareRange.to || pendingCompareRange.from) : compareAte,
        });
        setOpen(false);
    };

    const label = de === ate
        ? fmtShortYear(de)
        : `${fmtShort(de)} – ${fmtShortYear(ate)}`;

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-sm font-semibold">
                    <CalendarRange size={16} className="text-muted" />
                    {label}
                    {compareEnabled && (
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">
                            vs {fmtShort(compareDe)}
                        </span>
                    )}
                    <ChevronDown size={14} className="text-subtle" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col sm:flex-row">
                    {/* Atalhos */}
                    <div className="flex shrink-0 flex-col gap-0.5 border-b border-border p-2 sm:w-44 sm:border-b-0 sm:border-r">
                        {PRESETS.filter(p => p.key !== 'custom').map(p => (
                            <button
                                key={p.key}
                                onClick={() => handleShortcut(p.key)}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors',
                                    pendingPreset === p.key
                                        ? 'bg-primary-light text-primary'
                                        : 'text-muted hover:bg-surface-hover hover:text-foreground',
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Calendário */}
                    <div className="p-2">
                        <Calendar
                            mode="range"
                            numberOfMonths={2}
                            selected={pendingRange}
                            onSelect={handleCalendarSelect}
                            defaultMonth={pendingRange?.from}
                        />
                    </div>
                </div>

                {/* Comparar com período anterior */}
                <div className="border-t border-border p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                        <Checkbox checked={pendingCompare} onCheckedChange={v => setPendingCompare(v === true)} />
                        Comparar com período anterior
                    </label>
                    {pendingCompare && (
                        <div className="mt-2 pl-6">
                            <Calendar
                                mode="range"
                                numberOfMonths={1}
                                selected={pendingCompareRange}
                                onSelect={setPendingCompareRange}
                                defaultMonth={pendingCompareRange?.from}
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-border p-3">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleApply} disabled={!pendingRange?.from}>Aplicar</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
