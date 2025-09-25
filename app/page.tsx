export default function HomePage() {
  return (
    <div className="bg-gray-900 text-gray-200">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
              <div className="text-2xl font-bold text-white">
                <a href="/">Revenue<span className="text-blue-400">Sentry</span></a>
              </div>
              <nav className="hidden md:flex items-center space-x-6">
                  <a href="#features" className="text-gray-300 hover:text-white transition">Funzionalità</a>
                  <a href="#pricing" className="text-gray-300 hover:text-white transition">Prezzi</a>
              </nav>
              <div className="flex items-center space-x-4">
                 <a href="/login" className="hidden sm:block bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition">
                    Accedi
                  </a>
                   <a href="/register" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition">
                      Inizia Ora
                  </a>
              </div>
          </div>
      </header>

      {/* Main Content */}
      <main className="pt-24">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-16 md:py-24 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4">
                Prendi il <span className="gradient-text">Controllo Scientifico</span><br/>dei Ricavi del Tuo Hotel
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-8">
                Smetti di navigare a vista. Con RevenueSentry hai tutti i parametri necessari per ottimizzare i costi e massimizzare i profitti in modo professionale.
            </p>
            <a href="/register" className="shiny-button inline-block text-white font-bold py-3 px-8 rounded-lg text-lg transition">
                Inizia la Prova Gratuita
            </a>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-6 py-16">
            <h2 className="text-3xl font-bold text-center text-white mb-12">Una Dashboard Potente e Intuitiva</h2>
            <div className="grid md:grid-cols-3 gap-8">
                {/* Card 1 */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                    <div className="text-blue-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-labelledby="cost-icon-title">
                            <title id="cost-icon-title">Icona di analisi dei costi</title>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zM15 17v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"/>
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Analisi dei Costi</h3>
                    <p className="text-gray-400">Traccia ogni spesa, dal food & beverage alle utenze. Identifica le aree di spreco e ottimizza il tuo budget con precisione chirurgica.</p>
                </div>
                {/* Card 2 */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                    <div className="text-blue-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-labelledby="kpi-icon-title">
                            <title id="kpi-icon-title">Icona di un grafico KPI</title>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">KPI Fondamentali</h3>
                    <p className="text-gray-400">Tieni sotto controllo i Key Performance Indicators (KPI) più importanti: RevPAR, ADR, Tasso di Occupazione e molto altro, tutto in un unico posto.</p>
                </div>
                {/* Card 3 */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                    <div className="text-blue-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-labelledby="report-icon-title">
                            <title id="report-icon-title">Icona di un report a barre</title>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Report Automatici</h3>
                    <p className="text-gray-400">Genera report professionali e facili da leggere con un click. Condividi i dati con il tuo team e prendi decisioni basate su informazioni concrete.</p>
                </div>
            </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="container mx-auto px-6 py-16">
            <h2 className="text-3xl font-bold text-center text-white mb-12">Un Piano per Ogni Esigenza</h2>
            <div className="flex flex-col md:flex-row justify-center items-center gap-8">
                <div className="w-full max-w-sm bg-gray-800/50 border-2 border-blue-500 rounded-2xl p-8 text-center shadow-2xl shadow-blue-500/10">
                    <h3 className="text-2xl font-bold text-white mb-2">PRO</h3>
                    <p className="text-gray-400 mb-6">Per hotel indipendenti e strutture che vogliono crescere.</p>
                    <p className="text-5xl font-extrabold text-white mb-6">€49 <span className="text-lg font-medium text-gray-400">/mese</span></p>
                    <ul className="text-left space-y-3 text-gray-300 mb-8">
                        <li className="flex items-center"><svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Dashboard Completa</li>
                        <li className="flex items-center"><svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Analisi Costi Illimitata</li>
                        <li className="flex items-center"><svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Report Settimanali</li>
                        <li className="flex items-center"><svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Supporto via Email</li>
                    </ul>
                    <a href="/register" className="w-full inline-block shiny-button text-white font-bold py-3 px-8 rounded-lg text-base transition text-center">
                        Inizia Ora
                    </a>
                </div>
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="container mx-auto px-6 py-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} RevenueSentry.com - Tutti i diritti riservati.</p>
        </div>
    </footer>
    </div>
  );
}

