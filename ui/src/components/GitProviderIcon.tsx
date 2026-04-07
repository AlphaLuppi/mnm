import { Github, GitBranch } from "lucide-react";
import type { GitProviderType } from "@mnm/shared";

type IconProps = {
  className?: string;
};

// SVG inline pour les providers sans icone lucide native
function GitLabIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
    </svg>
  );
}

function BitbucketIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.878 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891L.778 1.213zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z"/>
    </svg>
  );
}

function AzureDevOpsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 17.182V6.727L6.545 0l3.273 1.636v3.273L16.364 3l7.636 2.727V18L16.364 21l-9.818-2.182v2.545L0 17.182zm16.364-1.091l4.363-1.273V8.182l-4.363-1.455v9.364zM2.182 15.818l4.364.818V7.364L2.182 8.727v7.091z"/>
    </svg>
  );
}

const PROVIDER_ICONS: Record<GitProviderType, React.FC<IconProps>> = {
  github: ({ className }) => <Github className={className} />,
  gitlab: GitLabIcon,
  bitbucket: BitbucketIcon,
  gitea: ({ className }) => <GitBranch className={className} />, // fallback
  azure_devops: AzureDevOpsIcon,
  generic: ({ className }) => <GitBranch className={className} />,
};

export function GitProviderIcon({
  provider,
  className,
}: {
  provider: GitProviderType | string;
  className?: string;
}) {
  const Icon = PROVIDER_ICONS[provider as GitProviderType] ?? PROVIDER_ICONS.generic;
  return <Icon className={className} />;
}
