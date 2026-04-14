import { useState } from 'react';

interface IndicatorDoc {
  id: string;
  label: string;
  shortLabel: string;
  category: 'oscillator' | 'crossover' | 'volume';
  defaultEntry: string;
  defaultExit: string;
  range?: string;
  period: string;
  description: string;
  logic: string;
  tips: string[];
}

const INDICATORS: IndicatorDoc[] = [
  {
    id: 'SMA_CROSS',
    label: 'SMA — Simple Moving Average',
    shortLabel: 'SMA',
    category: 'crossover',
    defaultEntry: 'close > SMA',
    defaultExit: 'close < SMA',
    period: '20',
    description: 'Média aritmética dos fechamentos dos últimos N períodos. Sinal de cruzamento: compra quando o preço fecha acima, vende quando fecha abaixo.',
    logic: 'Close > SMA → preço acima da média, momentum de alta. Close < SMA → abaixo, momentum de baixa.',
    tips: [
      'SMA 20 = curto prazo · SMA 50 = médio · SMA 200 = longo prazo.',
      'Combine duas SMAs com períodos diferentes para um crossover clássico (ex: AND SMA 50).',
      'Em mercados laterais gera muitos falsos sinais — combine com ADX > 25.',
    ],
  },
  {
    id: 'VWAP_CROSS',
    label: 'VWAP — Volume Weighted Average Price',
    shortLabel: 'VWAP',
    category: 'crossover',
    defaultEntry: 'close > VWAP',
    defaultExit: 'close < VWAP',
    period: 'acumulado',
    description: 'Preço médio ponderado pelo volume. Referência institucional de preço justo. Cruzamento indica se o mercado opera acima ou abaixo da média negociada.',
    logic: 'Close > VWAP → compradores pagando acima da média, alta. Close < VWAP → pressão vendedora.',
    tips: [
      'Em dados diários o VWAP acumula desde o início da série — mais útil em timeframes intraday.',
      'Combine com RSI: VWAP como filtro de tendência + RSI como timing de entrada.',
    ],
  },
  {
    id: 'RSI',
    label: 'RSI — Relative Strength Index',
    shortLabel: 'RSI',
    category: 'oscillator',
    defaultEntry: '< 30',
    defaultExit: '> 70',
    range: '0 – 100',
    period: '14',
    description: 'Mede velocidade e magnitude das variações de preço. Compara ganhos e perdas médios para indicar sobrecompra ou sobrevenda.',
    logic: 'RSI < 30 → sobrevendido, sinal de compra. RSI > 70 → sobrecomprado, sinal de venda.',
    tips: [
      'Períodos curtos (9) = mais sinais e mais ruído. Longos (21+) = mais lentos e confiáveis.',
      'Em tendências fortes o RSI pode ficar sobrecomprado por muito tempo — confirme com outro indicador.',
    ],
  },
  {
    id: 'STOCH',
    label: 'Stochastic Oscillator',
    shortLabel: 'Stochastic',
    category: 'oscillator',
    defaultEntry: '< 20',
    defaultExit: '> 80',
    range: '0 – 100',
    period: 'K=14, D=3',
    description: 'Compara o fechamento com o intervalo máximo–mínimo do período. K é o oscilador principal; D é sua média móvel (linha de sinal).',
    logic: 'K < 20 → sobrevendido, compra. K > 80 → sobrecomprado, venda.',
    tips: [
      'Muito eficiente em mercados laterais; em tendências fortes gera falsos sinais.',
      'Combine com ADX: se ADX < 25, o Stochastic tende a funcionar melhor.',
    ],
  },
  {
    id: 'MACD',
    label: 'MACD — Moving Average Convergence Divergence',
    shortLabel: 'MACD',
    category: 'oscillator',
    defaultEntry: '> 0',
    defaultExit: '< 0',
    period: '12 / 26 / 9 (fixo)',
    description: 'Diferença entre EMA rápida (12) e lenta (26). A linha de sinal é a EMA(9) do MACD. O histograma mostra a distância entre elas.',
    logic: 'MACD > 0 → EMA rápida acima da lenta, momentum de alta. MACD < 0 → momentum de baixa.',
    tips: [
      'Parâmetros 12/26/9 são fixos — representam o padrão do mercado.',
      'Histograma crescente indica momentum aumentando antes do cruzamento das linhas.',
    ],
  },
  {
    id: 'CCI',
    label: 'CCI — Commodity Channel Index',
    shortLabel: 'CCI',
    category: 'oscillator',
    defaultEntry: '< -100',
    defaultExit: '> 100',
    range: 'ilimitado (tipicamente ±200)',
    period: '20',
    description: 'Mede o quanto o preço se afastou da sua média estatística. Muito volátil — valores extremos indicam movimentos fora do padrão.',
    logic: 'CCI < -100 → sobrevendido, compra. CCI > 100 → sobrecomprado, venda.',
    tips: [
      'Mais volátil que RSI — prepare-se para valores extremos em alta volatilidade.',
      'Períodos curtos (10–14) identificam ciclos de curto prazo.',
    ],
  },
  {
    id: 'ADX',
    label: 'ADX — Average Directional Index',
    shortLabel: 'ADX',
    category: 'oscillator',
    defaultEntry: '> 25',
    defaultExit: '< 20',
    range: '0 – 100',
    period: '14',
    description: 'Mede a força de uma tendência, sem indicar direção. ADX alto = tendência forte. ADX baixo = mercado lateral.',
    logic: 'ADX > 25 → tendência forte, bom para seguir o movimento. ADX < 20 → mercado lateral, evitar.',
    tips: [
      'Use como filtro: combine com RSI ou MACD para eliminar sinais em mercados sem tendência.',
      'ADX > 40 = tendência muito forte — pode ser tarde demais para entrar.',
    ],
  },
  {
    id: 'WILLIAMS_R',
    label: 'Williams %R',
    shortLabel: 'Williams %R',
    category: 'oscillator',
    defaultEntry: '< -80',
    defaultExit: '> -20',
    range: '-100 a 0',
    period: '14',
    description: 'Similar ao Stochastic, com escala invertida (-100 a 0). Mede onde o fechamento está no range do período.',
    logic: '%R < -80 → sobrevendido (próximo do mínimo), compra. > -20 → sobrecomprado, venda.',
    tips: [
      'Escala invertida: -100 é o fundo (sobrevendido), 0 é o topo (sobrecomprado).',
      'Muito responsivo — útil para timing de entradas em tendências definidas.',
    ],
  },
  {
    id: 'ATR',
    label: 'ATR — Average True Range',
    shortLabel: 'ATR',
    category: 'oscillator',
    defaultEntry: '> 1',
    defaultExit: '< 0.5',
    period: '14',
    description: 'Mede a volatilidade média do ativo em valor absoluto ($). Não indica direção — apenas o tamanho médio dos movimentos.',
    logic: 'ATR alto → alta volatilidade, movimentos maiores. Use para filtrar entradas: só operar com volatilidade suficiente.',
    tips: [
      'O valor depende do preço do ativo: ATR $1 é relevante para $10, mas irrelevante para $500.',
      'Use como múltiplo para stop loss: stop = entrada − (2 × ATR).',
    ],
  },
  {
    id: 'OBV',
    label: 'OBV — On-Balance Volume',
    shortLabel: 'OBV',
    category: 'volume',
    defaultEntry: '> 0',
    defaultExit: '< 0',
    period: 'acumulado',
    description: 'Acumula volume nos dias de alta e subtrai nos dias de baixa. Indica se o volume confirma ou diverge da tendência de preço.',
    logic: 'OBV crescente com preço crescente → confirmação de alta. OBV caindo com preço subindo → divergência bearish.',
    tips: [
      'Mais útil para detectar divergências do que sinais absolutos.',
      'Use como confirmação secundária — combine com RSI ou MACD como gatilho principal.',
    ],
  },
  {
    id: 'BBPCTB',
    label: 'BB %B — Bollinger Band Percent B',
    shortLabel: 'BB %B',
    category: 'oscillator',
    defaultEntry: '< 0.2',
    defaultExit: '> 0.8',
    range: '0 – 1 (pode ultrapassar)',
    period: '20',
    description: 'Onde o preço está dentro das Bandas de Bollinger. 0 = banda inferior, 0.5 = média, 1 = banda superior.',
    logic: '%B < 0.2 → próximo ou abaixo da banda inferior, sobrevendido. %B > 0.8 → próximo da banda superior, sobrecomprado.',
    tips: [
      'Diferente do RSI, reflete volatilidade: bandas largas = limites mais distantes do preço médio.',
      '%B < 0 significa que o preço está abaixo da banda inferior — movimento extremo.',
    ],
  },
];

const CATEGORY_CONFIG = {
  crossover:  { label: 'Cruzamento de Linha', color: 'text-amber-400',  dot: 'bg-amber-400' },
  oscillator: { label: 'Osciladores',          color: 'text-purple-400', dot: 'bg-purple-400' },
  volume:     { label: 'Volume',               color: 'text-green-400',  dot: 'bg-green-400' },
};

const COMBOS = [
  { title: 'Tendência + Momentum',   combo: 'SMA AND RSI',     desc: 'Só compra quando o preço está acima da SMA e o RSI indica sobrevendido. Reduz operações contra a tendência.' },
  { title: 'Força + Volatilidade',   combo: 'ADX AND BB %B',   desc: 'ADX > 25 confirma tendência; %B < 0.2 busca entradas na banda inferior. Evita comprar em mercados laterais.' },
  { title: 'Volume + Momentum',      combo: 'OBV AND MACD',    desc: 'OBV confirma que o volume apoia o movimento; MACD > 0 confirma o momentum. Dois fatores independentes.' },
  { title: 'Dupla Confirmação',      combo: 'RSI AND Stoch',   desc: 'Ambos sobrevendidos ao mesmo tempo. Sinal mais raro mas com maior probabilidade de reversão.' },
];

function IndicatorRow({ ind }: { ind: IndicatorDoc }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_CONFIG[ind.category];

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      {/* Summary row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cat.dot}`} />
        <span className="text-sm font-semibold text-gray-200 flex-1">{ind.label}</span>

        {/* Badges always visible */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono flex-shrink-0">
          {ind.range && (
            <span className="text-gray-600">{ind.range}</span>
          )}
          <span className="bg-green-950/40 border border-green-800/40 text-green-400 px-2 py-0.5 rounded">
            {ind.defaultEntry}
          </span>
          <span className="bg-red-950/40 border border-red-800/40 text-red-400 px-2 py-0.5 rounded">
            {ind.defaultExit}
          </span>
          <span className="text-gray-600 border border-gray-700 px-2 py-0.5 rounded">p={ind.period}</span>
        </div>

        <span className={`text-gray-600 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-3 bg-gray-900/50">
          <p className="text-sm text-gray-400 leading-relaxed">{ind.description}</p>

          <div className="bg-gray-800/60 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1">Lógica no backtest</p>
            <p className="text-sm text-gray-300">{ind.logic}</p>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1.5">Dicas</p>
            <ul className="space-y-1">
              {ind.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">›</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IndicatorHelp() {
  const categories = ['crossover', 'oscillator', 'volume'] as const;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Guia de Indicadores</h1>
        <p className="text-sm text-gray-400 mt-1">
          Clique em um indicador para ver detalhes, lógica de backtest e dicas de uso.
        </p>
      </div>

      {/* Intro */}
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg px-4 py-3 text-sm text-blue-200/80 leading-relaxed">
        <span className="font-semibold text-blue-300">Como funciona: </span>
        selecione indicadores e configure entrada/saída. Com{' '}
        <span className="font-mono text-blue-300">AND</span> todas as condições precisam ser verdadeiras;
        com <span className="font-mono text-blue-300">OR</span> basta uma.
        O backtest verifica cada candle e executa quando a condição é atendida.
      </div>

      {/* Indicators by category */}
      {categories.map((cat) => {
        const items = INDICATORS.filter((i) => i.category === cat);
        const cfg = CATEGORY_CONFIG[cat];
        return (
          <section key={cat} className="space-y-1.5">
            <h2 className={`text-xs font-semibold uppercase tracking-widest ${cfg.color} mb-2`}>
              {cfg.label}
            </h2>
            {items.map((ind) => <IndicatorRow key={ind.id} ind={ind} />)}
          </section>
        );
      })}

      {/* Combinations */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Combinações sugeridas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMBOS.map((c) => (
            <div key={c.title} className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-200">{c.title}</span>
                <code className="text-[11px] bg-gray-800 border border-gray-700 text-blue-300 px-2 py-0.5 rounded font-mono flex-shrink-0">
                  {c.combo}
                </code>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
