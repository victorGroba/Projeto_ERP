import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps;

/** Calendário de intervalo reestilizado em Tailwind (react-day-picker v10, sem CSS próprio). */
function Calendar({ className, ...props }: CalendarProps) {
    return (
        <DayPicker
            locale={ptBR}
            showOutsideDays
            className={cn('p-3', className)}
            classNames={{
                months: 'flex flex-col sm:flex-row gap-4',
                month: 'space-y-3',
                month_caption: 'flex justify-center items-center h-8 relative',
                caption_label: 'text-sm font-semibold text-foreground',
                nav: 'flex items-center gap-1 absolute inset-x-0 justify-between px-1',
                button_previous: cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded-md border border-border-strong text-muted',
                    'hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-30',
                ),
                button_next: cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded-md border border-border-strong text-muted',
                    'hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-30',
                ),
                month_grid: 'w-full border-collapse',
                weekdays: 'flex',
                weekday: 'text-subtle w-9 text-[0.75rem] font-semibold',
                weeks: '',
                week: 'flex w-full mt-1',
                day: 'relative h-9 w-9 text-center text-sm p-0 focus-within:relative focus-within:z-20',
                day_button: cn(
                    'h-9 w-9 inline-flex items-center justify-center rounded-md font-medium text-foreground transition-colors',
                    'hover:bg-primary-light',
                ),
                range_start: '[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary rounded-l-md bg-primary-light',
                range_end: '[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary rounded-r-md bg-primary-light',
                range_middle: 'bg-primary-light [&>button]:rounded-none [&>button]:hover:bg-primary-light',
                selected: '',
                today: '[&>button]:border [&>button]:border-primary',
                outside: 'text-subtle opacity-50',
                disabled: 'text-subtle opacity-30',
                hidden: 'invisible',
            }}
            components={{
                Chevron: ({ orientation }) =>
                    orientation === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />,
            }}
            {...props}
        />
    );
}

export { Calendar };
