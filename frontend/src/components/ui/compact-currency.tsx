import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip';
import { formatCurrencyCompact, formatCurrencyFull } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CompactCurrencyProps {
    value: number;
    className?: string;
}

/** KPI em destaque: mostra o valor compacto ("R$ 8,67 mi") e o valor exato no tooltip ao hover. */
function CompactCurrency({ value, className }: CompactCurrencyProps) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={cn('tabular-nums cursor-default', className)}>
                        {formatCurrencyCompact(value)}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{formatCurrencyFull(value)}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export { CompactCurrency };
