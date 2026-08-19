import { Icon } from "@/components/icons";
import type { UserRole } from "@/types/cargo";

const roles = [
  { id: "shipper" as const, label: "Отправитель", icon: "box" as const },
  { id: "carrier" as const, label: "Перевозчик", icon: "truck" as const },
  { id: "dispatcher" as const, label: "Диспетчер", icon: "chart" as const },
];

export function RoleSwitcher({ role, onChange }: { role: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <div className="role-switcher" aria-label="Выберите роль">
      {roles.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-pressed={role === item.id} className={role === item.id ? "active" : ""}>
          <Icon name={item.icon} className="size-4" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function MobileNavigation({ role, onChange }: { role: UserRole; onChange: (role: UserRole) => void }) {
  return <nav className="mobile-nav" aria-label="Основная навигация">{roles.map((item) => <button key={item.id} type="button" onClick={() => onChange(item.id)} className={role === item.id ? "active" : ""}><Icon name={item.icon} className="size-5"/><span>{item.label}</span></button>)}</nav>;
}

