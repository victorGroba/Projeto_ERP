import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { FacetConfig } from './types';

/** "+ Filtro": combobox pesquisável com multisseleção (ex: grupo econômico). */
export function FacetFilter({ facet }: { facet: FacetConfig }) {
    const toggle = (value: string) => {
        const next = facet.selected.includes(value)
            ? facet.selected.filter(v => v !== value)
            : [...facet.selected, value];
        facet.onChange(next);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 gap-1.5 text-sm font-semibold">
                    <Plus size={15} />
                    {facet.label}
                    {facet.selected.length > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                            {facet.selected.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Buscar ${facet.label.toLowerCase()}...`} />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        <CommandGroup>
                            {facet.options.map(opt => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.label}
                                    onSelect={() => toggle(opt.value)}
                                >
                                    <Checkbox checked={facet.selected.includes(opt.value)} className="pointer-events-none" />
                                    <span className="truncate">{opt.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
