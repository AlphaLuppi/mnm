"use client";

import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DiscoveredAgentType {
  id: string;
  name: string;
  description: string;
  source: string;
  category?: string;
}

interface AvailableAgentsProps {
  onLaunch: (agentType: string) => void;
}

export function AvailableAgents({ onLaunch }: AvailableAgentsProps) {
  const { data, isLoading } = useSWR<{ agentTypes: DiscoveredAgentType[] }>(
    "/api/discovery/agents",
    fetcher
  );

  const agentTypes = data?.agentTypes ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {agentTypes.map((type) => (
        <Card key={type.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">{type.name}</CardTitle>
            </div>
            <CardDescription className="text-xs">
              {type.description}
            </CardDescription>
            <Badge variant="secondary" className="w-fit text-xs">
              {type.source}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onLaunch(type.id)}
            >
              Launch
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
