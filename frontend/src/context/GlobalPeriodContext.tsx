import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRESETS, computeRange, shiftYear, toISO, type PresetKey } from '@/utils/periodPresets';

export interface GlobalPeriod {
    de: string;
    ate: string;
    preset: PresetKey;
    compareEnabled: boolean;
    compareDe: string;
    compareAte: string;
}

interface GlobalPeriodContextValue extends GlobalPeriod {
    setPeriod: (de: string, ate: string, preset: PresetKey) => void;
    setCompareEnabled: (v: boolean) => void;
    setComparePeriod: (de: string, ate: string) => void;
    /** Aplica período + comparação de uma vez (uma única navegação/URL). */
    applyAll: (args: { de: string; ate: string; preset: PresetKey; compareEnabled: boolean; compareDe: string; compareAte: string }) => void;
}

const GlobalPeriodContext = createContext<GlobalPeriodContextValue | null>(null);

const hoje = new Date();
const DEFAULT_RANGE = computeRange('ytd', { de: '', ate: toISO(hoje) });

/**
 * Período compartilhado entre Visão Geral, Clientes & Grupos e Inadimplência
 * (Fase 2 do redesign) — escolhido numa tela, vale nas outras até mudar.
 * Fonte de verdade é a URL (?de=&ate=&preset=&cmp=&cde=&cate=), então sobrevive
 * a F5 e pode ser compartilhada por link. Páginas fora desse grupo não usam este
 * contexto e continuam com seu próprio estado de período.
 */
export function GlobalPeriodProvider({ children }: { children: ReactNode }) {
    const [params, setParams] = useSearchParams();

    const de = params.get('de') || DEFAULT_RANGE.de;
    const ate = params.get('ate') || DEFAULT_RANGE.ate;
    const preset = (params.get('preset') as PresetKey) || 'ytd';
    const compareEnabled = params.get('cmp') === '1';
    const compareDe = params.get('cde') || shiftYear(de, -1);
    const compareAte = params.get('cate') || shiftYear(ate, -1);

    const setPeriod = useCallback((novoDe: string, novoAte: string, novoPreset: PresetKey) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('de', novoDe);
            next.set('ate', novoAte);
            next.set('preset', novoPreset);
            // Compare "auto" segue o novo período principal — a menos que o usuário
            // já tenha fixado um comparativo manual (cde/cate presentes na URL).
            if (!prev.get('cde') && !prev.get('cate')) {
                next.set('cde', shiftYear(novoDe, -1));
                next.set('cate', shiftYear(novoAte, -1));
            }
            return next;
        }, { replace: true });
    }, [setParams]);

    const setCompareEnabled = useCallback((v: boolean) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('cmp', v ? '1' : '0');
            return next;
        }, { replace: true });
    }, [setParams]);

    const setComparePeriod = useCallback((novoDe: string, novoAte: string) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('cde', novoDe);
            next.set('cate', novoAte);
            return next;
        }, { replace: true });
    }, [setParams]);

    // Combina período + comparação numa ÚNICA navegação — setSearchParams
    // chamado várias vezes seguidas no mesmo handler não compõe (cada chamada
    // parte do params "prev" anterior à anterior), então a última sobrescrevia
    // as outras. Isso foi um bug real: só a comparação ficava na URL.
    const applyAll = useCallback((args: { de: string; ate: string; preset: PresetKey; compareEnabled: boolean; compareDe: string; compareAte: string }) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('de', args.de);
            next.set('ate', args.ate);
            next.set('preset', args.preset);
            next.set('cmp', args.compareEnabled ? '1' : '0');
            next.set('cde', args.compareDe);
            next.set('cate', args.compareAte);
            return next;
        }, { replace: true });
    }, [setParams]);

    const value = useMemo<GlobalPeriodContextValue>(() => ({
        de, ate, preset, compareEnabled, compareDe, compareAte,
        setPeriod, setCompareEnabled, setComparePeriod, applyAll,
    }), [de, ate, preset, compareEnabled, compareDe, compareAte, setPeriod, setCompareEnabled, setComparePeriod, applyAll]);

    return <GlobalPeriodContext.Provider value={value}>{children}</GlobalPeriodContext.Provider>;
}

export function useGlobalPeriod() {
    const ctx = useContext(GlobalPeriodContext);
    if (!ctx) throw new Error('useGlobalPeriod precisa estar dentro de <GlobalPeriodProvider>');
    return ctx;
}

export { PRESETS };
