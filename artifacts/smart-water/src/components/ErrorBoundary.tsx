import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white gap-6 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-4xl">
            💧
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              Tiara Manajemen Distribusi
            </h1>
            <p className="text-slate-400 text-sm mb-1">TIARA MANAJEMEN DISTRIBUSI · SPAM Aiq Bone</p>
            <p className="mt-4 text-red-400 text-sm font-mono bg-red-900/30 px-4 py-2 rounded-lg max-w-md">
              {this.state.error?.message ?? "Terjadi kesalahan yang tidak terduga."}
            </p>
          </div>
          <p className="text-slate-500 text-xs text-center max-w-sm">
            Kemungkinan backend API sedang tidak dapat dijangkau. Coba refresh halaman ini.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            Refresh Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
