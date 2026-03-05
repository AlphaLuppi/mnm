import { useDashboardData } from '../hooks/useDashboardData'
import { ProjectHealthSummary } from './ProjectHealthSummary'

export function CockpitDashboard() {
  const data = useDashboardData()

  return (
    <div
      role="region"
      aria-label="Cockpit Dashboard"
      className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-6 overflow-y-auto h-full"
    >
      <div className="col-span-full">
        <ProjectHealthSummary
          health={data.health}
          agents={data.agentsSummary}
          drifts={data.driftSummary}
          stories={data.storiesSummary}
        />
      </div>

      {/* Agent widget slot — Story 5.2 */}
      <div id="widget-agents" />

      {/* Drift widget slot — Story 5.2 */}
      <div id="widget-drift" />

      {/* Stories progress — Story 5.3, full width */}
      <div id="widget-stories" className="col-span-full" />
    </div>
  )
}
