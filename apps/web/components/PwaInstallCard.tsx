'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Info, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}


export function PwaInstallCard() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [wasInstalled, setWasInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateInstalledMode = () => setIsStandalone(displayMode.matches || Boolean((navigator as NavigatorWithStandalone).standalone));
    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
      setMessage('');
    };
    const handleAppInstalled = () => {
      setWasInstalled(true);
      setDeferredPrompt(null);
      setMessage('');
    };

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setIsSecureContext(window.isSecureContext);
    updateInstalledMode();
    displayMode.addEventListener('change', updateInstalledMode);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      displayMode.removeEventListener('change', updateInstalledMode);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt || installing) return;

    const installEvent = deferredPrompt;
    setDeferredPrompt(null);
    setInstalling(true);
    setMessage('');

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setMessage(choice.outcome === 'accepted'
        ? 'Permintaan pemasangan diterima. Lawn akan menampilkan status terpasang setelah browser mengonfirmasinya.'
        : 'Pemasangan dibatalkan. Anda tetap dapat membuka Lawn di tab browser.');
    } catch {
      setMessage('Browser tidak dapat memulai pemasangan. Coba menu browser atau panduan perangkat di bawah.');
    } finally {
      setInstalling(false);
    }
  }

  const isInstalled = isStandalone || wasInstalled;

  return (
    <section className="card mt-6" aria-labelledby="pwa-install-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-wash text-moss" aria-hidden="true">
          {isInstalled ? <Check className="size-5" /> : <Download className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pwa-install-title" className="font-semibold">{isInstalled ? 'Sudah terpasang' : 'Pasang Lawn di perangkat'}</h2>
          {isInstalled ? (
            <p className="mt-1 text-sm leading-6 text-muted">Lawn terbuka sebagai aplikasi terpasang. Tampilan standalone mengikuti dukungan perangkat dan browser.</p>
          ) : (
            <>
              <p className="mt-1 text-sm leading-6 text-muted">Akses Lawn dari layar utama dengan jendela aplikasi. Tab browser biasa tetap menampilkan chrome browser—Lawn tidak dapat memaksakan layar penuh dari tab.</p>
              {deferredPrompt ? (
                <button className="btn-primary mt-4" onClick={() => void install()} disabled={installing}>
                  <Download className="size-4" aria-hidden="true" />
                  {installing ? 'Membuka pemasangan…' : 'Install Lawn'}
                </button>
              ) : isIOS ? (
                <div className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm leading-6">
                  <p className="flex items-center gap-2 font-semibold text-ink"><Share className="size-4" aria-hidden="true" />iPhone atau iPad (Safari)</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                    <li>Buka halaman ini di Safari.</li>
                    <li>Ketuk tombol Bagikan (ikon kotak dengan panah ke atas).</li>
                    <li>Pilih <strong className="text-ink">Tambahkan ke Layar Utama</strong>, lalu konfirmasi.</li>
                  </ol>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm leading-6">
                  <p className="flex items-center gap-2 font-semibold text-ink"><Info className="size-4" aria-hidden="true" />Pemasangan melalui menu browser</p>
                  <p className="mt-2 text-muted">Jika browser mendukung pemasangan, buka menunya lalu pilih <strong className="text-ink">Install app</strong> atau <strong className="text-ink">Tambahkan ke layar utama</strong> (nama opsi dapat berbeda). Bila opsi tidak tersedia, gunakan browser yang mendukung instalasi PWA.</p>
                </div>
              )}
            </>
          )}
          {message ? <p className="mt-3 text-sm leading-6 text-muted" role="status">{message}</p> : null}
          {!isInstalled ? (
            <p className="mt-3 text-sm leading-6 text-muted">Pemasangan memerlukan browser yang mendukung PWA dan koneksi aman (HTTPS; localhost hanya untuk pengujian lokal).</p>
          ) : null}
          {!isInstalled && !isSecureContext ? (
            <p className="mt-2 text-sm leading-6 text-amber-800">Koneksi ini tidak aman untuk pemasangan PWA. Gunakan HTTPS, atau localhost untuk pengujian lokal.</p>
          ) : null}
          {process.env.NODE_ENV === 'development' ? (
            <p className="mt-3 text-sm leading-6 text-muted">Mode pengembangan: service worker sengaja tidak didaftarkan. Pengujian install di sini tidak berarti cache/offline PWA produksi aktif; verifikasi versi lengkap melalui deployment produksi HTTPS.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
