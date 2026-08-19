import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import type { CarrierProfile } from "@/types/cargo";

const STORAGE_KEY = "nextstep-cargo.carrier-profile.v1";
const vehicleTypes = ["Газель", "Тент", "Фургон", "Рефрижератор", "Бортовой", "Другое"];

function getKazakhNationalDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (/^\s*\+7/.test(value) && digits.startsWith("7")) digits = digits.slice(1);
  else if (digits.length > 10 && (digits.startsWith("7") || digits.startsWith("8"))) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.slice(0, 10);
}

function formatKazakhPhone(value: string, preserveEmpty = false): string {
  const digits = getKazakhNationalDigits(value);
  if (!digits && preserveEmpty) return "";
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean);
  return `+7${groups.length ? ` ${groups.join(" ")}` : " "}`;
}

function normalizeVehiclePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9\s-]/g, "").replace(/\s+/g, " ").slice(0, 16);
}

function isValidProfile(value: unknown): value is CarrierProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<CarrierProfile>;
  return [profile.id, profile.name, profile.phone, profile.vehicleType, profile.vehiclePlate].every((field) => typeof field === "string" && field.trim().length > 0);
}

function createCarrierId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return `carrier-${[...values].map((value) => value.toString(16)).join("")}`;
  }
  return `carrier-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useCarrierProfile() {
  const [profile, setProfile] = useState<CarrierProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isValidProfile(parsed)) setProfile(parsed);
        }
      } catch {
        // A blocked or invalid localStorage entry falls back to profile setup.
      } finally { setReady(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function saveProfile(input: Omit<CarrierProfile, "id">): CarrierProfile {
    const nextProfile = { ...input, id: profile?.id ?? createCarrierId() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    return nextProfile;
  }

  return { profile, ready, saveProfile };
}

export function CarrierProfileForm({ profile, onSave, onCancel }: { profile: CarrierProfile | null; onSave: (input: Omit<CarrierProfile, "id">) => void; onCancel?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [vehiclePlate, setVehiclePlate] = useState(profile?.vehiclePlate ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const input = {
      name: String(values.get("name") ?? "").trim(),
      phone: formatKazakhPhone(phone).trim(),
      vehicleType: String(values.get("vehicleType") ?? "").trim(),
      vehiclePlate: normalizeVehiclePlate(vehiclePlate).trim(),
    };
    if (!input.name) return setError("Укажите имя перевозчика.");
    if (getKazakhNationalDigits(phone).length !== 10) return setError("Укажите номер телефона полностью: 10 цифр после +7.");
    if (!input.vehicleType) return setError("Выберите тип транспорта.");
    if (!input.vehiclePlate) return setError("Укажите государственный номер.");
    try { onSave(input); } catch { setError("Не удалось сохранить профиль в этом браузере. Проверьте настройки хранилища."); }
  }

  return <section className="profile-setup" aria-labelledby="carrier-profile-title"><div className="profile-setup-card"><div className="profile-setup-head"><span><Icon name="truck" className="size-6"/></span><div><p className="eyebrow">Локальный профиль · без авторизации</p><h1 id="carrier-profile-title">{profile ? "Изменить профиль" : "Профиль перевозчика"}</h1><p>Данные сохранятся только в этом браузере и будут записаны в принятые заказы.</p></div></div><form onSubmit={handleSubmit}><div className="form-grid"><label><span>Имя *</span><input name="name" required autoComplete="name" defaultValue={profile?.name ?? ""} placeholder="Например, Ерлан"/></label><label><span>Телефон *</span><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" value={phone} onFocus={() => { if (!phone) setPhone("+7 "); }} onChange={(event) => setPhone(formatKazakhPhone(event.target.value))} placeholder="+7 777 123 45 67"/></label><label><span>Тип транспорта *</span><select name="vehicleType" required defaultValue={profile?.vehicleType ?? ""}><option value="" disabled>Выберите транспорт</option>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Госномер *</span><input name="vehiclePlate" required inputMode="text" autoCapitalize="characters" autoComplete="off" value={vehiclePlate} onChange={(event) => setVehiclePlate(normalizeVehiclePlate(event.target.value))} onBlur={() => setVehiclePlate((current) => current.trim())} placeholder="123 ABC 12"/><small className="field-help">Например: 123 ABC 12</small></label></div>{error && <div className="inline-feedback error" role="status"><span>{error}</span></div>}<div className="profile-form-actions">{onCancel && <button type="button" className="secondary-button" onClick={onCancel}>Отмена</button>}<button type="submit" className="primary-button">Сохранить профиль <Icon name="arrow" className="size-4"/></button></div></form></div></section>;
}

export function CarrierProfileSummary({ profile, onEdit }: { profile: CarrierProfile; onEdit: () => void }) {
  return <aside className="carrier-profile-summary" aria-label="Текущий профиль перевозчика"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><div><strong>{profile.name}</strong><small>{profile.vehicleType} · {profile.vehiclePlate}</small></div><button type="button" onClick={onEdit}>Изменить профиль</button></aside>;
}
