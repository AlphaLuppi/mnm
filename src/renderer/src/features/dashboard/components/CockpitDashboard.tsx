import { useDashboardData } from '../hooks/useDashboardData'
import { ProjectHealthSummary } from './ProjectHealthSummary'
import { AgentsSummaryWidget } from './AgentsSummaryWidget'
import { DriftSummaryWidget } from './DriftSummaryWidget'
import { StoriesProgress } from './StoriesProgress'

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

      <AgentsSummaryWidget />

      <DriftSummaryWidget />

      <div className="col-span-full">
        <StoriesProgress />
      </div>
    </div>
  )
}
