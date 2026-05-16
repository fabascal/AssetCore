import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { X, Upload, Trash2, Save, Lock, Sun, Moon, User } from "lucide-react";

type Theme = "light" | "dark";

type UserPreferencesProps = {
  isOpen: boolean;
  onClose: () => void;
  user: {
    fullName: string;
    email: string;
    roleName: string;
  };
  avatarUrl: string;
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  onSaveProfile: (payload: { fullName: string; email: string }) => Promise<void>;
  onChangePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  onChangeAvatar: (avatarUrl: string) => void;
};

export const UserPreferences = ({
  isOpen,
  onClose,
  user,
  avatarUrl,
  theme,
  onSetTheme,
  onSaveProfile,
  onChangePassword,
  onChangeAvatar,
}: UserPreferencesProps) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [newAvatarUrl, setNewAvatarUrl] = useState(avatarUrl);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFullName(user.fullName);
      setEmail(user.email);
      setNewAvatarUrl(avatarUrl);
      setProfileMessage("");
      setPasswordMessage("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }
  }, [isOpen, user.fullName, user.email, avatarUrl]);

  const initials = useMemo(
    () =>
      fullName
        .split(" ")
        .filter(Boolean)
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [fullName]
  );

  if (!isOpen) {
    return null;
  }

  const handleSaveProfile = async () => {
    setProfileMessage("");
    setSavingProfile(true);
    try {
      await onSaveProfile({ fullName, email });
      onChangeAvatar(newAvatarUrl.trim());
      setProfileMessage("Perfil actualizado correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible actualizar el perfil.";
      setProfileMessage(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    setProfileMessage("");
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileMessage("Selecciona una imagen válida para el avatar.");
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setProfileMessage("La imagen debe ser menor a 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setNewAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setNewAvatarUrl("");
  };

  const handleChangePassword = async () => {
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage("La confirmación de contraseña no coincide.");
      return;
    }

    setSavingPassword(true);
    try {
      await onChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage("Contraseña actualizada correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible cambiar la contraseña.";
      setPasswordMessage(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-xl animate-scale-in transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Perfil y Preferencias</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Administra tu nombre, correo, avatar, contraseña y tema.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-lighter dark:hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><User size={15} className="text-primary" /> Datos de usuario</h3>

            <div className="mt-4 flex items-center gap-3">
              {newAvatarUrl ? (
                <img
                  src={newAvatarUrl}
                  alt="Avatar de usuario"
                  className="h-14 w-14 rounded-full border border-border-light dark:border-border-dark object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-base font-semibold text-primary">
                  {initials || "U"}
                </div>
              )}
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Rol actual: <span className="font-medium text-slate-800 dark:text-slate-200">{user.roleName}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Nombre completo
                <input
                  value={fullName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Correo
                <input
                  type="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <div>
                <p className="mb-1 text-xs text-slate-700 dark:text-slate-300">Avatar (imagen)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition">
                    <Upload size={14} />
                    Subir imagen
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition"
                  >
                    <Trash2 size={14} />
                    Quitar avatar
                  </button>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">PNG/JPG hasta 2MB</span>
                </div>
              </div>

              <button
                type="button"
                disabled={savingProfile}
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
              >
                <Save size={14} />
                {savingProfile ? "Guardando..." : "Guardar perfil"}
              </button>

              {profileMessage ? <p className="text-xs text-slate-700 dark:text-slate-300">{profileMessage}</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Lock size={15} className="text-primary" /> Seguridad y tema</h3>

            <div className="mt-4">
              <p className="mb-2 text-xs text-slate-700 dark:text-slate-300">Tema</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSetTheme("light")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    theme === "light"
                      ? "bg-primary text-white"
                      : "border border-border-light dark:border-border-dark text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-lighter"
                  }`}
                >
                  <Sun size={14} />
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => onSetTheme("dark")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    theme === "dark"
                      ? "bg-primary text-white"
                      : "border border-border-light dark:border-border-dark text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-lighter"
                  }`}
                >
                  <Moon size={14} />
                  Oscuro
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Contraseña actual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Nueva contraseña
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Confirmar nueva contraseña
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <button
                type="button"
                disabled={savingPassword}
                onClick={handleChangePassword}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-surface-lighter disabled:opacity-60 transition"
              >
                <Lock size={14} />
                {savingPassword ? "Actualizando..." : "Cambiar contraseña"}
              </button>

              {passwordMessage ? <p className="text-xs text-slate-700 dark:text-slate-300">{passwordMessage}</p> : null}
            </div>
          </div>
        </div>

      </section>
    </div>
  );
};
