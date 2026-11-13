export function AdminSkeleton() {
  return (
    <div className="admin-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Cargando datos administrativos…</span>
      <div aria-hidden="true">
        <div className="admin-skeleton-heading admin-skeleton-shape" />
        <div className="admin-skeleton-metrics">
          {[0, 1, 2, 3].map((item) => <div className="admin-skeleton-metric" key={item}><div className="admin-skeleton-shape" /><div className="admin-skeleton-shape" /></div>)}
        </div>
        <div className="admin-skeleton-table">
          {[0, 1, 2, 3].map((item) => <div className="admin-skeleton-row" key={item}><div className="admin-skeleton-shape" /><div className="admin-skeleton-shape" /><div className="admin-skeleton-shape" /></div>)}
        </div>
        <div className="admin-skeleton-cards">
          {[0, 1, 2].map((item) => <div className="admin-skeleton-card" key={item}><div className="admin-skeleton-shape" /><div className="admin-skeleton-shape" /></div>)}
        </div>
      </div>
    </div>
  );
}
