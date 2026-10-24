import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import DemoButton from '@/components/Auth/DemoButton';

const FEATURES = [
  {
    icon: '📓',
    title: 'Diário de Trades',
    desc: 'Registre entradas e saídas, calcule P&L automaticamente e acompanhe métricas de desempenho: Sharpe, Sortino, win rate e R:R médio.',
  },
  {
    icon: '🔬',
    title: 'Backtesting',
    desc: 'Combine RSI, MACD, Stochastic, CCI, ADX e Williams %R para testar estratégias em dados históricos com gráficos e métricas completas.',
  },
  {
    icon: '💰',
    title: 'DCA & Aportes',
    desc: 'Simule aportes periódicos e compare DCA fixo vs Lump Sum vs DCA condicional. Visualize o crescimento do patrimônio ao longo do tempo.',
  },
  {
    icon: '📉',
    title: '15 Indicadores',
    desc: 'SMA, EMA, Bollinger Bands, VWAP, RSI, MACD, ATR, Stochastic, CCI, ADX, Williams %R, OBV, Ichimoku, SAR e Pivot Points.',
  },
  {
    icon: '🔍',
    title: 'Scanner de Mercado',
    desc: 'Crie filtros com múltiplas condições de indicadores e escaneie vários tickers de uma vez para encontrar oportunidades.',
  },
  {
    icon: '🔔',
    title: 'Alertas',
    desc: 'Configure alertas automáticos para ser notificado quando um ticker atingir uma condição específica de preço ou indicador.',
  },
];

const TERMS = [
  {
    title: 'Finalidade educacional',
    text: 'O Tradelink é uma plataforma de análise e aprendizado. Todas as ferramentas, análises, backtests e simulações são disponibilizados exclusivamente para fins educacionais e informativos.',
  },
  {
    title: 'Não é recomendação de investimento',
    text: 'Nenhuma informação presente nesta plataforma constitui recomendação, consultoria ou oferta de compra ou venda de ativos financeiros. Não somos uma corretora, banco ou gestor de investimentos regulamentado.',
  },
  {
    title: 'Performance passada não garante resultados futuros',
    text: 'Resultados de backtests e simulações de DCA são baseados em dados históricos. Desempenho passado não é garantia de retorno futuro. Mercados financeiros envolvem riscos e você pode perder capital.',
  },
  {
    title: 'Responsabilidade do usuário',
    text: 'O usuário é integralmente responsável por suas decisões de investimento. Consulte um profissional habilitado (CFP, CGA ou assessor de investimentos certificado) antes de tomar qualquer decisão financeira.',
  },
  {
    title: 'Dados e disponibilidade',
    text: 'Os dados de mercado são obtidos de fontes públicas e podem conter imprecisões ou atrasos. A plataforma não garante disponibilidade contínua do serviço.',
  },
  {
    title: 'Privacidade',
    text: 'Os dados cadastrados (trades, estratégias, configurações) são armazenados de forma segura e não são compartilhados com terceiros. Você pode excluir sua conta e todos os dados a qualquer momento.',
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-white tracking-tight">Tradelink</span>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Ir para o app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-700/30 text-blue-400 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Plataforma educacional de trading
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
          Analise suas operações.<br />
          <span className="text-blue-400">Evolua como trader.</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Diário de trades, backtesting com múltiplos indicadores, simulação de DCA e scanner de
          mercado — tudo em um só lugar para estudar e aprimorar sua metodologia.
        </p>
        {!isAuthenticated && (
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <DemoButton className="px-8 py-3" />
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Começar gratuitamente
            </Link>
            <Link
              to="/login"
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold px-8 py-3 rounded-xl transition-colors text-sm border border-gray-700"
            >
              Já tenho conta
            </Link>
          </div>
        )}
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-white text-center mb-3">O que você encontra aqui</h2>
        <p className="text-gray-500 text-center text-sm mb-12">
          Ferramentas para estudar, testar e registrar — não para operar ao vivo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Disclaimer banner ────────────────────────────────────────────────── */}
      <section className="bg-amber-950/20 border-y border-amber-800/30">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-start gap-4">
          <span className="text-2xl flex-shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-amber-400 font-semibold text-sm mb-1">Aviso importante</p>
            <p className="text-amber-200/70 text-sm leading-relaxed">
              Esta plataforma é exclusivamente educacional e informativa.{' '}
              <strong className="text-amber-200">Não constitui recomendação de investimento</strong>{' '}
              e não deve ser utilizada como base única para decisões financeiras. Resultados de
              backtests e simulações são baseados em dados históricos —{' '}
              <strong className="text-amber-200">performance passada não garante retornos futuros</strong>.
              Consulte um profissional habilitado antes de investir.
            </p>
          </div>
        </div>
      </section>

      {/* ── Terms ────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20" id="termos">
        <h2 className="text-2xl font-bold text-white mb-2">Termos de uso</h2>
        <p className="text-gray-500 text-sm mb-10">
          Ao criar uma conta, você concorda com os termos abaixo. Leia com atenção.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TERMS.map((t) => (
            <div key={t.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full inline-block flex-shrink-0" />
                {t.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed pl-3">{t.text}</p>
            </div>
          ))}
        </div>

        {/* Acceptance note */}
        <div className="mt-12 bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400 mb-1">
            Ao utilizar o Tradelink, você confirma que leu e concordou com os termos acima.
          </p>
          <p className="text-xs text-gray-600">
            Este projeto é open source e de uso pessoal/educacional. Última atualização: Abril 2026.
          </p>
          {!isAuthenticated && (
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                Aceitar e criar conta
              </Link>
              <Link
                to="/login"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Já tenho conta — entrar
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© 2026 Tradelink — Plataforma educacional de análise de trading</span>
          <a
            href="https://github.com/jeffev/tradelink"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
