import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trazabilidad - Frigorífico San Jacinto",
  description: "Sistema de trazabilidad y control de envíos de carne",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var p = new URLSearchParams(window.location.search);
                if (p.get('reset') === '1') {
                  var keys = [
                    'trazabilidad_new_records','trazabilidad_exp_edits','trazabilidad_exp_deleted',
                    'trazabilidad_exp_ingresos','trazabilidad_dep_edits','trazabilidad_dep_new_records',
                    'trazabilidad_dep_deleted','cruce_caliral_edits','trazabilidad_stock_data',
                    'trazabilidad_imported_batches','trazabilidad_recent_searches',
                    'trazabilidad_dep_imported','trazabilidad_exp_imported'
                  ];
                  keys.forEach(function(k){ localStorage.removeItem(k); });
                  window.history.replaceState({}, '', window.location.pathname);
                  window.location.reload();
                }
              } catch(e) {}
            })();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if(new URLSearchParams(window.location.search).get('reset')==='1'){window.__TRZ_RESET=1;}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                if (window.__TRZ_VER_CHECKED) return;
                window.__TRZ_VER_CHECKED = true;
                var links = document.querySelectorAll('script[src*="_next"]');
                var hashes = [];
                links.forEach(function(s){ var m = s.src.match(/[a-f0-9]{8,}/); if(m) hashes.push(m[0]); });
                var ver = hashes.join('_');
                var prev = sessionStorage.getItem('_trz_v');
                if (prev && prev !== ver) {
                  sessionStorage.setItem('_trz_v', ver);
                  window.location.reload(true);
                } else if (!prev) {
                  sessionStorage.setItem('_trz_v', ver);
                }
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton duration={3000} />
      </body>
    </html>
  );
}