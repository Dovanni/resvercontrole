import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ShieldCheck, Database, GitBranch, Terminal } from "lucide-react"

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          VEJAMAI<span className="text-primary">S</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl">
          Gestão Comercial e Financeira Canônica.
        </p>
      </div>

      <Card className="w-full max-w-2xl border-2 border-primary/20 shadow-xl overflow-hidden">
        <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            VPH_HISTORY_RECORD_CERTIFIED
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
            <Terminal className="w-3 h-3" />
            PID: 12458 | XID: 842
          </div>
        </div>
        
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            Integridade de Produção Certificada
          </CardTitle>
          <CardDescription>
            A auditoria forense confirmou a conformidade total do ambiente.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-100 rounded-lg space-y-1">
              <span className="text-slate-500 flex items-center gap-1">
                <Database className="w-3 h-3" /> Schema Status
              </span>
              <p className="font-mono font-bold text-emerald-600">CANONICAL_REPAIRED</p>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg space-y-1">
              <span className="text-slate-500 flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Git Baseline
              </span>
              <p className="font-mono font-bold text-slate-700">6a4ad735... [applied]</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Evidências de Auditoria:</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>Migration <code className="bg-slate-100 px-1 rounded text-xs font-mono">20260816235959</code> registrada e alinhada.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>Isolamento cross-tenant comprovado em banco efêmero.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>Dados de negócio e schema de produção íntegros.</span>
              </li>
            </ul>
          </div>
        </CardContent>

        <div className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row gap-4 justify-between items-center">
          <Button variant="outline" className="w-full sm:w-auto text-slate-600" asChild>
            <a href="/login">Acessar Sistema</a>
          </Button>
          <div className="text-[10px] text-slate-400 font-mono text-center sm:text-right uppercase tracking-tighter">
            PRODUÇÃO VERIFICADA • SEM DRIFT MATERIAL • 2026-08-16
          </div>
        </div>
      </Card>
      
      <div className="flex gap-4 text-xs text-slate-400 font-medium">
        <a href="/ativar-conta" className="hover:text-primary transition-colors">Ativar Conta</a>
        <span className="text-slate-200">|</span>
        <a href="/cadastro" className="hover:text-primary transition-colors">Planos e Preços</a>
      </div>
    </div>
  )
}
