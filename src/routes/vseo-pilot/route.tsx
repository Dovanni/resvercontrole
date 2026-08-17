import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { PilotBadge } from '@/components/vseo-pilot/PilotUI';

export const Route = createFileRoute('/vseo-pilot')({
  component: PilotLayout,
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' },
      { title: 'VSEO — VEJAMAIS ERP Organic SEO, Blog & Rich Snippet Manager v1.0' }

    ]
  })
});

function PilotLayout() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-50">
        <PilotBadge />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/vseo-pilot" className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white text-xs">V</span>
              VSEO Pilot
            </Link>
          </div>
          <nav className="flex gap-4">
            <Link to="/vseo-pilot" className="text-sm font-medium hover:text-primary transition-colors [&.active]:text-primary">
              Dashboard
            </Link>
            <Link to="/vseo-pilot/blog" className="text-sm font-medium hover:text-primary transition-colors [&.active]:text-primary">
              Blog Mocks
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
