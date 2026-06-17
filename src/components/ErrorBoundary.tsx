'use client';

import React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const errorMessage =
        this.state.error?.message || 'Ha ocurrido un error inesperado';
      const componentStack =
        this.state.errorInfo?.componentStack || '';

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
              <div>
                <h2 className="text-white font-semibold text-base">
                  Algo salió mal
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Se produjo un error en la aplicación
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                No se pudo cargar esta sección. Intente nuevamente o contacte al
                administrador si el problema persiste.
              </p>

              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>

              {/* Collapsible error details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                  aria-expanded={this.state.showDetails}
                  aria-label="Mostrar detalles del error"
                >
                  <span>Detalles del error</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {this.state.showDetails && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <p className="text-xs text-red-600 font-mono mb-2 break-words">
                      {errorMessage}
                    </p>
                    {componentStack && (
                      <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
