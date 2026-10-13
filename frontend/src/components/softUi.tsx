import React, { useEffect, useRef, useState } from 'react';

// ── Primitivas visuais compartilhadas do redesign "soft UI" (piloto aprovado
// na Visão Geral, propagado pro resto do sistema). Sem libs novas — só
// requestAnimationFrame e as animações nativas do recharts. ──────────────────

export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const handler = () => setReduced(mq.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return reduced;
}

export function useCountUp(target: number, durationMs: number, reduced: boolean) {
    const [value, setValue] = useState(0);
    const prevRef = useRef(0);
    useEffect(() => {
        if (reduced || !Number.isFinite(target)) {
            setValue(target);
            prevRef.current = target;
            return;
        }
        const start = prevRef.current;
        const startTime = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - startTime) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(start + (target - start) * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
            else prevRef.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, durationMs, reduced]);
    return value;
}

export const initials = (nome: string) =>
    nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/** Anel de progresso circular — bloco de destaque escuro (dark ring block). */
export const Ring: React.FC<{ pct: number; size?: number; reduced: boolean; color?: string }> = ({ pct, size = 92, reduced, color = '#3e93a0' }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);
    const stroke = 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, pct));
    const offset = c - ((mounted ? clamped : 0) / 100) * c;
    return (
        <div className="su-ring-wrap" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                    style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }}
                />
            </svg>
            <span className="su-ring-pct">{clamped.toFixed(0)}%</span>
        </div>
    );
};

/** Dot customizado pra curvas recharts: só o último ponto ganha destaque. */
export const LastPointDot = (lastIndex: number) => (props: any) => {
    const { cx, cy, index } = props;
    if (index !== lastIndex) return <g key={index} />;
    return (
        <g key={index}>
            <circle cx={cx} cy={cy} r={5} fill="#fff" stroke="#0b6b76" strokeWidth={3} />
        </g>
    );
};
