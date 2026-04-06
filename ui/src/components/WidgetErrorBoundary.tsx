import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WidgetErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-xs text-destructive">
            {this.state.error?.message ?? "Widget failed to render"}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RotateCw className="mr-1.5 h-3 w-3" />
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
