import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChipProps {
    label: React.ReactNode;
    onRemove?: () => void;
    className?: string;
}

/** Filtro aplicado, removível — usado na FilterBar (ex: "Grupo: Sodexo ×"). */
function Chip({ label, onRemove, className }: ChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface py-1 pl-3 text-xs font-semibold text-foreground',
                onRemove ? 'pr-1.5' : 'pr-3',
                className,
            )}
        >
            {label}
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-full p-0.5 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
                    aria-label="Remover filtro"
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
}

export { Chip };
