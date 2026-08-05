'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, ApiError, Profile } from '@/lib/api';
import { Eye, EyeOff, CheckCircle2, Circle, Check, CircleX } from 'lucide-react';

type TabKey = 'profil' | 'keamanan' | 'alamat';

const PROVINCES = [
  { value: 'DKI Jakarta', label: 'DKI Jakarta' },
  { value: 'Jawa Barat', label: 'Jawa Barat' },
  { value: 'Banten', label: 'Banten' },
  { value: 'Jawa Timur', label: 'Jawa Timur' },
  { value: 'Jawa Tengah', label: 'Jawa Tengah' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+62[\s\-]?\d{3}[\s\-]?\d{3,4}[\s\-]?\d{3,4}$/;
const POSTAL_REGEX = /^\d{5}$/;

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('profil');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  /* ---- Tab 1: Profil ---- */
  const [formProfile, setFormProfile] = useState({ name: '', email: '', phone: '' });
  const [formProfileErrors, setFormProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  /* ---- Tab 2: Keamanan ---- */
  const [pwFields, setPwFields] = useState({ current: '', next: '', confirm: '' });
  const [pwVisible, setPwVisible] = useState<Record<string, boolean>>({});
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [savingPw, setSavingPw] = useState(false);

  /* ---- Tab 3: Alamat ---- */
  const [formAddress, setFormAddress] = useState({ address: '', city: '', postalCode: '', province: '' });
  const [formAddressErrors, setFormAddressErrors] = useState<Record<string, string>>({});
  const [savingAddress, setSavingAddress] = useState(false);

  /* ---- Toast ---- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (!user && !authLoading) {
      router.push('/auth/login?returnUrl=/profile');
    }
  }, [user, authLoading, router]);

  /* ---- Load profile ---- */
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res: any = await profileApi.get();
        const data: Profile = res?.data;
        setProfile(data);
        setFormProfile({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
        });
        setFormAddress({
          address: data.address || '',
          city: data.city || '',
          postalCode: data.postal_code || '',
          province: data.province || '',
        });
      } catch (err) {
        setToast({ message: 'Gagal memuat profil.', error: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  /* ---- Password live rules ---- */
  const pwRules = {
    length: pwFields.next.length >= 8,
    upper: /[A-Z]/.test(pwFields.next),
    number: /\d/.test(pwFields.next),
  };

  const togglePwVisibility = (key: string) => {
    setPwVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ---- Submit: Profil ---- */
  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!formProfile.name.trim()) errs.name = 'Nama lengkap wajib diisi';
    if (!EMAIL_REGEX.test(formProfile.email.trim())) errs.email = 'Format email tidak valid';
    if (!PHONE_REGEX.test(formProfile.phone.replace(/\s/g, ''))) errs.phone = 'Nomor telepon tidak valid. Gunakan format +62';
    setFormProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingProfile(true);
    try {
      const res: any = await profileApi.update({
        name: formProfile.name.trim(),
        email: formProfile.email.trim().toLowerCase(),
        phone: formProfile.phone.trim(),
      });
      setProfile(res?.data);
      setToast({ message: 'Profil berhasil diperbarui.' });
    } catch (err) {
      handleApiError(err, setFormProfileErrors, 'Gagal menyimpan profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  /* ---- Submit: Keamanan ---- */
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pwFields.current) errs.current = 'Password lama wajib diisi';
    if (pwFields.next.length < 8 || !/[A-Z]/.test(pwFields.next) || !/\d/.test(pwFields.next)) {
      errs.next = 'Password minimal 8 karakter, mengandung huruf besar dan angka';
    }
    if (pwFields.confirm !== pwFields.next || !pwFields.confirm) errs.confirm = 'Konfirmasi password tidak cocok';
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingPw(true);
    try {
      await profileApi.changePassword(pwFields.current, pwFields.next);
      setPwFields({ current: '', next: '', confirm: '' });
      setPwVisible({});
      setToast({ message: 'Password berhasil diubah.' });
    } catch (err) {
      handleApiError(err, setPwErrors, 'Gagal mengubah password.');
    } finally {
      setSavingPw(false);
    }
  };

  /* ---- Submit: Alamat ---- */
  const submitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!formAddress.address.trim()) errs.address = 'Alamat wajib diisi';
    if (!formAddress.city.trim()) errs.city = 'Kota wajib diisi';
    if (!POSTAL_REGEX.test(formAddress.postalCode.trim())) errs.postalCode = 'Kode pos harus 5 digit angka';
    if (!formAddress.province) errs.province = 'Provinsi wajib dipilih';
    setFormAddressErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingAddress(true);
    try {
      const res: any = await profileApi.update({
        address: formAddress.address.trim(),
        city: formAddress.city.trim(),
        postalCode: formAddress.postalCode.trim(),
        province: formAddress.province,
      });
      setProfile(res?.data);
      setToast({ message: 'Alamat pengiriman berhasil disimpan.' });
    } catch (err) {
      handleApiError(err, setFormAddressErrors, 'Gagal menyimpan alamat.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleApiError = (
    err: unknown,
    setErrors: (e: Record<string, string>) => void,
    fallback: string,
  ) => {
    if (err instanceof ApiError) {
      if (Array.isArray(err.errors) && err.errors.length > 0) {
        // Backend errors: [{ field, message }]
        const mapped: Record<string, string> = {};
        for (const item of err.errors as Array<{ field?: string; message?: string }>) {
          if (item && item.field) mapped[item.field] = item.message || '';
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
          return;
        }
      }
      setToast({ message: err.message || fallback, error: true });
      return;
    }
    setToast({ message: fallback, error: true });
  };

  if (authLoading) return null;

  if (!user) return null; // redirect handled in useEffect

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>

        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/">Beranda</Link> / <span>Profil</span>
        </nav>

        {/* Heading */}
        <div className="mb-3">
          <h1 style={{ marginBottom: '0.35rem' }}>Profil Saya</h1>
          <p className="text-muted" style={{ fontSize: '0.95rem' }}>
            Kelola data pribadi, keamanan, dan alamat pengiriman Anda.
          </p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs profile-tabs" role="tablist">
          {(['profil', 'keamanan', 'alamat'] as TabKey[]).map(tab => (
            <button
              key={tab}
              className={`auth-tab ${activeTab === tab ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'profil' ? 'Profil' : tab === 'keamanan' ? 'Keamanan' : 'Alamat'}
            </button>
          ))}
        </div>

        {/* ===== TAB 1: DATA PRIBADI ===== */}
        {activeTab === 'profil' && (
          <div className="tab-panel active card" style={{ padding: '1.5rem', borderTopLeftRadius: 0 }}>
            {loading ? (
              <div style={{ padding: '1rem 0' }}>
                <div className="ph-skeleton-block" style={{ height: '2.5rem', marginBottom: '1rem' }} />
                <div className="ph-skeleton-block" style={{ height: '2.5rem', marginBottom: '1rem' }} />
                <div className="ph-skeleton-block" style={{ height: '2.5rem' }} />
              </div>
            ) : (
              <form onSubmit={submitProfile} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="profil-nama">Nama Lengkap</label>
                  <input
                    className={`form-input ${formProfileErrors.name ? 'form-input-error' : ''}`}
                    type="text"
                    id="profil-nama"
                    value={formProfile.name}
                    onChange={e => { setFormProfile({ ...formProfile, name: e.target.value }); setFormProfileErrors({ ...formProfileErrors, name: '' }); }}
                  />
                  {formProfileErrors.name && <p className="form-error">{formProfileErrors.name}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profil-email">Email</label>
                  <input
                    className={`form-input ${formProfileErrors.email ? 'form-input-error' : ''}`}
                    type="email"
                    id="profil-email"
                    value={formProfile.email}
                    onChange={e => { setFormProfile({ ...formProfile, email: e.target.value }); setFormProfileErrors({ ...formProfileErrors, email: '' }); }}
                  />
                  {formProfileErrors.email && <p className="form-error">{formProfileErrors.email}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profil-telp">Nomor Telepon</label>
                  <input
                    className={`form-input ${formProfileErrors.phone ? 'form-input-error' : ''}`}
                    type="tel"
                    id="profil-telp"
                    placeholder="+62 8XX-XXXX-XXXX"
                    value={formProfile.phone}
                    onChange={e => { setFormProfile({ ...formProfile, phone: e.target.value }); setFormProfileErrors({ ...formProfileErrors, phone: '' }); }}
                  />
                  {formProfileErrors.phone && <p className="form-error">{formProfileErrors.phone}</p>}
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={savingProfile}>
                  <span className="btn-text">{savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  <span className="spinner" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* ===== TAB 2: GANTI PASSWORD ===== */}
        {activeTab === 'keamanan' && (
          <div className="tab-panel active card" style={{ padding: '1.5rem', borderTopLeftRadius: 0 }}>
            <form onSubmit={submitPassword} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="pw-lama">Password Lama</label>
                <div className="password-field-wrap">
                  <input
                    className={`form-input ${pwErrors.current ? 'form-input-error' : ''}`}
                    type={pwVisible.current ? 'text' : 'password'}
                    id="pw-lama"
                    placeholder="Masukkan password lama"
                    style={{ paddingRight: '2.5rem' }}
                    value={pwFields.current}
                    onChange={e => { setPwFields({ ...pwFields, current: e.target.value }); setPwErrors({ ...pwErrors, current: '' }); }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePwVisibility('current')}
                    aria-label="Tampilkan password"
                  >
                    {pwVisible.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {pwErrors.current && <p className="form-error">{pwErrors.current}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pw-baru">Password Baru</label>
                <div className="password-field-wrap">
                  <input
                    className={`form-input ${pwErrors.next ? 'form-input-error' : ''}`}
                    type={pwVisible.next ? 'text' : 'password'}
                    id="pw-baru"
                    placeholder="Min. 8 karakter"
                    style={{ paddingRight: '2.5rem' }}
                    value={pwFields.next}
                    onChange={e => { setPwFields({ ...pwFields, next: e.target.value }); setPwErrors({ ...pwErrors, next: '' }); }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePwVisibility('next')}
                    aria-label="Tampilkan password"
                  >
                    {pwVisible.next ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {pwErrors.next && <p className="form-error">{pwErrors.next}</p>}
                <ul className="password-rules">
                  <li className={pwRules.length ? 'met' : ''}>
                    {pwRules.length ? <Check size={14} /> : <Circle size={14} />}
                    Minimal 8 karakter
                  </li>
                  <li className={pwRules.upper ? 'met' : ''}>
                    {pwRules.upper ? <Check size={14} /> : <Circle size={14} />}
                    Mengandung huruf besar
                  </li>
                  <li className={pwRules.number ? 'met' : ''}>
                    {pwRules.number ? <Check size={14} /> : <Circle size={14} />}
                    Mengandung angka
                  </li>
                </ul>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pw-konfirmasi">Konfirmasi Password Baru</label>
                <div className="password-field-wrap">
                  <input
                    className={`form-input ${pwErrors.confirm ? 'form-input-error' : ''}`}
                    type={pwVisible.confirm ? 'text' : 'password'}
                    id="pw-konfirmasi"
                    placeholder="Ulangi password baru"
                    style={{ paddingRight: '2.5rem' }}
                    value={pwFields.confirm}
                    onChange={e => { setPwFields({ ...pwFields, confirm: e.target.value }); setPwErrors({ ...pwErrors, confirm: '' }); }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePwVisibility('confirm')}
                    aria-label="Tampilkan password"
                  >
                    {pwVisible.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {pwErrors.confirm && <p className="form-error">{pwErrors.confirm}</p>}
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={savingPw}>
                <span className="btn-text">{savingPw ? 'Menyimpan...' : 'Ubah Password'}</span>
                <span className="spinner" />
              </button>
            </form>
          </div>
        )}

        {/* ===== TAB 3: ALAMAT PENGIRIMAN ===== */}
        {activeTab === 'alamat' && (
          <div className="tab-panel active card" style={{ padding: '1.5rem', borderTopLeftRadius: 0 }}>
            {loading ? (
              <div style={{ padding: '1rem 0' }}>
                <div className="ph-skeleton-block" style={{ height: '2.5rem', marginBottom: '1rem' }} />
                <div className="ph-skeleton-block" style={{ height: '2.5rem', marginBottom: '1rem' }} />
                <div className="ph-skeleton-block" style={{ height: '2.5rem', marginBottom: '1rem' }} />
                <div className="ph-skeleton-block" style={{ height: '2.5rem' }} />
              </div>
            ) : (
              <form onSubmit={submitAddress} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="almt-alamat">Alamat Lengkap</label>
                  <input
                    className={`form-input ${formAddressErrors.address ? 'form-input-error' : ''}`}
                    type="text"
                    id="almt-alamat"
                    placeholder="Jalan, nomor, RT/RW"
                    value={formAddress.address}
                    onChange={e => { setFormAddress({ ...formAddress, address: e.target.value }); setFormAddressErrors({ ...formAddressErrors, address: '' }); }}
                  />
                  {formAddressErrors.address && <p className="form-error">{formAddressErrors.address}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="almt-kota">Kota</label>
                  <input
                    className={`form-input ${formAddressErrors.city ? 'form-input-error' : ''}`}
                    type="text"
                    id="almt-kota"
                    placeholder="Nama kota"
                    value={formAddress.city}
                    onChange={e => { setFormAddress({ ...formAddress, city: e.target.value }); setFormAddressErrors({ ...formAddressErrors, city: '' }); }}
                  />
                  {formAddressErrors.city && <p className="form-error">{formAddressErrors.city}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="almt-kodepos">Kode Pos</label>
                  <input
                    className={`form-input ${formAddressErrors.postalCode ? 'form-input-error' : ''}`}
                    type="text"
                    id="almt-kodepos"
                    placeholder="5 digit"
                    maxLength={5}
                    value={formAddress.postalCode}
                    onChange={e => { setFormAddress({ ...formAddress, postalCode: e.target.value }); setFormAddressErrors({ ...formAddressErrors, postalCode: '' }); }}
                  />
                  {formAddressErrors.postalCode && <p className="form-error">{formAddressErrors.postalCode}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="almt-provinsi">Provinsi</label>
                  <select
                    className={`form-input ${formAddressErrors.province ? 'form-input-error' : ''}`}
                    id="almt-provinsi"
                    value={formAddress.province}
                    onChange={e => { setFormAddress({ ...formAddress, province: e.target.value }); setFormAddressErrors({ ...formAddressErrors, province: '' }); }}
                  >
                    <option value="">Pilih provinsi</option>
                    {PROVINCES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {formAddressErrors.province && <p className="form-error">{formAddressErrors.province}</p>}
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={savingAddress}>
                  <span className="btn-text">{savingAddress ? 'Menyimpan...' : 'Simpan Alamat'}</span>
                  <span className="spinner" />
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.error ? 'toast-error' : 'toast-success'} profile-toast show`} role="alert" aria-live="polite">
          {toast.error ? <CircleX size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </main>
  );
}
