import { useEffect, useState } from "react";
import { Building2, Upload, Save } from "lucide-react";
import { api } from "../lib/api";
import { notify } from "../lib/toast";

type Company = {
  id?: number;
  name: string;
  rfc: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoData: string | null;
  logoMime: string | null;
};

const inputCls =
  "w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-1 ring-primary";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition";

export const CompanyConfigView = () => {
  const [company, setCompany] = useState<Company>({
    name: "",
    rfc: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    logoData: null,
    logoMime: null,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ company: Company | null }>("/itam-config/company")
      .then((res) => {
        if (res.data.company) setCompany(res.data.company);
      })
      .catch(() => notify.error("Empresa", "No se pudieron cargar los datos."))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify.error("Logo", "El logo no puede superar 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setCompany((c) => ({ ...c, logoData: base64, logoMime: file.type }));
    };
    reader.readAsDataURL(file);
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ company: Company }>("/itam-config/company", company);
      setCompany(res.data.company);
      notify.success("Empresa", "Datos de empresa guardados.");
    } catch {
      notify.error("Empresa", "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
        Cargando datos de empresa...
      </div>
    );
  }

  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Building2 size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Empresa</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Datos de la empresa para reportes y cartas responsivas.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-card space-y-5">
        {/* Header with save button */}
        <div className="flex justify-end">
          <button
            className={btnPrimary}
            disabled={saving || !company.name.trim()}
            onClick={saveCompany}
          >
            <Save size={15} /> {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark overflow-hidden">
            {company.logoData ? (
              <img
                src={`data:${company.logoMime};base64,${company.logoData}`}
                alt="Logo"
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <Building2 size={32} className="text-slate-300 dark:text-slate-600" />
            )}
          </div>
          <div>
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition">
              <Upload size={14} /> Subir logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
            <p className="mt-1 text-[11px] text-slate-400">PNG, JPG o SVG. Max 2 MB.</p>
            {company.logoData && (
              <button
                type="button"
                onClick={() => setCompany((c) => ({ ...c, logoData: null, logoMime: null }))}
                className="mt-1 text-[11px] text-red-500 hover:underline"
              >
                Quitar logo
              </button>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700 dark:text-slate-300">Nombre de la empresa *</span>
            <input
              className={inputCls}
              value={company.name}
              onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700 dark:text-slate-300">RFC</span>
            <input
              className={inputCls}
              value={company.rfc ?? ""}
              onChange={(e) => setCompany((c) => ({ ...c, rfc: e.target.value || null }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-slate-700 dark:text-slate-300">Dirección</span>
            <input
              className={inputCls}
              value={company.address ?? ""}
              onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value || null }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700 dark:text-slate-300">Teléfono</span>
            <input
              className={inputCls}
              value={company.phone ?? ""}
              onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value || null }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700 dark:text-slate-300">Correo</span>
            <input
              type="email"
              className={inputCls}
              value={company.email ?? ""}
              onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value || null }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700 dark:text-slate-300">Sitio web</span>
            <input
              className={inputCls}
              value={company.website ?? ""}
              onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value || null }))}
            />
          </label>
        </div>
      </div>
    </section>
  );
};
